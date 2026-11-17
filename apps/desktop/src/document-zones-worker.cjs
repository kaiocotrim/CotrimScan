(async()=>{
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>30*1024*1024)throw Error('Imagem muito grande.');chunks.push(chunk);}
 const result=await require('./document-zone-core.cjs').run(Buffer.concat(chunks),JSON.parse(process.argv[2]),Number(process.argv[3]),{calibrate:process.argv[4]==='calibrate'});
 process.stdout.write(JSON.stringify(result));
})().catch(e=>{process.stderr.write(e.message);process.exitCode=1;});
