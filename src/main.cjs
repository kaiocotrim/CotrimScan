const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
// Keep the existing local account and projects when changing the display name.
app.setName('CotrimScan');
const userDataPath=path.join(app.getPath('appData'),'naps2-desktop');
require('node:fs').mkdirSync(userDataPath,{recursive:true,mode:0o700});
app.setPath('userData',userDataPath);
const scanner=require('./scanner.cjs');
const {createAuth}=require('./auth.cjs');
const {createProjects}=require('./projects.cjs');
const {createSignatures}=require('./signatures.cjs');
const signatures=createSignatures();
let projects,activeProject=null;
let auth;
let win, busy=false;
let pages=[];
async function operation(fn){if(busy) throw Error('Aguarde a operação em andamento.'); busy=true; try{return await fn();}finally{busy=false;}}
function requireProject(){if(!activeProject)throw Error('Abra um projeto para digitalizar.');}
function pageView(data,id){return {id,url:'data:image/jpeg;base64,'+data.toString('base64')};}
function handle(name,fn,protectedAction=true){ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame) throw Error('Solicitação inválida.'); if(protectedAction) auth.requireSession(); return fn(...args);});}
app.whenReady().then(()=>{
 auth=createAuth(path.join(app.getPath('userData'),'account.json'));
 projects=createProjects(path.join(app.getPath('userData'),'projects'),{signatures});
 handle('certificates:platform',()=>({a3:process.platform==='win32'}));
 handle('certificates:list',()=>operation(()=>signatures.list()));
 handle('certificates:pickFile',()=>operation(async()=>{const result=await dialog.showOpenDialog(win,{title:'Selecionar certificado A1',properties:['openFile'],filters:[{name:'Certificado A1',extensions:['pfx','p12']}]});return result.canceled?null:result.filePaths[0];}));
 handle('certificates:status',async()=>{requireProject();const project=await projects.info(activeProject);return {type:project.signature.type,ready:signatures.ready(activeProject,project.signature)};});
 handle('certificates:prepare',password=>operation(async()=>{requireProject();const project=await projects.info(activeProject);return signatures.prepare(activeProject,project.signature,password);}));
 handle('projects:list',()=>operation(()=>projects.list()));
 handle('projects:create',input=>operation(()=>projects.create(input)));
 handle('projects:update',(id,input)=>operation(async()=>{const before=await projects.info(id);const after=await projects.update(id,input);if(JSON.stringify(before.signature)!==JSON.stringify(after.signature))signatures.forget(id);return after;}));
 handle('projects:open',id=>operation(async()=>{const data=await projects.open(id); activeProject=data.project.id; pages=data.pages;return {project:data.project,pages:pages.map(pageView)};}));
 handle('projects:pickOutputs',()=>operation(async()=>{const result=await dialog.showOpenDialog(win,{title:'Selecionar pastas de saída',properties:['openDirectory','multiSelections','createDirectory']});return result.canceled?[]:result.filePaths;}));
 handle('projects:export',()=>operation(async()=>{requireProject();return projects.exportAll(activeProject);}));
 handle('projects:close',()=>operation(()=>{activeProject=null;pages=[];}));
 handle('auth:status',()=>auth.status(),false);
 handle('auth:register',(username,password)=>auth.register(username,password),false);
 handle('auth:login',(username,password)=>auth.login(username,password),false);
 handle('auth:logout',()=>{if(busy) throw Error('Aguarde a operação em andamento.'); auth.logout();signatures.clear(); pages=[];activeProject=null;});
 win=new BrowserWindow({title:'CotrimScan',width:1100,height:780,minWidth:760,minHeight:600,backgroundColor:'#111827',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 handle('connect',port=>scanner.connect(port));
 handle('scan',()=>operation(async()=>{
   requireProject();
   const project=await projects.info(activeProject);
   const {port,dpi,source,colorMode}=project;
   scanner.settings(dpi,source,colorMode);
   await projects.checkOutputs(activeProject);
   if(!signatures.ready(activeProject,project.signature))throw Error('Libere o certificado antes de digitalizar.');
   return scanner.scan(port,dpi,source,async data=>{
    const page=await projects.append(activeProject,data);
    const id=pages.push(data)-1;
    if(!win.isDestroyed())win.webContents.send('page',pageView(data,id));
    await projects.sendPage(activeProject,page,data);
   },colorMode);
 }));
 handle('pages:remove',indices=>operation(async()=>{requireProject();const removed=await projects.removePages(activeProject,indices);const data=await projects.open(activeProject);pages=data.pages;return {removed,project:data.project,pages:pages.map(pageView)};}));
 handle('clear',()=>operation(async()=>{requireProject();await projects.clear(activeProject);pages=[];}));
 handle('save',async id=>{
   if(!Number.isInteger(id)||!pages[id]) throw Error('Página inválida.');
   if(busy) throw Error('Aguarde a operação em andamento.');
   busy=true;
   try {
   requireProject();
   const output=await projects.pageOutput(activeProject,id);
   const result=await dialog.showSaveDialog(win,{defaultPath:output.filename,filters:[{name:output.extension==='pdf'?'PDF assinado':'Imagem JPEG',extensions:[output.extension]}]});
   if(result.canceled) return false;
   await fs.writeFile(result.filePath,output.buffer); return true;
   } finally {busy=false;}
 });
 win.loadFile(path.join(__dirname,'index.html'));
});
app.on('window-all-closed',()=>{signatures.clear();app.quit();});
