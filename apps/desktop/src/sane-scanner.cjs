const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const run=promisify(execFile);
function parseDevices(stdout){
 return stdout.split(/\r?\n/).filter(Boolean).flatMap(line=>{
  const [saneId,vendor,model,type]=line.split('\t');
  if(!saneId||!type||/virtual|camera/i.test(type))return [];
  return [{id:'sane:'+saneId,saneId,name:[vendor,model].filter(Boolean).join(' '),driver:'sane'}];
 });
}
async function listDevices(){
 if(process.platform!=='linux')return [];
 const {stdout}=await run('scanimage',['--formatted-device-list=%d\t%v\t%m\t%t%n'],{timeout:30000,maxBuffer:1024*1024});
 return parseDevices(stdout);
}
let lastCapabilities;
async function scanDevice(device,options,onPage){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrimscan-sane-'));
 try{
  if(lastCapabilities?.id!==device.saneId){
   const {stdout:help}=await run('scanimage',['--device-name',device.saneId,'--all-options'],{timeout:30000,maxBuffer:1024*1024})
    .catch(error=>{
     if(/open of device.*failed.*Invalid argument/i.test(error.stderr||''))throw Error('O endereço USB do scanner mudou ou ele foi desconectado. Atualize a lista e selecione o scanner novamente.');
     throw error;
    });
   const sources=help.match(/--source (.+?) \[/)?.[1]?.split('|')||[];
   lastCapabilities={id:device.saneId,sources};
  }
  const {sources}=lastCapabilities;
  const source=options.duplex?sources.find(s=>/duplex/i.test(s)):options.source==='Platen'?sources.find(s=>/flatbed|platen/i.test(s)):sources.find(s=>/ADF Front|ADF Simplex|Automatic Document Feeder|^ADF$|Feeder/i.test(s));
  if(!source)throw Error('O driver SANE não oferece a origem de digitalização selecionada.');
  const mode={RGB24:'Color',Grayscale8:'Gray',BlackAndWhite1:'Lineart'}[options.colorMode];
  const limit=options.source==='Platen'?1:options.maxPages;
  if(!mode||!Number.isInteger(limit)||limit<1||limit>200)throw Error('Configuração de digitalização inválida.');
  const args=['--device-name',device.saneId,'--source',source,'--mode',mode,'--resolution',String(options.dpi),'--format=png',`--batch=${path.join(dir,'page-%04d.png')}`,'--batch-count',String(limit)];
  let failure;
  try{await run('scanimage',args,{timeout:300000,maxBuffer:1024*1024});}catch(error){failure=error;}
  const files=(await fs.readdir(dir)).filter(f=>/^page-\d+\.png$/.test(f)).sort();
  // SANE status 7 means the feeder has no more sheets, a normal end of batch.
  if(failure&&failure.code!==7)throw Error('Falha na digitalização SANE: '+String(failure.stderr||failure.message).slice(0,500));
  if(!files.length)throw Error('Nenhuma página digitalizada. Coloque documentos no alimentador.');
  for(const file of files){const image=await require('./mobile-images.cjs').normalizeMobileImage(await fs.readFile(path.join(dir,file)),options.colorMode,'color');await onPage(image);}
  return files.length;
 }catch(error){lastCapabilities=undefined;throw error;}finally{await fs.rm(dir,{recursive:true,force:true});}
}
module.exports={listDevices,scanDevice,parseDevices};
