const sharp=require('sharp'),g=require('./document-zone-geometry.cjs');
async function cropPolygon(image,points,width,height){
 const meta=await sharp(image).metadata(),pixels=points.map(p=>({x:p.x*meta.width,y:p.y*meta.height})),b=g.bounds(pixels);
 const left=Math.max(0,Math.floor(b.x)),top=Math.max(0,Math.floor(b.y)),right=Math.min(meta.width,Math.ceil(b.x+b.width)),bottom=Math.min(meta.height,Math.ceil(b.y+b.height));
 if(right<=left||bottom<=top)throw Error('A região localizada ficou fora da página.');
 const raw=await sharp(image).extract({left,top,width:right-left,height:bottom-top}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const cv=await require('@techstark/opencv-js'),mats=[],keep=m=>{mats.push(m);return m;};
 try{
  const src=keep(cv.matFromArray(raw.info.height,raw.info.width,cv.CV_8UC3,raw.data));
  const from=keep(cv.matFromArray(4,1,cv.CV_32FC2,pixels.flatMap(p=>[p.x-left,p.y-top]))),to=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width,0,width,height,0,height]));
  const matrix=keep(cv.getPerspectiveTransform(from,to)),out=keep(new cv.Mat());
  cv.warpPerspective(src,out,matrix,new cv.Size(width,height),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));
  return await sharp(Buffer.from(out.data),{raw:{width,height,channels:3}}).png().toBuffer();
 }finally{for(const mat of mats.reverse())mat.delete();}
}
async function run(image,model,dpi,{calibrate=false}={}){
 const meta=await sharp(image,{limitInputPixels:40000000}).metadata(),aspect=meta.height/meta.width;
 const {createWorker,PSM}=require('tesseract.js'),language=require('@tesseract.js-data/por');
 const worker=await createWorker('por',1,{langPath:language.langPath,gzip:true,cacheMethod:'none'});
 try{
  let words=[];
  if(calibrate||model.autoAlign||model.fields.some(f=>f.anchor)){
   await worker.setParameters({user_defined_dpi:String(dpi||300),tessedit_pageseg_mode:PSM.AUTO,tessedit_char_whitelist:''});
   const page=await worker.recognize(image,{}, {text:true,blocks:true});words=g.wordsFrom(page.data,meta.width,meta.height);
  }
  if(calibrate)return {reference:g.referenceFrom(words,aspect)};
  const transform=model.autoAlign?g.alignment(model.alignmentReference,words,aspect):null;
  const referenceAspect=model.autoAlign?model.alignmentReference.aspect:aspect;
  const map=p=>transform?(()=>{const q=g.apply(transform,{x:p.x,y:p.y*referenceAspect});return {x:q.x,y:q.y/aspect};})():p;
  const canonicalWords=transform?words.map(w=>{const box=g.bounds(g.corners(w).map(p=>{const q=g.inverse(transform,{x:p.x,y:p.y*aspect});return {x:q.x,y:q.y/referenceAspect};}));return {...w,...box};}):words;
  const fields=[];
  for(const field of model.fields){
   let r=field.region,warning='',anchorFound=false;
   if(model.autoAlign&&!transform)warning='Não foi possível alinhar com segurança. Confira o documento ou calibre novamente o modelo.';
   if(!warning&&field.anchor){
    const matches=g.findAnchor(canonicalWords,field.anchor.text);
    if(matches.length!==1)warning=matches.length?'Referência repetida na página. Ajuste o texto de referência.':'Texto de referência não encontrado. Confira a imagem e a referência.';
    else{r=g.anchoredRegion(r,field.anchor,matches[0]);anchorFound=true;}
   }
   if(!warning&&(r.x<0||r.y<0||r.x+r.width>1||r.y+r.height>1))warning='A região localizada ficou fora da página. Ajuste o campo ou a referência.';
   let value='',confidence=0,points=null;
   if(!warning){
    const expanded=g.expand(r,field.margin||0);points=g.corners(expanded).map(map);
    const size=Math.min(2,2400/(expanded.width*meta.width),2400/(expanded.height*meta.height));
    const width=Math.max(1,Math.round(expanded.width*meta.width*size)),height=Math.max(1,Math.round(expanded.height*meta.height*size));
    try{
     const crop=transform?await cropPolygon(image,points,width,height):await sharp(image).extract({left:Math.floor(expanded.x*meta.width),top:Math.floor(expanded.y*meta.height),width:Math.min(meta.width-Math.floor(expanded.x*meta.width),Math.ceil(expanded.width*meta.width)),height:Math.min(meta.height-Math.floor(expanded.y*meta.height),Math.ceil(expanded.height*meta.height))}).flatten({background:'white'}).resize(width,height).png().toBuffer();
     await worker.setParameters({user_defined_dpi:String(dpi||300),tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:field.type==='identifier'?'0123456789':field.type==='cpf'?'0123456789.-':field.type==='date'?'0123456789/':'',preserve_interword_spaces:'1'});
     const {data}=await worker.recognize(crop,{}, {text:true});value=data.text.trim().replace(/\s+/g,' ');confidence=data.confidence;
    }catch{warning='Não foi possível ler a região localizada. Confira o campo.';}
   }
   fields.push({...field,recognized:value,value,confidence,corrected:false,reviewed:false,warning,error:warning,resolvedRegion:points?g.bounds(points):null,location:{aligned:!!transform,angle:transform?.angle||0,matches:transform?.matches||0,anchorFound}});
  }
  return {fields};
 }finally{await worker.terminate();}
}
module.exports={run,cropPolygon};
