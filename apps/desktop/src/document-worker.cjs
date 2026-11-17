(async()=>{
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>30*1024*1024)throw Error('Documento maior que 30 MB.');chunks.push(chunk);}
 const result=await require('./document-core.cjs').processDocument(Buffer.concat(chunks),JSON.parse(process.argv[2]||'{}'));
 process.stdout.write(JSON.stringify({...result,image:result.image.toString('base64'),original:result.original.toString('base64'),pdf:result.pdf?.toString('base64')||null}));
})().catch(error=>{process.stderr.write(JSON.stringify({error:error.message}));process.exitCode=1;});
