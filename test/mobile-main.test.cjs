const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const sharp=require('sharp');
test('fotos entram no projeto, falha na saída preserva a página e troca de projeto revoga a conexão',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrimscan-mobile-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const handlers=new Map(),events=[];let win,callbacks,session=null,sequence=0;
 const controller={addresses:()=>[{address:'127.0.0.1',name:'Teste'}],snapshot:()=>session||{active:false},isActive:(id,client)=>session?.sessionId===id&&client==='approved',start:async options=>{session={active:true,sessionId:String(++sequence),projectName:options.projectName,url:'http://127.0.0.1:12345/#token='+('a'.repeat(64))};return session;},stop:async()=>{session=null;},decide(){}};
 controller.setReceivingStage=()=>{};
 class Window{constructor(){win=this;this.webContents={mainFrame:{},setWindowOpenHandler(){},on(){},session:{setPermissionRequestHandler(){}},send:(name,data)=>events.push({name,data})};}isDestroyed(){return false;}loadFile(){}}
 const electron={app:{whenReady:()=>Promise.resolve(),getPath:()=>dir,setName(){},setPath(){},on(){},quit(){}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{}};
 const code=await fs.readFile(path.join(__dirname,'../src/main.cjs'),'utf8');
 vm.runInNewContext(code,{__dirname:path.join(__dirname,'../src'),require(name){
  if(name==='electron')return electron;
  if(name==='./mobile-server.cjs')return {createMobileServer:options=>{callbacks=options;return controller;}};
  return name.startsWith('./')?require(path.join(__dirname,'../src',name)):require(name);
 }});
 await new Promise(resolve=>setImmediate(resolve));
 const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 const invoke=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args));
 await invoke('auth:register','kaio','senha-segura');
 const options={name:'Celular',port:9880,dpi:300,source:'Feeder',colorMode:'Grayscale8',outputs:[path.join(dir,'destino-ausente')]};
 const a=await invoke('projects:create',options),b=await invoke('projects:create',{...options,name:'Outro',outputs:[]});
 await invoke('projects:open',a.id);const paired=await invoke('mobile:start','127.0.0.1');assert.ok(paired.qr.startsWith('data:image/png;base64,'));
 const photo=await sharp({create:{width:20,height:30,channels:3,background:'#f02040'}}).png().toBuffer();
 const result=await callbacks.onImage(photo,{sessionId:paired.sessionId,clientId:'approved'});
 assert.equal(result.accepted,true);assert.equal(result.exported,false);
 const received=events.find(event=>event.name==='page');assert.equal(received.data.source,'mobile');assert.equal(received.data.projectId,a.id);
 assert.equal((await sharp(Buffer.from(received.data.url.split(',')[1],'base64')).metadata()).format,'jpeg');
 assert.ok(events.find(event=>event.name==='mobile:received').data.warning);
 await invoke('projects:open',b.id);assert.equal(controller.snapshot().active,false);
 await assert.rejects(callbacks.onImage(photo,{sessionId:paired.sessionId,clientId:'approved'}),/encerrado/);
 assert.equal((await invoke('projects:open',b.id)).pages.length,0);assert.equal((await invoke('projects:open',a.id)).pages.length,1);
 // Simulate a previously saved project whose certificate is unavailable this session.
 const locked=await require('../src/projects.cjs').createProjects(path.join(dir,'projects')).create({...options,name:'Assinado',outputs:[],signature:{type:'a1',filePath:path.join(dir,'inexistente.pfx')}});
 await invoke('projects:open',locked.id);
 const lockedPair=await invoke('mobile:start','127.0.0.1');assert.ok(lockedPair.qr);assert.equal(controller.snapshot().active,true);
 const accepted=await callbacks.onImage(photo,{sessionId:lockedPair.sessionId,clientId:'approved'});
 assert.equal(accepted.accepted,true);assert.equal(accepted.exported,false);
 assert.match(events.filter(event=>event.name==='mobile:received').at(-1).data.warning,/certificado|assinar/);
 assert.equal((await invoke('projects:open',locked.id)).pages.length,1);
 await assert.rejects(invoke('projects:export'),/saída/);
 await invoke('projects:open',b.id);await invoke('mobile:start','127.0.0.1');await invoke('auth:logout');assert.equal(controller.snapshot().active,false);
});
