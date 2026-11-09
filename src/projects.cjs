const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID,createHash} = require('node:crypto');
const {endpoint, settings} = require('./scanner.cjs');
const {normalizeOutputs,checkOutputs,writeOutputs}=require('./outputs.cjs');
const {normalizeSignature}=require('./signatures.cjs');
const {signedPage}=require('./pdf.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function createProjects(root,{signatures}={}) {
 function directory(id) { if(typeof id !== 'string' || !uuid.test(id)) throw Error('Projeto inválido.'); return path.join(root,id); }
 function validateInput(input) {
  if(!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) throw Error('Informe um nome de projeto com até 80 caracteres.');
  const colorMode=input.colorMode??'RGB24',outputs=normalizeOutputs(input.outputs);
  const duplex=input.duplex??false;
  endpoint(input.port); settings(input.dpi,input.source,colorMode,duplex);
  const processingMode=require('./mobile-image-modes.cjs').scanMode(input.processingMode,colorMode);
  const namingMode=require('./document-naming.cjs').namingMode(input.namingMode);
  const documentType=require('./mobile-image-modes.cjs').documentType(input.documentType);
  const captureTemplate=require('./capture.cjs').template(input.captureTemplate);
  const namingFieldId=input.namingFieldId??null;
  if(namingMode==='ocr'&&(!captureTemplate||!captureTemplate.fields.some(f=>f.id===namingFieldId)))throw Error('Selecione um campo do modelo para nomear os arquivos pelo OCR.');
  return {namingFieldId,name:input.name.trim(),port:input.port,dpi:input.dpi,source:input.source,duplex,colorMode,processingMode,namingMode,documentType,captureTemplate,outputs,signature:normalizeSignature(input.signature)};
 }
 async function read(id) {
  const data=JSON.parse(await fs.readFile(path.join(directory(id),'project.json'),'utf8'));
  if(data.version!==1 || data.id!==id || !Array.isArray(data.pages) || !data.pages.every(page=>typeof page==='string' && uuid.test(page)) || new Set(data.pages).size!==data.pages.length) throw Error('Dados do projeto inválidos.');
  return {...data,...validateInput(data)};
 }
 async function write(data) {
  const dir=directory(data.id),temp=path.join(dir,randomUUID()+'.tmp');
  try {await fs.writeFile(temp,JSON.stringify(data),{mode:0o600,flag:'wx'});await fs.rename(temp,path.join(dir,'project.json'));}
  finally {await fs.rm(temp,{force:true});}
 }
 function summary(data){const {pages,...rest}=data;return {...rest,pageCount:pages.length};}
 async function outputPage(data,page,buffer){
  const capture=await readCapture(data.id,page);
  const indexBuffer=capture?Buffer.from(JSON.stringify({schema:'cotrimscan.capture.v1',projectId:data.id,pageId:page,...capture},null,2)):null;
  const output=await pageContent(data,page,buffer,indexBuffer);
  const named=await require('./document-naming.cjs').documentFilename(data,page,output,directory(data.id));
  if(!capture)return named;
  const hash=createHash('sha256').update(indexBuffer).digest('hex').slice(0,12);
  const filename=data.namingMode==='ocr'?named.filename:named.filename.replace(/\.[^.]+$/,`-idx-${hash}.${named.extension}`);
  return {...named,filename,warning:[named.warning,capture.error,capture.needsReview||capture.fields.some(f=>!f.reviewed||f.error)?'Campos de captura pendentes de revisão.':''].filter(Boolean).join(' ')};
 }
 async function readCapture(id,page){return require('./document-naming.cjs').readJson(path.join(directory(id),page+'-capture.json'));}
 async function copyCapture(id,previous,page,changed=false){
  const capture=await readCapture(id,previous);if(!capture)return;
  if(changed){capture.revision=randomUUID();capture.imageChanged=true;capture.needsReview=true;capture.fields=capture.fields.map(f=>({...f,reviewed:false}));}
  await require('./document-naming.cjs').writeJson(path.join(directory(id),page+'-capture.json'),capture);
 }
 async function writeOutput(data,output){
  await writeOutputs(data.outputs,output.filename,output.buffer);
 }
 async function pageContent(data,page,buffer,indexBuffer=null){
  if(!data.pages.includes(page))throw Error('Página inválida.');
  let searchable=null;try{searchable=await fs.readFile(path.join(directory(data.id),`${page}-ocr.pdf`));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(indexBuffer){
   const revision=createHash('sha256').update(indexBuffer).update(JSON.stringify({signature:data.signature,name:data.name,dpi:data.dpi})).digest('hex').slice(0,24);
   const filename=`pagina-${page}-indexado-${revision}.pdf`,file=path.join(directory(data.id),`${page}-indexed-${revision}.pdf`);
   try{return {filename,buffer:await fs.readFile(file),extension:'pdf'};}catch(error){if(error.code!=='ENOENT')throw error;}
   let pdf=await require('./pdf.cjs').indexedPdf(searchable||await require('./pdf.cjs').imagePage(buffer,data),indexBuffer);
   if(data.signature.type!=='none'){
    try{if(!signatures)throw Error('Assinatura digital indisponível.');pdf=await signedPage(buffer,data,signatures.get(data.id,data.signature),pdf);}
    catch(error){throw Error(`A página está preservada no projeto, mas não foi possível assinar: ${error.message}`);}
   }
   const temp=file+'.tmp';try{await fs.writeFile(temp,pdf,{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   return {filename,buffer:pdf,extension:'pdf'};
  }
  if(data.signature.type==='none'&&searchable)return {filename:`pagina-${page}-ocr.pdf`,buffer:searchable,extension:'pdf'};
  if(data.signature.type==='none'){
   let processed=false;try{await fs.access(path.join(directory(data.id),`${page}-scan.json`));processed=true;}catch(error){if(error.code!=='ENOENT')throw error;}
   if(processed){
    const file=path.join(directory(data.id),`${page}-processed.pdf`);let pdf;
    try{pdf=await fs.readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;pdf=await require('./pdf.cjs').imagePage(buffer,data);await fs.writeFile(file,pdf,{flag:'wx',mode:0o600});}
    return {filename:`pagina-${page}.pdf`,buffer:pdf,extension:'pdf'};
   }
  }
  if(data.signature.type==='none')return {filename:`pagina-${page}.jpg`,buffer,extension:'jpg'};
  const revision=createHash('sha256').update(JSON.stringify(data.signature)).digest('hex').slice(0,16);
  const filename=`pagina-${page}-assinado-${revision}.pdf`,file=path.join(directory(data.id),`${page}-${revision}.pdf`);
  try{return {filename,buffer:await fs.readFile(file),extension:'pdf'};}catch(error){if(error.code!=='ENOENT')throw error;}
  try{
   if(!signatures)throw Error('Assinatura digital indisponível.');
   const signed=await signedPage(buffer,data,signatures.get(data.id,data.signature),searchable);
   const temp=file+'.tmp';
   try{await fs.writeFile(temp,signed,{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   return {filename,buffer:signed,extension:'pdf'};
  }catch(error){throw Error(`A página está preservada no projeto, mas não foi possível assinar: ${error.message}`);}
 }
 async function removePageFiles(id,removed){
  const files=await fs.readdir(directory(id));
  const remove=files.filter(file=>removed.some(page=>file===page+'.jpg'||file===page+'.source'||(file.startsWith(page+'-')&&(/\.(pdf|json)$/.test(file)))));
  await Promise.all(remove.map(file=>fs.rm(path.join(directory(id),file),{force:true}).catch(()=>{})));
 }
 return {
  async list() {
   let dirs;try{dirs=await fs.readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
   const projects=await Promise.all(dirs.filter(d=>d.isDirectory()&&uuid.test(d.name)).map(d=>read(d.name)));
   return projects.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(summary);
  },
  async create(input) {
   const data={version:1,id:randomUUID(),...validateInput(input),createdAt:new Date().toISOString(),pages:[]};
   await fs.mkdir(directory(data.id),{recursive:true,mode:0o700});await write(data);return summary(data);
  },
  async update(id,input) {const previous=await read(id),data={...previous,...validateInput({...previous,...input})};await write(data);return summary(data);},
  async open(id) {
   const data=await read(id);
   const pages=[];
   for(const page of data.pages)pages.push(await fs.readFile(path.join(directory(id),page+'.jpg')));
   const ocr=await Promise.all(data.pages.map(page=>fs.access(path.join(directory(id),`${page}-ocr.pdf`)).then(()=>true,()=>false)));
   const processed=await Promise.all(data.pages.map(page=>fs.access(path.join(directory(id),`${page}-scan.json`)).then(()=>true,()=>false)));
   return {project:summary(data),pages,ocr,processed};
  },
  async append(id,buffer,original=buffer,processingMode) {
   const data=await read(id),page=randomUUID(),file=path.join(directory(id),page+'.jpg'),source=path.join(directory(id),page+'.source');
   await fs.writeFile(file,buffer,{flag:'wx',mode:0o600});
   data.pages.push(page);
   try{
    await fs.writeFile(source,original,{flag:'wx',mode:0o600});
    if(processingMode)await fs.writeFile(path.join(directory(id),page+'-scan.json'),JSON.stringify({mode:require('./mobile-image-modes.cjs').scanMode(processingMode)}),{flag:'wx',mode:0o600});
    await write(data);
   }catch(error){await fs.rm(file,{force:true});await fs.rm(source,{force:true});await fs.rm(path.join(directory(id),page+'-scan.json'),{force:true});throw error;}
   if(data.captureTemplate)await this.capture(id,data.pages.length-1);
   return page;
  },
  async captureData(id,index){const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');return readCapture(id,data.pages[index]);},
  async capture(id,index){
   const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');
   const previous=await readCapture(id,data.pages[index]);if(previous&&(!previous.error||previous.fields.some(f=>f.corrected||f.reviewed)))return previous;
   if(!data.captureTemplate)throw Error('Selecione um modelo de captura no projeto.');
   const image=await fs.readFile(path.join(directory(id),data.pages[index]+'.jpg'));
   let result,error='';try{result=await require('./capture.cjs').extract(image,data.captureTemplate,data.dpi);}catch(e){error=e.message;result={fields:data.captureTemplate.fields.map(f=>({...f,recognized:'',value:'',confidence:0,corrected:false,reviewed:false}))};}
   const capture={revision:randomUUID(),template:data.captureTemplate,createdAt:new Date().toISOString(),needsReview:true,error,fields:result.fields.map(f=>({...f,error:f.error||require('./capture.cjs').validation(f,f.value)}))};
   await require('./document-naming.cjs').writeJson(path.join(directory(id),data.pages[index]+'-capture.json'),capture);return capture;
  },
  async saveCapture(id,index,values,revision){
   const stored=await this.captureData(id,index);if(!stored||stored.revision!==revision)throw Error('Os campos mudaram. Reabra a página antes de salvar.');
   if(!Array.isArray(values)||values.length!==stored.fields.length||new Set(values.map(v=>v.id)).size!==stored.fields.length)throw Error('Campos inválidos.');
   const fields=stored.fields.map(field=>{
    const input=values.find(v=>v.id===field.id);if(!input||typeof input.value!=='string'||input.value.length>2000||input.value.includes('\0')||typeof input.reviewed!=='boolean')throw Error('Valor de campo inválido.');
    return {...field,value:input.value,corrected:input.value!==field.recognized,reviewed:input.reviewed,error:require('./capture.cjs').validation(field,input.value)};
   });
   const result={...stored,fields,revision:randomUUID(),updatedAt:new Date().toISOString(),needsReview:fields.some(f=>!f.reviewed||f.error)};
   const data=await read(id);await require('./document-naming.cjs').writeJson(path.join(directory(id),data.pages[index]+'-capture.json'),result);return result;
  },
  async recognize(id,index){
   const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');
   const previous=data.pages[index],image=await fs.readFile(path.join(directory(id),previous+'.jpg'));
   const result=await require('./documents.cjs').processDocument(image,{enhance:false,ocr:true,dpi:data.dpi,colorMode:data.colorMode});
   if(!result.pdf||!result.text)throw Error(result.info.warning||'Nenhum texto foi reconhecido. Tente uma foto mais nítida.');
   const page=randomUUID(),files=[page+'.jpg',page+'-ocr.pdf',page+'-ocr.json',page+'.source',page+'-scan.json'];
   try{
    await fs.writeFile(path.join(directory(id),files[0]),image,{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(directory(id),files[1]),result.pdf,{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(directory(id),files[2]),JSON.stringify({text:result.text,confidence:result.info.confidence}),{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(directory(id),files[3]),await this.original(id,index),{flag:'wx',mode:0o600});
    try{await fs.writeFile(path.join(directory(id),files[4]),await fs.readFile(path.join(directory(id),previous+'-scan.json')),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='ENOENT')throw error;}
    await copyCapture(id,previous,page);
    data.pages[index]=page;await write(data);
   }catch(error){await Promise.all(files.map(file=>fs.rm(path.join(directory(id),file),{force:true})));throw error;}
   await removePageFiles(id,[previous]);return {image,text:result.text,confidence:result.info.confidence,warning:result.info.warning};
  },
  async ocrText(id,index){
   const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');
   const page=data.pages[index];
   try{const stored=JSON.parse(await fs.readFile(path.join(directory(id),page+'-ocr.json'),'utf8'));return {...stored,revision:page};}
   catch(error){if(error.code==='ENOENT')throw Error('Reconheça o texto desta página antes de editar.');throw error;}
  },
  async saveOcrText(id,index,text,revision){
   if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>1024*1024||text.includes('\0'))throw Error('Texto inválido ou maior que 1 MB.');
   text=text.replace(/\r\n?/g,'\n');
   const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');
   const previous=data.pages[index],stored=await this.ocrText(id,index);
   if(revision!==previous)throw Error('A página mudou. Abra o texto novamente antes de salvar.');
   const image=await fs.readFile(path.join(directory(id),previous+'.jpg'));
   const pdf=await require('./pdf.cjs').correctedOcrPage(image,await fs.readFile(path.join(directory(id),previous+'-ocr.pdf')),text,data);
   const page=randomUUID(),files=[page+'.jpg',page+'.source',page+'-ocr.pdf',page+'-ocr.json',page+'-scan.json'];
   const metadata={text,confidence:stored.confidence,edited:true};
   try{
    await fs.writeFile(path.join(directory(id),files[0]),image,{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(directory(id),files[1]),await this.original(id,index),{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(directory(id),files[2]),pdf,{flag:'wx',mode:0o600});
    await fs.writeFile(path.join(directory(id),files[3]),JSON.stringify(metadata),{flag:'wx',mode:0o600});
    try{await fs.writeFile(path.join(directory(id),files[4]),await fs.readFile(path.join(directory(id),previous+'-scan.json')),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='ENOENT')throw error;}
    await copyCapture(id,previous,page);
    data.pages[index]=page;await write(data);
   }catch(error){await Promise.all(files.map(file=>fs.rm(path.join(directory(id),file),{force:true})));throw error;}
   await removePageFiles(id,[previous]);return {image,...metadata,revision:page};
  },
  async original(id,index){
   const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');
   try{return await fs.readFile(path.join(directory(id),data.pages[index]+'.source'));}catch(error){if(error.code!=='ENOENT')throw error;return fs.readFile(path.join(directory(id),data.pages[index]+'.jpg'));}
  },
  async rotate(id,index,angle){const rotate=buffer=>require('./mobile-image-rotate.cjs').rotateImage(buffer,angle);return this.transformPage(id,index,rotate,{sourceTransform:rotate});},
  async enhance(id,index,corners,mode){
   const project=await read(id);mode=require('./mobile-image-modes.cjs').scanMode(mode??project.processingMode);
   let result;
   const image=await this.transformPage(id,index,async buffer=>{result=await require('./mobile-image-rotate.cjs').enhanceImage(buffer,corners,mode,{documentType:project.documentType,dpi:project.dpi});return result.image;},{fromOriginal:true,processingMode:mode});
   return {image,cropped:result.cropped,cropMethod:result.cropMethod,mode};
  },
  async transformPage(id,index,transform,{fromOriginal=false,sourceTransform,processingMode}={}){
   const data=await read(id);
   if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');
   const previous=data.pages[index],page=randomUUID(),file=path.join(directory(id),page+'.jpg');
   const current=await fs.readFile(path.join(directory(id),previous+'.jpg')),original=await this.original(id,index);
   const buffer=await transform(fromOriginal?original:current);
   const source=sourceTransform?(current.equals(original)?buffer:await sourceTransform(original)):original;
   await fs.writeFile(file,buffer,{flag:'wx',mode:0o600});
   data.pages[index]=page;
   try{
    await fs.writeFile(path.join(directory(id),page+'.source'),source,{flag:'wx',mode:0o600});
    let scan=processingMode?Buffer.from(JSON.stringify({mode:processingMode})):null;
    if(!scan)try{scan=await fs.readFile(path.join(directory(id),previous+'-scan.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(scan)await fs.writeFile(path.join(directory(id),page+'-scan.json'),scan,{flag:'wx',mode:0o600});
    await copyCapture(id,previous,page,true);
    await write(data);
   }catch(error){await fs.rm(file,{force:true});await fs.rm(path.join(directory(id),page+'.source'),{force:true});await fs.rm(path.join(directory(id),page+'-scan.json'),{force:true});throw error;}
   // New identity regenerates signed PDFs and avoids overwriting earlier exports.
   await removePageFiles(id,[previous]);return buffer;
  },
  async info(id){return summary(await read(id));},
  async pageOutput(id,index){const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');const page=data.pages[index];return outputPage(data,page,await fs.readFile(path.join(directory(id),page+'.jpg')));},
  async checkOutputs(id){await checkOutputs((await read(id)).outputs);},
  async sendPage(id,page,buffer){const data=await read(id),output=await outputPage(data,page,buffer);await writeOutput(data,output);return {filename:output.filename,warning:output.warning};},
  async exportAll(id){
   const data=await read(id);
   if(!data.outputs.length)throw Error('Configure pelo menos uma pasta de saída no projeto.');
   await checkOutputs(data.outputs);
   const warnings=[];
   for(const page of data.pages){const output=await outputPage(data,page,await fs.readFile(path.join(directory(id),page+'.jpg')));await writeOutput(data,output);if(output.warning)warnings.push(output.warning);}
   return {pages:data.pages.length,outputs:data.outputs.length,...(warnings.length?{warnings}:{} )};
  },
  async removePages(id,indices){
   const data=await read(id);
   if(!Array.isArray(indices)||!indices.length||!indices.every(index=>Number.isInteger(index)&&index>=0&&index<data.pages.length))throw Error('Selecione páginas válidas para excluir.');
   const selected=new Set(indices),removed=data.pages.filter((_page,index)=>selected.has(index));
   data.pages=data.pages.filter((_page,index)=>!selected.has(index));await write(data);
   await removePageFiles(id,removed);return removed.length;
  },
  async clear(id) {
   const data=await read(id),old=data.pages;data.pages=[];await write(data);
   await removePageFiles(id,old);
  }
 };
}
module.exports={createProjects};
