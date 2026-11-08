const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {randomBytes,randomInt,timingSafeEqual}=require('node:crypto');
const {MAX_IMAGE_BYTES}=require('./mobile-images.cjs');
const secret=()=>randomBytes(32).toString('hex');
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function lanAddresses(){
 const rows=[];
 for(const [name,items] of Object.entries(os.networkInterfaces()))for(const item of items||[]){
  if(item.internal||item.family!=='IPv4')continue;
  if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))rows.push({name,address:item.address});
 }
 const virtual=name=>/^(docker|br-|veth|virbr|tun|tap|tailscale|utun|wg|lo)/i.test(name)?1:0;
 return rows.sort((a,b)=>virtual(a.name)-virtual(b.name)||a.name.localeCompare(b.name));
}
function failure(status,message){return Object.assign(Error(message),{status});}
async function body(req,limit){
 const length=req.headers['content-length'];
 if(length&&(!/^\d+$/.test(length)||Number(length)>limit))throw failure(413,'Arquivo muito grande. O limite é 20 MB por imagem.');
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw failure(413,'Arquivo muito grande.');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
function createMobileServer({onImage,onState=()=>{},addresses=lanAddresses,now=Date.now,pairLifetime=300000,pendingLifetime=120000,idleLifetime=1800000,maxLifetime=7200000}={}){
 let current=null;
 function snapshot(){
  const s=current;if(!s)return {active:false};
  const approved=[...s.clients.values()].find(c=>c.status==='approved');
  return {active:true,sessionId:s.id,address:s.address,port:s.port,projectName:s.projectName,
   url:s.token&&now()<s.qrExpiresAt?`${s.origin}/#token=${s.token}`:null,qrExpiresAt:s.qrExpiresAt,
   connected:approved?{id:approved.id,name:approved.name,code:approved.code}:null,
   pending:[...s.clients.values()].filter(c=>c.status==='pending').map(c=>({id:c.id,name:c.name,code:c.code,expiresAt:c.expiresAt})),receiving:s.receiving};
 }
 function emit(){onState(snapshot());}
 async function stop(){
  const s=current;if(!s)return;
  current=null;clearInterval(s.timer);s.token=null;s.clients.clear();emit();
  s.server.closeAllConnections();await new Promise(resolve=>s.server.close(()=>resolve()));
 }
 async function prune(){
  const s=current;if(!s)return;
  let changed=false;
  for(const [id,c] of s.clients){
   if(c.status==='pending'&&now()>c.expiresAt){c.status='expired';changed=true;}
   if(c.status==='approved'&&now()-c.lastUsed>idleLifetime){await stop();return;}
   if(['expired','rejected'].includes(c.status)&&now()-c.expiresAt>60000)s.clients.delete(id);
  }
  if(now()-s.startedAt>maxLifetime||(!s.receiving&&![...s.clients.values()].some(c=>c.status==='approved')&&now()>s.qrExpiresAt)){await stop();return;}
  if(changed)emit();
 }
 function isActive(sessionId,clientId){const s=current;return !!s&&s.id===sessionId&&(!clientId||s.clients.get(clientId)?.status==='approved');}
 function decide(id,allow){
  if(typeof allow!=='boolean'||typeof id!=='string')throw Error('Solicitação de pareamento inválida.');
  const s=current,c=s?.clients.get(id);
  if(!c||c.status!=='pending'||now()>c.expiresAt)throw Error('A solicitação de pareamento expirou. Gere um novo QR Code.');
  if(allow){
   if([...s.clients.values()].some(peer=>peer.status==='approved'))throw Error('Já existe um celular conectado.');
   c.status='approved';c.lastUsed=now();s.token=null;
   for(const peer of s.clients.values())if(peer.id!==id&&peer.status==='pending')peer.status='rejected';
  }else c.status='rejected';
  emit();return snapshot();
 }
 async function start({address,projectName}){
  if(!addresses().some(row=>row.address===address))throw Error('Selecione um endereço da rede local deste computador.');
  await stop();
  const files={};
  for(const [url,name,type] of [['/','index.html','text/html; charset=utf-8'],['/phone.js','phone.js','text/javascript; charset=utf-8'],['/phone.css','phone.css','text/css; charset=utf-8']])files[url]={data:await fs.readFile(path.join(__dirname,'mobile',name)),type};
  const s={id:secret(),address,projectName,startedAt:now(),qrExpiresAt:now()+pairLifetime,token:secret(),clients:new Map(),attempts:new Map(),receiving:false};
  const server=http.createServer(async(req,res)=>{
   function reply(status,value,type='application/json; charset=utf-8'){
    if(res.destroyed||res.writableEnded)return;
    res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
     'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'X-Frame-Options':'DENY',Connection:'close'});
    res.end(type.startsWith('application/json')?JSON.stringify(value):value);
   }
   try{
    if(current!==s)throw failure(410,'Conexão encerrada. Gere um novo QR Code no computador.');
    if(req.headers.host!==`${s.address}:${s.port}`)throw failure(403,'Endereço inválido.');
    if(req.headers.origin&&req.headers.origin!==s.origin||req.headers['sec-fetch-site']==='cross-site')throw failure(403,'Origem não permitida.');
    const url=new URL(req.url,s.origin);if(url.origin!==s.origin)throw failure(403,'Endereço inválido.');
    if(req.method==='GET'&&files[url.pathname]){const file=files[url.pathname];reply(200,file.data,file.type);return;}
    const auth=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(req.method==='POST'&&url.pathname==='/api/pair'){
     const ip=req.socket.remoteAddress,attempt=s.attempts.get(ip)||{count:0,since:now()};
     if(now()-attempt.since>60000){attempt.count=0;attempt.since=now();}
     attempt.count++;if(s.attempts.size>=128&&!s.attempts.has(ip))s.attempts.delete(s.attempts.keys().next().value);s.attempts.set(ip,attempt);
     if(attempt.count>20)throw failure(429,'Muitas tentativas. Aguarde um minuto.');
     if(!s.token||now()>s.qrExpiresAt||!equal(auth,s.token))throw failure(401,'QR Code inválido ou expirado. Gere outro no computador.');
     if(s.clients.size>=20||[...s.clients.values()].filter(c=>c.status==='pending').length>=3)throw failure(429,'Aguarde a confirmação no computador.');
     const input=JSON.parse((await body(req,1024)).toString('utf8'));
     const c={id:randomBytes(16).toString('hex'),secret:secret(),name:typeof input.name==='string'?input.name.trim().slice(0,50)||'Meu celular':'Meu celular',code:String(randomInt(100000,1000000)),status:'pending',expiresAt:now()+pendingLifetime,lastUsed:now(),done:new Map()};
     if(current!==s||!s.token||!equal(auth,s.token))throw failure(410,'Conexão encerrada.');
     if(now()>s.qrExpiresAt||s.clients.size>=20||[...s.clients.values()].filter(peer=>peer.status==='pending').length>=3)throw failure(429,'Pareamento indisponível. Gere um novo QR Code.');
     s.clients.set(c.id,c);emit();reply(201,{id:c.id,secret:c.secret,code:c.code,status:c.status});return;
    }
    const c=[...s.clients.values()].find(c=>equal(auth,c.secret));
    if(!c)throw failure(401,'Conexão não autorizada. Leia o QR Code novamente.');
    if(req.method==='GET'&&url.pathname==='/api/status'){
     if(now()>c.expiresAt&&c.status==='pending')c.status='expired';
     if(c.status==='approved'&&(now()-c.lastUsed>idleLifetime||now()-s.startedAt>maxLifetime))throw failure(410,'Conexão expirada.');
     reply(200,{status:c.status,code:c.code,projectName:c.status==='approved'?s.projectName:undefined});return;
    }
    if(req.method==='POST'&&url.pathname==='/api/disconnect'){
     const wasApproved=c.status==='approved';c.status='rejected';emit();reply(200,{disconnected:true});if(wasApproved)setImmediate(()=>{if(current===s)stop().catch(()=>{});});return;
    }
    if(c.status!=='approved')throw failure(403,'Aguarde a aprovação no computador antes de enviar.');
    if(req.method==='POST'&&url.pathname==='/api/upload'){
     const uploadId=req.headers['x-upload-id'];
     if(typeof uploadId!=='string'||! /^[a-f0-9]{32,64}$/.test(uploadId))throw failure(400,'Identificador de envio inválido.');
     if(c.done.has(uploadId)){reply(200,c.done.get(uploadId));return;}
     if(c.done.size>=200)throw failure(429,'Limite de 200 imagens nesta conexão. Conecte novamente para continuar.');
     if(s.receiving)throw failure(409,'Outra imagem está sendo recebida. Aguarde e tente novamente.');
     if(now()-c.lastUsed>idleLifetime||now()-s.startedAt>maxLifetime)throw failure(410,'Conexão expirada.');
     const type=(req.headers['content-type']||'').split(';')[0];
     if(!['image/jpeg','image/png','image/webp','application/octet-stream'].includes(type))throw failure(415,'Use fotos JPEG, PNG ou WebP.');
     s.receiving=true;emit();
     try{
      const bytes=await body(req,MAX_IMAGE_BYTES);
      if(!bytes.length)throw failure(415,'Envie uma imagem válida.');
      if(!isActive(s.id,c.id))throw failure(410,'Conexão encerrada.');
      c.lastUsed=now();
      const result=await onImage(bytes,{sessionId:s.id,clientId:c.id});
      if(!result?.accepted)throw Error('A imagem não foi recebida.');
      c.done.set(uploadId,result);c.lastUsed=now();reply(200,result);
     }finally{s.receiving=false;if(current===s)emit();}
     return;
    }
    throw failure(404,'Endereço não encontrado.');
   }catch(error){reply(error.status||422,{error:error.status?error.message:'Não foi possível receber a imagem. Confira o computador e tente novamente.'});}
  });
  s.server=server;server.maxHeadersCount=30;server.requestTimeout=30000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  current=s;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,address,resolve);});}
  catch{current=null;throw Error('Não foi possível abrir a conexão local. Confira a rede selecionada.');}
  s.port=server.address().port;s.origin=`http://${address}:${s.port}`;
  s.timer=setInterval(()=>{prune().catch(()=>{});},1000);s.timer.unref();emit();return snapshot();
 }
 return {start,stop,decide,snapshot,isActive,addresses,prune};
}
module.exports={createMobileServer,lanAddresses};
