const fs=require('node:fs');
const path=require('node:path');
const MAX_BYTES=1024*1024;
// Logs keep scope and error text only; request arguments such as passwords are never written.
function createDiagnosticLog(dir){
 const file=path.join(dir,'cotrimscan.log');
 function write(level,scope,error){
  try{
   fs.mkdirSync(dir,{recursive:true,mode:0o700});
   try{if(fs.statSync(file).size>MAX_BYTES)fs.renameSync(file,file+'.old');}catch(e){if(e.code!=='ENOENT')throw e;}
   const message=error instanceof Error?(error.stack||error.message):String(error);
   fs.appendFileSync(file,`${new Date().toISOString()} ${level} ${scope} ${message}\n`,{mode:0o600});
  }catch{}
 }
 return {
  file,
  info:(scope,message)=>write('INFO',scope,message),
  error:(scope,error)=>write('ERROR',scope,error)
 };
}
module.exports={createDiagnosticLog};
