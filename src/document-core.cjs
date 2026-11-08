const sharp=require('sharp');
function orderCorners(points){
 const byY=[...points].sort((a,b)=>a.y-b.y),top=byY.slice(0,2).sort((a,b)=>a.x-b.x),bottom=byY.slice(2).sort((a,b)=>a.x-b.x);
 return [top[0],top[1],bottom[1],bottom[0]];
}
async function enhanceDocument(buffer,colorMode='RGB24'){
 let image=await sharp(buffer,{limitInputPixels:40000000}).rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const cv=await require('@techstark/opencv-js');
 const small=await sharp(image.data,{raw:image.info}).resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).raw().toBuffer({resolveWithObject:true});
 const mats=[],keep=mat=>{mats.push(mat);return mat;};let cropped=false;
 try{
  const src=keep(new cv.Mat(small.info.height,small.info.width,cv.CV_8UC3));src.data.set(small.data);
  const gray=keep(new cv.Mat()),blur=keep(new cv.Mat()),edges=keep(new cv.Mat()),closed=keep(new cv.Mat());
  cv.cvtColor(src,gray,cv.COLOR_RGB2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);cv.Canny(blur,edges,40,120);
  const kernel=keep(cv.Mat.ones(5,5,cv.CV_8U));cv.morphologyEx(edges,closed,cv.MORPH_CLOSE,kernel);
  const contours=keep(new cv.MatVector()),hierarchy=keep(new cv.Mat());cv.findContours(closed,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
  let best=null,score=0;const total=small.info.width*small.info.height;
  for(let i=0;i<contours.size();i++){
   const contour=contours.get(i),approx=new cv.Mat();
   try{
    cv.approxPolyDP(contour,approx,0.025*cv.arcLength(contour,true),true);
    const area=Math.abs(cv.contourArea(approx));
    if(approx.rows!==4||area<total*.2||area>total*.97||!cv.isContourConvex(approx))continue;
    const points=[];for(let j=0;j<4;j++)points.push({x:approx.data32S[j*2],y:approx.data32S[j*2+1]});
    const ordered=orderCorners(points),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const width=(distance(ordered[0],ordered[1])+distance(ordered[2],ordered[3]))/2,height=(distance(ordered[0],ordered[3])+distance(ordered[1],ordered[2]))/2;
    if(width/height<.35||width/height>2.8||Math.min(width,height)<120)continue;
    if(area>score){score=area;best=ordered;}
   }finally{contour.delete();approx.delete();}
  }
  if(best){
   const sx=image.info.width/small.info.width,sy=image.info.height/small.info.height,points=best.map(p=>({x:p.x*sx,y:p.y*sy}));
   const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),width=Math.round(Math.max(dist(points[0],points[1]),dist(points[2],points[3]))),height=Math.round(Math.max(dist(points[0],points[3]),dist(points[1],points[2])));
   const full=keep(new cv.Mat(image.info.height,image.info.width,cv.CV_8UC3));full.data.set(image.data);
   const from=keep(cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]))),to=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width-1,0,width-1,height-1,0,height-1]));
   const transform=keep(cv.getPerspectiveTransform(from,to)),warped=keep(new cv.Mat());cv.warpPerspective(full,warped,transform,new cv.Size(width,height),cv.INTER_CUBIC,cv.BORDER_REPLICATE);
   image={data:Buffer.from(warped.data),info:{width,height,channels:3}};cropped=true;
  }
 }finally{for(const mat of mats.reverse())mat.delete();}
 const gray=await sharp(image.data,{raw:image.info}).greyscale().raw().toBuffer();
 const background=await sharp(gray,{raw:{width:image.info.width,height:image.info.height,channels:1}}).blur(Math.max(10,Math.min(image.info.width,image.info.height)/35)).raw().toBuffer();
 const corrected=Buffer.alloc(image.data.length);
 for(let p=0;p<gray.length;p++){const gain=238/Math.max(30,background[p]);for(let c=0;c<3;c++)corrected[p*3+c]=Math.max(0,Math.min(255,Math.round(image.data[p*3+c]*gain)));}
 let output=sharp(corrected,{raw:image.info}).normalize({lower:1,upper:99}).sharpen({sigma:.5});
 if(colorMode==='Grayscale8')output=output.greyscale();
 if(colorMode==='BlackAndWhite1')output=output.threshold(160);
 return {image:await output.jpeg({quality:95,mozjpeg:true}).toBuffer(),cropped};
}
async function recognizeDocument(image,dpi=300){
 const {createWorker,PSM}=require('tesseract.js'),language=require('@tesseract.js-data/por');
 const worker=await createWorker('por',1,{langPath:language.langPath,gzip:true,cacheMethod:'none'});
 try{
  await worker.setParameters({user_defined_dpi:String(dpi),tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1'});
  const {data}=await worker.recognize(image,{pdfTitle:'CotrimScan - Documento pesquisavel'},{text:true,pdf:true});
  return {pdf:Buffer.from(data.pdf),text:data.text.trim(),confidence:data.confidence};
 }finally{await worker.terminate();}
}
async function processDocument(buffer,{enhance=true,ocr=true,colorMode='RGB24',dpi=300}={}){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>30*1024*1024)throw Error('Documento inválido ou maior que 30 MB.');
 if(!['RGB24','Grayscale8','BlackAndWhite1'].includes(colorMode)||![150,300,600].includes(dpi))throw Error('Configuração do documento inválida.');
 const metadata=await sharp(buffer,{limitInputPixels:40000000}).metadata();if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages||1)>1)throw Error('Formato de imagem não suportado.');
 const original=await sharp(buffer,{limitInputPixels:40000000}).rotate().flatten({background:'#fff'}).jpeg({quality:95}).toBuffer();
 let image=original,cropped=false;
 if(enhance)({image,cropped}=await enhanceDocument(original,colorMode));
 else {let pipeline=sharp(original);if(colorMode==='Grayscale8')pipeline=pipeline.greyscale();if(colorMode==='BlackAndWhite1')pipeline=pipeline.threshold(160);image=await pipeline.jpeg({quality:95}).toBuffer();}
 let pdf=null,text='',confidence=0,warning='';
 if(ocr){
  try{({pdf,text,confidence}=await recognizeDocument(image,dpi));if(!text||confidence<50)warning='O texto reconhecido tem baixa confiança. Revise a leitura e, se necessário, tire outra foto.';}
  catch{warning='Não foi possível reconhecer o texto. A imagem foi preservada; tente o OCR novamente.';}
 }
 if(enhance&&!cropped)warning=[warning,'Contorno da folha não identificado com segurança; o enquadramento original foi mantido.'].filter(Boolean).join(' ');
 return {image,original,pdf,text,info:{enhanced:!!enhance,cropped,hasText:!!text,confidence,warning}};
}
module.exports={processDocument,enhanceDocument,recognizeDocument,orderCorners};
