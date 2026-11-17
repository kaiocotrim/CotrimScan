const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const sharp=require('sharp');
const {template,extract}=require('../src/capture.cjs');

test('capture decodes QR and barcode regions and preserves leading zeros',async()=>{
 const qr=await require('qrcode').toBuffer('001234',{width:250});
 const writer=require('zxing-wasm/writer');
 const wasm=await fs.readFile(require.resolve('zxing-wasm/writer/zxing_writer.wasm'));
 writer.prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)}});
 const encoded=await writer.writeBarcode('009876',{format:'Code128',scale:2});
 assert.equal(encoded.error,'');
 const bars=Buffer.from(await encoded.image.arrayBuffer());
 const image=await sharp({create:{width:1000,height:600,channels:3,background:'white'}}).composite([{input:qr,left:20,top:20},{input:bars,left:520,top:40}]).png().toBuffer();
 const field=(id,type,x)=>({id,name:id,type,required:true,region:{x,y:0,width:.5,height:1}});
 const model=template({name:'Codes',fields:[field('qr','qr',0),field('bars','barcode',.5)]});
 const result=await extract(image,model,300);
 assert.deepEqual(result.fields.map(f=>f.value),['001234','009876']);
 assert.ok(result.fields.every(f=>!f.error));
 const wrongType=await extract(image,template({name:'Wrong',fields:[field('wrong','barcode',0)]}),300);
 assert.equal(wrongType.fields[0].value,'');
 assert.match(wrongType.fields[0].error,/Nenhum código/);
});
