/* Capture templates and page indexes. No image bytes leave the computer. */
(()=>{
 let models=[],editorModel=null,fields=[],drag=null,activeField=null,token=0,highlightRegion=null;
 let fromSettings=false,sampleSettings=null,alignmentReference=null,previewRegion=null;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const current=()=>reviewPages.find(p=>p.id===activePage);
 const dirty=page=>!!page?.captureDraft&&JSON.stringify(page.captureDraft)!==JSON.stringify(page.captureData.fields.map(f=>({id:f.id,value:f.value,reviewed:f.reviewed})));
 function hide(){ $('capture-panel').hidden=true;$('preview-content').classList.remove('has-capture');highlightRegion=null;highlight.hidden=true; }
 const highlight=document.createElement('div');highlight.className='capture-highlight';highlight.hidden=true;$('document-viewport').append(highlight);
 function placeHighlight(){
  if(!highlightRegion)return;const a=$('document-preview').getBoundingClientRect(),v=$('document-viewport'),b=v.getBoundingClientRect(),r=highlightRegion;
  Object.assign(highlight.style,{left:`${a.left-b.left+v.scrollLeft+r.x*a.width}px`,top:`${a.top-b.top+v.scrollTop+r.y*a.height}px`,width:`${r.width*a.width}px`,height:`${r.height*a.height}px`});highlight.hidden=false;
 }
 $('document-viewport').addEventListener('scroll',placeHighlight);window.addEventListener('resize',placeHighlight);
 if(window.ResizeObserver)new ResizeObserver(placeHighlight).observe($('document-preview'));
 function setData(page,data){page.captureData=data;page.captureLoaded=true;page.captureDraft=data?.fields.map(f=>({id:f.id,value:f.value,reviewed:f.reviewed}));}
 function render(page){
  if(page!==current())return;
  const data=page.captureData;
  if(data&&(!currentProject?.signature||currentProject.signature.type==='none')&&!page.hasOcr)$('save-page').textContent='Salvar PDF';
  if(!data&&!currentProject?.captureTemplate){hide();return;}
  setOcrVisible(false);$('capture-panel').hidden=false;$('preview-content').classList.add('has-capture');
  $('capture-model-label').textContent=data?`${data.template.name} · versão ${data.template.version}`:currentProject.captureTemplate.name;
  $('capture-values').replaceChildren();
  if(data)for(const field of data.fields){
   const draft=page.captureDraft.find(f=>f.id===field.id),box=document.createElement('section');box.className='capture-value';
   const label=document.createElement('label');label.textContent=field.name;
   const input=document.createElement('input');input.type='text';input.maxLength=2000;input.value=draft.value;input.autocomplete='off';input.setAttribute('aria-label',field.name);
   const meta=document.createElement('p');meta.textContent=`OCR: ${field.recognized||'(vazio)'} · confiança ${Math.round(field.confidence||0)}%${field.corrected?' · corrigido':''}`;
   const warning=document.createElement('p');warning.className='capture-warning';warning.textContent=field.error||(field.confidence<70?'Baixa confiança: confira na imagem.':'Formato aceito; confira com o documento.');
   const review=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=draft.reviewed;review.append(check,document.createTextNode(' Conferido com o documento'));
   input.oninput=()=>{draft.value=input.value;draft.reviewed=false;check.checked=false;$('capture-status').textContent='Alterações ainda não salvas.';};
   check.onchange=()=>{draft.reviewed=check.checked;$('capture-status').textContent='Alterações ainda não salvas.';};
   input.onfocus=()=>{highlightRegion=field.resolvedRegion||field.region;placeHighlight();};
   label.append(input);box.append(label,meta,warning,review);$('capture-values').append(box);
  }
  $('capture-status').textContent=dirty(page)?'Alterações ainda não salvas.':data?.error?data.error:data?.imageChanged?'A imagem mudou. Os valores foram preservados; confira novamente cada campo e sua região.':data?.needsReview?'Confira os campos antes de exportar.':data?'Revisão salva no projeto.':'Clique em Extrair campos para aplicar o modelo a esta página.';
  $('capture-extract').hidden=!!data&&!data.error;$('capture-save').disabled=!data||uiBusy||remoteReceiving;
 }
 async function load(page){
  if(page.captureLoading||page.captureLoaded)return;
  const projectId=currentProject?.id;if(!projectId)return;
  page.captureLoading=true;
  try{const data=await window.capture.read(page.id,projectId);if(currentProject?.id!==projectId)return;setData(page,data);render(page);}
  catch(e){if(page===current())$('capture-status').textContent=message(e);}
  finally{page.captureLoading=false;}
 }
 function activate(page){highlightRegion=null;highlight.hidden=true;render(page);if(!uiBusy&&!remoteReceiving)load(page);}
 async function savePage(page){
  if(!dirty(page))return;const projectId=currentProject.id;
  const data=await window.capture.save(page.id,page.captureDraft,page.captureData.revision,projectId);setData(page,data);render(page);
 }
 async function loadModels(selected,namingFieldId){
  const request=++token;const select=$('project-capture');select.captureReady=false;select.captureSnapshot=selected;select.disabled=true;
  try{
   const list=await window.capture.models();if(request!==token)return;models=list;
   select.replaceChildren(new Option('Sem captura automática',''));
   for(const model of list)select.append(new Option(`${model.name} · v${model.version}`,model.id));
   if(selected){if(!list.some(m=>m.id===selected.id))select.append(new Option(`${selected.name} · versão do projeto`,selected.id));select.value=selected.id;}
   select.captureSnapshot=selected;select.captureReady=true;syncNamingFields(namingFieldId);
  }catch(e){$('editor-status').textContent=message(e);}finally{if(request===token)select.disabled=false;}
 }
 function selectedTemplate(){const select=$('project-capture');if(!select.captureReady)throw Error('Aguarde o carregamento dos modelos de captura.');if(!select.value)return null;return clone(select.captureSnapshot?.id===select.value?select.captureSnapshot:models.find(m=>m.id===select.value));}
 function syncNamingFields(preferred){
  const select=$('project-naming-field'),previous=preferred??select.value;
  const model=$('project-capture').captureReady?selectedTemplate():null;
  select.replaceChildren(new Option(model?'Selecione um campo':'Configure um modelo de captura',''));
  for(const field of model?.fields||[])select.append(new Option(field.name,field.id));
  if(model?.fields.some(f=>f.id===previous))select.value=previous;
  const enabled=$('project-naming').value==='ocr';$('project-naming-field-row').hidden=!enabled;select.required=enabled;
 }
 $('project-naming').onchange=()=>syncNamingFields();
 $('project-capture').onchange=()=>{$('project-capture').captureSnapshot=null;syncNamingFields();};
 function alignmentStatus(){
  $('capture-alignment-status').textContent=$('capture-auto-align').checked?(alignmentReference?`Calibrado com ${alignmentReference.points.length} palavras. Teste os campos nesta amostra.`:'Digitalize uma folha de exemplo e calibre o alinhamento.'):'Alinhamento desativado.';
 }
 $('capture-auto-align').onchange=()=>{previewRegion=null;alignmentStatus();draw();};
 $('capture-calibrate').onclick=()=>task(async()=>{
  if($('capture-surface').hidden)throw Error('Digitalize uma folha de exemplo antes de calibrar.');
  $('capture-alignment-status').textContent='Lendo referências da folha…';
  try{const result=await window.capture.calibrate($('capture-sample').src,sampleSettings.dpi);alignmentReference=result.reference;$('capture-auto-align').checked=true;alignmentStatus();previewRegion=null;draw();}
  catch(e){alignmentStatus();throw e;}
 },'capture-editor-status');
 function draw(){
  const svg=$('capture-regions');svg.replaceChildren();
  for(const [i,field] of fields.entries()){
   const r=field.region,rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
   for(const [k,v] of Object.entries({x:r.x*1000,y:r.y*1000,width:r.width*1000,height:r.height*1000}))rect.setAttribute(k,v);
   rect.classList.toggle('selected',field.id===activeField);svg.append(rect);
   const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',r.x*1000+4);text.setAttribute('y',r.y*1000+20);text.textContent=String(i+1);svg.append(text);
  }
  const selected=fields.find(f=>f.id===activeField),r=previewRegion||selected?.region;
  if(r){const margin=previewRegion?0:selected?.margin||0,x=Math.max(0,r.x-margin),y=Math.max(0,r.y-margin),w=Math.min(1,r.x+r.width+margin)-x,h=Math.min(1,r.y+r.height+margin)-y;
   const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.classList.add('capture-search-region');
   for(const [k,v] of Object.entries({x:x*1000,y:y*1000,width:w*1000,height:h*1000}))rect.setAttribute(k,v);svg.append(rect);
  }
 }
 function fieldRows(){
  $('capture-field-list').replaceChildren();
  for(const [i,field] of fields.entries()){
   const box=document.createElement('fieldset'),title=document.createElement('legend');title.textContent=`Campo ${i+1}`;box.append(title);
   const label=(name,input)=>{const l=document.createElement('label');l.append(document.createTextNode(name),input);box.append(l);};
   const margin=document.createElement('input');margin.className='capture-margin';margin.type='number';margin.min=0;margin.max=10;margin.step=.1;margin.value=((field.margin||0)*100).toFixed(1);margin.oninput=()=>{field.margin=Number(margin.value)/100;previewRegion=null;draw();};label('Margem de busca (% da página, em cada lado)',margin);
   const anchorToggle=document.createElement('input');anchorToggle.type='checkbox';anchorToggle.className='capture-anchor-toggle';anchorToggle.checked=!!field.anchor;label('Localizar pelo texto de referência',anchorToggle);
   const anchorBox=document.createElement('div');const anchorNote=document.createElement('p');anchorNote.textContent='O retângulo define o tamanho da leitura. A referência define sua posição. Textos repetidos precisam de uma referência mais específica.';anchorBox.append(anchorNote);anchorBox.hidden=!field.anchor;anchorBox.className='capture-anchor-options';
   const anchorText=document.createElement('input');anchorText.placeholder='Ex.: Matrícula';anchorText.maxLength=100;anchorText.value=field.anchor?.text||'';
   const direction=document.createElement('select');direction.append(new Option('Valor à direita da referência','right'),new Option('Valor abaixo da referência','below'));direction.value=field.anchor?.direction||'right';
   const gap=document.createElement('input');gap.type='number';gap.min=0;gap.max=20;gap.step=.1;gap.value=((field.anchor?.gap||0)*100).toFixed(1);
   for(const [text,input] of [['Texto fixo de referência',anchorText],['Posição do valor',direction],['Distância da referência (% da página)',gap]]){const l=document.createElement('label');l.append(document.createTextNode(text),input);anchorBox.append(l);}
   const updateAnchor=()=>{field.anchor=anchorToggle.checked?{text:anchorText.value,direction:direction.value,gap:Number(gap.value)/100}:null;anchorBox.hidden=!anchorToggle.checked;previewRegion=null;draw();};
   anchorToggle.onchange=updateAnchor;anchorText.oninput=updateAnchor;direction.onchange=updateAnchor;gap.oninput=updateAnchor;box.append(anchorBox);
   const name=document.createElement('input');name.value=field.name;name.maxLength=80;name.oninput=()=>field.name=name.value;label('Nome',name);
   const type=document.createElement('select');for(const [v,l] of [['text','Texto / nome'],['identifier','Identificador numérico'],['cpf','CPF'],['date','Data DD/MM/AAAA']])type.append(new Option(l,v));type.value=field.type;type.onchange=()=>field.type=type.value;label('Tipo',type);
   const digits=document.createElement('input');digits.type='number';digits.min=1;digits.max=100;digits.placeholder='Sem tamanho fixo';digits.value=field.digits||'';digits.oninput=()=>{field.digits=digits.value?Number(digits.value):undefined;};label('Dígitos esperados (opcional)',digits);
   const required=document.createElement('input');required.type='checkbox';required.checked=field.required;required.onchange=()=>field.required=required.checked;label('Obrigatório',required);
   const coords=document.createElement('div');coords.className='capture-coordinates';
   for(const [key,text] of [['x','Esquerda %'],['y','Topo %'],['width','Largura %'],['height','Altura %']]){
    const l=document.createElement('label'),input=document.createElement('input');input.type='number';input.min=0;input.max=100;input.step=.1;input.value=(field.region[key]*100).toFixed(1);input.oninput=()=>{field.region[key]=Number(input.value)/100;activeField=field.id;previewRegion=null;draw();};l.append(document.createTextNode(text),input);coords.append(l);
   }
   const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir campo';remove.onclick=()=>{fields=fields.filter(f=>f!==field);fieldRows();draw();};
   const read=document.createElement('button');read.type='button';read.textContent='Ler campo';read.className='capture-read-field';
   const result=document.createElement('p');result.className='capture-field-result';result.setAttribute('role','status');
   box.addEventListener('input',()=>{result.textContent='Configuração alterada. Clique em Ler campo para testar novamente.';});
   read.onclick=()=>task(async()=>{
    if($('capture-surface').hidden)throw Error('Digitalize uma folha de exemplo antes de ler o campo.');
    activeField=field.id;draw();result.textContent='Lendo campo…';
    try{const value=await window.capture.preview($('capture-sample').src,clone(field),sampleSettings.dpi,{autoAlign:$('capture-auto-align').checked,alignmentReference});
     previewRegion=value.resolvedRegion||null;draw();
     result.textContent=`${value.location?.aligned?'Alinhado · ':''}${value.location?.anchorFound?'Referência localizada · ':''}Leitura: ${value.value||'(nenhum texto reconhecido)'} · confiança ${Math.round(value.confidence||0)}%. ${value.error||'Confira o resultado na imagem.'}`;
    }catch(e){result.textContent=message(e);throw e;}
   },'capture-editor-status');
   box.onfocusin=()=>{activeField=field.id;previewRegion=null;draw();};box.append(coords,read,result,remove);$('capture-field-list').append(box);
  }
 }
 function fillEditor(model){previewRegion=null;alignmentReference=model?.alignmentReference?clone(model.alignmentReference):null;$('capture-auto-align').checked=!!model?.autoAlign;alignmentStatus();editorModel=model?clone(model):null;fields=clone(model?.fields||[]);$('capture-model-name').value=model?.name||'';activeField=null;fieldRows();draw();}
 function point(e){const r=$('capture-regions').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 const surface=$('capture-regions');
 surface.onpointerdown=e=>{if(e.button!==0||uiBusy||remoteReceiving||$('capture-surface').hidden)return;e.preventDefault();drag=point(e);surface.setPointerCapture(e.pointerId);};
 surface.onpointermove=e=>{
  if(!drag)return;draw();const p=point(e),rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
  for(const [k,v] of Object.entries({x:Math.min(p.x,drag.x)*1000,y:Math.min(p.y,drag.y)*1000,width:Math.abs(p.x-drag.x)*1000,height:Math.abs(p.y-drag.y)*1000}))rect.setAttribute(k,v);surface.append(rect);
 };
 surface.onpointerup=e=>{
  if(!drag)return;const p=point(e),r={x:Math.min(p.x,drag.x),y:Math.min(p.y,drag.y),width:Math.abs(p.x-drag.x),height:Math.abs(p.y-drag.y)};drag=null;
  if(r.width>=.005&&r.height>=.005&&fields.length<30){const field={id:crypto.randomUUID(),name:`Campo ${fields.length+1}`,type:'text',required:false,region:r};fields.push(field);activeField=field.id;fieldRows();}
  draw();
 };
 surface.onpointercancel=()=>{drag=null;draw();};
 function setSample(url){
  previewRegion=null;
  for(const result of document.querySelectorAll('.capture-field-result'))result.textContent='Amostra alterada. Clique em Ler campo para testar novamente.';
  $('capture-sample').src=url;$('capture-surface').hidden=false;$('capture-sample-empty').hidden=true;
  $('capture-sample-zoom').value='100';$('capture-surface').style.width='100%';
 }
 async function openAreas(settings){
  fromSettings=settings;
  sampleSettings=settings?{
   port:Number($('project-port').value),dpi:Number($('project-dpi').value),source:$('project-source').value,
   colorMode:$('project-color').value==='AutoProfessional'?'RGB24':$('project-color').value,
   processingMode:({AutoProfessional:'auto',RGB24:'color',Grayscale8:'gray',BlackAndWhite1:'bw'})[$('project-color').value],documentType:$('project-document-type').value
  }:currentProject;
  const selected=settings?selectedTemplate():currentProject?.captureTemplate;
  models=await window.capture.models();$('capture-model-select').replaceChildren(new Option('Novo modelo',''));
  for(const model of models)$('capture-model-select').append(new Option(`${model.name} · v${model.version}`,model.id));
  $('capture-model-select').value=selected?.id||'';
  $('capture-surface').hidden=true;$('capture-sample-empty').hidden=false;$('capture-sample').removeAttribute('src');
  const page=current();if(!settings&&page)setSample(page.url);
  fillEditor(selected);$('capture-editor-status').textContent='';
  $('capture-model-save').textContent=settings?'Salvar modelo e selecionar':'Salvar modelo e usar no projeto';
  $('capture-editor').showModal();
 }
 $('capture-config').onclick=()=>run(()=>openAreas(false));
 $('capture-define-areas').onclick=()=>task(()=>openAreas(true),'editor-status');
 $('capture-scan-sample').onclick=()=>task(async()=>{
  $('capture-editor-status').textContent='Digitalizando uma folha de exemplo… aguarde.';
  const sample=await window.capture.sample(sampleSettings);setSample(sample.url);
  $('capture-editor-status').textContent='Folha recebida. Arraste sobre a imagem para criar os campos. Esta amostra não será exportada.';
 },'capture-editor-status');
 $('capture-sample-zoom').oninput=()=>{$('capture-surface').style.width=$('capture-sample-zoom').value+'%';};
 $('capture-fit-sample').onclick=()=>{$('capture-sample-zoom').value='100';$('capture-surface').style.width='100%';$('capture-sample-viewport').scrollTo?.(0,0);};
 $('capture-model-load').onclick=()=>fillEditor(models.find(m=>m.id===$('capture-model-select').value));
 $('capture-model-new').onclick=()=>{fillEditor(null);$('capture-model-select').value='';};
 $('capture-model-cancel').onclick=()=>{if(!uiBusy)$('capture-editor').close();};
 $('capture-editor').addEventListener('cancel',e=>{if(uiBusy)e.preventDefault();});
 $('capture-model-save').onclick=()=>task(async()=>{
  const model=await window.capture.saveModel({...editorModel,name:$('capture-model-name').value,fields,autoAlign:$('capture-auto-align').checked,alignmentReference});
  if(fromSettings){await loadModels(model);$('capture-editor').close();$('editor-status').textContent='Modelo selecionado. Salve o projeto para aplicar.';return;}
  currentProject=await window.capture.assign(model);$('capture-editor').close();status('Modelo salvo e ativado. Novas páginas terão extração automática; nesta página, clique em Extrair campos.');
  const page=current();if(page){page.captureLoaded=false;activate(page);}
 },'capture-editor-status');
 $('capture-open').onclick=()=>{const page=current();if(!page)return;if(!$('capture-panel').hidden){hide();return;}if(!page.captureData&&!currentProject.captureTemplate){status('Configure um modelo em Modelos de captura.');return;}render(page);load(page);};
 $('capture-extract').onclick=()=>run(async()=>{
  const page=current();if(!page)return;status('Extraindo campos das regiões… aguarde.');
  setData(page,await window.capture.extract(page.id,currentProject.id));render(page);status('Captura concluída. Confira os campos ao lado do documento.');
 });
 $('capture-save').onclick=()=>run(async()=>{await savePage(current());status('Dados de indexação salvos no projeto. Salve ou envie novamente para exportar a revisão.');});
 window.captureUI={activate,hide,loadModels,selectedTemplate,savePage,dirty,
  sync(){const page=current();for(const input of $('capture-values').querySelectorAll('input'))input.disabled=uiBusy||remoteReceiving;for(const id of ['capture-config','capture-open','capture-extract','capture-save'])$(id).disabled=uiBusy||remoteReceiving||(id==='capture-config'?!currentProject:!page)||(id==='capture-save'&&!page.captureData);if(page&&!uiBusy&&!remoteReceiving&&!page.captureLoaded)load(page);},
  reset(){hide();},
  confirmLeave(page){return !(page?dirty(page):reviewPages.some(dirty))||window.confirm('Há campos de captura não salvos. Continuar e descartar essas alterações?');}
 };
})();
