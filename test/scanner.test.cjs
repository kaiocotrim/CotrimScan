const {test}=require('node:test');
const assert=require('node:assert/strict');
const {endpoint,settings,connect,scan}=require('../src/scanner.cjs');
test('rejeita portas e opções inválidas',()=>{
 assert.throws(()=>endpoint(80));assert.throws(()=>endpoint('9880'));
 assert.throws(()=>settings(72,'Platen'));assert.throws(()=>settings(300,'<invalid>'));
 assert.match(settings(300,'Feeder'),/<scan:XResolution>300/);
});
test('consulta capacidades e recebe páginas até 404',async t=>{
 let n=0,deleted=false;
 t.mock.method(global,'fetch',async(url,init)=>{
  assert.equal(new URL(url).hostname,'127.0.0.1');
  if(url.endsWith('ScannerCapabilities'))return new Response('<scan:ScannerCapabilities/>');
  if(init.method==='POST')return new Response(null,{status:201,headers:{Location:'/eSCL/ScanJobs/1'}});
  if(init.method==='DELETE'){deleted=true;return new Response();}
  if(n++<2)return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
  return new Response(null,{status:404});
 });
 await connect(9880);const pages=[];
 assert.equal(await scan(9880,300,'Feeder',p=>pages.push(p)),2);
 assert.equal(pages.length,2);assert.ok(deleted);
 t.mock.restoreAll();
});
test('recusa trabalho em outro servidor',async t=>{
 t.mock.method(global,'fetch',async()=>new Response(null,{status:201,headers:{Location:'http://example.com/eSCL/ScanJobs/1'}}));
 await assert.rejects(scan(9880,300,'Platen',()=>{}),/inválido/);
 t.mock.restoreAll();
});
test('informa erro ao iniciar trabalho',async t=>{
 t.mock.method(global,'fetch',async()=>new Response(null,{status:409}));
 await assert.rejects(scan(9880,300,'Platen',()=>{}),/409/);
 t.mock.restoreAll();
});

test('aguarda a persistência da página antes de concluir o trabalho',async t=>{
 let saved=false;
 t.mock.method(global,'fetch',async(_url,init)=>{
  if(init.method==='POST')return new Response(null,{status:201,headers:{Location:'/eSCL/ScanJobs/1'}});
  if(init.method==='DELETE')return new Response();
  return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
 });
 assert.equal(await scan(9880,300,'Platen',async()=>{await new Promise(resolve=>setImmediate(resolve));saved=true;}),1);
 assert.equal(saved,true);
 t.mock.restoreAll();
});

test('envia o modo de cor escolhido e rejeita modos desconhecidos',async t=>{
 assert.throws(()=>settings(300,'Feeder','<invalido>'),/Configuração/);
 for(const mode of ['RGB24','Grayscale8','BlackAndWhite1']){
  assert.ok(settings(300,'Feeder',mode).includes(`<scan:ColorMode>${mode}</scan:ColorMode>`));
  let body='';
  t.mock.method(global,'fetch',async(_url,init)=>{
   if(init.method==='POST'){body=init.body;return new Response(null,{status:201,headers:{Location:'/eSCL/ScanJobs/1'}});}
   if(init.method==='DELETE')return new Response();
   return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
  });
  await scan(9880,300,'Platen',()=>{},mode);
  assert.ok(body.includes(`<scan:ColorMode>${mode}</scan:ColorMode>`));t.mock.restoreAll();
 }
});
