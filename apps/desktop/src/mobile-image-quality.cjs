const sharp=require('sharp');
const {MODES,scanMode}=require('./mobile-image-modes.cjs');
const clamp=value=>Math.max(0,Math.min(255,Math.round(value)));
const median=values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)]||0;};

// Geometry is handled by jscanify before this stage. Only luminance is
// equalized; saturated ink is excluded from paper white-balance estimates.
async function improvePaper(buffer,mode='auto'){
 mode=scanMode(mode);
 const cv=await require('@techstark/opencv-js');
 const raw=await sharp(buffer,{limitInputPixels:40000000}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const {width,height}=raw.info,mats=[],keep=m=>{mats.push(m);return m;};
 try{
  const rgb=keep(cv.matFromArray(height,width,cv.CV_8UC3,raw.data)),lab=keep(new cv.Mat());cv.cvtColor(rgb,lab,cv.COLOR_RGB2Lab);
  const channels=keep(new cv.MatVector());cv.split(lab,channels);
  const light=keep(channels.get(0)),a=keep(channels.get(1)),b=keep(channels.get(2));
  const scale=Math.min(1,700/Math.max(width,height)),small=keep(new cv.Mat());
  cv.resize(light,small,new cv.Size(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))),0,0,cv.INTER_AREA);
  // Closing removes dark print from the illumination estimate. A broad blur
  // then follows shadows without producing halos around individual letters.
  const size=Math.max(3,Math.min(21,(Math.round(Math.min(small.cols,small.rows)/45)|1)));
  const kernel=keep(cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(size,size))),closed=keep(new cv.Mat()),smooth=keep(new cv.Mat()),background=keep(new cv.Mat());
  cv.morphologyEx(small,closed,cv.MORPH_CLOSE,kernel);
  cv.GaussianBlur(closed,smooth,new cv.Size(0,0),Math.max(2,size/3));
  cv.resize(smooth,background,new cv.Size(width,height),0,0,cv.INTER_LINEAR);
  // Cache typed views in pixel loops; OpenCV getters allocate new wrappers.
  // Reacquire them after OpenCV allocations, which can grow the WASM heap.
  let lightData=light.data,aData=a.data,bData=b.data,backgroundData=background.data;
  const paperA=[],paperB=[];let count=0,sampled=0;
  const stride=Math.max(1,Math.floor(Math.sqrt(width*height/30000)));
  for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
   const i=y*width+x,L=lightData[i],bg=backgroundData[i],ca=aData[i]-128,cb=bData[i]-128;sampled++;
   if(L>105&&L>bg*.9&&Math.abs(ca)<14&&cb>-14&&cb<35){paperA.push(ca);paperB.push(cb);count++;}
  }
  // Photos/solid colors without paper evidence retain their color and texture.
  const hasPaper=count/Math.max(1,sampled)>.25;
  const offsetA=hasPaper?median(paperA):0,offsetB=hasPaper?median(paperB):0;
  const corrected=keep(new cv.Mat(height,width,cv.CV_8UC1));
  lightData=light.data;aData=a.data;bData=b.data;backgroundData=background.data;
  let correctedData=corrected.data;
  for(let i=0;i<lightData.length;i++){
   const L=lightData[i],bg=Math.max(70,backgroundData[i]);
   const target=mode==='color'?243:248;
   const chromaDistance=Math.hypot(aData[i]-128-offsetA,bData[i]-128-offsetB);
   const normalized=L>250&&bg>248?L:chromaDistance>18?Math.min(L+12,L*Math.min(1.2,target/bg)):L*Math.min(2.5,target/bg);
   const strength=hasPaper?(mode==='color'?.68:1):0;
   correctedData[i]=clamp(L+(normalized-L)*strength);
  }
  // Blend a weak edge-preserving filter only on near-flat neighborhoods.
  const denoised=keep(new cv.Mat());cv.bilateralFilter(corrected,denoised,3,7,2);
  correctedData=corrected.data;
  const denoisedData=denoised.data;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   const i=y*width+x,edge=Math.max(Math.abs(correctedData[i]-correctedData[i-1]),Math.abs(correctedData[i]-correctedData[i+1]),Math.abs(correctedData[i]-correctedData[i-width]),Math.abs(correctedData[i]-correctedData[i+width]));
   if(edge<10)correctedData[i]=clamp(correctedData[i]*.8+denoisedData[i]*.2);
  }
  const local=keep(new cv.Mat()),clahe=keep(new cv.CLAHE(1.4,new cv.Size(8,8)));clahe.apply(corrected,local);
  lightData=light.data;aData=a.data;bData=b.data;backgroundData=background.data;correctedData=corrected.data;
  const localData=local.data;
  for(let i=0;i<lightData.length;i++){
   const originalL=lightData[i],L=correctedData[i],blend=hasPaper?(mode==='color'?.08:.14):0;
   // CLAHE must not turn the corrected white background gray again.
   lightData[i]=clamp(L+(localData[i]-L)*blend*(L>238?.2:1));
   if(mode==='auto'&&hasPaper){
    const deviation=Math.hypot(aData[i]-128-offsetA,bData[i]-128-offsetB);
    const neutral=Math.max(0,Math.min(1,1-deviation/18));
    const detail=Math.max(0,backgroundData[i]-originalL);
    const paperWeight=L>210&&deviation<12?Math.max(0,1-detail/14)**2*.85:0;
    lightData[i]=clamp(lightData[i]+Math.max(0,253-lightData[i])*paperWeight);
    aData[i]=clamp(aData[i]-offsetA*neutral*.95);
    bData[i]=clamp(bData[i]-offsetB*neutral*.95);
   }
  }
  if(mode==='bw'){
   const binary=keep(new cv.Mat()),block=Math.max(3,Math.min(71,(Math.round(Math.min(width,height)/35)|1)));
   cv.adaptiveThreshold(denoised,binary,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY,block,13);
   return {image:await sharp(Buffer.from(binary.data),{raw:{width,height,channels:1}}).png().toBuffer(),mode,hasPaper};
  }
  let pipeline;
  if(mode==='gray')pipeline=sharp(Buffer.from(lightData),{raw:{width,height,channels:1}});
  else{
   const merged=keep(new cv.MatVector());merged.push_back(light);merged.push_back(a);merged.push_back(b);
   const resultLab=keep(new cv.Mat()),resultRgb=keep(new cv.Mat());cv.merge(merged,resultLab);cv.cvtColor(resultLab,resultRgb,cv.COLOR_Lab2RGB);
   pipeline=sharp(Buffer.from(resultRgb.data),{raw:{width,height,channels:3}});
  }
  return {image:await pipeline.sharpen({sigma:.45,m1:.25,m2:.6,x1:2,y2:3,y3:3}).png().toBuffer(),mode,hasPaper};
 }finally{for(const mat of mats.reverse())mat.delete();}
}

async function processScan(buffer,{mode='auto',corners,detect=true,documentType='document',dpi=300}={}){
 mode=scanMode(mode);
 documentType=require('./mobile-image-modes.cjs').documentType(documentType);
 if(![150,300,600].includes(dpi))throw Error('Resolução inválida para o recorte.');
 const original=await sharp(buffer,{limitInputPixels:40000000,failOn:'warning'}).rotate().flatten({background:'#fff'}).toColourspace('srgb').png().toBuffer();
 const geometry=require('./mobile-image-enhance.cjs');
 let framed=corners?await geometry.cropPhoto(original,corners,{minArea:documentType==='receipt'?.005:.05}):detect?await geometry.enhancePhoto(original,{documentType}):original;
 let cropMethod=framed.equals(original)?null:'outline';
 if(documentType==='receipt'&&detect&&!corners&&!cropMethod){
  framed=await require('./mobile-image-receipts.cjs').cropReceiptContent(original,{dpi});
  if(!framed.equals(original))cropMethod='content';
 }
 const result=await improvePaper(framed,mode);
 const image=await sharp(result.image).jpeg({quality:97,chromaSubsampling:'4:4:4'}).toBuffer();
 if(image.length>30*1024*1024)throw Error('Imagem processada excede 30 MB.');
 return {image,cropped:!!cropMethod,cropMethod,mode,hasPaper:result.hasPaper};
}
module.exports={improvePaper,processScan,scanMode,MODES};
