const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const forge=require('node-forge');
const {P12Signer}=require('@signpdf/signer-p12');
const {Signer}=require('@signpdf/signpdf');
const {windowsCertificates}=require('./windows-certificates.cjs');
function normalizeSignature(input={type:'none'}){
 if(!input||!['none','a1','a3'].includes(input.type))throw Error('Tipo de certificado inválido.');
 if(input.type==='none')return {type:'none'};
 if(input.type==='a1'){
  if(typeof input.filePath!=='string'||!path.isAbsolute(input.filePath)||! /\.(pfx|p12)$/i.test(input.filePath)||input.filePath.includes('\0'))throw Error('Selecione um certificado A1 em arquivo .pfx ou .p12.');
  return {type:'a1',filePath:input.filePath};
 }
 if(typeof input.thumbprint!=='string'||! /^[a-f0-9]{40}$/i.test(input.thumbprint))throw Error('Selecione o certificado A3 disponível no Windows.');
 return {type:'a3',thumbprint:input.thumbprint.toUpperCase(),label:typeof input.label==='string'?input.label.slice(0,300):''};
}
function validDate(metadata){const now=Date.now();if(now<new Date(metadata.validFrom).getTime()||now>=new Date(metadata.expiresAt).getTime())throw Error('O certificado está fora do período de validade.');}
function inspectP12(buffer,password){
 let p12;
 try{p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString('binary')),false,password);}
 catch{throw Error('Não foi possível abrir o certificado A1. Confira a senha e o arquivo selecionado.');}
 const keys=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[];
 const certs=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
 const key=keys.find(b=>b.key?.n&&b.key?.e)?.key;
 const certificate=key&&certs.find(b=>b.cert?.publicKey?.n?.compareTo(key.n)===0&&b.cert.publicKey.e.compareTo(key.e)===0)?.cert;
 if(!certificate)throw Error('O A1 precisa conter certificado e chave privada RSA compatíveis.');
 const usage=certificate.getExtension('keyUsage');
 if(usage&&!usage.digitalSignature&&!usage.nonRepudiation)throw Error('Este certificado não permite assinatura digital.');
 const x509=new crypto.X509Certificate(forge.pki.certificateToPem(certificate));
 const metadata={subject:certificate.subject.getField('CN')?.value||x509.subject,validFrom:x509.validFrom,expiresAt:x509.validTo,fingerprint:x509.fingerprint256};
 validDate(metadata);return metadata;
}
class MemoryP12Signer extends Signer{
 constructor(buffer,password,metadata){super();this.buffer=buffer;this.password=password;this.metadata=metadata;}
 async sign(content){validDate(this.metadata);return new P12Signer(Buffer.from(this.buffer),{passphrase:this.password}).sign(content);}
 dispose(){this.buffer.fill(0);this.password='';}
}
class WindowsSigner extends Signer{
 constructor(thumbprint,bridge=windowsCertificates){super();this.thumbprint=thumbprint;this.bridge=bridge;}
 async sign(content){
  const result=await this.bridge({action:'sign',thumbprint:this.thumbprint,content:content.toString('base64')});
  if(typeof result.signature!=='string'||! /^[A-Za-z0-9+/]+=*$/.test(result.signature))throw Error('O Windows não retornou uma assinatura válida.');
  return Buffer.from(result.signature,'base64');
 }
}
function createSignatures({windowsBridge=windowsCertificates}={}){
 const sessions=new Map();
 const key=signature=>JSON.stringify(normalizeSignature(signature));
 return {
  async list(){const result=await windowsBridge({action:'list'});return result.certificates||[];},
  ready(id,signature){return signature.type==='none'||sessions.get(id)?.key===key(signature);},
  async prepare(id,signature,password=''){
   signature=normalizeSignature(signature);
   let signer,metadata;
   if(signature.type==='none')return null;
   if(signature.type==='a1'){
    if(typeof password!=='string'||password.length>1024)throw Error('Senha do certificado inválida.');
    const stat=await fs.stat(signature.filePath).catch(()=>{throw Error('Arquivo A1 não encontrado. Edite o projeto e selecione o certificado novamente.');});
    if(!stat.isFile()||stat.size>5*1024*1024)throw Error('Arquivo de certificado A1 inválido ou maior que 5 MB.');
    const buffer=await fs.readFile(signature.filePath);
    try{metadata=inspectP12(buffer,password);signer=new MemoryP12Signer(buffer,password,metadata);}catch(error){buffer.fill(0);throw error;}
   }else{
    const rows=await this.list(),cert=rows.find(c=>c.thumbprint.toUpperCase()===signature.thumbprint);
    if(!cert)throw Error('Certificado A3 não encontrado. Conecte o token e confira o driver do Windows.');
    metadata={subject:cert.subject,expiresAt:cert.expiresAt};signer=new WindowsSigner(signature.thumbprint,windowsBridge);signer.metadata=metadata;
   }
   sessions.get(id)?.signer.dispose?.();sessions.set(id,{key:key(signature),signer,metadata});return metadata;
  },
  get(id,signature){
   if(!this.ready(id,signature))throw Error('Libere o certificado deste projeto antes de assinar.');
   return sessions.get(id)?.signer;
  },
  transfer(from,to){const session=sessions.get(from);if(!session)return;this.forget(to);sessions.set(to,session);sessions.delete(from);},
  forget(id){sessions.get(id)?.signer.dispose?.();sessions.delete(id);},
  clear(){for(const id of sessions.keys())this.forget(id);}
 };
}
module.exports={normalizeSignature,createSignatures,inspectP12,WindowsSigner};
