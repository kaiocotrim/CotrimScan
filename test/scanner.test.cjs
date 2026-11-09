const {test}=require('node:test');
const assert=require('node:assert/strict');
const {endpoint,settings,connect,scan}=require('../src/scanner.cjs');
test('rejeita portas e opções inválidas',()=>{
 assert.throws(()=>endpoint(80));assert.throws(()=>endpoint('9880'));
 assert.throws(()=>settings(72,'Platen'));assert.throws(()=>settings(300,'<invalid>'));
 assert.match(settings(300,'Feeder'),/<scan:XResolution>300/);
 // NAPS2 reads this field in the PWG namespace. A scan:InputSource is ignored
 // and silently falls back to Platen (one page), even with an ADF selected.
 assert.match(settings(300,'Feeder'),/<pwg:InputSource>Feeder<\/pwg:InputSource>/);
 assert.match(settings(300,'Platen'),/<pwg:InputSource>Platen<\/pwg:InputSource>/);
 assert.doesNotMatch(settings(300,'Feeder'),/<scan:InputSource>/);
 assert.match(settings(300,'Feeder'),/<scan:Duplex>false<\/scan:Duplex>/);
 assert.match(settings(300,'Feeder','RGB24',true),/<scan:Duplex>true<\/scan:Duplex>/);
 assert.throws(()=>settings(300,'Platen','RGB24',true),/alimentador/);
 assert.throws(()=>settings(300,'Feeder','RGB24','true'),/simplex\/duplex/);
});

test('duplex envia frente e verso e recebe todas as faces no mesmo trabalho',async t=>{
 let pages=0,posted=0;
 t.mock.method(global,'fetch',async(_url,init)=>{
  if(init.method==='POST'){posted++;assert.match(init.body,/<pwg:InputSource>Feeder<\/pwg:InputSource>/);assert.match(init.body,/<scan:Duplex>true<\/scan:Duplex>/);return new Response(null,{status:201,headers:{Location:'/eSCL/ScanJobs/duplex'}});}
  if(init.method==='DELETE')return new Response();
  if(pages++<4)return new Response(Buffer.from([255,216,pages]),{headers:{'Content-Type':'image/jpeg'}});
  return new Response(null,{status:404});
 });
 const received=[];assert.equal(await scan(9880,300,'Feeder',p=>received.push(p[2]),'RGB24',true),4);
 assert.equal(posted,1);assert.deepEqual(received,[1,2,3,4]);
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

test('amostra lê apenas uma página do alimentador e encerra o trabalho',async t=>{
 let reads=0,deleted=false;
 t.mock.method(global,'fetch',async(_url,init)=>{
  if(init.method==='POST'){assert.match(init.body,/<scan:Duplex>false/);return new Response(null,{status:201,headers:{Location:'/eSCL/ScanJobs/sample'}});}
  if(init.method==='DELETE'){deleted=true;return new Response();}
  reads++;return new Response(Buffer.from([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});
 });
 const pages=[];assert.equal(await scan(9880,300,'Feeder',b=>pages.push(b),'RGB24',false,1),1);
 assert.equal(reads,1);assert.equal(pages.length,1);assert.ok(deleted);
});
