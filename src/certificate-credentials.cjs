const fs=require('node:fs/promises');
const path=require('node:path');

function createCertificateCredentials(root,safeStorage){
 const file=path.join(root,'certificate-credentials.json');
 async function read(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return {};}}
 async function write(rows){await fs.mkdir(root,{recursive:true,mode:0o700});await fs.writeFile(file,JSON.stringify(rows),{mode:0o600});}
 return {
  available(){return !!safeStorage?.isEncryptionAvailable?.() && safeStorage.getSelectedStorageBackend?.()!=='basic_text';},
  async get(id,signature){
   if(!this.available())return null;
   const entry=(await read())[id];
   if(!entry||entry.filePath!==signature.filePath)return null;
   try{return safeStorage.decryptString(Buffer.from(entry.secret,'base64'));}catch{return null;}
  },
  async set(id,signature,password){
   if(!this.available())throw Error('O armazenamento seguro de senhas não está disponível neste computador.');
   const rows=await read();rows[id]={filePath:signature.filePath,secret:safeStorage.encryptString(password).toString('base64')};await write(rows);
  },
  async remove(id){const rows=await read();if(id in rows){delete rows[id];await write(rows);}},
  async has(id,signature){return (await this.get(id,signature))!==null;}
 };
}
module.exports={createCertificateCredentials};
