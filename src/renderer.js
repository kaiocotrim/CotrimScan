const $=id=>document.getElementById(id);
let count=0,creatingAccount=false,username='',currentProject=null,editingProject=null,uiBusy=false;
let projectList=[],editorOutputs=[],unlockPending=null;
function message(error){return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');}
function status(text){$('status').textContent=text;}
async function task(action,target='status'){
 if(uiBusy)return;
 uiBusy=true;
 const controls=document.querySelectorAll('.workspace button,.workspace input,.workspace select,.project-editor button,.project-editor input,.project-editor select');
 controls.forEach(e=>e.disabled=true);
 try{await action();}catch(error){$(target).textContent=message(error);}
 finally{controls.forEach(e=>e.disabled=false);document.querySelectorAll('.workspace button,.workspace input,.project-editor button,.project-editor input').forEach(e=>e.disabled=false);uiBusy=false;syncReviewControls();}
}
const run=action=>task(action);
let reviewPages=[],selectedPages=new Set(),activePage=null;
function syncReviewControls(){
 $('delete-selected').disabled=uiBusy||selectedPages.size===0;
 $('select-all').disabled=uiBusy||reviewPages.length===0;
 $('save-page').disabled=uiBusy||activePage===null;
 $('export-outputs').disabled=uiBusy||reviewPages.length===0||!currentProject?.outputs?.length;
 $('export-outputs').title=currentProject?.outputs?.length?'Enviar documentos para as pastas do projeto':'Configure as pastas de saída no editor do projeto';
 $('save-page').textContent=currentProject?.signature?.type&&currentProject.signature.type!=='none'?'Salvar PDF assinado':'Salvar JPEG';
}
function updateSelection(){
 for(const card of $('pages').querySelectorAll('.page-thumbnail')){
  const id=Number(card.dataset.pageId),selected=selectedPages.has(id);
  card.classList.toggle('is-selected',selected);card.classList.toggle('is-active',id===activePage);
  card.querySelector('input').checked=selected;
  const button=card.querySelector('.thumbnail-open');if(id===activePage)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 $('selection-count').textContent=selectedPages.size?`${selectedPages.size} selecionada(s)`:'Nenhuma selecionada';
 $('delete-selected').textContent=selectedPages.size?`Excluir selecionadas (${selectedPages.size})`:'Excluir selecionadas';
 $('select-all').textContent=selectedPages.size===reviewPages.length&&reviewPages.length?'Desmarcar todas':'Selecionar todas';
 syncReviewControls();
}
function activatePage(id){
 const page=reviewPages.find(page=>page.id===id);if(!page)return;
 activePage=id;$('document-preview').src=page.url;$('document-preview').alt=`Prévia da página ${id+1}`;
 $('document-preview').hidden=false;$('preview-empty').hidden=true;
 $('preview-title').textContent=`Página ${String(id+1).padStart(2,'0')}`;
 $('preview-position').textContent=`${id+1} de ${reviewPages.length} página(s)`;updateSelection();
 $('pages').querySelector(`[data-page-id="${id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function selectPage(id,additive=false){
 if(uiBusy)return;
 if(additive){if(selectedPages.has(id))selectedPages.delete(id);else selectedPages.add(id);}
 else selectedPages=new Set([id]);
 activatePage(id);
}
function resetPages(){
 reviewPages=[];selectedPages.clear();activePage=null;
 $('pages').replaceChildren();count=0;$('count').textContent='0 páginas';
 const empty=document.createElement('p');empty.id='empty';empty.textContent='Suas páginas aparecerão aqui.';$('pages').append(empty);
 $('document-preview').hidden=true;$('document-preview').removeAttribute('src');$('document-preview').alt='';
 $('preview-empty').hidden=false;$('preview-title').textContent='Prévia do documento';$('preview-position').textContent='Nenhum documento';
 status('Pronto para digitalizar.');updateSelection();
}
function addPage(page,follow=true){
 const {id,url}=page;reviewPages.push(page);
 $('empty')?.remove();count=reviewPages.length;$('count').textContent=`${count} página(s)`;
 const card=document.createElement('article');card.className='page-thumbnail';card.dataset.pageId=id;
 const label=document.createElement('label');label.className='thumbnail-select';
 const check=document.createElement('input');check.type='checkbox';check.disabled=uiBusy;check.setAttribute('aria-label',`Selecionar página ${id+1}`);
 check.onchange=()=>{if(uiBusy)return;if(check.checked)selectedPages.add(id);else selectedPages.delete(id);activatePage(id);};
 const name=document.createElement('span');name.textContent=`Página ${String(id+1).padStart(2,'0')}`;label.append(check,name);
 const button=document.createElement('button');button.type='button';button.className='thumbnail-open';button.disabled=uiBusy;button.setAttribute('aria-label',`Visualizar e selecionar página ${id+1}`);
 const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.draggable=false;button.append(img);
 button.onclick=event=>selectPage(id,event.ctrlKey||event.metaKey);
 button.onkeydown=event=>{
  if(!['ArrowUp','ArrowDown'].includes(event.key)||uiBusy)return;event.preventDefault();
  const next=reviewPages.findIndex(page=>page.id===id)+(event.key==='ArrowDown'?1:-1);
  if(reviewPages[next]){selectPage(reviewPages[next].id);$('pages').querySelector(`[data-page-id="${reviewPages[next].id}"] .thumbnail-open`).focus();}
 };
 card.append(label,button);$('pages').append(card);
 if(follow)activatePage(id);else updateSelection();
}
function loadReview(pages){resetPages();for(const page of pages)addPage(page,false);if(pages.length)activatePage(pages[0].id);}
window.scanner.onPage(page=>addPage(page));
$('scan').onclick=()=>run(async()=>{
 await ensureCertificate();status('Digitalizando… aguarde.');
 const n=await window.scanner.scan();status(`${n} página(s) adicionada(s) ao projeto${currentProject.outputs?.length?' e enviada(s) para as saídas':''}.`);
});
$('save-page').onclick=()=>run(async()=>{await ensureCertificate();if(await window.scanner.save(activePage))status('Documento salvo.');});
$('select-all').onclick=()=>{if(uiBusy)return;selectedPages=selectedPages.size===reviewPages.length?new Set():new Set(reviewPages.map(page=>page.id));updateSelection();};
function deleteSelected(){return run(async()=>{
 const indices=[...selectedPages].sort((a,b)=>a-b);if(!indices.length)return;
 if(!window.confirm(`Excluir ${indices.length} página(s) selecionada(s) deste projeto? As cópias já enviadas para as pastas de saída serão mantidas.`))return;
 const data=await window.scanner.remove(indices);currentProject=data.project;loadReview(data.pages);
 if(data.pages.length)activatePage(data.pages[Math.min(indices[0],data.pages.length-1)].id);
 status(`${data.removed} página(s) excluída(s) do projeto.`);
});}
$('delete-selected').onclick=deleteSelected;
document.addEventListener('keydown',event=>{
 if($('scanner-view').hidden||uiBusy||$('project-editor').open||$('certificate-unlock').open||!selectedPages.size)return;
 if(event.key!=='Delete'||event.target.closest('input:not([type="checkbox"]),textarea,select,[contenteditable="true"]'))return;
 event.preventDefault();deleteSelected();
});
function renderProjects(){
 $('projects-grid').replaceChildren();$('projects-empty').hidden=projectList.length>0;
 for(const project of projectList){
  const card=document.createElement('article');card.className='project-card';
  const title=document.createElement('h2');title.textContent=project.name;
  const folder=document.createElement('button');folder.className='folder-open';folder.type='button';
  folder.setAttribute('aria-label',`Abrir projeto ${project.name}. Dê dois cliques ou pressione Enter.`);
  const image=document.createElement('img');image.src='assets/folder.svg';image.alt='';image.draggable=false;
  const detail=document.createElement('span');detail.textContent=`${project.pageCount} página(s) · ${project.dpi} dpi`;
  folder.append(image,detail);
  folder.onclick=event=>{
   document.querySelectorAll('.project-card').forEach(e=>e.classList.remove('selected'));card.classList.add('selected');
   if(event.detail===0)openProject(project);
  };
  folder.ondblclick=()=>openProject(project);
  const edit=document.createElement('button');edit.type='button';edit.className='project-edit';edit.setAttribute('aria-label',`Editar projeto ${project.name}`);edit.title='Editar projeto';
  edit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l1-5L16 4a2.8 2.8 0 0 1 4 4L9 19Z"/></svg>';
  edit.onclick=()=>openEditor(project);
  card.append(title,folder,edit);$('projects-grid').append(card);
 }
}
async function refreshProjects(){projectList=await window.projects.list();renderProjects();}
async function showProjects(name){
 username=name;$('auth-form').reset();$('auth-status').textContent='';
 $('auth-view').hidden=true;$('scanner-view').hidden=true;$('projects-view').hidden=false;
 $('projects-user').textContent=name;$('session-user').textContent=name;
 $('projects-status').textContent='';
 try{await refreshProjects();}catch(error){$('projects-status').textContent=message(error);}
}
function openProject(project){return task(async()=>{
 const data=await window.projects.open(project.id);currentProject=data.project;
 loadReview(data.pages);
 $('active-project-name').textContent=currentProject.name;
 $('projects-view').hidden=true;$('scanner-view').hidden=false;
 if(count)status('Escolha uma página para revisar ou digitalize novos documentos.');
 },'projects-status');}
$('back-projects').onclick=()=>run(async()=>{await window.projects.close();currentProject=null;resetPages();await showProjects(username);});
function openEditor(project=null){
 if(uiBusy)return;
 editingProject=project;editorOutputs=[...(project?.outputs||[])];$('project-form').reset();$('editor-status').textContent='';
 $('editor-title').textContent=project?'Editar projeto':'Novo projeto';$('editor-save').textContent=project?'Salvar alterações':'Criar projeto';
 if(project){$('project-name').value=project.name;$('project-port').value=project.port;$('project-dpi').value=project.dpi;$('project-source').value=project.source;$('project-color').value=project.colorMode||'RGB24';}
 loadSignatureEditor(project?.signature||{type:'none'});renderOutputRows();
 $('project-editor').showModal();$('project-name').focus();
}
function showSignatureFields(){
 const type=$('project-signature').value;
 $('signature-a1').hidden=type!=='a1';$('signature-a3').hidden=type!=='a3';$('signature-summary').hidden=type==='none';
 $('certificate-file').required=type==='a1';$('certificate-store').required=type==='a3';
 $('certificate-editor-status').textContent='';
}
function loadSignatureEditor(signature){
 $('project-signature').value=signature.type;$('certificate-file').value=signature.filePath||'';
 $('certificate-store').replaceChildren(new Option('Selecione um certificado',''));
 if(signature.thumbprint)$('certificate-store').append(new Option(signature.label||signature.thumbprint,signature.thumbprint,true,true));
 showSignatureFields();
}
function editorSignature(){
 const type=$('project-signature').value;
 if(type==='a1')return {type,filePath:$('certificate-file').value};
 if(type==='a3')return {type,thumbprint:$('certificate-store').value,label:$('certificate-store').selectedOptions[0]?.textContent||''};
 return {type:'none'};
}
$('project-signature').onchange=showSignatureFields;
$('pick-certificate').onclick=()=>task(async()=>{const file=await window.certificates.pickFile();if(file)$('certificate-file').value=file;},'certificate-editor-status');
$('refresh-certificates').onclick=()=>task(async()=>{
 $('certificate-editor-status').textContent='Buscando certificados…';
 const selected=$('certificate-store').value,rows=await window.certificates.list();
 $('certificate-store').replaceChildren(new Option('Selecione um certificado',''));
 for(const row of rows)$('certificate-store').append(new Option(`${row.subject} · ${new Date(row.expiresAt).toLocaleDateString('pt-BR')}`,row.thumbprint,false,row.thumbprint===selected));
 $('certificate-editor-status').textContent=rows.length?'Selecione o certificado vinculado ao seu token ou cartão.':'Nenhum certificado disponível. Confira a conexão do token e o driver.';
},'certificate-editor-status');
async function ensureCertificate(){
 const certificate=await window.certificates.status();
 if(certificate.ready)return;
 if(certificate.type==='a3'){status('Acessando certificado do Windows… O driver poderá solicitar o PIN.');await window.certificates.prepare('');return;}
 return new Promise((resolve,reject)=>{
  unlockPending={resolve,reject};$('certificate-unlock-form').reset();$('certificate-unlock-status').textContent='';
  $('certificate-unlock').showModal();$('certificate-password').focus();
 });
}
function cancelUnlock(){
 if($('unlock-confirm').disabled)return;
 $('certificate-password').value='';$('certificate-unlock').close();
 unlockPending?.reject(Error('Operação cancelada. O certificado não foi liberado.'));unlockPending=null;
}
$('unlock-cancel').onclick=cancelUnlock;
$('certificate-unlock').addEventListener('cancel',event=>{event.preventDefault();cancelUnlock();});
$('certificate-unlock-form').onsubmit=async event=>{
 event.preventDefault();$('unlock-confirm').disabled=true;$('unlock-cancel').disabled=true;
 $('certificate-unlock-status').textContent='Conferindo certificado…';
 const password=$('certificate-password').value;$('certificate-password').value='';
 try{await window.certificates.prepare(password);$('certificate-unlock').close();unlockPending?.resolve();unlockPending=null;}
 catch(error){$('certificate-unlock-status').textContent=message(error);$('certificate-password').focus();}
 finally{$('unlock-confirm').disabled=false;$('unlock-cancel').disabled=false;}
};
function renderOutputRows(){
 $('output-list').replaceChildren();$('output-count').textContent=String(editorOutputs.length);$('outputs-empty').hidden=editorOutputs.length>0;
 editorOutputs.forEach((folder,index)=>{
  const row=document.createElement('div');row.className='output-row';
  const label=document.createElement('label');label.textContent=`Saída ${String(index+1).padStart(2,'0')}`;
  const input=document.createElement('input');input.value=folder;input.placeholder='Caminho completo da pasta';input.required=true;
  input.oninput=()=>editorOutputs[index]=input.value;label.append(input);
  const remove=document.createElement('button');remove.type='button';remove.className='remove-output';remove.textContent='×';remove.setAttribute('aria-label',`Remover saída ${index+1}`);
  remove.onclick=()=>{editorOutputs.splice(index,1);renderOutputRows();};
  row.append(label,remove);$('output-list').append(row);
 });
}
$('add-output').onclick=()=>task(async()=>{
 const folders=await window.projects.pickOutputs();
 editorOutputs=[...new Set([...editorOutputs,...folders])];renderOutputRows();
},'editor-status');
$('manual-output').onclick=()=>{editorOutputs.push('');renderOutputRows();$('output-list').lastElementChild.querySelector('input').focus();};
$('export-outputs').onclick=()=>run(async()=>{await ensureCertificate();status('Enviando documentos para as saídas…');const result=await window.projects.export();status(`${result.pages} página(s) salva(s) em ${result.outputs} pasta(s) de saída.`);});
$('new-project').onclick=()=>openEditor();$('first-project').onclick=()=>openEditor();
function closeEditor(){if(!uiBusy)$('project-editor').close();}
$('editor-close').onclick=closeEditor;$('editor-cancel').onclick=closeEditor;
$('project-editor').addEventListener('cancel',event=>{if(uiBusy)event.preventDefault();});
$('project-form').onsubmit=event=>{
 event.preventDefault();task(async()=>{
 const input={name:$('project-name').value,port:Number($('project-port').value),dpi:Number($('project-dpi').value),source:$('project-source').value,colorMode:$('project-color').value,outputs:editorOutputs,signature:editorSignature()};
 if(editingProject)await window.projects.update(editingProject.id,input);else await window.projects.create(input);
 await refreshProjects();$('project-editor').close();
 },'editor-status');
};
async function logout(){await window.localAuth.logout();currentProject=null;resetPages();await loadAuth();}
$('logout').onclick=()=>run(logout);$('projects-logout').onclick=()=>task(logout,'projects-status');
async function loadAuth(){
 $('scanner-view').hidden=true;$('projects-view').hidden=true;$('auth-view').hidden=false;$('auth-form').hidden=true;
 try {
  const session=await window.localAuth.status();
  if(session.authenticated){showProjects(session.username);return;}
  creatingAccount=!session.hasAccount;
  $('auth-title').textContent=creatingAccount?'Comece com o NAPS2':'Bem-vindo ao NAPS2';
  $('auth-description').textContent=creatingAccount?'Crie sua conta local para começar. Escolha um usuário e uma senha com pelo menos 8 caracteres.':'Entre com seu usuário e senha para acessar seus documentos e começar a digitalizar.';
  $('auth-submit').textContent=creatingAccount?'Criar conta e entrar':'Entrar';
  $('confirm-label').hidden=!creatingAccount;
  $('confirm-password').required=creatingAccount;
  $('password').minLength=creatingAccount?8:1;
  $('password').autocomplete=creatingAccount?'new-password':'current-password';
  $('auth-form').hidden=false;$('username').focus();
 }catch(error){$('auth-status').textContent=`Não foi possível carregar a conta local: ${message(error)}`;}
}
$('auth-about').onclick=()=>{
 const expanded=$('auth-about').getAttribute('aria-expanded')==='true';
 $('auth-about').setAttribute('aria-expanded',String(!expanded));$('auth-help').hidden=expanded;
};
$('auth-form').onsubmit=async event=>{
 event.preventDefault();
 if(creatingAccount && $('password').value!==$('confirm-password').value){$('auth-status').textContent='As senhas não coincidem.';return;}
 const controls=$('auth-form').querySelectorAll('input,button');
 controls.forEach(e=>e.disabled=true);$('auth-status').textContent='Validando…';
 try{
  const action=creatingAccount?'register':'login';
  const session=await window.localAuth[action]($('username').value,$('password').value);
  showProjects(session.username);
 }catch(error){$('auth-status').textContent=message(error);$('password').value='';$('confirm-password').value='';}
 finally{controls.forEach(e=>e.disabled=false);}
};

loadAuth();
