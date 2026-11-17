const {execFile}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');

const candidates=[
 process.env.COTRIMSCAN_NAPS2_CONSOLE,
 path.join(__dirname,'..','.local','naps2-cli','App','NAPS2.Console.exe'),
 path.join(process.env.ProgramFiles||'C:\\Program Files','NAPS2','NAPS2.Console.exe')
].filter(Boolean);

function run(exe,args,timeout=30000){
 return new Promise((resolve,reject)=>execFile(exe,args,{windowsHide:true,timeout,maxBuffer:1024*1024},(error,stdout,stderr)=>error?reject(Error((stderr||stdout||error.message).trim())):resolve(stdout)));
}
async function device(){
 if(process.platform!=='win32')return null;
 for(const exe of candidates){
  try{
   await fs.access(exe);
   return {exe,name:'CANON DR-C340 USB #4'};
  }catch{}
 }
 return null;
}
async function scan(selected,dpi,source,colorMode,duplex,onPage,maxPages=200){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'cotrimscan-twain-'));
 try{
  const output=path.join(folder,'page-$(nnn).jpg');
  const scanSource=source==='Platen'?'glass':duplex?'duplex':'feeder';
  const bitDepth={RGB24:'color',Grayscale8:'gray',BlackAndWhite1:'bw'}[colorMode]||'color';
  const options=['--noprofile','--source',scanSource,'--dpi',String(dpi),'--bitdepth',bitDepth,'-o',output];
  try{
   await run(selected.exe,['--driver','wia','--device',selected.name,...options],300000);
  }catch(wiaError){
   const existing=(await fs.readdir(folder)).some(name=>/^page-\d+\.jpg$/i.test(name));
   if(existing||/NoMedia|PaperEmpty|alimentador vazio/i.test(wiaError.message))throw wiaError;
   try{
    await run(selected.exe,['--driver','twain','--device','Canon DR-C340 TWAIN',...options],300000);
   }catch(twainError){
    throw Error(`A captura WIA falhou: ${wiaError.message}. O driver TWAIN também falhou: ${twainError.message}`);
   }
  }
  const files=(await fs.readdir(folder)).filter(name=>/^page-\d+\.jpg$/i.test(name)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
  if(!files.length)throw Error('Nenhuma página foi recebida do scanner TWAIN.');
  if(files.length>maxPages)throw Error(`O scanner recebeu ${files.length} páginas; o limite desta operação é ${maxPages}. Coloque apenas uma folha para a prévia.`);
  for(const file of files)await onPage(await fs.readFile(path.join(folder,file)));
  return files.length;
 }finally{await fs.rm(folder,{recursive:true,force:true});}
}
module.exports={device,scan};
