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
function command(script,args=[],timeout=30000){
 return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...(script.startsWith('$')?['-Command',script]:['-File',script]),...args],{windowsHide:true,timeout,maxBuffer:1024*1024},(error,stdout,stderr)=>{
  if(error){
   if(stderr.includes('WIA_PAPER_EMPTY'))return reject(Error('O alimentador do scanner está vazio. Coloque o documento no alimentador e tente novamente.'));
   return reject(Error((stderr||error.message).trim()));
  }
  resolve({stdout,stderr});
 }));
}
async function scan(dpi,source,colorMode,duplex,onPage,maxPages=200){
 if(process.platform!=='win32')throw Error('A digitalização WIA requer Windows.');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'cotrimscan-wia-'));
 try{
  const script=path.join(__dirname,'wia-scan.ps1');
  const {stdout}=await command(script,['-OutputDirectory',folder,'-Dpi',String(dpi),'-Source',source,'-Duplex',duplex?'true':'false','-MaxPages',String(maxPages)],300000);
  const files=JSON.parse(stdout.trim());
  for(const file of files){
   const image=sharp(file);
   const output=colorMode==='Grayscale8'?image.grayscale():colorMode==='BlackAndWhite1'?image.threshold():image;
   await onPage(await output.jpeg({quality:95}).toBuffer());
  }
  return files.length;
 }catch(error){throw Error(`Falha ao digitalizar pelo scanner WIA: ${error.message}`);}
 finally{await fs.rm(folder,{recursive:true,force:true});}
}
module.exports={available,scan};
