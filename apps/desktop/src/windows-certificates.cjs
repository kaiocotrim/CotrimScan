const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
async function windowsCertificates(request){
 if(process.platform!=='win32')throw Error('Certificados A3 estão disponíveis nesta versão somente no Windows, com o driver do token instalado.');
 const script=await fs.readFile(path.join(__dirname,'windows','certificates.ps1'),'utf8');
 const command=Buffer.from(script,'utf16le').toString('base64');
 const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,['-NoLogo','-NoProfile','-STA','-EncodedCommand',command],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='',finished=false;
  const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
  const timer=setTimeout(()=>{child.kill();finish(Error('Tempo de acesso ao certificado esgotado. Confira o token e tente novamente.'));},180000);
  child.on('error',()=>finish(Error('Não foi possível iniciar o acesso aos certificados do Windows.')));
  child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2*1024*1024){child.kill();finish(Error('Resposta do certificado excedeu o limite permitido.'));}});
  child.on('close',code=>{
   if(finished)return;
   try{const result=JSON.parse(output.replace(/^\uFEFF/,'').trim());
    if(code!==0||result.error)finish(Error(`Não foi possível usar o certificado: ${result.error||'confira o driver e o token.'}`));else finish(null,result);
   }catch{finish(Error('Não foi possível ler a resposta do certificado do Windows. Confira o driver do token.'));}
  });
  child.stdin.end(JSON.stringify(request));
 });
}
module.exports={windowsCertificates};
