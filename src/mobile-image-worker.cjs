// Private conversion helper. Receives image bytes on stdin and emits JPEG on stdout.
(async()=>{
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>20*1024*1024)throw Error('Imagem maior que 20 MB.');chunks.push(chunk);}
 const {normalizeMobileImage}=require('./mobile-image-core.cjs');
 process.stdout.write(await normalizeMobileImage(Buffer.concat(chunks),process.argv[2]));
})().catch(error=>{process.stderr.write(JSON.stringify({error:error.code==='MODULE_NOT_FOUND'?'Não foi possível carregar o conversor. Atualize as dependências do CotrimScan.':error.message}));process.exitCode=1;});
