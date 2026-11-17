const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {PDFDocument}=require('pdf-lib');
const {normalizeSeparation,groupDocuments}=require('../src/document-separation.cjs');
const {createProjects}=require('../src/projects.cjs');
const {createDiagnosticLog}=require('../src/diagnostic-log.cjs');
test('agrupa por número fixo de páginas',()=>{
 const separation=normalizeSeparation({mode:'count',pagesPerDocument:2});
 assert.deepEqual(groupDocuments([false,false,false,false,false],separation),[[0,1],[2,3],[4]]);
});
test('separador por código descarta ou mantém a página separadora',()=>{
 const marks=[false,true,false,false,true,false];
 assert.deepEqual(groupDocuments(marks,normalizeSeparation({mode:'barcode'})),[[0],[2,3],[5]]);
 assert.deepEqual(groupDocuments(marks,normalizeSeparation({mode:'barcode',separatorAction:'keep'})),[[0],[1,2,3],[4,5]]);
});
test('rejeita configurações inválidas de separação',()=>{
 assert.throws(()=>normalizeSeparation({mode:'x'}),/Modo de separação inválido/);
 assert.throws(()=>normalizeSeparation({mode:'count',pagesPerDocument:0}),/1 a 200/);
 assert.throws(()=>normalizeSeparation({mode:'barcode',separatorAction:'move'}),/Ação do separador/);
});
test('registra erros em arquivo sem gravar argumentos',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'naps2-log-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const log=createDiagnosticLog(dir);
 log.error('projects:open',Error('Projeto inválido.'));
 const text=await fs.readFile(log.file,'utf8');
 assert.match(text,/ERROR projects:open Error: Projeto inválido\./);
});
test('exporta documentos com várias páginas e descarta o separador',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'naps2-docs-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const folder=path.join(dir,'saida');await fs.mkdir(folder);
 const jpeg=await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).jpeg().toBuffer();
 const store=createProjects(path.join(dir,'projects'),{readSeparator:async buffer=>({status:buffer.toString()==='SEP'?'found':'not-found'})});
 const project=await store.create({name:'Lote',port:9880,dpi:300,source:'Feeder',outputs:[folder],separation:{mode:'barcode'}});
 for(const original of ['doc','SEP','doc','doc'])await store.append(project.id,jpeg,Buffer.from(original));
 assert.deepEqual(await store.exportAll(project.id),{pages:4,documents:2,outputs:1});
 const files=(await fs.readdir(folder)).sort();
 assert.equal(files.length,2);
 assert.match(files[0],/^documento-001-[a-f0-9]{8}\.pdf$/);
 assert.equal((await PDFDocument.load(await fs.readFile(path.join(folder,files[0])))).getPageCount(),1);
 assert.equal((await PDFDocument.load(await fs.readFile(path.join(folder,files[1])))).getPageCount(),2);
});
test('rejeita separação por documento com nomenclatura por código',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'naps2-docs-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=createProjects(path.join(dir,'projects'));
 await assert.rejects(store.create({name:'Lote',port:9880,dpi:300,source:'Feeder',namingMode:'qr',separation:{mode:'count',pagesPerDocument:2}}),/nome padrão/);
});
