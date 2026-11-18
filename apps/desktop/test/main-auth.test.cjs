const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {createAuth}=require('../src/auth.cjs');
test('IPC protege scanner, rejeita outras janelas e encerra sessão',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'naps2-ipc-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const handlers=new Map();let win,connected=0,sampleFailure=false;const sent=[],scanOptions=[],sampleOptions=[];const device={id:'escl:127.0.0.1:9880',name:'Canon DR-C340',driver:'escl-local',host:'127.0.0.1',port:9880};
 class Window {
  constructor(){win=this;this.webContents={mainFrame:{},setWindowOpenHandler(){},on(){},session:{setPermissionRequestHandler(){}},send:(name,page)=>sent.push(page)};}
  isDestroyed(){return false;}
  removeMenu(){}
  loadFile(){}
 }
 const electron={app:{whenReady:()=>Promise.resolve(),getPath:()=>dir,setName(){},setPath(){},on(){}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{}};
 const code=await fs.readFile(path.join(__dirname,'../src/main.cjs'),'utf8');
 vm.runInNewContext(code,{__dirname:path.join(__dirname,'../src'),require(name){
  if(name==='electron')return electron;
  if(name==='@cotrimscan/scan-core/escl-client')return {deviceId:require('@cotrimscan/scan-core/escl-client').deviceId,listDevices:async()=>({devices:[device],forkError:null}),connectDevice:async()=>{++connected;return true;},scanDevice:async(target,options,onPage)=>{assert.equal(target.id,device.id);if(options.maxPages===1){sampleOptions.push({...options});if(sampleFailure)throw Error('sample failed');await onPage(Buffer.from('sample-jpeg'));return 1;}scanOptions.push({device:target.id,...options});await onPage(Buffer.from('test-jpeg'));return 1;}};
  if(name==='./auth.cjs')return {createAuth};
  if(name==='./projects.cjs')return require('../src/projects.cjs');
  if(name==='./signatures.cjs')return require('../src/signatures.cjs');
  if(name==='./mobile-server.cjs')return require('../src/mobile-server.cjs');
  if(name==='./mobile-images.cjs')return require('../src/mobile-images.cjs');
  if(name==='./mobile-image-rotate.cjs')return {enhanceImage:async image=>({image})};
  if(name==='@cotrimscan/scan-core/scanner')return require('@cotrimscan/scan-core/scanner');
  return name.startsWith('./')?require(path.join(__dirname,'../src',name)):require(name);
 }});
 await new Promise(resolve=>setImmediate(resolve));
 const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 const invoke=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args));
 for(const name of ['capture:calibrate','capture:preview','capture:sample','capture:models','capture:model-save','capture:assign','capture:read','capture:extract','capture:save','scanners:list','scanners:select','scanners:connect','scan','clear','save','pages:remove','pages:ocr-text','pages:ocr-save','projects:list','projects:create','projects:update','projects:open','projects:close','projects:pickOutputs','projects:export','certificates:platform','certificates:list','certificates:pickFile','certificates:status','certificates:prepare','mobile:addresses','mobile:copyLink','mobile:status','mobile:start','mobile:decide','mobile:stop'])await assert.rejects(invoke(name),/Faça login/);
 await invoke('auth:register','kaio','senha-segura');
 await assert.rejects(invoke('capture:sample',{dpi:300,source:'Feeder',colorMode:'RGB24'}),/Selecione um scanner/);
 await invoke('scanners:select',device.id);assert.equal((await invoke('scanners:list')).selected,device.id);
 await invoke('scanners:connect',device.id);assert.equal(connected,1);
 await assert.rejects(invoke('capture:calibrate','not-an-image',300),/folha de exemplo/);
 await assert.rejects(invoke('capture:preview','not-an-image',{},300),/folha de exemplo/);
 const sample=await invoke('capture:sample',{port:9880,dpi:300,source:'Feeder',colorMode:'RGB24',processingMode:'auto',documentType:'document'});
 assert.ok(sample.url.startsWith('data:image/jpeg;base64,'));assert.equal(sent.length,0);assert.equal((await invoke('projects:list')).length,0);scanOptions.length=0;
 const boundedSample=await invoke('capture:sample',{port:9880,dpi:300,source:'Feeder',colorMode:'RGB24'});
 assert.equal(boundedSample.url,'data:image/jpeg;base64,'+Buffer.from('sample-jpeg').toString('base64'));
 assert.deepEqual(sampleOptions[0],{dpi:300,source:'Feeder',colorMode:'RGB24',duplex:false,maxPages:1});
 sampleFailure=true;
 await assert.rejects(invoke('capture:sample',{port:9880,dpi:300,source:'Feeder',colorMode:'RGB24'}),/sample failed/);
 await assert.rejects(invoke('scan',{dpi:300,source:'Feeder'}),/Abra um projeto/);
 const output=path.join(dir,'output');await fs.mkdir(output);
 const project=await invoke('projects:create',{name:'Teste',port:9880,dpi:300,source:'Feeder',duplex:true,outputs:[output],colorMode:'BlackAndWhite1'});
 const invalidSigned={...project,signature:{type:'a1',filePath:path.join(dir,'missing.pfx')}};
 await assert.rejects(invoke('projects:create',invalidSigned,'secret'),/Arquivo A1/);
 await assert.rejects(invoke('projects:update',project.id,invalidSigned,'secret'),/Arquivo A1/);
 assert.equal((await invoke('projects:list')).length,1);
 assert.equal((await invoke('projects:list'))[0].signature.type,'none');
 await invoke('projects:open',project.id);
 await assert.rejects(invoke('pages:ocr-text',0,'other-project'),/projeto mudou/);
 await assert.rejects(invoke('pages:ocr-save',0,'text','revision','other-project'),/projeto mudou/);
 await invoke('scan');
 assert.deepEqual(scanOptions[0],{device:device.id,dpi:300,source:'Feeder',colorMode:'BlackAndWhite1',duplex:true,maxPages:200});
 assert.equal(sent.length,2);assert.equal(sent[0].previewPending,true);assert.equal(sent[1].previewPending,undefined);
 const files=await fs.readdir(output);assert.equal(files.length,1);assert.equal(await fs.readFile(path.join(output,files[0]),'utf8'),'test-jpeg');
 assert.equal((await invoke('projects:export')).pages,1);
 await invoke('projects:close');
 assert.equal((await invoke('projects:open',project.id)).pages.length,0);
 assert.equal((await fs.readdir(output)).length,1);
 await invoke('scan');assert.equal((await invoke('projects:open',project.id)).pages.length,1);
 await invoke('clear');assert.equal((await invoke('projects:open',project.id)).pages.length,0);
 assert.throws(()=>handlers.get('scanners:connect')({sender:{},senderFrame:{}},device.id),/inválida/);
 assert.throws(()=>handlers.get('scanners:connect')({sender:win.webContents,senderFrame:{}},device.id),/inválida/);
 await invoke('auth:logout');
 for(const name of ['capture:calibrate','capture:preview','capture:sample','capture:models','capture:model-save','capture:assign','capture:read','capture:extract','capture:save','scanners:list','scanners:select','scanners:connect','scan','clear','save','pages:remove','projects:list','projects:create','projects:update','projects:open','projects:close','projects:pickOutputs','projects:export','certificates:platform','certificates:list','certificates:pickFile','certificates:status','certificates:prepare','mobile:addresses','mobile:copyLink','mobile:status','mobile:start','mobile:decide','mobile:stop'])await assert.rejects(invoke(name),/Faça login/);
 await invoke('auth:login','kaio','senha-segura');
 await invoke('scanners:connect',device.id);assert.equal(connected,2);
});
