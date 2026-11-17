const sharp=require('sharp');
// jscanify's contour API works on OpenCV matrices without browser canvas bindings.
async function enhancePhoto(buffer,{documentType='document'}={}){
 documentType=require('./mobile-image-modes.cjs').documentType(documentType);
 const receipt=documentType==='receipt';
 const cv=await require('@techstark/opencv-js');globalThis.cv=cv;
 const Scanner=require('jscanify/client'),scanner=new Scanner();
 const small=await sharp(buffer).resize({width:800,height:800,fit:'inside',withoutEnlargement:true}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 if(receipt&&require('./mobile-image-receipts.cjs').whiteScannerCanvas(small.data,small.info.width,small.info.height))return buffer;
 const mats=[],keep=m=>{mats.push(m);return m;};let best=null,bestScore=0;
 try{
  const rgb=keep(new cv.Mat(small.info.height,small.info.width,cv.CV_8UC3));rgb.data.set(small.data);
  const gray=keep(new cv.Mat());cv.cvtColor(rgb,gray,cv.COLOR_RGB2GRAY);
  const total=rgb.rows*rgb.cols;
  function consider(contour){
   const area=Math.abs(cv.contourArea(contour));if(area<total*(receipt?.015:.25)||area>total*.985)return;
   for(const epsilon of [.015,.025,.04]){
    const approx=new cv.Mat();
    try{
     cv.approxPolyDP(contour,approx,epsilon*cv.arcLength(contour,true),true);
     if(approx.rows!==4||!cv.isContourConvex(approx))continue;
     const c=scanner.getCornerPoints(approx),points=[c.topLeftCorner,c.topRightCorner,c.bottomRightCorner,c.bottomLeftCorner];
     if(points.some(p=>!p))continue;
     const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
     const width=(d(points[0],points[1])+d(points[2],points[3]))/2,height=(d(points[0],points[3])+d(points[1],points[2]))/2;
     if(Math.min(width,height)<(receipt?25:100)||width/height<(receipt?.08:.35)||width/height>(receipt?12:2.8))continue;
     const quad=Math.abs(cv.contourArea(approx)),fill=Math.min(1,area/quad);
     if(fill<.85)continue;
     const atBorder=points.filter(p=>p.x<2||p.y<2||p.x>rgb.cols-3||p.y>rgb.rows-3).length;
     if(atBorder===4)continue;
     const score=quad*fill*(1-atBorder*.025);
     if(score>bestScore){bestScore=score;best=points.map(p=>({x:p.x/(rgb.cols-1),y:p.y/(rgb.rows-1)}));}
    }finally{approx.delete();}
   }
  }
  const primary=scanner.findPaperContour(gray);if(primary){try{consider(primary);}finally{primary.delete();}}
  function contours(mask){
   const list=new cv.MatVector(),hierarchy=new cv.Mat();
   try{cv.findContours(mask,list,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);for(let i=0;i<list.size();i++){const c=list.get(i);try{consider(c);}finally{c.delete();}}}
   finally{list.delete();hierarchy.delete();}
  }
  const edges=keep(new cv.Mat()),kernel=keep(cv.Mat.ones(5,5,cv.CV_8U));
  cv.GaussianBlur(gray,edges,new cv.Size(5,5),0);cv.Canny(edges,edges,35,110);cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);contours(edges);
  const hsv=keep(new cv.Mat());cv.cvtColor(rgb,hsv,cv.COLOR_RGB2HSV);
  for(const saturation of [35,65]){
   const low=keep(new cv.Mat(rgb.rows,rgb.cols,hsv.type(),[0,0,100,0])),high=keep(new cv.Mat(rgb.rows,rgb.cols,hsv.type(),[180,saturation,255,255])),mask=keep(new cv.Mat());
   cv.inRange(hsv,low,high,mask);cv.morphologyEx(mask,mask,cv.MORPH_OPEN,kernel);cv.morphologyEx(mask,mask,cv.MORPH_CLOSE,kernel);contours(mask);
  }
 }finally{for(const mat of mats.reverse())mat.delete();}
 if(!best){
  if(receipt)return buffer;
  // A tightly framed sheet may touch every edge and have no closed quadrilateral.
  let center=0,paper=0,border=0,background=0;
  for(let y=0;y<small.info.height;y+=4)for(let x=0;x<small.info.width;x+=4){
   const i=(y*small.info.width+x)*3,r=small.data[i],g=small.data[i+1],b=small.data[i+2],light=(r+g+b)/3,chroma=Math.max(r,g,b)-Math.min(r,g,b);
   if(x>small.info.width*.25&&x<small.info.width*.75&&y>small.info.height*.15&&y<small.info.height*.85){center++;if(light>110&&chroma<65)paper++;}
   if(x<small.info.width*.06||x>small.info.width*.94||y<small.info.height*.04||y>small.info.height*.96){border++;if(light<95||chroma>65)background++;}
  }
  if(paper/center>.6&&background/border>.025)return await separatePaper(buffer,small,cv,scanner)||buffer;
  return buffer;
 }
 // Refine large, border-touching sheets to separate keyboards, desks and hands.
 if(!receipt&&best.some(p=>p.x<.01||p.y<.01||p.x>.99||p.y>.99)){
  const refined=await separatePaper(buffer,small,cv,scanner);
  if(refined)return refined;
 }
 return cropPhoto(buffer,best,{minArea:receipt?.005:.05});
}

async function separatePaper(buffer,small,cv,scanner){
 const w=small.info.width,h=small.info.height,mats=[],keep=m=>{mats.push(m);return m;};
 try{
  const src=keep(cv.matFromArray(h,w,cv.CV_8UC3,small.data)),mask=keep(new cv.Mat(h,w,cv.CV_8UC1));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let label=cv.GC_PR_FGD;
   if(x<w*.03||x>w*.96||y<h*.015||y>h*.99)label=cv.GC_PR_BGD;
   const pixel=(y*w+x)*3,r=small.data[pixel],g=small.data[pixel+1],b=small.data[pixel+2];
   const nearEdge=x<w*.08||x>w*.9||y<h*.06||y>h*.94;
   if(nearEdge&&((r+g+b)/3<100||Math.max(r,g,b)-Math.min(r,g,b)>65))label=cv.GC_BGD;
   if(x>w*.25&&x<w*.7&&y>h*.12&&y<h*.9)label=cv.GC_FGD;
   mask.ucharPtr(y,x)[0]=label;
  }
  const bg=keep(new cv.Mat()),fg=keep(new cv.Mat());cv.grabCut(src,mask,new cv.Rect(),bg,fg,4,cv.GC_INIT_WITH_MASK);
  for(let i=0;i<w*h;i++)mask.data[i]=(mask.data[i]&1)?255:0;
  const contours=keep(new cv.MatVector()),hierarchy=keep(new cv.Mat());cv.findContours(mask,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
  let best=null,area=0,index=-1;
  for(let i=0;i<contours.size();i++){const c=contours.get(i),a=cv.contourArea(c);if(a>area){best?.delete();best=c;area=a;index=i;}else c.delete();}
  if(!best)return null;keep(best);
  if(area<w*h*.45||area>w*h*.985)return null;
  const c=scanner.getCornerPoints(best),points=[c.topLeftCorner,c.topRightCorner,c.bottomRightCorner,c.bottomLeftCorner];
  if(points.some(p=>!p))return null;
  // Fill the external outline so printed letters and signatures never become holes.
  const filled=keep(cv.Mat.zeros(h,w,cv.CV_8UC1));cv.drawContours(filled,contours,index,new cv.Scalar(255),-1);
  const dimensions=await sharp(buffer).metadata();
  const alpha=await sharp(Buffer.from(filled.data),{raw:{width:w,height:h,channels:1}}).resize(dimensions.width,dimensions.height,{kernel:'cubic'}).greyscale().raw().toBuffer();
  const rgb=await sharp(buffer).removeAlpha().png().toBuffer();
  const rgba=await sharp(rgb).joinChannel(alpha,{raw:{width:dimensions.width,height:dimensions.height,channels:1}}).png().toBuffer();
  const paper=await sharp(rgba).flatten({background:'#fff'}).png().toBuffer();
  return cropPhoto(paper,points.map(p=>({x:p.x/(w-1),y:p.y/(h-1)})));
 }finally{for(const m of mats.reverse())m.delete();}
}

async function cropPhoto(buffer,corners,{minArea=.05}={}){
 if(!Array.isArray(corners)||corners.length!==4||corners.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))throw Error('Marque os quatro cantos da folha.');
 let area=0;
 for(let i=0;i<4;i++){
  const a=corners[i],b=corners[(i+1)%4],c=corners[(i+2)%4];
  if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<=0)throw Error('Os cantos devem formar uma folha sem cruzar as linhas.');
  area+=a.x*b.y-b.x*a.y;
 }
 if(area/2<minArea)throw Error('A área marcada é muito pequena.');
 const cv=await require('@techstark/opencv-js');
 const raw=await sharp(buffer).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const points=corners.map(p=>({x:p.x*(raw.info.width-1),y:p.y*(raw.info.height-1)}));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const width=Math.round(Math.max(distance(points[0],points[1]),distance(points[2],points[3]))),height=Math.round(Math.max(distance(points[0],points[3]),distance(points[1],points[2])));
 if(Math.min(width,height)<50)throw Error('A área marcada é muito pequena.');
 const mats=[],keep=m=>{mats.push(m);return m;};
 try{
  const src=keep(new cv.Mat(raw.info.height,raw.info.width,cv.CV_8UC3));src.data.set(raw.data);
  const from=keep(cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]))),to=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width-1,0,width-1,height-1,0,height-1]));
  const transform=keep(cv.getPerspectiveTransform(from,to)),dst=keep(new cv.Mat());
  cv.warpPerspective(src,dst,transform,new cv.Size(width,height),cv.INTER_CUBIC,cv.BORDER_REPLICATE);
  return await sharp(Buffer.from(dst.data),{raw:{width,height,channels:3}}).png().toBuffer();
 }finally{for(const m of mats.reverse())m.delete();}
}
module.exports={enhancePhoto,cropPhoto};
