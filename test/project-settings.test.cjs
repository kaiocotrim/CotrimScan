const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
test('editar nome dos arquivos reutiliza o A1 já liberado na sessão',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrim-settings-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const handlers=new Map(),sessions=new Map();let win,preparations=0;
 const signatures={ready:(id,signature)=>sessions.get(id)===JSON.stringify(signature),prepare:async(id,signature,password)=>{preparations++;if(password!=='validada')throw Error('Senha incorreta');sessions.set(id,JSON.stringify(signature));},transfer:(a,b)=>{sessions.set(b,sessions.get(a));sessions.delete(a);},forget:id=>sessions.delete(id),clear:()=>sessions.clear()};
 class Window{constructor(){win=this;this.webContents={mainFrame:{},setWindowOpenHandler(){},on(){},session:{setPermissionRequestHandler(){}}};}loadFile(){}}
 const electron={app:{whenReady:()=>Promise.resolve(),getPath:()=>dir,setName(){},setPath(){},on(){}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{}};
 vm.runInNewContext(await fs.readFile(path.join(__dirname,'../src/main.cjs'),'utf8'),{__dirname:path.join(__dirname,'../src'),require(name){if(name==='electron')return electron;if(name==='./signatures.cjs')return {createSignatures:()=>signatures};return name.startsWith('./')?require(path.join(__dirname,'../src',name)):require(name);}});
 await new Promise(resolve=>setImmediate(resolve));const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 const invoke=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args));
 await invoke('auth:register','usuario','senha-segura');
 const project=await invoke('projects:create',{name:'Projeto',port:9880,dpi:300,source:'Feeder',signature:{type:'a1',filePath:path.join(dir,'certificado.pfx')}},'validada');
 const updated=await invoke('projects:update',project.id,{...project,namingMode:'barcode'},'');assert.equal(updated.namingMode,'barcode');assert.equal(preparations,1);assert.equal(signatures.ready(project.id,project.signature),true);
 await assert.rejects(invoke('projects:update',project.id,{...updated,namingMode:'qr'},'errada'),/Senha incorreta/);
 assert.equal((await invoke('projects:list'))[0].namingMode,'barcode');
});
