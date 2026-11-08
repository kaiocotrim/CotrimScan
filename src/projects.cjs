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
  endpoint(input.port); settings(input.dpi,input.source,colorMode);
  return {name:input.name.trim(),port:input.port,dpi:input.dpi,source:input.source,colorMode,outputs,signature:normalizeSignature(input.signature)};
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
  if(!data.pages.includes(page))throw Error('Página inválida.');
  if(data.signature.type==='none')return {filename:`pagina-${page}.jpg`,buffer,extension:'jpg'};
  const revision=createHash('sha256').update(JSON.stringify(data.signature)).digest('hex').slice(0,16);
  const filename=`pagina-${page}-assinado-${revision}.pdf`,file=path.join(directory(data.id),`${page}-${revision}.pdf`);
  try{return {filename,buffer:await fs.readFile(file),extension:'pdf'};}catch(error){if(error.code!=='ENOENT')throw error;}
  try{
   if(!signatures)throw Error('Assinatura digital indisponível.');
   const signed=await signedPage(buffer,data,signatures.get(data.id,data.signature));
   const temp=file+'.tmp';
   try{await fs.writeFile(temp,signed,{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   return {filename,buffer:signed,extension:'pdf'};
  }catch(error){throw Error(`A página está preservada no projeto, mas não foi possível assinar: ${error.message}`);}
 }
 async function removePageFiles(id,removed){
  const files=await fs.readdir(directory(id));
  const remove=files.filter(file=>removed.some(page=>file===page+'.jpg'||(file.startsWith(page+'-')&&file.endsWith('.pdf'))));
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
   return {project:summary(data),pages};
  },
  async append(id,buffer) {
   const data=await read(id),page=randomUUID(),file=path.join(directory(id),page+'.jpg');
   await fs.writeFile(file,buffer,{flag:'wx',mode:0o600});
   data.pages.push(page);
   try{await write(data);}catch(error){await fs.rm(file,{force:true});throw error;}
   return page;
  },
  async info(id){return summary(await read(id));},
  async pageOutput(id,index){const data=await read(id);if(!Number.isInteger(index)||!data.pages[index])throw Error('Página inválida.');const page=data.pages[index];return outputPage(data,page,await fs.readFile(path.join(directory(id),page+'.jpg')));},
  async checkOutputs(id){await checkOutputs((await read(id)).outputs);},
  async sendPage(id,page,buffer){const data=await read(id),output=await outputPage(data,page,buffer);await writeOutputs(data.outputs,output.filename,output.buffer);},
  async exportAll(id){
   const data=await read(id);
   if(!data.outputs.length)throw Error('Configure pelo menos uma pasta de saída no projeto.');
   await checkOutputs(data.outputs);
   for(const page of data.pages){const output=await outputPage(data,page,await fs.readFile(path.join(directory(id),page+'.jpg')));await writeOutputs(data.outputs,output.filename,output.buffer);}
   return {pages:data.pages.length,outputs:data.outputs.length};
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
