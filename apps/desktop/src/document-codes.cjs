const path=require('node:path');
const {execFile}=require('node:child_process');
function readDocumentCode(buffer,mode){
 if(!['qr','barcode'].includes(mode))return Promise.reject(Error('Tipo de código inválido.'));
 const worker=path.join(__dirname,'document-code-worker.cjs').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
 const command=process.platform==='linux'&&process.versions.electron?'node':process.execPath;
 return new Promise((resolve,reject)=>{
  const child=execFile(command,[worker,mode],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,timeout:15000,maxBuffer:256*1024,encoding:'utf8'},(error,stdout)=>{
   if(error)return reject(Error('Não foi possível concluir a leitura do código.'));
   try{resolve(JSON.parse(stdout));}catch{reject(Error('A leitura não retornou um código válido.'));}
  });child.stdin.on('error',()=>{});child.stdin.end(buffer);
 });
}
module.exports={readDocumentCode};
