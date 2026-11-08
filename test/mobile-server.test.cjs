const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {createMobileServer}=require('../src/mobile-server.cjs');
const {MAX_IMAGE_BYTES}=require('../src/mobile-images.cjs');
const address='127.0.0.1';
async function fixture(t,extra={}){
 const calls=[],events=[];
 const mobile=createMobileServer({addresses:()=>[{name:'Teste',address}],onImage:async bytes=>{calls.push(bytes);return {accepted:true,pageNumber:calls.length,exported:true};},onState:state=>events.push(state),...extra});
 t.after(()=>mobile.stop());const state=await mobile.start({address,projectName:'Projeto de teste'}),url=new URL(state.url),base=url.origin,token=new URLSearchParams(url.hash.slice(1)).get('token');
 async function request(route,{auth=token,method='GET',body,headers={}}={}){
  const response=await fetch(base+route,{method,headers:{Authorization:`Bearer ${auth}`,...headers},body});
  return {status:response.status,headers:response.headers,data:await response.json()};
 }
 async function pair(){const response=await request('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Celular teste'})});assert.equal(response.status,201);return response.data;}
 return {mobile,calls,events,state,base,token,request,pair};
}
test('QR temporário exige aprovação, protege origem e evita envio duplicado',async t=>{
 const f=await fixture(t),jpeg=await fs.readFile(path.join(__dirname,'fixtures/document.jpg'));
 const page=await fetch(f.base+'/');assert.equal(page.status,200);assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.equal(page.headers.get('cache-control'),'no-store');
 const logo=await fetch(f.base+'/logo.png');assert.equal(logo.status,200);assert.equal(logo.headers.get('content-type'),'image/png');assert.ok((await logo.arrayBuffer()).byteLength>0);
 assert.equal((await f.request('/api/upload',{method:'POST',auth:'errado'})).status,401);
 assert.equal((await f.request('/api/pair',{method:'POST',headers:{Origin:'https://outro.exemplo'},body:'{}'})).status,403);
 const badHost=await new Promise((resolve,reject)=>{const req=http.request(f.base+'/api/status',{headers:{Host:'outro.exemplo'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});assert.equal(badHost,403);
 const peer=await f.pair();assert.equal(f.mobile.snapshot().pending[0].code,peer.code);
 assert.equal((await f.request('/api/status',{auth:peer.secret})).data.projectName,undefined);
 const upload={method:'POST',auth:peer.secret,headers:{'Content-Type':'image/jpeg','X-Upload-Id':'a'.repeat(32)},body:jpeg};
 assert.equal((await f.request('/api/upload',upload)).status,403);assert.equal(f.calls.length,0);
 const other=await f.pair();f.mobile.decide(other.id,false);assert.equal((await f.request('/api/status',{auth:other.secret})).data.status,'rejected');
 assert.throws(()=>f.mobile.decide(peer.id,'sim'),/inválida/);
 f.mobile.decide(peer.id,true);assert.equal((await f.request('/api/status',{auth:peer.secret})).data.projectName,'Projeto de teste');
 assert.equal(f.mobile.snapshot().url,null);
 assert.equal((await f.request('/api/pair',{method:'POST',body:'{}'})).status,401);
 assert.equal((await f.request('/api/upload',{...upload,headers:{...upload.headers,'X-Upload-Id':'invalido'}})).status,400);
 assert.equal((await f.request('/api/upload',{...upload,headers:{...upload.headers,'Content-Type':'image/svg+xml'}})).status,415);
 assert.equal((await f.request('/api/upload',upload)).status,200);
 assert.equal((await f.request('/api/upload',upload)).data.pageNumber,1);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],jpeg);
 assert.equal((await f.request('/api/upload',{...upload,headers:{...upload.headers,'X-Upload-Id':'b'.repeat(32)}})).data.pageNumber,2);
 const oversized=await new Promise((resolve,reject)=>{const req=http.request(f.base+'/api/upload',{method:'POST',headers:{Authorization:`Bearer ${peer.secret}`,'Content-Type':'image/jpeg','X-Upload-Id':'c'.repeat(32),'Content-Length':MAX_IMAGE_BYTES+1}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
 assert.equal(oversized,413);assert.equal(f.calls.length,2);
 const old=f.base;await f.mobile.stop();assert.equal(f.mobile.isActive(f.state.sessionId,peer.id),false);await assert.rejects(fetch(old+'/api/status'));
});
test('expira QR, solicitação pendente e conexão inativa',async t=>{
 let time=1000;const f=await fixture(t,{now:()=>time,pairLifetime:5000,pendingLifetime:1000,idleLifetime:2000});
 const expired=await f.pair();time+=1100;await f.mobile.prune();assert.equal((await f.request('/api/status',{auth:expired.secret})).data.status,'expired');assert.throws(()=>f.mobile.decide(expired.id,true),/expirou/);
 const approved=await f.pair();f.mobile.decide(approved.id,true);time+=2100;await f.mobile.prune();assert.equal(f.mobile.snapshot().active,false);
 const next=await f.mobile.start({address,projectName:'Outro'});assert.notEqual(next.sessionId,f.state.sessionId);
 time+=5100;await f.mobile.prune();assert.equal(f.mobile.snapshot().active,false);
});
test('serializa uploads, revoga conexão e invalida credenciais antigas',async t=>{
 let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 const f=await fixture(t,{onImage:async()=>{entered();await gate;return {accepted:true,pageNumber:1,exported:false};}}),peer=await f.pair();f.mobile.decide(peer.id,true);
 const upload={method:'POST',auth:peer.secret,headers:{'Content-Type':'image/jpeg','X-Upload-Id':'d'.repeat(32)},body:Buffer.from([255,216,255])};
 const first=f.request('/api/upload',upload);await started;
 assert.equal((await f.request('/api/upload',{...upload,headers:{...upload.headers,'X-Upload-Id':'e'.repeat(32)}})).status,409);
 release();assert.equal((await first).data.exported,false);
 const next=await f.mobile.start({address,projectName:'Novo projeto'});assert.equal(f.mobile.isActive(f.state.sessionId,peer.id),false);
 const old=await fetch(new URL(next.url).origin+'/api/status',{headers:{Authorization:`Bearer ${peer.secret}`}});assert.equal(old.status,401);await old.arrayBuffer();
});
