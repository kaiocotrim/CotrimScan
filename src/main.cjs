const {app,BrowserWindow,ipcMain,dialog,clipboard}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
// Keep the existing local account and projects when changing the display name.
app.setName('CotrimScan');
const userDataPath=path.join(app.getPath('appData'),'naps2-desktop');
require('node:fs').mkdirSync(userDataPath,{recursive:true,mode:0o700});
app.setPath('userData',userDataPath);
const scanner=require('./scanner.cjs');
const wiaScanner=require('./wia-scanner.cjs');
const {createAuth}=require('./auth.cjs');
const {createProjects}=require('./projects.cjs');
const {createSignatures}=require('./signatures.cjs');
const {createMobileServer}=require('./mobile-server.cjs');
const {normalizeMobileImage}=require('./mobile-images.cjs');
const QRCode=require('qrcode');
let mobile,mobileProject=null;
const signatures=createSignatures();
let projects,activeProject=null;
let captureModels;
let auth;
let win, busy=false;
let pages=[];
async function operation(fn){if(busy) throw Error('Aguarde a operação em andamento.'); busy=true; try{return await fn();}finally{busy=false;}}
function requireProject(){if(!activeProject)throw Error('Abra um projeto para digitalizar.');}
function pageView(data,id){return {id,url:'data:image/jpeg;base64,'+data.toString('base64')};}
async function scanConfigured(port,dpi,source,colorMode,duplex,onPage,maxPages=200){
 if(await wiaScanner.available())return wiaScanner.scan(dpi,source,colorMode,duplex,onPage,maxPages);
 return scanner.scan(port,dpi,source,onPage,colorMode,duplex,maxPages);
}
function handle(name,fn,protectedAction=true){ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame) throw Error('Solicitação inválida.'); if(protectedAction) auth.requireSession(); return fn(...args);});}
app.whenReady().then(()=>{
 auth=createAuth(path.join(app.getPath('userData'),'account.json'));
 projects=createProjects(path.join(app.getPath('userData'),'projects'),{signatures});
 captureModels=require('./capture.cjs').createTemplates(app.getPath('userData'));
 handle('capture:sample',input=>operation(async()=>{
  const {port,dpi,source,colorMode,processingMode,documentType}=input||{};
  scanner.endpoint(port);scanner.settings(dpi,source,colorMode,false);
  const modes=require('./mobile-image-modes.cjs');
  const mode=modes.scanMode(processingMode,colorMode),type=modes.documentType(documentType);
  let sample;
  await scanConfigured(port,dpi,source,colorMode,false,async image=>{sample=image;},1);
  if(!sample)throw Error('Nenhuma folha foi recebida.');
  const result=await require('./mobile-image-rotate.cjs').enhanceImage(sample,undefined,mode,{documentType:type,dpi});
  return {url:pageView(result.image,0).url};
 }));
 handle('capture:calibrate',(url,dpi)=>operation(()=>require('./capture.cjs').calibrate(url,dpi)));
 handle('capture:preview',(url,field,dpi,options)=>operation(()=>require('./capture.cjs').preview(url,field,dpi,options)));
 handle('capture:models',()=>operation(()=>captureModels.list()));
 handle('capture:model-save',input=>operation(()=>captureModels.save(input)));
 handle('capture:assign',model=>operation(async()=>{requireProject();return projects.update(activeProject,{captureTemplate:model});}));
 handle('capture:read',(index,projectId)=>operation(async()=>{requireProject();if(projectId!==activeProject)throw Error('O projeto mudou.');return projects.captureData(activeProject,index);}));
 handle('capture:extract',(index,projectId)=>operation(async()=>{requireProject();if(projectId!==activeProject)throw Error('O projeto mudou.');return projects.capture(activeProject,index);}));
 handle('capture:save',(index,values,revision,projectId)=>operation(async()=>{requireProject();if(projectId!==activeProject)throw Error('O projeto mudou.');return projects.saveCapture(activeProject,index,values,revision);}));
 mobile=createMobileServer({
  onState:state=>{if(win&&!win.isDestroyed())win.webContents.send('mobile:state',state);},
  onImage:(buffer,context)=>{
   if(busy)throw Object.assign(Error('O computador está ocupado. Aguarde e tente novamente.'),{status:409});
   return operation(async()=>{
    auth.requireSession();
    if(activeProject!==mobileProject||!mobile.isActive(context.sessionId,context.clientId))throw Object.assign(Error('O projeto ou a conexão foi encerrado.'),{status:410});
    const project=await projects.info(activeProject);
    mobile.setReceivingStage(context.sessionId,'processing');
    const image=await normalizeMobileImage(buffer,project.colorMode,project.processingMode,{documentType:project.documentType,dpi:project.dpi}).catch(error=>{throw Object.assign(error,{status:415});});
    if(!mobile.isActive(context.sessionId,context.clientId))throw Object.assign(Error('Conexão encerrada.'),{status:410});
    mobile.setReceivingStage(context.sessionId,'saving');
    const page=await projects.append(activeProject,image,buffer,project.processingMode),id=pages.push(image)-1;
    if(!win.isDestroyed())win.webContents.send('page',{...pageView(image,id),projectId:activeProject,source:'mobile',hasProcessed:true});
    mobile.setReceivingStage(context.sessionId,'exporting');
    let warning='',exported=true;try{const output=await projects.sendPage(activeProject,page,image);warning=output.warning||'';}catch(error){warning=error.message;exported=false;}
    if(!win.isDestroyed())win.webContents.send('mobile:received',{projectId:activeProject,pageNumber:id+1,warning});
    return {accepted:true,pageNumber:id+1,exported,...(warning?{warning}:{})};
   });
  }
 });
 handle('mobile:addresses',()=>mobile.addresses());
 handle('mobile:status',async()=>{const state=mobile.snapshot();return state.url?{...state,qr:await QRCode.toDataURL(state.url,{width:280,margin:2,errorCorrectionLevel:'M'})}:state;});
 handle('mobile:copyLink',()=>{requireProject();const url=mobile.snapshot().url;if(!url)throw Error('Gere um novo QR Code para copiar o link.');clipboard.writeText(url);return true;});
 handle('mobile:start',address=>operation(async()=>{
  requireProject();const project=await projects.info(activeProject);
  mobileProject=activeProject;
  const state=await mobile.start({address,projectName:project.name});
  return {...state,qr:await QRCode.toDataURL(state.url,{errorCorrectionLevel:'M',width:280,margin:2,color:{dark:'#111111',light:'#ffffff'}})};
 }));
 handle('mobile:decide',(id,allow)=>{requireProject();return mobile.decide(id,allow);});
 handle('mobile:stop',()=>operation(async()=>{await mobile.stop();mobileProject=null;return mobile.snapshot();}));
 handle('certificates:platform',()=>({a3:process.platform==='win32'}));
 handle('certificates:list',()=>operation(()=>signatures.list()));
 handle('certificates:pickFile',()=>operation(async()=>{const result=await dialog.showOpenDialog(win,{title:'Selecionar certificado A1',properties:['openFile'],filters:[{name:'Certificado A1',extensions:['pfx','p12']}]});return result.canceled?null:result.filePaths[0];}));
 handle('certificates:status',async()=>{requireProject();const project=await projects.info(activeProject);return {type:project.signature.type,ready:signatures.ready(activeProject,project.signature)};});
 handle('certificates:prepare',password=>operation(async()=>{requireProject();const project=await projects.info(activeProject);return signatures.prepare(activeProject,project.signature,password);}));
 handle('projects:list',()=>operation(()=>projects.list()));
 async function saveProject(id,input,password){
  // Validate into a temporary memory session before changing any project data.
  const pending=require('node:crypto').randomUUID();
  const signature=input?.signature||{type:'none'};
  try{
   const before=id?await projects.info(id):null;
   const reuse=!!id&&signature.type==='a1'&&(password===undefined||password==='')&&signatures.ready(id,signature);
   if(signature.type==='a1'&&!reuse)await signatures.prepare(pending,signature,password);
   const saved=id?await projects.update(id,input):await projects.create(input);
   if(signature.type==='a1'&&!reuse)signatures.transfer(pending,saved.id);
   else if(before&&JSON.stringify(before.signature)!==JSON.stringify(saved.signature))signatures.forget(id);
   return saved;
  }finally{signatures.forget(pending);}
 }
 handle('projects:create',(input,password)=>operation(()=>saveProject(null,input,password)));
 handle('projects:update',(id,input,password)=>operation(()=>saveProject(id,input,password)));
 handle('projects:open',id=>operation(async()=>{const data=await projects.open(id); await mobile.stop();mobileProject=null;activeProject=data.project.id; pages=data.pages;return {project:data.project,pages:pages.map((buffer,index)=>({...pageView(buffer,index),hasOcr:!!data.ocr[index],hasProcessed:!!data.processed[index]}))};}));
 handle('projects:pickOutputs',()=>operation(async()=>{const result=await dialog.showOpenDialog(win,{title:'Selecionar pastas de saída',properties:['openDirectory','multiSelections','createDirectory']});return result.canceled?[]:result.filePaths;}));
 handle('projects:export',()=>operation(async()=>{requireProject();return projects.exportAll(activeProject);}));
 handle('projects:close',()=>operation(async()=>{await mobile.stop();mobileProject=null;if(activeProject)await projects.clear(activeProject);activeProject=null;pages=[];}));
 handle('auth:status',()=>auth.status(),false);
 handle('auth:register',(username,password)=>auth.register(username,password),false);
 handle('auth:login',(username,password)=>auth.login(username,password),false);
 handle('auth:logout',()=>operation(async()=>{await mobile.stop();mobileProject=null;auth.logout();signatures.clear();pages=[];activeProject=null;}));
 win=new BrowserWindow({title:'CotrimScan',icon:path.join(__dirname,'assets','icones_3d','download.png'),width:1100,height:780,minWidth:760,minHeight:600,backgroundColor:'#111827',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.removeMenu();
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 handle('connect',port=>scanner.connect(port));
 handle('scan',()=>operation(async()=>{
   requireProject();
   const project=await projects.info(activeProject);
   const {port,dpi,source,colorMode,duplex}=project;
   scanner.settings(dpi,source,colorMode,duplex);
   await projects.checkOutputs(activeProject);
   if(!signatures.ready(activeProject,project.signature))throw Error('Libere o certificado antes de digitalizar.');
   const warnings=[];
   const scanned=await scanConfigured(port,dpi,source,colorMode,duplex,async data=>{
    let image=data;const receipt=project.documentType==='receipt',processed=receipt||!!project.captureTemplate;
    if(processed){
     const result=await require('./mobile-image-rotate.cjs').enhanceImage(data,undefined,project.processingMode,{documentType:project.documentType,dpi});image=result.image;
     if(!result.cropped)warnings.push('Não foi possível recortar um dos canhotos com segurança. A imagem completa foi mantida; use Ajustar recorte.');
    }
    const page=await projects.append(activeProject,image,data,processed?project.processingMode:undefined);
    const id=pages.push(image)-1;
    if(!win.isDestroyed())win.webContents.send('page',{...pageView(image,id),hasProcessed:processed});
    const output=await projects.sendPage(activeProject,page,image);if(output.warning)warnings.push(output.warning);
   });
   return {pages:scanned,warnings};
 }));
 handle('pages:rotate',(index,angle)=>operation(async()=>{requireProject();const buffer=await projects.rotate(activeProject,index,angle);pages[index]=buffer;return pageView(buffer,index);}));
 handle('pages:enhance',(index,corners,mode)=>operation(async()=>{requireProject();const result=await projects.enhance(activeProject,index,corners,mode);pages[index]=result.image;return {...pageView(result.image,index),cropped:result.cropped,cropMethod:result.cropMethod,mode:result.mode,hasProcessed:true};}));
 handle('pages:original',index=>operation(async()=>{requireProject();const buffer=await projects.original(activeProject,index);const mime=buffer[0]===137?'image/png':buffer.toString('ascii',0,4)==='RIFF'?'image/webp':'image/jpeg';return `data:${mime};base64,${buffer.toString('base64')}`;}));
 handle('pages:ocr',index=>operation(async()=>{requireProject();const result=await projects.recognize(activeProject,index);pages[index]=result.image;return {...pageView(result.image,index),hasOcr:true,text:result.text,confidence:result.confidence,warning:result.warning};}));
 handle('pages:ocr-text',async(index,projectId)=>{requireProject();if(projectId!==activeProject)throw Error('O projeto mudou. Abra a página novamente.');const text=await projects.ocrText(projectId,index);if(projectId!==activeProject)throw Error('O projeto mudou. Abra a página novamente.');return text;});
 handle('pages:ocr-save',(index,text,revision,projectId)=>operation(async()=>{requireProject();if(projectId!==activeProject)throw Error('O projeto mudou. Abra a página novamente.');const result=await projects.saveOcrText(activeProject,index,text,revision);return {...result,image:undefined,...pageView(result.image,index),hasOcr:true};}));
 handle('pages:remove',indices=>operation(async()=>{requireProject();const removed=await projects.removePages(activeProject,indices);const data=await projects.open(activeProject);pages=data.pages;return {removed,project:data.project,pages:pages.map((buffer,index)=>({...pageView(buffer,index),hasOcr:!!data.ocr[index],hasProcessed:!!data.processed[index]}))};}));
 handle('clear',()=>operation(async()=>{requireProject();await projects.clear(activeProject);pages=[];}));
 handle('save',async id=>{
   if(!Number.isInteger(id)||!pages[id]) throw Error('Página inválida.');
   if(busy) throw Error('Aguarde a operação em andamento.');
   busy=true;
   try {
   requireProject();
   const output=await projects.pageOutput(activeProject,id);
   const result=await dialog.showSaveDialog(win,{defaultPath:output.filename,filters:[{name:output.extension==='pdf'?'Documento PDF':'Imagem JPEG',extensions:[output.extension]}]});
   if(result.canceled) return false;
   await fs.writeFile(result.filePath,output.buffer);
   return {saved:true,filename:path.basename(result.filePath),warning:output.warning};
   } finally {busy=false;}
 });
 win.loadFile(path.join(__dirname,'../dist/index.html'));
});
app.on('before-quit',()=>{mobile?.stop().catch(()=>{});signatures.clear();});
app.on('window-all-closed',async()=>{await mobile?.stop();signatures.clear();app.quit();});
