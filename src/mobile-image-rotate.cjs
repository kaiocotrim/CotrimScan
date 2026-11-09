const path=require('node:path');
const {execFile}=require('node:child_process');
async function rotateImage(buffer,angle){
 if(![90,180,270].includes(angle))throw Error('Rotação inválida.');
 return transformImage(buffer,['rotate',String(angle)]);
}
async function enhanceImage(buffer,corners,mode='auto',options={}){
 const output=await transformImage(buffer,['enhance',corners===undefined?'':JSON.stringify(corners),mode,JSON.stringify(options)]);
 try{const result=JSON.parse(output.toString());return {image:Buffer.from(result.image,'base64'),cropped:result.cropped,cropMethod:result.cropMethod,mode:result.mode};}
 catch{throw Error('O processamento não retornou uma imagem válida.');}
}
async function transformImage(buffer,args){
 const worker=path.join(__dirname,'mobile-image-worker.cjs').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
 const runtime=process.platform==='linux'&&process.versions.electron?'node':process.execPath;
 return new Promise((resolve,reject)=>{
  const child=execFile(runtime,[worker,...args],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'buffer',maxBuffer:48*1024*1024,timeout:120000,windowsHide:true},(error,stdout)=>{
   if(error||!stdout.length)return reject(Error('Não foi possível processar a imagem.'));
   resolve(stdout);
  });
  child.stdin.on('error',()=>{});child.stdin.end(buffer);
 });
}
module.exports={rotateImage,enhanceImage};
