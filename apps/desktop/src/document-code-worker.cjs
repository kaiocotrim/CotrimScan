// Isolated, offline decoding. No camera, browser, network, or document execution.
(async()=>{
 const chunks=[];let bytes=0;
 for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>30*1024*1024)throw Error('Imagem muito grande.');chunks.push(chunk);}
 const mode=process.argv[2];if(!['qr','barcode'].includes(mode))throw Error('Tipo de código inválido.');
 const image=Buffer.concat(chunks),meta=await require('sharp')(image,{limitInputPixels:40000000}).metadata();
 if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages||1)!==1)throw Error('Imagem inválida.');
 const fs=require('node:fs'),zxing=require('zxing-wasm/reader');
 const wasm=fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
 zxing.prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)}});
 const results=await zxing.readBarcodes(image,{formats:[mode==='qr'?'QRCode':'AllLinear'],tryHarder:true,tryRotate:true,tryInvert:true,maxNumberOfSymbols:8});
 const codes=[...new Map(results.filter(r=>r.text&&!r.error).map(r=>[r.text,{text:r.text,format:r.format}])).values()];
 process.stdout.write(JSON.stringify(codes.length===1&&results.length<8?{status:'found',...codes[0]}:{status:codes.length?'ambiguous':'not-found'}));
})().catch(()=>{process.stderr.write('Não foi possível ler o código desta imagem.');process.exitCode=1;});
