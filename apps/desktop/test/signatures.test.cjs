const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const forge=require('node-forge');
const {PDFDocument}=require('pdf-lib');
const {P12Signer}=require('@signpdf/signer-p12');
const {normalizeSignature,createSignatures}=require('../src/signatures.cjs');
const {createProjects}=require('../src/projects.cjs');
const {signedPage}=require('../src/pdf.cjs');
const {windowsCertificates}=require('../src/windows-certificates.cjs');
let dir,pfx,jpeg;
const password='senha-ficticia-de-teste';
before(async()=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'naps2-signature-'));
 pfx=path.join(dir,'certificate.pfx');
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const privateKey=forge.pki.privateKeyFromPem(pair.privateKey.export({type:'pkcs1',format:'pem'}));
 const publicKey=forge.pki.publicKeyFromPem(pair.publicKey.export({type:'spki',format:'pem'}));
 const certificate=forge.pki.createCertificate();certificate.publicKey=publicKey;certificate.serialNumber='01';
 certificate.validity.notBefore=new Date(Date.now()-60000);certificate.validity.notAfter=new Date(Date.now()+2*86400000);
 certificate.setSubject([{name:'commonName',value:'NAPS2 Test Certificate'}]);certificate.setIssuer(certificate.subject.attributes);
 certificate.setExtensions([{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true}]);certificate.sign(privateKey,forge.md.sha256.create());
 const p12=forge.pkcs12.toPkcs12Asn1(privateKey,[certificate],password,{algorithm:'aes256'});
 await fs.writeFile(pfx,Buffer.from(forge.asn1.toDer(p12).getBytes(),'binary'));
 jpeg=await fs.readFile(path.join(__dirname,'fixtures/document.jpg'));
});
after(async()=>{if(dir)await fs.rm(dir,{recursive:true,force:true});});
async function verify(pdf,label){
 const range=pdf.toString('latin1').match(/\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\]/);assert.ok(range);
 const [start,len,end,last]=range.slice(1).map(Number);assert.equal(start,0);assert.equal(end+last,pdf.length);
 const payload=Buffer.concat([pdf.subarray(0,len),pdf.subarray(end,end+last)]);
 const hex=pdf.subarray(len+1,end-1).toString();const raw=Buffer.from(hex,'hex');
 const count=raw[1]&0x80?raw[1]&0x7f:0;
 const signatureLength=count?2+count+raw.readUIntBE(2,count):2+raw[1];
 const der=raw.subarray(0,signatureLength);
 const parsed=forge.asn1.fromDer(der.toString('binary'));
 const signedData=parsed.value[1].value[0];
 const signerInfo=signedData.value[signedData.value.length-1].value[0];
 const attributes=signerInfo.value.find(v=>v.tagClass===forge.asn1.Class.CONTEXT_SPECIFIC&&v.type===0);
 const octets=signerInfo.value.find(v=>v.type===forge.asn1.Type.OCTETSTRING&&v.tagClass===forge.asn1.Class.UNIVERSAL);
 const signature=Buffer.from(octets.value,'binary');
 const certContainer=signedData.value.find(v=>v.tagClass===forge.asn1.Class.CONTEXT_SPECIFIC&&v.type===0);
 const certificate=forge.pki.certificateFromAsn1(certContainer.value[0]);
 const publicKey=forge.pki.publicKeyToPem(certificate.publicKey);
 function valid(content){
  if(!attributes)return crypto.verify('sha256',content,publicKey,signature);
  const digest=attributes.value.find(attr=>forge.asn1.derToOid(attr.value[0].value)===forge.pki.oids.messageDigest).value[1].value[0].value;
  if(!crypto.createHash('sha256').update(content).digest().equals(Buffer.from(digest,'binary')))return false;
  const set=forge.asn1.create(forge.asn1.Class.UNIVERSAL,forge.asn1.Type.SET,true,attributes.value);
  return crypto.verify('sha256',Buffer.from(forge.asn1.toDer(set).getBytes(),'binary'),publicKey,signature);
 }
 assert.equal(valid(payload),true,label+' assinatura válida');
 payload[100]^=1;assert.equal(valid(payload),false,label+' alteração rejeitada');
}
test('PDF pesquisável mantém OCR ao receber assinatura A1 válida',async()=>{
 const sharp=require('sharp');
 const image=await sharp(Buffer.from('<svg width="1400" height="600"><rect width="1400" height="600" fill="white"/><text x="80" y="180" font-family="Arial" font-size="60">DOCUMENTO COTRIMSCAN</text><text x="80" y="280" font-family="Arial" font-size="48">Teste de assinatura com OCR 12345</text></svg>')).jpeg().toBuffer();
 const {processDocument}=require('../src/documents.cjs');
 const result=await processDocument(image,{enhance:false,ocr:true});assert.match(result.text,/COTRIMSCAN/);assert.ok(result.pdf);
 const manager=createSignatures(),signature={type:'a1',filePath:pfx};await manager.prepare('ocr',signature,password);
 try{
  const signed=await signedPage(image,{name:'OCR assinado',dpi:300},manager.get('ocr',signature),result.pdf);
  await verify(signed,'ocr');const doc=await PDFDocument.load(signed);assert.equal(doc.getPageCount(),1);
  assert.ok(doc.getPages()[0].node.Resources().get(require('pdf-lib').PDFName.of('Font')));
  const corrected=await require('../src/pdf.cjs').correctedOcrPage(image,result.pdf,'Cliente corrigido: JOÃO DA SILVA\nContrato: 12345');
  const revised=await signedPage(image,{name:'OCR revisado',dpi:300},manager.get('ocr',signature),corrected);
  await verify(revised,'ocr-edited');assert.equal((await PDFDocument.load(revised)).getPageCount(),1);
 }finally{manager.clear();}
});
test('nome por QR mantém assinatura válida e não sobrescreve exportação anterior',async()=>{
 const output=path.join(dir,'qr-signed-output');await fs.mkdir(output);
 const manager=createSignatures(),store=createProjects(path.join(dir,'qr-projects'),{signatures:manager});
 const project=await store.create({name:'QR assinado',port:9880,dpi:300,source:'Feeder',outputs:[output],namingMode:'qr',signature:{type:'a1',filePath:pfx}});
 await manager.prepare(project.id,project.signature,password);
 try{
  const image=await require('sharp')(await require('qrcode').toBuffer('00019295',{width:350})).jpeg().toBuffer();
  const page=await store.append(project.id,image);await store.sendPage(project.id,page,image);
  const first=await store.pageOutput(project.id,0);assert.equal(first.filename,'00019295.pdf');await verify(first.buffer,'qr-named');
  await store.exportAll(project.id);assert.equal((await fs.readdir(output)).length,1);
  await store.rotate(project.id,0,90);await store.exportAll(project.id);
  const revised=await store.pageOutput(project.id,0);assert.equal(revised.filename,'00019295-2.pdf');await verify(revised.buffer,'qr-named-revised');
  assert.deepEqual(await fs.readFile(path.join(output,'00019295.pdf')),first.buffer);
 }finally{manager.clear();}
});
test('A1 validado no editor transfere a sessão sem persistir a senha',async()=>{
 const manager=createSignatures(),signature={type:'a1',filePath:pfx};
 await manager.prepare('editor',signature,password);
 const signer=manager.get('editor',signature);
 manager.transfer('editor','saved-project');
 assert.equal(manager.ready('editor',signature),false);
 assert.equal(manager.ready('saved-project',signature),true);
 assert.equal(manager.get('saved-project',signature),signer);
 await assert.rejects(manager.prepare('replacement',signature,'wrong'),/Confira a senha/);
 assert.equal(manager.get('saved-project',signature),signer);
 manager.clear();assert.equal(signer.password,'');
});
test('A1 assina PDFs reais, confere senha, integridade e encerramento de sessão',async()=>{
 const manager=createSignatures(),signature={type:'a1',filePath:pfx};
 await assert.rejects(manager.prepare('a',signature,'errada'),/Confira a senha/);
 assert.equal(manager.ready('a',signature),false);
 const metadata=await manager.prepare('a',signature,password);assert.equal(metadata.subject,'NAPS2 Test Certificate');
 assert.equal(manager.ready('a',signature),true);
 const signer=manager.get('a',signature);
 const pdf=await signedPage(jpeg,{dpi:150,name:'Teste'},signer);
 const doc=await PDFDocument.load(pdf);assert.equal(doc.getPageCount(),1);assert.equal(doc.getPages()[0].getWidth(),620*72/150);
 await verify(pdf,'a1');
 const second=await signedPage(jpeg,{dpi:150,name:'Outro'},signer);await verify(second,'a1-second');
 const stamped=await signedPage(jpeg,{dpi:150,name:'Com carimbo',signatureStamp:true},signer);
 await verify(stamped,'a1-carimbo');
 const stampedDoc=await PDFDocument.load(stamped);
 assert.equal(stampedDoc.getPages()[0].getHeight(),doc.getPages()[0].getHeight()+46);
 manager.clear();assert.equal(manager.ready('a',signature),false);assert.equal(signer.password,'');assert.ok(signer.buffer.every(byte=>byte===0));
 await assert.rejects(signedPage(jpeg,{dpi:150},null),/Nenhum PDF sem assinatura/);
});
test('A3 usa o assinador CMS do Windows por adaptador e não exporta chave privada',async()=>{
 const thumbprint='A'.repeat(40),p12=await fs.readFile(pfx),requests=[];
 const manager=createSignatures({windowsBridge:async request=>{
  requests.push(request);
  if(request.action==='list')return {certificates:[{thumbprint,subject:'Token de teste',expiresAt:new Date(Date.now()+86400000).toISOString()}]};
  assert.equal(request.thumbprint,thumbprint);assert.equal(request.password,undefined);
  const cms=await new P12Signer(Buffer.from(p12),{passphrase:password}).sign(Buffer.from(request.content,'base64'));
  return {signature:cms.toString('base64')};
 }});
 const signature={type:'a3',thumbprint};await manager.prepare('b',signature);
 const pdf=await signedPage(jpeg,{dpi:150},manager.get('b',signature));await verify(pdf,'a3-adapter');
 assert.ok(requests.some(request=>request.action==='sign'));manager.clear();
 if(process.platform!=='win32')await assert.rejects(windowsCertificates({action:'list'}),/somente no Windows/);
});
test('projeto assinado exporta somente PDF, reutiliza assinatura e não grava senha',async()=>{
 const manager=createSignatures(),store=createProjects(path.join(dir,'projects'),{signatures:manager});
 const output=path.join(dir,'output');await fs.mkdir(output);
 const signature={type:'a1',filePath:pfx,password};
 const project=await store.create({name:'Assinado',port:9880,dpi:150,source:'Feeder',outputs:[output],signature});
 const config=await fs.readFile(path.join(dir,'projects',project.id,'project.json'),'utf8');assert.ok(!config.includes(password));
 const page=await store.append(project.id,jpeg);
 await assert.rejects(store.sendPage(project.id,page,jpeg),/Libere o certificado/);
 assert.deepEqual(await fs.readdir(output),[]);assert.equal((await store.open(project.id)).pages.length,1);
 await manager.prepare(project.id,project.signature,password);
 await store.sendPage(project.id,page,jpeg);
 const files=await fs.readdir(output);assert.equal(files.length,1);assert.match(files[0],/\.pdf$/);
 const saved=await fs.readFile(path.join(output,files[0]));await verify(saved,'project');
 await store.exportAll(project.id);assert.deepEqual(await fs.readFile(path.join(output,files[0])),saved);
 await store.clear(project.id);assert.equal((await store.open(project.id)).pages.length,0);
 assert.ok((await fs.readdir(path.join(dir,'projects',project.id))).every(file=>!file.endsWith('.pdf')));
 manager.clear();
 assert.deepEqual(normalizeSignature(signature),{type:'a1',filePath:pfx});
 assert.throws(()=>normalizeSignature({type:'a3',thumbprint:'invalido'}),/Selecione/);
 assert.throws(()=>normalizeSignature({type:'a1',filePath:'relative.pfx'}),/Selecione/);
});

test('indexação fica dentro do PDF assinado e revisão gera nova assinatura sem JSON externo',async()=>{
 const output=path.join(dir,'indexed-output');await fs.mkdir(output);
 const manager=createSignatures(),signature={type:'a1',filePath:pfx},store=createProjects(path.join(dir,'indexed-projects'),{signatures:manager});
 const model={name:'OS',fields:[{id:'os',name:'Ordem de serviço',type:'identifier',required:true,digits:5,region:{x:.1,y:.1,width:.2,height:.1}}]};
 const project=await store.create({name:'Indexado',port:9880,dpi:300,source:'Feeder',outputs:[output],signature});
 await manager.prepare(project.id,signature,password);const page=await store.append(project.id,jpeg);
 const updated=await store.update(project.id,{captureTemplate:model,namingMode:'ocr',namingFieldId:'os'});
 const capture={revision:'initial',template:updated.captureTemplate,createdAt:'2026-11-09T12:00:00Z',needsReview:false,error:'',fields:[{...updated.captureTemplate.fields[0],recognized:'19236',value:'19236',confidence:96,reviewed:true,corrected:false,error:''}]};
 await fs.writeFile(path.join(dir,'indexed-projects',project.id,page+'-capture.json'),JSON.stringify(capture));
 const first=await store.pageOutput(project.id,0);assert.equal(first.filename,'19236.pdf');assert.equal(first.indexBuffer,undefined);await verify(first.buffer,'indexação assinada');
 const lib=require('pdf-lib');async function embedded(buffer){const doc=await lib.PDFDocument.load(buffer),tree=doc.catalog.lookup(lib.PDFName.of('Names'),lib.PDFDict).lookup(lib.PDFName.of('EmbeddedFiles'),lib.PDFDict).lookup(lib.PDFName.of('Names'),lib.PDFArray),file=doc.context.lookup(tree.get(1),lib.PDFDict),stream=file.lookup(lib.PDFName.of('EF'),lib.PDFDict).lookup(lib.PDFName.of('F'),lib.PDFRawStream);return JSON.parse(Buffer.from(lib.decodePDFRawStream(stream).decode()).toString('utf8'));}
 assert.equal((await embedded(first.buffer)).fields[0].value,'19236');assert.deepEqual((await store.pageOutput(project.id,0)).buffer,first.buffer);
 await store.exportAll(project.id);await store.exportAll(project.id);assert.deepEqual(await fs.readdir(output),['19236.pdf']);
 await store.saveCapture(project.id,0,[{id:'os',value:'19237',reviewed:true}],'initial');
 const revised=await store.pageOutput(project.id,0);assert.equal(revised.filename,'19237.pdf');await verify(revised.buffer,'indexação revisada assinada');assert.equal((await embedded(revised.buffer)).fields[0].value,'19237');assert.equal((await embedded(revised.buffer)).fields[0].recognized,'19236');assert.notDeepEqual(first.buffer,revised.buffer);
 await store.exportAll(project.id);assert.deepEqual((await fs.readdir(output)).sort(),['19236.pdf','19237.pdf']);
 const doc=await lib.PDFDocument.load(revised.buffer),embeddedJpeg=doc.context.enumerateIndirectObjects().map(([,o])=>o).find(o=>o instanceof lib.PDFRawStream&&o.dict.get(lib.PDFName.of('Filter'))?.toString()==='/DCTDecode');assert.deepEqual(Buffer.from(embeddedJpeg.contents),jpeg);
});
