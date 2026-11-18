const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('capture',{
 calibrate:(url,dpi)=>ipcRenderer.invoke('capture:calibrate',url,dpi),
 preview:(url,field,dpi,options)=>ipcRenderer.invoke('capture:preview',url,field,dpi,options),
 sample:input=>ipcRenderer.invoke('capture:sample',input),
 models:()=>ipcRenderer.invoke('capture:models'),saveModel:model=>ipcRenderer.invoke('capture:model-save',model),assign:model=>ipcRenderer.invoke('capture:assign',model),
 read:(index,projectId)=>ipcRenderer.invoke('capture:read',index,projectId),extract:(index,projectId)=>ipcRenderer.invoke('capture:extract',index,projectId),
 save:(index,values,revision,projectId)=>ipcRenderer.invoke('capture:save',index,values,revision,projectId)
});
contextBridge.exposeInMainWorld('blankPages',{sample:(url,sensitivity)=>ipcRenderer.invoke('blank:sample',url,sensitivity),scan:input=>ipcRenderer.invoke('blank:scan',input),preview:(id,sensitivity)=>ipcRenderer.invoke('blank:preview',id,sensitivity)});
contextBridge.exposeInMainWorld('scanner',{
 connect:id=>ipcRenderer.invoke('scanners:connect',id),
 list:()=>ipcRenderer.invoke('scanners:list'),
 select:id=>ipcRenderer.invoke('scanners:select',id),
 refresh:()=>ipcRenderer.invoke('scanners:refresh'),
 addManual:input=>ipcRenderer.invoke('scanners:manual-add',input),
 removeManual:id=>ipcRenderer.invoke('scanners:manual-remove',id),
 scan:()=>ipcRenderer.invoke('scan'),
 remove:indices=>ipcRenderer.invoke('pages:remove',indices),
 rotate:(index,angle)=>ipcRenderer.invoke('pages:rotate',index,angle),
 enhance:(index,corners,mode)=>ipcRenderer.invoke('pages:enhance',index,corners,mode),
 original:index=>ipcRenderer.invoke('pages:original',index),
 ocr:index=>ipcRenderer.invoke('pages:ocr',index),
 readOcr:(index,projectId)=>ipcRenderer.invoke('pages:ocr-text',index,projectId),
 saveOcr:(index,text,revision,projectId)=>ipcRenderer.invoke('pages:ocr-save',index,text,revision,projectId),
 save:id=>ipcRenderer.invoke('save',id),
 clear:()=>ipcRenderer.invoke('clear'),
 onPage:callback=>{const listener=(_event,page)=>callback(page);ipcRenderer.on('page',listener);return ()=>ipcRenderer.removeListener('page',listener);}
});

contextBridge.exposeInMainWorld('localAuth',{
 status:()=>ipcRenderer.invoke('auth:status'),
 register:(username,password)=>ipcRenderer.invoke('auth:register',username,password),
 login:(username,password)=>ipcRenderer.invoke('auth:login',username,password),
 logout:()=>ipcRenderer.invoke('auth:logout')
});

contextBridge.exposeInMainWorld('projects',{
 rename:(id,name)=>ipcRenderer.invoke('projects:rename',id,name),
 duplicate:id=>ipcRenderer.invoke('projects:duplicate',id),
 delete:id=>ipcRenderer.invoke('projects:delete',id),
 list:()=>ipcRenderer.invoke('projects:list'),
 pickOutputs:()=>ipcRenderer.invoke('projects:pickOutputs'),
 export:()=>ipcRenderer.invoke('projects:export'),
 create:(input,password,remember)=>ipcRenderer.invoke('projects:create',input,password,remember),
 update:(id,input,password,remember)=>ipcRenderer.invoke('projects:update',id,input,password,remember),
 open:id=>ipcRenderer.invoke('projects:open',id),
 close:()=>ipcRenderer.invoke('projects:close')
});

contextBridge.exposeInMainWorld('certificates',{
 platform:()=>ipcRenderer.invoke('certificates:platform'),
 list:()=>ipcRenderer.invoke('certificates:list'),
 pickFile:()=>ipcRenderer.invoke('certificates:pickFile'),
 status:()=>ipcRenderer.invoke('certificates:status'),
 prepare:(password,remember)=>ipcRenderer.invoke('certificates:prepare',password,remember)
});
contextBridge.exposeInMainWorld('mobile',{
 addresses:()=>ipcRenderer.invoke('mobile:addresses'),
 copyLink:()=>ipcRenderer.invoke('mobile:copyLink'),
 status:()=>ipcRenderer.invoke('mobile:status'),
 start:address=>ipcRenderer.invoke('mobile:start',address),
 decide:(id,allow)=>ipcRenderer.invoke('mobile:decide',id,allow),
 stop:()=>ipcRenderer.invoke('mobile:stop'),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('mobile:state',listener);return ()=>ipcRenderer.removeListener('mobile:state',listener);},
 onReceived:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('mobile:received',listener);return ()=>ipcRenderer.removeListener('mobile:received',listener);}
});
