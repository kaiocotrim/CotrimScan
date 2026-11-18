const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {loadAgentConfig,createScanAgent,parseScanOptions}=require('../src/scan-agent.cjs');

const ORIGIN='http://localhost:5173';
const DEVICE={id:'escl:127.0.0.1:9880',name:'Canon DR-C340',driver:'escl-local',host:'127.0.0.1',port:9880};

async function startAgent(acquire,extra={}){
 const agent=createScanAgent({
  config:{port:0,token:'a'.repeat(64),allowedOrigins:[ORIGIN]},
  acquire,
  listDevices:async()=>({devices:[DEVICE],forkError:null}),
  ...extra
 });
 const {port}=await agent.start();
 return {agent,base:`http://127.0.0.1:${port}`};
}

const auth={authorization:'Bearer '+'a'.repeat(64)};

test('agent recusa requisições sem token válido',async()=>{
 const {agent,base}=await startAgent(async()=>0);
 try{
  assert.equal((await fetch(base+'/status')).status,401);
  assert.equal((await fetch(base+'/status',{headers:{authorization:'Bearer wrong'}})).status,401);
  assert.equal((await fetch(base+'/status',{headers:auth})).status,200);
 }finally{await agent.stop();}
});

test('preflight CORS libera apenas origens permitidas e rede privada',async()=>{
 const {agent,base}=await startAgent(async()=>0);
 try{
  const ok=await fetch(base+'/scan',{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST'}});
  assert.equal(ok.status,204);
  assert.equal(ok.headers.get('access-control-allow-origin'),ORIGIN);
  assert.equal(ok.headers.get('access-control-allow-private-network'),'true');
  const blocked=await fetch(base+'/scan',{method:'OPTIONS',headers:{origin:'https://evil.example'}});
  assert.equal(blocked.status,403);
 }finally{await agent.stop();}
});

test('POST /scan devolve as páginas em JPEG base64',async()=>{
 const received=[];
 const {agent,base}=await startAgent(async(options,onPage)=>{
  received.push(options);
  await onPage(Buffer.from('page-1'));
  await onPage(Buffer.from('page-2'));
  return 2;
 });
 try{
  const response=await fetch(base+'/scan',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({device:DEVICE.id,dpi:300,source:'Feeder',colorMode:'Grayscale8',duplex:true,maxPages:2})});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.count,2);
  assert.deepEqual(body.pages.map(page=>page.mime),['image/jpeg','image/jpeg']);
  assert.equal(Buffer.from(body.pages[0].data,'base64').toString(),'page-1');
  assert.equal(received[0].colorMode,'Grayscale8');
  assert.equal(received[0].device.id,DEVICE.id);
  assert.equal(received[0].duplex,true);
 }finally{await agent.stop();}
});

test('POST /scan rejeita parâmetros inválidos antes de digitalizar',async()=>{
 let calls=0;
 const {agent,base}=await startAgent(async()=>{calls++;return 0;});
 try{
  const response=await fetch(base+'/scan',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({dpi:5000})});
  assert.equal(response.status,400);
  const tooMany=await fetch(base+'/scan',{method:'POST',headers:auth,body:JSON.stringify({maxPages:999})});
  assert.equal(tooMany.status,400);
  assert.equal(calls,0);
 }finally{await agent.stop();}
});

test('GET /devices lista scanners e POST /scan rejeita dispositivo desconhecido',async()=>{
 let calls=0;
 const {agent,base}=await startAgent(async()=>{calls++;return 0;});
 try{
  const list=await fetch(base+'/devices',{headers:auth});
  assert.equal(list.status,200);
  assert.deepEqual((await list.json()).devices,[{id:DEVICE.id,name:DEVICE.name,driver:DEVICE.driver}]);
  const unknown=await fetch(base+'/scan',{method:'POST',headers:auth,body:JSON.stringify({device:'escl:10.0.0.9:9880'})});
  assert.equal(unknown.status,400);
  assert.equal(calls,0);
 }finally{await agent.stop();}
});

test('segunda digitalização simultânea recebe 409',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const {agent,base}=await startAgent(async(_options,onPage)=>{await gate;await onPage(Buffer.from('x'));return 1;});
 try{
  const first=fetch(base+'/scan',{method:'POST',headers:auth,body:JSON.stringify({device:DEVICE.id})});
  await new Promise(resolve=>setTimeout(resolve,50));
  const second=await fetch(base+'/scan',{method:'POST',headers:auth,body:JSON.stringify({device:DEVICE.id})});
  assert.equal(second.status,409);
  release();
  assert.equal((await first).status,200);
 }finally{release();await agent.stop();}
});

test('loadAgentConfig cria token persistente de 32 bytes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'agent-'));
 const file=path.join(dir,'agent.json');
 const first=await loadAgentConfig(file);
 const second=await loadAgentConfig(file);
 assert.match(first.token,/^[0-9a-f]{64}$/);
 assert.equal(second.token,first.token);
 assert.equal(first.port,9877);
 await fs.rm(dir,{recursive:true,force:true});
});

test('parseScanOptions aplica padrões seguros',()=>{
 assert.throws(()=>parseScanOptions(''),/device/);
 const options=parseScanOptions(JSON.stringify({device:DEVICE.id}));
 assert.equal(options.device,DEVICE.id);
 assert.equal(options.dpi,300);
 assert.equal(options.source,'Feeder');
 assert.equal(options.maxPages,200);
});
