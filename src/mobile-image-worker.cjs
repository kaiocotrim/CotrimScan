// Private conversion helper. Receives image bytes on stdin and emits JPEG on stdout.
(async()=>{
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>(['rotate','enhance'].includes(process.argv[2])?30:20)*1024*1024)throw Error('Imagem excede o limite de tamanho.');chunks.push(chunk);}
 if(process.argv[2]==='enhance'){
  const result=await require('./mobile-image-quality.cjs').processScan(Buffer.concat(chunks),{...JSON.parse(process.argv[5]||'{}'),corners:process.argv[3]?JSON.parse(process.argv[3]):undefined,mode:process.argv[4]||'auto'});
  process.stdout.write(JSON.stringify({...result,image:result.image.toString('base64')}));return;
 }
 if(process.argv[2]==='rotate'){
  const angle=Number(process.argv[3]);if(![90,180,270].includes(angle))throw Error('Rotação inválida.');
  process.stdout.write(await require('sharp')(Buffer.concat(chunks),{limitInputPixels:100000000}).rotate(angle).jpeg({quality:95}).toBuffer());return;
 }
 const {normalizeMobileImage}=require('./mobile-image-core.cjs');
 process.stdout.write(await normalizeMobileImage(Buffer.concat(chunks),process.argv[2],process.argv[3],JSON.parse(process.argv[4]||'{}')));
})().catch(error=>{process.stderr.write(JSON.stringify({error:error.code==='MODULE_NOT_FOUND'?'Não foi possível carregar o conversor. Atualize as dependências do CotrimScan.':error.message}));process.exitCode=1;});
