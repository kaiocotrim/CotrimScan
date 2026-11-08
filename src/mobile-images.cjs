const path=require('node:path');
const {execFile}=require('node:child_process');
const MAX_IMAGE_BYTES=20*1024*1024;
async function normalizeMobileImage(buffer,colorMode='RGB24'){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX_IMAGE_BYTES)throw Error('Envie uma imagem de até 20 MB.');
 if(!['RGB24','Grayscale8','BlackAndWhite1'].includes(colorMode))throw Error('Modo de cor inválido.');
 // Electron/Linux leaks GLib symbols into native addons. Use the system Node runtime
 // for libvips there, keeping crashes and image decoding outside the desktop process.
 if(process.platform==='linux'&&process.versions.electron){
  const worker=path.join(__dirname,'mobile-image-worker.cjs').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
  return new Promise((resolve,reject)=>{
   const child=execFile('node',['--max-old-space-size=256',worker,colorMode],{encoding:'buffer',maxBuffer:32*1024*1024,timeout:35000},(error,stdout,stderr)=>{
    if(error){
     let message='Não foi possível converter a foto. No Linux, instale Node.js 22 ou superior e confira se o comando node está disponível.';
     try{message=JSON.parse(stderr.toString('utf8')).error||message;}catch{}
     reject(Error(message));return;
    }
    if(!stdout.length||stdout.length>30*1024*1024){reject(Error('Imagem convertida inválida.'));return;}
    resolve(stdout);
   });
   child.stdin.on('error',()=>{});child.stdin.end(buffer);
  });
 }
 return require('./mobile-image-core.cjs').normalizeMobileImage(buffer,colorMode);
}
module.exports={normalizeMobileImage,MAX_IMAGE_BYTES};
