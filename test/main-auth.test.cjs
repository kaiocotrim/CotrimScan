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
 const handlers=new Map();let win,connected=0;const sent=[],scanOptions=[];
 class Window {
  constructor(){win=this;this.webContents={mainFrame:{},setWindowOpenHandler(){},on(){},session:{setPermissionRequestHandler(){}},send:(name,page)=>sent.push(page)};}
  isDestroyed(){return false;}
  loadFile(){}
 }
 const electron={app:{whenReady:()=>Promise.resolve(),getPath:()=>dir,setName(){},setPath(){},on(){}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{}};
 const code=await fs.readFile(path.join(__dirname,'../src/main.cjs'),'utf8');
 vm.runInNewContext(code,{__dirname:path.join(__dirname,'../src'),require(name){
  if(name==='electron')return electron;
  if(name==='./auth.cjs')return {createAuth};
  if(name==='./projects.cjs')return require('../src/projects.cjs');
  if(name==='./signatures.cjs')return require('../src/signatures.cjs');
  if(name==='./mobile-server.cjs')return require('../src/mobile-server.cjs');
  if(name==='./mobile-images.cjs')return require('../src/mobile-images.cjs');
  if(name==='./scanner.cjs')return {settings:require('../src/scanner.cjs').settings,connect:()=>++connected,scan:async(port,dpi,source,onPage,colorMode)=>{scanOptions.push({port,dpi,source,colorMode});await onPage(Buffer.from('test-jpeg'));return 1;}};
  return require(name);
 }});
 await new Promise(resolve=>setImmediate(resolve));
 const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 const invoke=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args));
 for(const name of ['connect','scan','clear','save','pages:remove','projects:list','projects:create','projects:update','projects:open','projects:close','projects:pickOutputs','projects:export','certificates:platform','certificates:list','certificates:pickFile','certificates:status','certificates:prepare','mobile:addresses','mobile:copyLink','mobile:status','mobile:start','mobile:decide','mobile:stop'])await assert.rejects(invoke(name),/Faça login/);
 await invoke('auth:register','kaio','senha-segura');
 await invoke('connect',9880);assert.equal(connected,1);
 await assert.rejects(invoke('scan',{port:9880,dpi:300,source:'Feeder'}),/Abra um projeto/);
 const output=path.join(dir,'output');await fs.mkdir(output);
 const project=await invoke('projects:create',{name:'Teste',port:9880,dpi:300,source:'Feeder',outputs:[output],colorMode:'BlackAndWhite1'});
 await invoke('projects:open',project.id);
 await invoke('scan',{port:12345,dpi:600,source:'Platen',colorMode:'RGB24'});
 assert.deepEqual(scanOptions[0],{port:9880,dpi:300,source:'Feeder',colorMode:'BlackAndWhite1'});
 assert.equal(sent.length,1);
 const files=await fs.readdir(output);assert.equal(files.length,1);assert.equal(await fs.readFile(path.join(output,files[0]),'utf8'),'test-jpeg');
 assert.equal((await invoke('projects:export')).pages,1);
 await invoke('projects:close');
 assert.equal((await invoke('projects:open',project.id)).pages.length,1);
 const deleted=await invoke('pages:remove',[0]);assert.equal(deleted.removed,1);assert.equal(deleted.pages.length,0);
 assert.equal((await fs.readdir(output)).length,1);
 await invoke('scan');assert.equal((await invoke('projects:open',project.id)).pages.length,1);
 await invoke('clear');assert.equal((await invoke('projects:open',project.id)).pages.length,0);
 assert.throws(()=>handlers.get('connect')({sender:{},senderFrame:{}},9880),/inválida/);
 assert.throws(()=>handlers.get('connect')({sender:win.webContents,senderFrame:{}},9880),/inválida/);
 await invoke('auth:logout');
 for(const name of ['connect','scan','clear','save','pages:remove','projects:list','projects:create','projects:update','projects:open','projects:close','projects:pickOutputs','projects:export','certificates:platform','certificates:list','certificates:pickFile','certificates:status','certificates:prepare','mobile:addresses','mobile:copyLink','mobile:status','mobile:start','mobile:decide','mobile:stop'])await assert.rejects(invoke(name),/Faça login/);
 await invoke('auth:login','kaio','senha-segura');
 await invoke('connect',9880);assert.equal(connected,2);
});
