const $=id=>document.getElementById(id);
let token=new URLSearchParams(location.hash.slice(1)).get('token'),credential=null,pollTimer=null,sending=false,queue=[],connectionFailures=0;
const storage={read(){try{return JSON.parse(sessionStorage.getItem('cotrimscan-mobile')||'null');}catch{return null;}},write(value){try{sessionStorage.setItem('cotrimscan-mobile',JSON.stringify(value));}catch{}},clear(){try{sessionStorage.removeItem('cotrimscan-mobile');}catch{}}};
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
function stage(id){for(const view of ['connect-step','pending-step','upload-step','ended-step'])$(view).hidden=view!==id;}
function ended(message){clearTimeout(pollTimer);credential=null;storage.clear();stage('ended-step');$('ended-message').textContent=message||'No computador, gere um novo QR Code para conectar novamente.';}
async function request(url,options={},auth=credential?.secret){
 const {timeout=300000,...fetchOptions}=options;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{...fetchOptions,headers:{Authorization:`Bearer ${auth||''}`,...options.headers},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Não foi possível concluir a operação.'),{status:response.status});return data;
 }finally{clearTimeout(timer);}
}
async function poll(){
 if(!credential)return;
 try{
  const state=await request('/api/status',{timeout:10000});connectionFailures=0;$('phone-error').textContent='';
  if(state.status==='pending'){stage('pending-step');$('verification-code').textContent=state.code;}
  else if(state.status==='approved'){stage('upload-step');$('phone-project').textContent=state.projectName;}
  else {ended(state.status==='rejected'?'O computador recusou ou encerrou a conexão. Leia um novo QR Code.':'O pareamento expirou. Gere um novo QR Code no computador.');return;}
  pollTimer=setTimeout(poll,state.status==='pending'?1500:5000);
 }catch(error){
  if(error.status===401||error.status===410){ended(error.message);return;}
  if(++connectionFailures>=3){ended('A conexão com o computador foi encerrada ou está indisponível. Gere um novo QR Code para continuar.');return;}
  $('phone-error').textContent='Conexão interrompida. Confira se o celular continua na mesma rede do computador.';pollTimer=setTimeout(poll,5000);
 }
}
$('pair-form').onsubmit=async event=>{
 event.preventDefault();$('pair-button').disabled=true;$('phone-error').textContent='';
 try{
  credential=await request('/api/pair',{timeout:15000,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('device-name').value})},token);
  token=null;storage.write(credential);await poll();
 }catch(error){$('phone-error').textContent=error.status?error.message:'Não foi possível conectar. Leia o QR Code novamente.';}
 finally{$('pair-button').disabled=false;}
};
function renderQueue(){
 $('phone-queue').replaceChildren();$('queue-empty').hidden=queue.length>0;
 for(const item of queue){
  const row=document.createElement('div');row.className='queue-item';row.dataset.status=item.status;
  const image=document.createElement('img');image.src=item.url;image.alt='Prévia da imagem selecionada';
  const description=document.createElement('div'),name=document.createElement('strong'),state=document.createElement('p');name.textContent=item.file.name;state.textContent=item.message;description.append(name,state);
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.disabled=sending;remove.setAttribute('aria-label','Remover imagem da fila deste celular');remove.onclick=()=>{URL.revokeObjectURL(item.url);queue=queue.filter(entry=>entry!==item);renderQueue();};
  row.append(image,description,remove);$('phone-queue').append(row);
 }
 const remaining=queue.filter(item=>!['done','warning'].includes(item.status)).length;
 $('send-images').disabled=sending||!remaining;$('send-images').textContent=sending?'Enviando…':remaining?`Enviar ${remaining} ${remaining===1?'imagem':'imagens'}`:queue.length?'Tudo enviado':'Enviar imagens';
 $('camera-input').disabled=sending;$('gallery-input').disabled=sending;$('disconnect').disabled=sending;
}
function addFiles(files){
 $('phone-error').textContent='';
 for(const file of files){
  if(queue.length>=50){$('phone-error').textContent='Envie ou remova imagens antes de adicionar mais. Limite de 50 na fila.';break;}
  if(file.size>20*1024*1024||!file.size){$('phone-error').textContent='Cada imagem precisa ter até 20 MB.';continue;}
  if(file.type&&!['image/jpeg','image/png','image/webp'].includes(file.type)){$('phone-error').textContent='Use fotos JPEG, PNG ou WebP.';continue;}
  queue.push({file,id:nonce(),url:URL.createObjectURL(file),status:'ready',message:'Pronta para enviar'});
 }
 renderQueue();
}
for(const id of ['camera-input','gallery-input'])$(id).onchange=event=>{addFiles(event.target.files);event.target.value='';};
$('send-images').onclick=async()=>{
 if(sending||!credential)return;sending=true;$('phone-error').textContent='';renderQueue();
 const pending=queue.filter(item=>!['done','warning'].includes(item.status));let sent=0;
 for(const item of pending){
  item.status='sending';item.message='Enviando para o computador…';renderQueue();
  try{
   const response=await request('/api/upload',{method:'POST',headers:{'Content-Type':item.file.type||'application/octet-stream','X-Upload-Id':item.id},body:item.file});
   item.status=response.exported===false?'warning':'done';item.message=response.exported===false?'Recebida no projeto. Confira no computador uma falha na saída ou assinatura.':`Recebida no projeto · Página ${response.pageNumber}`;sent++;
  }catch(error){item.status='error';item.message=error.status?error.message:'Envio interrompido. Confira a conexão e tente novamente.';if(error.status===401||error.status===410)ended(error.message);renderQueue();break;}
  $('send-progress').textContent=`${sent} de ${pending.length} imagem(ns) recebida(s).`;renderQueue();
 }
 sending=false;renderQueue();
};
$('disconnect').onclick=async()=>{try{await request('/api/disconnect',{timeout:10000,method:'POST'});}catch{}ended('Você desconectou este celular. Gere um novo QR Code no computador para continuar.');};
try{
 if(token){storage.clear();history.replaceState(null,'',location.pathname);if(!/^[a-f0-9]{64}$/.test(token))token=null;}
 else credential=storage.read();
 if(credential?.secret)poll();else if(!token)ended('No computador, abra um projeto e clique em “Conectar celular”. Leia o QR Code para começar.');
}catch{ended();}
