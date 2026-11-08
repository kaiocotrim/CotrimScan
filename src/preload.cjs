const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('scanner',{
 connect:port=>ipcRenderer.invoke('connect',port),
 scan:()=>ipcRenderer.invoke('scan'),
 remove:indices=>ipcRenderer.invoke('pages:remove',indices),
 save:id=>ipcRenderer.invoke('save',id),
 clear:()=>ipcRenderer.invoke('clear'),
 onPage:callback=>ipcRenderer.on('page',(_event,page)=>callback(page))
});

contextBridge.exposeInMainWorld('localAuth',{
 status:()=>ipcRenderer.invoke('auth:status'),
 register:(username,password)=>ipcRenderer.invoke('auth:register',username,password),
 login:(username,password)=>ipcRenderer.invoke('auth:login',username,password),
 logout:()=>ipcRenderer.invoke('auth:logout')
});

contextBridge.exposeInMainWorld('projects',{
 list:()=>ipcRenderer.invoke('projects:list'),
 pickOutputs:()=>ipcRenderer.invoke('projects:pickOutputs'),
 export:()=>ipcRenderer.invoke('projects:export'),
 create:input=>ipcRenderer.invoke('projects:create',input),
 update:(id,input)=>ipcRenderer.invoke('projects:update',id,input),
 open:id=>ipcRenderer.invoke('projects:open',id),
 close:()=>ipcRenderer.invoke('projects:close')
});

contextBridge.exposeInMainWorld('certificates',{
 platform:()=>ipcRenderer.invoke('certificates:platform'),
 list:()=>ipcRenderer.invoke('certificates:list'),
 pickFile:()=>ipcRenderer.invoke('certificates:pickFile'),
 status:()=>ipcRenderer.invoke('certificates:status'),
 prepare:password=>ipcRenderer.invoke('certificates:prepare',password)
});
