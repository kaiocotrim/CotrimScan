const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const sharp=require('sharp');
const QR=require('qrcode');
const {readDocumentCode}=require('../src/document-codes.cjs');
const {safeCodeName}=require('../src/document-naming.cjs');
const {createProjects}=require('../src/projects.cjs');
const options={name:'Nome por código',port:9880,dpi:300,source:'Feeder'};
async function fixture(t,namingMode='qr'){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrim-code-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const output=path.join(dir,'output');await fs.mkdir(output);const store=createProjects(path.join(dir,'projects'));
 const project=await store.create({...options,outputs:[output],namingMode});return {dir,output,store,project};
}
async function barcode(value,format='Code128'){
 const writer=require('zxing-wasm/writer'),wasm=await fs.readFile(require.resolve('zxing-wasm/writer/zxing_writer.wasm'));
 writer.prepareZXingModule({overrides:{wasmBinary:wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength)}});
 const result=await writer.writeBarcode(value,{format,scale:3});assert.equal(result.error,'');return Buffer.from(await result.image.arrayBuffer());
}
test('lê QR e barras giradas separadamente, mantendo zeros à esquerda',async()=>{
 const qr=await QR.toBuffer('0019295',{width:350});
 assert.equal((await readDocumentCode(qr,'qr')).text,'0019295');assert.equal((await readDocumentCode(qr,'barcode')).status,'not-found');
 const bars=await barcode('19295');
 assert.equal((await readDocumentCode(await sharp(bars).rotate(90).png().toBuffer(),'barcode')).text,'19295');
 assert.equal((await readDocumentCode(bars,'qr')).status,'not-found');
 const ean=await barcode('5901234123457','EAN13');assert.equal((await readDocumentCode(ean,'barcode')).text,'5901234123457');
});
test('QR diferente na mesma folha não escolhe um nome arbitrário',async()=>{
 const a=await QR.toBuffer('111',{width:250}),b=await QR.toBuffer('222',{width:250});
 const image=await sharp({create:{width:650,height:400,channels:3,background:'white'}}).composite([{input:a,left:30,top:40},{input:b,left:350,top:40}]).png().toBuffer();
 assert.equal((await readDocumentCode(image,'qr')).status,'ambiguous');
});
test('normaliza nomes de arquivo sem permitir caminhos ou dispositivos Windows',()=>{
 assert.equal(safeCodeName('0019295'),'0019295');assert.equal(safeCodeName('../../pasta\\arquivo:teste?'),'pasta-arquivo-teste');
 assert.equal(safeCodeName('CON'),'_CON');assert.equal(safeCodeName('LPT1.txt'),'_LPT1.txt');assert.equal(safeCodeName('...'),null);
 assert.ok(Buffer.byteLength(safeCodeName('漢'.repeat(200)),'utf8')<=180);
 assert.ok(!/[<>:"/\\|?*]/.test(safeCodeName('https://example.com/item?id=123')));
});
test('nome por QR persiste, evita colisão e não duplica ao reenviar',async t=>{
 const f=await fixture(t),image=await sharp(await QR.toBuffer('0019295',{width:350})).jpeg().toBuffer();
 const secondFolder=path.join(f.dir,'second-output');await fs.mkdir(secondFolder);await f.store.update(f.project.id,{outputs:[f.output,secondFolder]});
 await fs.writeFile(path.join(f.output,'0019295.pdf'),'arquivo externo');
 const page=await f.store.append(f.project.id,image,image,'auto');
 await f.store.sendPage(f.project.id,page,image);
 const first=await f.store.pageOutput(f.project.id,0);assert.equal(first.filename,'0019295-2.pdf');
 assert.deepEqual(await fs.readFile(path.join(secondFolder,first.filename)),first.buffer);
 await createProjects(path.join(f.dir,'projects')).exportAll(f.project.id);assert.equal((await fs.readdir(f.output)).length,2);
 await f.store.append(f.project.id,image,image,'auto');await f.store.exportAll(f.project.id);
 assert.equal((await f.store.pageOutput(f.project.id,1)).filename,'0019295-3.pdf');assert.equal((await fs.readdir(f.output)).length,3);
 assert.equal(await fs.readFile(path.join(f.output,'0019295.pdf'),'utf8'),'arquivo externo');
 await f.store.removePages(f.project.id,[1]);assert.equal((await fs.readdir(f.output)).length,3);
 const stored=JSON.parse(await fs.readFile(path.join(f.dir,'projects',f.project.id,'project.json'),'utf8'));delete stored.namingMode;await fs.writeFile(path.join(f.dir,'projects',f.project.id,'project.json'),JSON.stringify(stored));
 assert.equal((await createProjects(path.join(f.dir,'projects')).info(f.project.id)).namingMode,'default');
});
test('projeto escolhe QR ou barras e avisa quando não há código válido',async t=>{
 const f=await fixture(t,'barcode'),image=await sharp(await barcode('19295')).jpeg().toBuffer();
 await f.store.append(f.project.id,image,image,'auto');assert.equal((await f.store.pageOutput(f.project.id,0)).filename,'19295.pdf');
 await f.store.update(f.project.id,{namingMode:'qr'});const missing=await f.store.pageOutput(f.project.id,0);assert.match(missing.filename,/^pagina-/);assert.match(missing.warning,/QR Code/);
 const result=await f.store.exportAll(f.project.id);assert.equal(result.warnings.length,1);assert.equal(result.pages,1);
 await assert.rejects(f.store.update(f.project.id,{namingMode:'unsupported'}),/nome dos arquivos/);
});
