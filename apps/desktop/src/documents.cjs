const path=require('node:path');
const {execFile}=require('node:child_process');
function processDocument(buffer,options={}){
 if(!Buffer.isBuffer(buffer)||buffer.length>30*1024*1024)return Promise.reject(Error('Documento inválido ou maior que 30 MB.'));
 const worker=path.join(__dirname,'document-worker.cjs').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
 const command=process.platform==='linux'&&process.versions.electron?'node':process.execPath;
 return new Promise((resolve,reject)=>{
  const child=execFile(command,['--max-old-space-size=768',worker,JSON.stringify(options)],{encoding:'buffer',maxBuffer:140*1024*1024,timeout:180000,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}},(error,stdout,stderr)=>{
   if(error){let message='Não foi possível processar o documento. Confira a instalação e, no Linux, o Node.js 22.';try{message=JSON.parse(stderr.toString()).error||message;}catch{}reject(Error(message));return;}
   try{const result=JSON.parse(stdout.toString());resolve({...result,image:Buffer.from(result.image,'base64'),original:Buffer.from(result.original,'base64'),pdf:result.pdf?Buffer.from(result.pdf,'base64'):null});}catch{reject(Error('O processamento não retornou um documento válido.'));}
  });child.stdin.on('error',()=>{});child.stdin.end(buffer);
 });
}
module.exports={processDocument};
