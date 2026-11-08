const fs=require('node:fs/promises');
const path=require('node:path');
function normalizeOutputs(outputs=[]){
 if(!Array.isArray(outputs))throw Error('Pastas de saída inválidas.');
 const unique=new Map();
 for(const item of outputs){
  if(typeof item!=='string'||!item.trim()||item.includes('\0')||!path.isAbsolute(item.trim()))throw Error('Informe o caminho completo de cada pasta de saída.');
  const folder=path.normalize(item.trim()),key=process.platform==='win32'?folder.toLowerCase():folder;
  unique.set(key,folder);
 }
 return [...unique.values()];
}
async function checkOutputs(outputs){
 for(const folder of outputs){
  try{if(!(await fs.stat(folder)).isDirectory())throw Error();await fs.access(folder,fs.constants.W_OK);}
  catch{throw Error(`A pasta de saída não está disponível para gravação: ${folder}`);}
 }
}
async function writeOutputs(outputs,filename,buffer){
 const failures=[];
 for(const folder of outputs){
  try{await fs.writeFile(path.join(folder,filename),buffer,{flag:'wx'});}
  catch(error){
   if(error.code==='EEXIST'){
    try{if((await fs.readFile(path.join(folder,filename))).equals(buffer))continue;}catch{}
   }
   failures.push(folder);
  }
 }
 if(failures.length)throw Error(`A página está preservada no projeto, mas não foi salva em: ${failures.join('; ')}. Confira as pastas e use “Enviar para saídas” para tentar novamente.`);
}
module.exports={normalizeOutputs,checkOutputs,writeOutputs};
