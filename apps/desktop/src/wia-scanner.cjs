const {execFile}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');

async function available(){
 if(process.platform!=='win32')return false;
 try{
  const {stdout}=await command('$m=New-Object -ComObject WIA.DeviceManager; @($m.DeviceInfos | Where-Object {$_.Type -eq 1}).Count');
  return Number(stdout.trim())>0;
 }catch{return false;}
}
function command(script,args=[],timeout=30000,onLine){
 return new Promise((resolve,reject)=>{
  let partial='',pending=Promise.resolve();
  const receive=line=>{if(line.trim()&&onLine)pending=pending.then(()=>onLine(line)).catch(error=>{child.kill();throw error;});};
  const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...(script.startsWith('$')?['-Command',script]:['-File',script]),...args],{windowsHide:true,timeout,maxBuffer:1024*1024},async(error,stdout,stderr)=>{
   if(partial)receive(partial);
   try{await pending;}catch(reason){return reject(reason);}
   if(error){
    if(stderr.includes('WIA_PAPER_EMPTY'))return reject(Error('O alimentador do scanner est\u00e1 vazio. Coloque o documento no alimentador e tente novamente.'));
    return reject(Error((stderr||error.message).trim()));
   }
   resolve({stdout,stderr});
  });
  if(onLine)child.stdout.on('data',chunk=>{
   partial+=chunk.toString();
   const lines=partial.split(/\r?\n/);partial=lines.pop();
   for(const line of lines)receive(line);
  });
 });
}
async function scan(dpi,source,colorMode,duplex,onPage,maxPages=200){
 if(process.platform!=='win32')throw Error('A digitalização WIA requer Windows.');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'cotrimscan-wia-'));
 try{
  const script=path.join(__dirname,'wia-scan.ps1');
  let count=0;
  await command(script,['-OutputDirectory',folder,'-Dpi',String(dpi),'-Source',source,'-Duplex',duplex?'true':'false','-MaxPages',String(maxPages)],300000,async line=>{
   const file=JSON.parse(line).file;
   if(typeof file!=='string'||path.dirname(path.resolve(file))!==path.resolve(folder))throw Error('O scanner retornou um arquivo de p\u00e1gina inv\u00e1lido.');
   const image=colorMode==='RGB24'?await fs.readFile(file):await (colorMode==='Grayscale8'?sharp(file).grayscale():sharp(file).threshold()).jpeg({quality:95}).toBuffer();
   await onPage(image);
   count++;
  });
  return count;
 }catch(error){throw Error(`Falha ao digitalizar pelo scanner WIA: ${error.message}`);}
 finally{await fs.rm(folder,{recursive:true,force:true});}
}
module.exports={available,scan};
