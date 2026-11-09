const $=id=>document.getElementById(id);
let count=0,creatingAccount=false,username='',currentProject=null,editingProject=null,uiBusy=false;
let projectList=[],editorOutputs=[],unlockPending=null;
function message(error){return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');}
function status(text){$('status').textContent=text;}
async function task(action,target='status'){
 if(uiBusy)return;
 uiBusy=true;
 const controls=document.querySelectorAll('.workspace button,.workspace input,.workspace select,.workspace textarea,.project-editor button,.project-editor input,.project-editor select,.capture-editor button,.capture-editor input,.capture-editor select');
 controls.forEach(e=>e.disabled=true);
 try{await action();}catch(error){$(target).textContent=message(error);}
 finally{controls.forEach(e=>e.disabled=false);document.querySelectorAll('.workspace button,.workspace input,.project-editor button,.project-editor input').forEach(e=>e.disabled=false);uiBusy=false;syncReviewControls();syncDuplexField();}
}
const run=action=>task(action);
let reviewPages=[],selectedPages=new Set(),activePage=null,remoteReceiving=false;
function syncReviewControls(){
 const locked=uiBusy||remoteReceiving;
 $('scan').disabled=locked;
 for(const input of $('pages').querySelectorAll('button,input'))input.disabled=locked;
 $('delete-selected').disabled=locked||selectedPages.size===0;
 $('select-all').disabled=locked||reviewPages.length===0;
 $('save-page').disabled=locked||activePage===null;
 $('enhance-page').disabled=locked||activePage===null;
 $('manual-crop-page').disabled=locked||activePage===null;
 $('ocr-page').disabled=locked||activePage===null;
 $('compare-page').disabled=locked||activePage===null;
 $('processing-mode').disabled=locked||activePage===null;
 $('export-outputs').disabled=locked||reviewPages.length===0||!currentProject?.outputs?.length;
 $('export-outputs').title=currentProject?.outputs?.length?'Enviar documentos para as pastas do projeto':'Configure as pastas de saída no editor do projeto';
 const page=reviewPages.find(p=>p.id===activePage);
 $('ocr-page').textContent=page?.hasOcr?'Revisar texto (OCR)':'Reconhecer texto (OCR)';
 syncOcrControls(page);
 window.captureUI?.sync();
 window.previewZoom?.syncControls(locked);
 $('save-page').textContent=currentProject?.signature?.type&&currentProject.signature.type!=='none'?'Salvar PDF assinado':page?.hasOcr?'Salvar PDF pesquisável':page?.hasProcessed||page?.captureData?'Salvar PDF':'Salvar JPEG';
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
 activePage=id;
 if(window.previewZoom)window.previewZoom.setImage(page.url,`Prévia da página ${id+1}`);
 else{$('document-preview').src=page.url;$('document-preview').alt=`Prévia da página ${id+1}`;}
 $('zoom-stage').hidden=false;
 $('document-preview').hidden=false;$('preview-empty').hidden=true;
 $('preview-title').textContent=`Página ${String(id+1).padStart(2,'0')}`;
 $('preview-position').textContent=`${id+1} de ${reviewPages.length} página(s)`;updateSelection();
 renderOcrEditor(page);
 window.captureUI?.activate(page);
 $('pages').querySelector(`[data-page-id="${id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function selectPage(id,additive=false){
 if(uiBusy||remoteReceiving)return;
 if(additive){if(selectedPages.has(id))selectedPages.delete(id);else selectedPages.add(id);}
 else selectedPages=new Set([id]);
 activatePage(id);
}
function resetPages(){
 window.captureUI?.reset();
 window.previewZoom?.clear();$('zoom-stage').hidden=true;
 setOcrVisible(false);$('ocr-result-text').value='';$('ocr-result-status').textContent='';
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
 card.oncontextmenu=event=>showRotationMenu(event,id);
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
const rotationMenu=document.createElement('div');rotationMenu.className='page-context-menu';rotationMenu.hidden=true;rotationMenu.setAttribute('role','menu');document.body.append(rotationMenu);
function closeRotationMenu(){rotationMenu.hidden=true;}
function showRotationMenu(event,id){
 event.preventDefault();if(uiBusy||remoteReceiving)return;
 activatePage(id);rotationMenu.replaceChildren();
 for(const [label,angle] of [['Girar 90° à esquerda',270],['Girar 90° à direita',90],['Girar 180°',180]]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('role','menuitem');
  button.onclick=()=>{closeRotationMenu();run(async()=>{
   if(!confirmDiscardOcr(reviewPages.find(p=>p.id===id)))return;
   status('Girando imagem…');const page=await window.scanner.rotate(id,angle);
   reviewPages[reviewPages.findIndex(item=>item.id===id)]=page;
   $('pages').querySelector(`[data-page-id="${id}"] img`).src=page.url;activatePage(id);
   status('Imagem girada e salva no projeto. Use Enviar para saídas para exportar a nova versão.');
  });};rotationMenu.append(button);
 }
 rotationMenu.hidden=false;
 rotationMenu.style.left=`${Math.max(0,Math.min(event.clientX,innerWidth-rotationMenu.offsetWidth))}px`;
 rotationMenu.style.top=`${Math.max(0,Math.min(event.clientY,innerHeight-rotationMenu.offsetHeight))}px`;
 rotationMenu.firstElementChild.focus();
}
document.addEventListener('pointerdown',event=>{if(!rotationMenu.contains(event.target))closeRotationMenu();});
document.addEventListener('scroll',closeRotationMenu,true);window.addEventListener('resize',closeRotationMenu);
document.addEventListener('keydown',event=>{
 if(rotationMenu.hidden)return;
 if(event.key==='Escape'){event.preventDefault();closeRotationMenu();}
 if(event.key==='Tab')closeRotationMenu();
 if(['ArrowDown','ArrowUp'].includes(event.key)){
  event.preventDefault();const items=[...rotationMenu.children],index=items.indexOf(document.activeElement);
  items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus();
 }
});
window.scanner.onPage(page=>{if(!page.projectId||page.projectId===currentProject?.id)addPage(page);});
$('scan').onclick=()=>run(async()=>{
 await ensureCertificate();status('Digitalizando… aguarde.');
 const result=await window.scanner.scan();const n=typeof result==='number'?result:result.pages;
 status(`${n} página(s) adicionada(s) ao projeto${currentProject.outputs?.length?' e enviada(s) para as saídas':''}. ${[...new Set(result.warnings||[])].join(' ')}`.trim());
});
$('save-page').onclick=()=>run(async()=>{const page=reviewPages.find(p=>p.id===activePage);if(ocrDirty(page))await saveOcrPage(page);await window.captureUI?.savePage(reviewPages.find(p=>p.id===activePage));await ensureCertificate();const result=await window.scanner.save(activePage);if(result)status(`Documento salvo${result.filename?': '+result.filename:'.'} ${result.warning||''}`.trim());});
$('ocr-page').onclick=()=>run(async()=>{
 const id=activePage;if(id===null)return;
 const existing=reviewPages.find(p=>p.id===id);await window.captureUI?.savePage(existing);if(existing?.hasOcr){existing.ocrOpen=true;renderOcrEditor(existing);return;}
 $('ocr-page').textContent='Reconhecendo texto…';status('Reconhecendo texto em português… aguarde.');
 let page;try{page=await window.scanner.ocr(id);}finally{$('ocr-page').textContent='Reconhecer texto (OCR)';}
 reviewPages[reviewPages.findIndex(item=>item.id===id)]=page;activatePage(id);
 status('OCR concluído. Salve o PDF ou envie para saídas para exportar o documento pesquisável.');
});
function ocrDirty(page){return !!page?.ocrData&&page.ocrDraft!==page.ocrData.text;}
function confirmDiscardOcr(page){if(window.captureUI&&!window.captureUI.confirmLeave(page))return false;return !(page?ocrDirty(page):reviewPages.some(ocrDirty))||window.confirm('Existem alterações de texto não salvas. Continuar e descartar essas alterações?');}
function setOcrVisible(visible){if(visible)window.captureUI?.hide();$('ocr-editor').hidden=!visible;$('preview-content').classList.toggle('has-ocr',visible);}
function syncOcrControls(page=reviewPages.find(p=>p.id===activePage)){
 const locked=uiBusy||remoteReceiving||!page?.ocrData;
 $('ocr-result-text').readOnly=locked;
 $('ocr-save').disabled=locked||!ocrDirty(page);$('ocr-discard').disabled=locked||!ocrDirty(page);
}
function renderOcrEditor(page){
 if(!page.hasOcr||page.ocrOpen===false){setOcrVisible(false);return;}
 setOcrVisible(true);
 if(page.ocrData){
  $('ocr-result-text').value=page.ocrDraft;
  $('ocr-result-status').textContent=ocrDirty(page)?'Alterações ainda não salvas.':page.ocrData.edited?'Texto revisado e salvo no projeto.':`Confiança estimada do OCR: ${Math.round(page.ocrData.confidence||0)}%. Confira nomes e números.`;
  syncOcrControls(page);return;
 }
 $('ocr-result-text').value='';$('ocr-result-status').textContent='Carregando texto…';syncOcrControls(page);
 if(page.ocrLoading)return;page.ocrLoading=true;
 const projectId=currentProject.id;
 window.scanner.readOcr(page.id,projectId).then(data=>{
  if(currentProject?.id!==projectId||!reviewPages.includes(page))return;
  page.ocrData=data;page.ocrDraft=data.text;
  if(activePage===page.id)renderOcrEditor(page);
 }).catch(error=>{if(currentProject?.id===projectId&&activePage===page.id)$('ocr-result-status').textContent=message(error);}).finally(()=>{page.ocrLoading=false;});
}
$('ocr-result-text').oninput=()=>{const page=reviewPages.find(p=>p.id===activePage);if(!page?.ocrData)return;page.ocrDraft=$('ocr-result-text').value;$('ocr-result-status').textContent=ocrDirty(page)?'Alterações ainda não salvas.':'Texto sem alterações.';syncOcrControls(page);};
$('ocr-editor-close').onclick=()=>{const page=reviewPages.find(p=>p.id===activePage);if(page)page.ocrOpen=false;setOcrVisible(false);};
$('ocr-discard').onclick=()=>{const page=reviewPages.find(p=>p.id===activePage);if(page?.ocrData){page.ocrDraft=page.ocrData.text;renderOcrEditor(page);}};
async function saveOcrPage(page){
 const saved=await window.scanner.saveOcr(page.id,page.ocrDraft,page.ocrData.revision,currentProject.id);
 const updated={...page,...saved,ocrData:{text:saved.text,confidence:saved.confidence,edited:true,revision:saved.revision},ocrDraft:saved.text};
 reviewPages[reviewPages.indexOf(page)]=updated;
 if(activePage===page.id)renderOcrEditor(updated);
 status('Correções salvas. O PDF pesquisável será exportado com o texto revisado.');
}
$('ocr-save').onclick=()=>task(async()=>{const page=reviewPages.find(p=>p.id===activePage);if(ocrDirty(page))await saveOcrPage(page);},'ocr-result-status');
async function showComparison(id,detail='Compare a imagem original com o resultado atual antes de exportar.'){
 const original=await window.scanner.original(id),page=reviewPages.find(p=>p.id===id);if(!page)return;
 $('comparison-original').src=original;$('comparison-processed').src=page.url;
 $('comparison-status').textContent=detail;$('image-comparison').showModal();
}
$('compare-page').onclick=()=>run(()=>showComparison(activePage));
$('image-comparison').addEventListener('close',()=>{for(const id of ['comparison-original','comparison-processed'])$(id).removeAttribute('src');});
let cropPage=null,cropImage=null,cropCorners=[],dragCorner=null;
function drawCrop(){
 if(!cropImage)return;const canvas=$('crop-canvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.drawImage(cropImage,0,0,w,h);
 ctx.beginPath();ctx.rect(0,0,w,h);ctx.moveTo(cropCorners[0].x*w,cropCorners[0].y*h);
 for(let i=3;i>=0;i--)ctx.lineTo(cropCorners[i].x*w,cropCorners[i].y*h);
 ctx.closePath();ctx.fillStyle='#0009';ctx.fill('evenodd');
 ctx.beginPath();cropCorners.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.closePath();ctx.strokeStyle='#69bdff';ctx.lineWidth=2;ctx.stroke();
 cropCorners.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x*w,p.y*h,10,0,Math.PI*2);ctx.fillStyle='#168de2';ctx.fill();ctx.strokeStyle='white';ctx.stroke();ctx.fillStyle='white';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x*w,p.y*h);});
 for(const input of $('crop-corner-fields').querySelectorAll('input'))input.value=Math.round(cropCorners[Number(input.dataset.corner)][input.dataset.axis]*100);
}
async function openManualCrop(){
 if(uiBusy||remoteReceiving||activePage===null)return;
 cropPage=activePage;cropImage=new Image();
 cropCorners=[{x:.04,y:.03},{x:.96,y:.03},{x:.96,y:.97},{x:.04,y:.97}];
 $('crop-status').textContent='';$('crop-corner-fields').replaceChildren();
 ['Superior esquerdo','Superior direito','Inferior direito','Inferior esquerdo'].forEach((name,i)=>{
  const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${i+1}. ${name}`;field.append(legend);
  for(const axis of ['x','y']){const label=document.createElement('label'),input=document.createElement('input');label.textContent=axis.toUpperCase()+' % ';input.type='number';input.min=0;input.max=100;input.step=1;input.dataset.corner=i;input.dataset.axis=axis;input.oninput=()=>{cropCorners[i][axis]=Math.max(0,Math.min(1,Number(input.value)/100));drawCrop();};label.append(input);field.append(label);}
  $('crop-corner-fields').append(field);
 });
 cropImage.onload=()=>{const scale=Math.min(1,700/cropImage.width,innerHeight*.55/cropImage.height);$('crop-canvas').width=Math.round(cropImage.width*scale);$('crop-canvas').height=Math.round(cropImage.height*scale);drawCrop();$('crop-editor').showModal();};
 try{cropImage.src=await window.scanner.original(cropPage);}catch(error){status(message(error));}
};
function cropPointer(event){const r=$('crop-canvas').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};}
$('crop-canvas').onpointerdown=event=>{if(uiBusy)return;const p=cropPointer(event);dragCorner=cropCorners.reduce((best,c,i)=>Math.hypot(c.x-p.x,c.y-p.y)<Math.hypot(cropCorners[best].x-p.x,cropCorners[best].y-p.y)?i:best,0);$('crop-canvas').setPointerCapture(event.pointerId);cropCorners[dragCorner]=p;drawCrop();};
$('crop-canvas').onpointermove=event=>{if(dragCorner===null||uiBusy)return;cropCorners[dragCorner]=cropPointer(event);drawCrop();};
$('crop-canvas').onpointerup=$('crop-canvas').onpointercancel=()=>{dragCorner=null;};
$('crop-cancel').onclick=()=>{if(!uiBusy)$('crop-editor').close();};
$('crop-editor').addEventListener('cancel',event=>{if(uiBusy)event.preventDefault();});
$('crop-apply').onclick=()=>run(()=>applyEnhancement(cropPage,cropCorners));
$('enhance-page').onclick=()=>run(()=>applyEnhancement(activePage));
$('manual-crop-page').onclick=openManualCrop;
async function applyEnhancement(id,corners){
 if(id===null)return;
 if(!confirmDiscardOcr(reviewPages.find(p=>p.id===id)))return;
 $('crop-apply').disabled=true;$('crop-cancel').disabled=true;
 $('enhance-page').textContent='Melhorando…';
 status('Melhorando documento… aguarde.');
 let page;
 try{page=await window.scanner.enhance(id,corners,$('processing-mode').value);}
 catch(error){$('crop-status').textContent=message(error);throw error;}
 finally{$('enhance-page').textContent='Melhorar PDF';$('crop-apply').disabled=false;$('crop-cancel').disabled=false;}
 $('crop-editor').close();
 reviewPages[reviewPages.findIndex(item=>item.id===id)]=page;
 $('pages').querySelector(`[data-page-id="${id}"] img`).src=page.url;activatePage(id);
 const result=page.cropMethod==='content'?'As margens externas foram reduzidas com uma margem de seguran\u00e7a ao redor do conte\u00fado. A ilumina\u00e7\u00e3o e a nitidez foram ajustadas.':page.cropped?'A folha foi recortada, a perspectiva corrigida e a iluminação ajustada.':'A iluminação e a nitidez foram ajustadas. Não foi possível identificar as quatro bordas da folha com segurança; o enquadramento foi mantido.';
 status(result);
 $('enhance-result-message').textContent=result+' Salve o PDF ou envie para saídas para exportar a nova versão.';
 await showComparison(id,result);
}
$('select-all').onclick=()=>{if(uiBusy)return;selectedPages=selectedPages.size===reviewPages.length?new Set():new Set(reviewPages.map(page=>page.id));updateSelection();};
function deleteSelected(){return run(async()=>{
 const indices=[...selectedPages].sort((a,b)=>a-b);if(!indices.length)return;
 if(!confirmDiscardOcr())return;
 if(!window.confirm(`Excluir ${indices.length} página(s) selecionada(s) deste projeto? As cópias já enviadas para as pastas de saída serão mantidas.`))return;
 const data=await window.scanner.remove(indices);currentProject=data.project;loadReview(data.pages);
 if(data.pages.length)activatePage(data.pages[Math.min(indices[0],data.pages.length-1)].id);
 status(`${data.removed} página(s) excluída(s) do projeto.`);
});}
$('delete-selected').onclick=deleteSelected;
document.addEventListener('keydown',event=>{
 if($('scanner-view').hidden||uiBusy||remoteReceiving||document.querySelector('dialog[open]')||!selectedPages.size)return;
 if(event.key!=='Delete'||event.target.closest('input:not([type="checkbox"]),textarea,select,[contenteditable="true"]'))return;
 event.preventDefault();deleteSelected();
});
let mobileState={active:false},mobileBusy=false;
async function mobileAction(action){
 if(mobileBusy)return;mobileBusy=true;$('mobile-error').textContent='';
 const controls=$('mobile-dialog').querySelectorAll('button,select');controls.forEach(e=>e.disabled=true);
 try{await action();}catch(error){$('mobile-error').textContent=message(error);}
 finally{mobileBusy=false;controls.forEach(e=>e.disabled=false);$('mobile-generate').disabled=!$('mobile-address').value;}
}
function renderMobile(state){
 mobileState=state.active&&state.sessionId===mobileState.sessionId?{...mobileState,...state}:state;
 remoteReceiving=!!state.receiving;syncReviewControls();
 const phase={uploading:'Recebendo foto…',processing:'Melhorando foto…',saving:'Salvando foto…',exporting:'Exportando documento…'}[state.receivingStage]||'Recebendo foto…';
 $('connect-mobile').textContent=state.receiving?phase:state.connected?'Celular conectado':state.active?'Pareamento do celular':'Conectar celular';
 $('mobile-qr').hidden=!mobileState.qr||!state.url;
 if(mobileState.qr&&state.url)$('mobile-qr').src=mobileState.qr;else $('mobile-qr').removeAttribute('src');
 $('mobile-qr-empty').hidden=!$('mobile-qr').hidden;
 $('mobile-qr-empty').textContent=state.connected?'Celular conectado. Você já pode enviar imagens.':'Gere um QR Code e leia com a câmera do celular.';
 $('mobile-link-box').hidden=!state.url;$('mobile-link').value=state.url||'';
 $('mobile-generate').textContent=state.active?'Gerar nova conexão':'Gerar QR Code';
 $('mobile-stop').hidden=!state.active;
 $('mobile-connected').hidden=!state.connected;
 $('mobile-connected-name').textContent=state.connected?.name||'';
 $('mobile-receiving').textContent=state.receiving?phase:'Pronto para receber fotos.';
 if(state.receiving){$('mobile-error').textContent='';status(phase);}
 if(state.lastError){$('mobile-error').textContent=state.lastError;status(state.lastError);}
 $('mobile-pending').replaceChildren();
 for(const peer of state.pending||[]){
  const item=document.createElement('div');item.className='mobile-pending-item';
  const name=document.createElement('h3');name.textContent=peer.name;
  const hint=document.createElement('p');hint.textContent='Confira este código no celular:';
  const code=document.createElement('strong');code.textContent=peer.code;
  const actions=document.createElement('div');actions.className='mobile-pending-actions';
  const deny=document.createElement('button');deny.type='button';deny.textContent='Recusar';
  const allow=document.createElement('button');allow.type='button';allow.className='mobile-primary';allow.textContent='Permitir conexão';
  for(const [button,decision] of [[deny,false],[allow,true]])button.onclick=()=>mobileAction(async()=>renderMobile(await window.mobile.decide(peer.id,decision)));
  actions.append(deny,allow);item.append(name,hint,code,actions);$('mobile-pending').append(item);
 }
 if(state.pending?.length&&!$('mobile-dialog').open&&!$('scanner-view').hidden&&!$('certificate-unlock').open)$('mobile-dialog').showModal();
 updateMobileExpiry();
}
function updateMobileExpiry(){
 if(mobileState.url){const left=Math.max(0,Math.ceil((mobileState.qrExpiresAt-Date.now())/1000));$('mobile-expiry').textContent=left?`QR Code válido por ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'QR Code expirado. Gere uma nova conexão.';}
 else $('mobile-expiry').textContent=mobileState.connected?'Conexão aprovada neste computador.':'';
}
setInterval(updateMobileExpiry,1000);
$('connect-mobile').onclick=()=>run(async()=>{
 $('mobile-project-label').textContent=currentProject.name;$('mobile-error').textContent='';
 const rows=await window.mobile.addresses();$('mobile-address').replaceChildren();
 for(const row of rows)$('mobile-address').append(new Option(`${row.name} · ${row.address}`,row.address));
 renderMobile(await window.mobile.status());$('mobile-generate').disabled=!rows.length;
 if(!rows.length)$('mobile-error').textContent='Nenhuma rede local disponível. Conecte o computador e o celular à mesma rede Wi-Fi.';
 $('mobile-dialog').showModal();
});
$('mobile-close').onclick=()=>$('mobile-dialog').close();
$('mobile-generate').onclick=()=>mobileAction(async()=>{renderMobile(await window.mobile.start($('mobile-address').value));});
$('mobile-stop').onclick=()=>mobileAction(async()=>renderMobile(await window.mobile.stop()));
$('mobile-copy').onclick=()=>mobileAction(async()=>{await window.mobile.copyLink();$('mobile-error').textContent='Link copiado. Abra no celular conectado à mesma rede.';});
window.mobile.onState(renderMobile);
window.mobile.onReceived(data=>{if(data.projectId===currentProject?.id)status(data.warning?`Foto recebida e preservada no projeto. ${data.warning}`:`Página ${data.pageNumber} recebida do celular.`);});
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
 loadReview(data.pages);$('processing-mode').value=currentProject.processingMode||({Grayscale8:'gray',BlackAndWhite1:'bw'}[currentProject.colorMode]||'auto');
 $('active-project-name').textContent=currentProject.name;
 $('projects-view').hidden=true;$('scanner-view').hidden=false;
 if(count)status('Escolha uma página para revisar ou digitalize novos documentos.');
 },'projects-status');}
$('back-projects').onclick=()=>run(async()=>{if(!confirmDiscardOcr())return;await window.projects.close();currentProject=null;resetPages();await showProjects(username);});
function openEditor(project=null,allowBusy=false){
 if(uiBusy&&!allowBusy)return;
 editingProject=project;editorOutputs=[...(project?.outputs||[])];$('project-form').reset();$('editor-status').textContent='';
 $('editor-title').textContent=project?'Editar projeto':'Novo projeto';$('editor-save').textContent=project?'Salvar alterações':'Criar projeto';
 if(project){$('project-name').value=project.name;$('project-port').value=project.port;$('project-dpi').value=project.dpi;$('project-source').value=project.source;$('project-document-type').value=project.documentType||'document';$('project-duplex').value=project.duplex?'duplex':'simplex';$('project-naming').value=project.namingMode||'default';$('project-color').value=(project.processingMode||'auto')==='auto'?'AutoProfessional':project.colorMode||'RGB24';}
 syncDuplexField();loadSignatureEditor(project?.signature||{type:'none'});renderOutputRows();
 window.projectEditorTabs?.select('general');$('project-editor').showModal();$('project-name').focus();window.captureUI?.loadModels(project?.captureTemplate,project?.namingFieldId);
}
function syncDuplexField(){
 const glass=$('project-source').value==='Platen';
 if(glass)$('project-duplex').value='simplex';
 $('project-duplex').disabled=uiBusy||glass;
}
$('project-source').onchange=syncDuplexField;
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
$('pick-certificate').onclick=()=>task(async()=>{const file=await window.certificates.pickFile();if(file){$('certificate-file').value=file;$('certificate-editor-password').value='';}},'certificate-editor-status');
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
 openEditor(currentProject,true);
 window.projectEditorTabs?.select('signature');$('certificate-editor-password').focus();
 throw Error('Informe a senha do certificado na configuração do projeto e salve antes de continuar.');
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
$('export-outputs').onclick=()=>run(async()=>{
 for(const page of [...reviewPages]){await window.captureUI?.savePage(page);if(ocrDirty(page))await saveOcrPage(page);}
 await ensureCertificate();status('Enviando documentos para as saídas…');
 const result=await window.projects.export();
 const confirmation=`${result.pages} ${result.pages===1?'documento salvo':'documentos salvos'} em ${result.outputs} ${result.outputs===1?'pasta de saída':'pastas de saída'}. ${[...new Set(result.warnings||[])].join(' ')}`.trim();
 status(confirmation);
 $('export-success-message').textContent=confirmation;
 $('export-success').showModal();
});
$('new-project').onclick=()=>openEditor();$('first-project').onclick=()=>openEditor();
function closeEditor(){if(!uiBusy)$('project-editor').close();}
$('project-editor').addEventListener('close',()=>{$('certificate-editor-password').value='';});
$('editor-close').onclick=closeEditor;$('editor-cancel').onclick=closeEditor;
$('project-editor').addEventListener('cancel',event=>{if(uiBusy)event.preventDefault();});
$('project-form').onsubmit=event=>{
 event.preventDefault();task(async()=>{
 const input={captureTemplate:(window.captureUI?window.captureUI.selectedTemplate():editingProject?.captureTemplate??null),name:$('project-name').value,port:Number($('project-port').value),dpi:Number($('project-dpi').value),source:$('project-source').value,documentType:$('project-document-type').value,namingMode:$('project-naming').value,namingFieldId:$('project-naming-field').value||null,duplex:$('project-source').value==='Feeder'&&$('project-duplex').value==='duplex',colorMode:$('project-color').value==='AutoProfessional'?'RGB24':$('project-color').value,processingMode:({AutoProfessional:'auto',RGB24:'color',Grayscale8:'gray',BlackAndWhite1:'bw'})[$('project-color').value],outputs:editorOutputs,signature:editorSignature()};
 const password=$('certificate-editor-password').value;$('certificate-editor-password').value='';
 $('editor-status').textContent=input.signature.type==='a1'?'Conferindo certificado…':'';
 const saved=editingProject?await window.projects.update(editingProject.id,input,password):await window.projects.create(input,password);
 if(currentProject?.id===saved.id){currentProject=saved;$('processing-mode').value=saved.processingMode;}
 await refreshProjects();$('project-editor').close();
 },'editor-status');
};
async function logout(){if(!confirmDiscardOcr())return;await window.localAuth.logout();currentProject=null;resetPages();await loadAuth();}
$('logout').onclick=()=>run(logout);$('projects-logout').onclick=()=>task(logout,'projects-status');
async function loadAuth(){
 $('scanner-view').hidden=true;$('projects-view').hidden=true;$('auth-view').hidden=false;$('auth-form').hidden=true;
 try {
  const session=await window.localAuth.status();
  if(session.authenticated){showProjects(session.username);return;}
  creatingAccount=!session.hasAccount;
  $('auth-title').textContent=creatingAccount?'Comece com o CotrimScan':'Bem-vindo ao CotrimScan';
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
