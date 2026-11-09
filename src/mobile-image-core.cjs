const sharp=require('sharp');
const MAX_IMAGE_BYTES=20*1024*1024;
async function normalizeMobileImage(buffer,colorMode='RGB24',mode,options={}){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX_IMAGE_BYTES)throw Error('Envie uma imagem de até 20 MB.');
 const jpeg=buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
 const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 if(!jpeg&&!png&&!webp)throw Error('Formato não suportado. Use fotos JPEG, PNG ou WebP.');
 if(!['RGB24','Grayscale8','BlackAndWhite1'].includes(colorMode))throw Error('Modo de cor inválido.');
 try{
  const image=sharp(buffer,{limitInputPixels:40000000,failOn:'warning'});
  const metadata=await image.metadata();
  if(!metadata.width||!metadata.height||(metadata.pages||1)!==1)throw Error('Imagem inválida ou animada.');
  const selected=require('./mobile-image-quality.cjs').scanMode(mode,colorMode);
  const {image:result}=await require('./mobile-image-quality.cjs').processScan(buffer,{...options,mode:selected});
  return result;
 }catch{throw Error('Não foi possível ler a foto. Use JPEG, PNG ou WebP com até 40 megapixels.');}
}
module.exports={normalizeMobileImage,MAX_IMAGE_BYTES};
