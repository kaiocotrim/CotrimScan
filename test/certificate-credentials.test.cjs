const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createCertificateCredentials}=require('../src/certificate-credentials.cjs');

test('senha lembrada fica cifrada e vinculada ao arquivo A1',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrim-cert-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const storage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'dpapi',encryptString:value=>Buffer.from(value.split('').reverse().join('')),decryptString:buffer=>buffer.toString().split('').reverse().join('')};
 const credentials=createCertificateCredentials(dir,storage),signature={filePath:'C:\\certificado.pfx'};
 await credentials.set('projeto',signature,'senha-privada');
 assert.equal(await credentials.get('projeto',signature),'senha-privada');
 assert.equal(await credentials.get('projeto',{filePath:'C:\\outro.pfx'}),null);
 assert.doesNotMatch(await fs.readFile(path.join(dir,'certificate-credentials.json'),'utf8'),/senha-privada/);
 await credentials.remove('projeto');assert.equal(await credentials.get('projeto',signature),null);
});

test('recusa armazenamento que cai para texto simples',async()=>{
 const credentials=createCertificateCredentials(os.tmpdir(),{isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'basic_text'});
 assert.equal(credentials.available(),false);
 await assert.rejects(credentials.set('x',{filePath:'x'},'senha'),/armazenamento seguro/);
});
