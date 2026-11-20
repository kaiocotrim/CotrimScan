const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID,createHash} = require('node:crypto');
const {endpoint, settings} = require('@cotrimscan/scan-core/scanner');
const {normalizeOutputs,checkOutputs,writeOutputs}=require('./outputs.cjs');
const {normalizeSignature}=require('./signatures.cjs');
const {signedPage,documentPdf}=require('./pdf.cjs');
const {normalizeSeparation,groupDocuments}=require('./document-separation.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const defaultReadSeparator=buffer=>require('./document-codes.cjs').readDocumentCode(buffer,'barcode');
function createProjects(root,{signatures,readSeparator=defaultReadSeparator}={}) {
 function directory(id) { if(typeof id !== 'string' || !uuid.test(id)) throw Error('Projeto inválido.'); return path.join(root,id); }
 function validateInput(input) {
  if(!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) throw Error('Informe um nome de projeto com até 80 caracteres.');
  const colorMode=input.colorMode??'RGB24',outputs=normalizeOutputs(input.outputs);
  const duplex=input.duplex??false;
  endpoint(input.port); settings(input.dpi,input.source,colorMode,duplex);
  const processingMode=require('./mobile-image-modes.cjs').scanMode(input.processingMode,colorMode);
  const namingMode=require('./document-naming.cjs').namingMode(input.namingMode);
  const nameTemplate=require('./name-template.cjs').validateTemplate(input.nameTemplate);
  if(namingMode==='custom'&&!nameTemplate)throw Error('Configure os nomes personalizados antes de selecionar essa opção.');
  const fixedName=typeof input.fixedName==='string'?input.fixedName.trim().slice(0,100):'';
  if(namingMode==='fixed'&&!require('./document-naming.cjs').safeCodeName(fixedName))throw Error('Informe um nome fixo válido para os documentos.');
  const documentType=require('./mobile-image-modes.cjs').documentType(input.documentType);
  const captureTemplate=require('./capture.cjs').template(input.captureTemplate);
  const namingFieldId=input.namingFieldId??null;
  if(namingMode==='ocr'&&(!captureTemplate||!captureTemplate.fields.some(f=>f.id===namingFieldId)))throw Error('Selecione um campo do modelo para nomear os arquivos pelo OCR.');
  const signature=normalizeSignature(input.signature),separation=normalizeSeparation(input.separation);
  if(separation.mode!=='none'&&namingMode!=='default'&&namingMode!=='custom'&&namingMode!=='fixed')throw Error('Na separação por documento, use o nome padrão, fixo ou personalizado.');
  if(separation.mode==='blank'&&input.blankPages?.enabled===true&&input.blankPages.action==='auto')throw Error('Para separar por página em branco, mantenha as páginas em branco durante a digitalização.');
  if(separation.mode!=='none'&&signature.type!=='none')throw Error('Na separação por documento, desative a assinatura digital. Ela ainda não se aplica a documentos com várias páginas.');
  const indexing={enabled:input.indexing?.enabled===true,fields:Array.isArray(input.indexing?.fields)?input.indexing.fields.slice(0,30).map(f=>({id:String(f.id||'').slice(0,80),name:String(f.name||'').trim().slice(0,80),type:['text','number','date'].includes(f.type)?f.type:'text',source:'manual'})):[]};
  if(indexing.enabled&&indexing.fields.some(f=>!f.id||!f.name))throw Error('Informe o nome de todos os campos de indexação.');
  return {indexing,blankPages:require('./blank-pages.cjs').settings(input.blankPages),fixedName,namingFieldId,name:input.name.trim(),nameTemplate,port:input.port,dpi:input.dpi,source:input.source,duplex,colorMode,processingMode,namingMode,documentType,captureTemplate,outputs,signature,separation,certificateInfo:input.certificateInfo&&typeof input.certificateInfo.subject==='string'&&Number.isFinite(Date.parse(input.certificateInfo.expiresAt))?{subject:input.certificateInfo.subject.slice(0,300),expiresAt:input.certificateInfo.expiresAt}:null,signatureStamp:input.signatureStamp===true};
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
 async function applyNameTemplate(data,page,output,context){
  if(data.namingMode!=='custom'||!data.nameTemplate)return output;
  const {renderTemplate}=require('./name-template.cjs');
  const template=data.nameTemplate;
  const codes={};
  for(const kind of ['qr','barcode'])if([...template.file,...template.folder].some(item=>item.kind===kind)){
   const result=await require('./document-codes.cjs').readDocumentCode(await sourceImage(data.id,page),kind);
   if(result.status==='found')codes[kind]=result.text;
  }
  context.codes=codes;
  const folderParts=[[]];
  for(const item of template.folder){
   if(item.kind==='text'&&item.text.includes('/')){
    const pieces=item.text.split('/');
    folderParts[folderParts.length-1].push({...item,text:pieces.shift()});
    for(const piece of pieces)folderParts.push([{...item,text:piece}]);
   }else folderParts[folderParts.length-1].push(item);
  }
  const subfolder=template.folder.length?folderParts.filter(parts=>parts.length).map(parts=>renderTemplate(parts,context)).join(path.sep):'';
  return {...output,filename:template.file.length?`${renderTemplate(template.file,context)}.${output.extension}`:output.filename,subfolder};
 }
 async function outputPage(data,page,buffer){
  const capture=await readCapture(data.id,page);
  const indexBuffer=capture?Buffer.from(JSON.stringify({schema:'cotrimscan.capture.v1',projectId:data.id,pageId:page,...capture},null,2)):null;
  const output=await pageContent(data,page,buffer,indexBuffer);
  const named=data.namingMode==='custom'&&data.nameTemplate?.file.length?output:await require('./document-naming.cjs').documentFilename(data,page,output,directory(data.id),(image,mode)=>require('./document-codes.cjs').readDocumentCode(image,mode),await sourceImage(data.id,page));
  const context={project:data.name,documentId:page,documentNumber:data.pages.indexOf(page)+1,page:data.pages.indexOf(page)+1,sequence:data.pages.indexOf(page)+1,fields:capture?.fields};
  const custom=await applyNameTemplate(data,page,named,context);
  if(!capture)return custom;
  const hash=createHash('sha256').update(indexBuffer).digest('hex').slice(0,12);
  const codeNamed=['qr','barcode'].includes(data.namingMode)&&custom.code;
  const filename=data.namingMode==='ocr'||data.namingMode==='fixed'||data.namingMode==='custom'&&data.nameTemplate?.file.length||codeNamed?custom.filename:custom.filename.replace(/\.[^.]+$/,`-idx-${hash}.${custom.extension}`);
  return {...custom,filename,warning:[custom.warning,capture.error,capture.needsReview||capture.fields.some(f=>!f.reviewed||f.error)?'Campos de captura pendentes de revisão.':''].filter(Boolean).join(' ')};
 }
 async function readCapture(id,page){return require('./document-naming.cjs').readJson(path.join(directory(id),page+'-capture.json'));}
 async function copyCapture(id,previous,page,changed=false){
  const capture=await readCapture(id,previous);if(!capture)return;
  if(changed){capture.revision=randomUUID();capture.imageChanged=true;capture.needsReview=true;capture.fields=capture.fields.map(f=>({...f,reviewed:false}));}
  await require('./document-naming.cjs').writeJson(path.join(directory(id),page+'-capture.json'),capture);
 }
 async function writeOutput(data,output){
  await writeOutputs(data.outputs,output.filename,output.buffer,output.subfolder);
 }
 async function pageContent(data,page,buffer,indexBuffer=null){
  if(!data.pages.includes(page))throw Error('Página inválida.');
  let searchable=null;try{searchable=await fs.readFile(path.join(directory(data.id),`${page}-ocr.pdf`));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(indexBuffer){
   const revision=createHash('sha256').update(indexBuffer).update(JSON.stringify({signature:data.signature,signatureStamp:data.signatureStamp,name:data.name,dpi:data.dpi})).digest('hex').slice(0,24);
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
  const revision=createHash('sha256').update(JSON.stringify({signature:data.signature,signatureStamp:data.signatureStamp})).digest('hex').slice(0,16);
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
 async function sourceImage(id,page){
  try{return await fs.readFile(path.join(directory(id),page+'.source'));}catch(error){if(error.code!=='ENOENT')throw error;return fs.readFile(path.join(directory(id),page+'.jpg'));}
 }
 async function exportDocuments(data){
  const separators=[];
  for(const page of data.pages){
   if(data.separation.mode==='barcode'){
    const result=await readSeparator(await sourceImage(data.id,page));
    separators.push(result.status==='found');
   }else if(data.separation.mode==='blank'){
    const result=await require('./blank-pages.cjs').inspect(await sourceImage(data.id,page),data.separation.sensitivity);
    separators.push(result.blank);
   }else separators.push(false);
  }
  const groups=groupDocuments(separators,data.separation);
  for(const [index,group] of groups.entries()){
   const images=[];
   for(const i of group)images.push(await fs.readFile(path.join(directory(data.id),data.pages[i]+'.jpg')));
   const buffer=await documentPdf(images,{dpi:data.dpi,name:`${data.name} ${index+1}`});
   const hash=createHash('sha256').update(buffer).digest('hex').slice(0,8);
   const firstPage=data.pages[group[0]];
   const capture=await readCapture(data.id,firstPage);
   const output=await applyNameTemplate(data,firstPage,{filename:`documento-${String(index+1).padStart(3,'0')}-${hash}.pdf`,extension:'pdf',buffer},{project:data.name,documentId:firstPage,documentNumber:index+1,page:group[0]+1,sequence:index+1,fields:capture?.fields});
   await writeOutput(data,output);
  }
  return {pages:data.pages.length,documents:groups.length,outputs:data.outputs.length};
 }
 async function removePageFiles(id,removed){
  const files=await fs.readdir(directory(id));
  const protectedPages=new Set((await read(id)).indexingQueue?.flatMap(d=>d.pages)||[]);
  const removable=removed.filter(page=>!protectedPages.has(page));
  const remove=files.filter(file=>removable.some(page=>file===page+'.jpg'||file===page+'.source'||(file.startsWith(page+'-')&&(/\.(pdf|json)$/.test(file)))));
  await Promise.all(remove.map(file=>fs.rm(path.join(directory(id),file),{force:true}).catch(()=>{})));
 }
 function indexingFolder(data,doc){
  if(doc.outputFolder)return doc.outputFolder;
  if(doc.processed)return 'Lote-'+doc.id;
  const values=data.indexing.fields.map(field=>doc.values[field.id]).filter(Boolean);
  const name=require('./document-naming.cjs').safeCodeName(values.join(' - '));
  return name||'Lote-'+doc.id;
 }
 async function reserveIndexingFolder(data,doc){
  if(doc.outputFolder)return;
  const base=indexingFolder(data,doc);
  const occupied=new Set(data.indexingQueue.filter(item=>item.id!==doc.id&&(item.outputFolder||item.processed)).map(item=>indexingFolder(data,item).toLowerCase()));
  let suffix=1;
  for(;;suffix++){
   const candidate=suffix===1?base:`${base} (${suffix})`;
   if(occupied.has(candidate.toLowerCase()))continue;
   let exists=false;
   for(const output of data.outputs){
    try{await fs.lstat(path.join(output,candidate));exists=true;break;}
    catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;}
   }
   if(exists)continue;
   doc.outputFolder=candidate;
   // Persist the selected destination before writing so retries use the same folder.
   await write(data);return;
  }
 }
 return {
  async indexingQueue(id,command,input={}) {
   const data=await read(id);if(!data.indexing?.enabled)throw Error('Indexação manual desativada.');
   data.indexingQueue ||= [];
   // Migrate previously finalized pages out of the active scanner workspace.
   const queued=new Set(data.indexingQueue.flatMap(d=>d.pages));
   data.pages=data.pages.filter(p=>!queued.has(p));
   if(command==='add'){
    const used=new Set(data.indexingQueue.flatMap(d=>d.pages));const pages=data.pages.filter(p=>!used.has(p));
    if(!pages.length)throw Error('Digitalize páginas para finalizar um documento.');
    const values={};for(const f of data.indexing.fields){const value=String(input.values?.[f.id]||'').trim();if(!value||value.length>300)throw Error('Preencha '+f.name);values[f.id]=value;}
    data.indexingQueue.push({id:randomUUID(),pages,values,processed:false});
    data.pages=[];
   }else if(command==='remove'){
    const doc=data.indexingQueue.find(d=>d.id===input.id);
    if(!doc)throw Error('Documento indisponível.');
    for(const page of doc.pages){try{await fs.access(path.join(directory(id),page+'.jpg'));data.pages.push(page);}catch(error){if(error.code!=='ENOENT')throw error;}}
    data.indexingQueue=data.indexingQueue.filter(d=>d.id!==input.id);
   }
   else if(command==='edit'){const doc=data.indexingQueue.find(d=>d.id===input.id);if(!doc||doc.processed)throw Error('Documento indisponível.');if(doc.outputFolder)throw Error('A exportação deste lote já foi iniciada. Tente processar a fila novamente antes de alterar a identificação.');for(const f of data.indexing.fields){const value=String(input.values?.[f.id]||'').trim();if(!value||value.length>300)throw Error('Preencha '+f.name);doc.values[f.id]=value;}}
   else if(command==='process'){
    if(!data.outputs.length)throw Error('Configure uma pasta de saída.');
    if(data.signature.type!=='none')throw Error('Desative a assinatura para processar documentos agrupados.');
    for(const doc of data.indexingQueue.filter(d=>!d.processed)){
     const images=await Promise.all(doc.pages.map(async(p,index)=>{try{return await fs.readFile(path.join(directory(id),p+'.jpg'));}catch(error){if(error.code==='ENOENT')throw Error(`A página ${index+1} de um lote não está mais disponível. Abra Visualizar fila, remova o lote afetado e importe novamente as fotos antes de finalizar.`);throw error;}}));
     const searchablePdfs=await Promise.all(doc.pages.map(async p=>{try{return await fs.readFile(path.join(directory(id),p+'-ocr.pdf'));}catch(error){if(error.code!=='ENOENT')throw error;return null;}}));
     const cached=path.join(directory(id),doc.id+'-batch.pdf');
     let buffer;try{buffer=await fs.readFile(cached);}catch(error){if(error.code!=='ENOENT')throw error;buffer=await documentPdf(images,{dpi:data.dpi,name:data.name,searchablePdfs});await fs.writeFile(cached,buffer,{flag:'wx'});}
     await reserveIndexingFolder(data,doc);
     await writeOutput(data,{buffer,extension:'pdf',filename:'documento.pdf',subfolder:doc.outputFolder});doc.processed=true;await write(data);
    }
   }else if(command!=='list')throw Error('Ação inválida.');
   await write(data);
   return Promise.all(data.indexingQueue.map(async d=>{
    const missingPages=[];
    const previews=await Promise.all(d.pages.map(async(p,index)=>{
     try{return 'data:image/jpeg;base64,'+(await fs.readFile(path.join(directory(id),p+'.jpg'))).toString('base64');}
     catch(error){if(error.code!=='ENOENT')throw error;missingPages.push(index+1);return '';}
    }));
    return {...d,pageCount:d.pages.length,previews,missingPages:missingPages.sort((a,b)=>a-b),folder:indexingFolder(data,d)};
   }));
  },
  async list() {
   let dirs;try{dirs=await fs.readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
   const projects=await Promise.all(dirs.filter(d=>d.isDirectory()&&uuid.test(d.name)).map(d=>read(d.name)));
   return projects.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(summary);
  },
  async rename(id,name) { return this.update(id,{name}); },
  async duplicate(id) {
   const original=await read(id),existing=await this.list();let suffix=2;
   while(existing.some(item=>item.name===original.name.slice(0,75)+' '+suffix))suffix++;
   const data={...original,id:randomUUID(),name:original.name.slice(0,75)+' '+suffix,createdAt:new Date().toISOString()};
   await fs.cp(directory(id),directory(data.id),{recursive:true,errorOnExist:true,force:false});
   await write(data);return summary(data);
  },
  async delete(id) { await read(id);await fs.rm(directory(id),{recursive:true,force:true}); },
  async create(input) {
   const data={version:1,id:randomUUID(),...validateInput(input),createdAt:new Date().toISOString(),pages:[]};
   await fs.mkdir(directory(data.id),{recursive:true,mode:0o700});await write(data);return summary(data);
  },
  async update(id,input) {const previous=await read(id),data={...previous,...validateInput({...previous,...input})};await write(data);return summary(data);},
  async open(id) {
   const data=await read(id);
   if(data.indexingQueue?.length){const queued=new Set(data.indexingQueue.flatMap(d=>d.pages));data.pages=data.pages.filter(p=>!queued.has(p));await write(data);}
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
  async readCode(id,index,reader=require('./document-codes.cjs').readDocumentCode){const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');const page=data.pages[index],source=await sourceImage(id,page);let last={status:'not-found'};for(const mode of ['qr','barcode']){const result=await reader(source,mode);if(result.status==='found')return result;if(result.status==='ambiguous')last=result;}return last;},
  async namePage(id,index,value){if(typeof value!=='string'||!value.trim())throw Error('Informe o nome que deseja usar.');const stem=require('./document-naming.cjs').safeCodeName(value.trim());if(!stem)throw Error('Informe um nome de arquivo válido.');const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');const page=data.pages[index];await require('./document-naming.cjs').writeJson(path.join(directory(id),page+'-name.json'),{mode:'manual',status:'found',text:value.trim(),stem});return this.pageOutput(id,index);},
  async checkOutputs(id){await checkOutputs((await read(id)).outputs);},
  async sendPage(id,page,buffer){const data=await read(id);if(data.indexing?.enabled)return {filename:null,warning:'Documento aguardando finalização na indexação manual.'};if(data.separation.mode!=='none')return {filename:null,warning:''};const output=await outputPage(data,page,buffer);await writeOutput(data,output);return {filename:output.filename,warning:output.warning};},
  async exportAll(id){
   const data=await read(id);
   if(data.indexing?.enabled)throw Error('Finalize os documentos e use Processar fila na tela Visualizar fila.');
   if(!data.outputs.length)throw Error('Configure pelo menos uma pasta de saída no projeto.');
   await checkOutputs(data.outputs);
   if(data.separation.mode!=='none')return exportDocuments(data);
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
