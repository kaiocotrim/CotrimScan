const sharp=require('sharp');
function orderCorners(points){
 const byY=[...points].sort((a,b)=>a.y-b.y),top=byY.slice(0,2).sort((a,b)=>a.x-b.x),bottom=byY.slice(2).sort((a,b)=>a.x-b.x);
 return [top[0],top[1],bottom[1],bottom[0]];
}
async function enhanceDocument(buffer,colorMode='RGB24'){
 const mode=require('./mobile-image-modes.cjs').scanMode(undefined,colorMode);
 return require('./mobile-image-quality.cjs').processScan(buffer,{mode});
}

async function recognizeDocument(image,dpi=300){
 const {createWorker,PSM}=require('tesseract.js'),language=require('@tesseract.js-data/por');
 const worker=await createWorker('por',1,{langPath:language.langPath,gzip:true,cacheMethod:'none'});
 try{
  await worker.setParameters({user_defined_dpi:String(dpi),tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1'});
  const {data}=await worker.recognize(image,{pdfTitle:'CotrimScan - Documento pesquisavel',pdfTextOnly:true},{text:true,pdf:true});
  const {PDFDocument}=require('pdf-lib'),doc=await PDFDocument.load(Buffer.from(data.pdf));
  const embedded=await doc.embedJpg(image);
  const page=doc.getPages()[0],{width,height}=page.getSize();page.drawImage(embedded,{x:0,y:0,width,height});
  return {pdf:Buffer.from(await doc.save({useObjectStreams:false})),text:data.text.trim(),confidence:data.confidence};
 }finally{await worker.terminate();}
}
async function processDocument(buffer,{enhance=true,ocr=true,colorMode='RGB24',dpi=300}={}){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>30*1024*1024)throw Error('Documento inválido ou maior que 30 MB.');
 if(!['RGB24','Grayscale8','BlackAndWhite1'].includes(colorMode)||![150,300,600].includes(dpi))throw Error('Configuração do documento inválida.');
 const metadata=await sharp(buffer,{limitInputPixels:40000000}).metadata();if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages||1)>1)throw Error('Formato de imagem não suportado.');
 const original=metadata.format==='jpeg'&&!metadata.orientation?buffer:await sharp(buffer,{limitInputPixels:40000000}).rotate().flatten({background:'#fff'}).jpeg({quality:97,chromaSubsampling:'4:4:4'}).toBuffer();
 let image=original,cropped=false;
 if(enhance)({image,cropped}=await enhanceDocument(original,colorMode));

 let pdf=null,text='',confidence=0,warning='';
 if(ocr){
  try{({pdf,text,confidence}=await recognizeDocument(image,dpi));if(!text||confidence<50)warning='O texto reconhecido tem baixa confiança. Revise a leitura e, se necessário, tire outra foto.';}
  catch{warning='Não foi possível reconhecer o texto. A imagem foi preservada; tente o OCR novamente.';}
 }
 if(enhance&&!cropped)warning=[warning,'Contorno da folha não identificado com segurança; o enquadramento original foi mantido.'].filter(Boolean).join(' ');
 return {image,original,pdf,text,info:{enhanced:!!enhance,cropped,hasText:!!text,confidence,warning}};
}
module.exports={processDocument,enhanceDocument,recognizeDocument,orderCorners};
