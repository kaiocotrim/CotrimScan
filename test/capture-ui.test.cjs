const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
test('painel mantém rascunho, salva revisão e permite desativar modelo',async t=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8'),{runScripts:'outside-only',url:'https://localhost/'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;
 const model={id:'modelo',name:'Ficha',version:1,fields:[]};
 const data={template:model,revision:'r1',needsReview:true,fields:[{id:'matricula',name:'Matrícula',value:'00125478',recognized:'00125478',confidence:90,reviewed:false,region:{x:0,y:0,width:.5,height:.2}}]};
 let saved;
 w.capture={models:async()=>[model],read:async()=>data,save:async(id,values,revision,projectId)=>{saved={id,values,revision,projectId};return {...data,fields:[{...data.fields[0],...values[0],corrected:true}],revision:'r2',needsReview:false};}};
 w.eval(`var $=id=>document.getElementById(id);var reviewPages=[{id:0,url:'sample'}],activePage=0,currentProject={id:'projeto',captureTemplate:${JSON.stringify(model)}},uiBusy=false,remoteReceiving=false;var message=e=>e.message;var status=s=>{};var setOcrVisible=v=>{};var run=f=>f();var task=f=>f();`);
 w.eval(fs.readFileSync(path.join(__dirname,'../src/capture-ui.js'),'utf8'));
 w.eval('window.captureUI.activate(reviewPages[0]);');await new Promise(r=>setImmediate(r));
 assert.equal(d.getElementById('capture-panel').hidden,false);
 const input=d.querySelector('#capture-values input[type=text]');assert.equal(input.value,'00125478');input.value='00125473';input.dispatchEvent(new w.Event('input'));
 const check=d.querySelector('#capture-values input[type=checkbox]');check.checked=true;check.dispatchEvent(new w.Event('change'));
 assert.equal(w.eval('window.captureUI.dirty(reviewPages[0])'),true);
 await w.eval('window.captureUI.savePage(reviewPages[0])');assert.equal(saved.values[0].value,'00125473');assert.equal(saved.revision,'r1');assert.equal(saved.projectId,'projeto');
 assert.equal(w.eval('window.captureUI.dirty(reviewPages[0])'),false);
 await w.captureUI.loadModels(model);assert.equal(w.captureUI.selectedTemplate().id,'modelo');
 d.getElementById('project-capture').value='';assert.equal(w.captureUI.selectedTemplate(),null);
});

test('definir áreas no projeto permite digitalizar amostra e selecionar modelo sem salvar o projeto',async t=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8'),{runScripts:'outside-only',url:'https://localhost/'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;let settings,saved,assigned=false,previewOptions;const reference={aspect:1.4,points:[{key:'documento',x:.1,y:.1},{key:'cliente',x:.5,y:.5},{key:'assinatura',x:.7,y:1.1}]};
 const model={id:'modelo',name:'Ficha',version:1,fields:[{id:'matricula',name:'Matrícula',type:'identifier',required:true,region:{x:.1,y:.1,width:.4,height:.2}}]};
 w.capture={calibrate:async()=>({reference}),preview:async(url,field,dpi,options)=>{previewOptions=options;assert.equal(field.id,'matricula');assert.equal(dpi,300);assert.ok(url.startsWith('data:image/jpeg;'));return {value:'00125478',confidence:95,error:''};},models:async()=>[model],sample:async input=>{settings=input;return {url:'data:image/jpeg;base64,YQ=='};},saveModel:async input=>{saved=input;return {...input,version:2};},assign:async()=>{assigned=true;}};
 w.eval(`var $=id=>document.getElementById(id);var reviewPages=[],activePage=null,currentProject=null,uiBusy=false,remoteReceiving=false;var message=e=>e.message;var status=s=>{};var setOcrVisible=v=>{};var run=f=>f();var task=f=>f();`);
 for(const dialog of d.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 w.eval(fs.readFileSync(path.join(__dirname,'../src/capture-ui.js'),'utf8'));await w.captureUI.loadModels(model);
 await d.getElementById('capture-define-areas').onclick();assert.ok(d.getElementById('capture-editor').open);assert.equal(d.getElementById('capture-surface').hidden,true);
 await d.getElementById('capture-scan-sample').onclick();assert.equal(settings.port,9880);assert.equal(settings.source,'Feeder');assert.equal(settings.processingMode,'auto');assert.equal(d.getElementById('capture-surface').hidden,false);
 assert.ok(d.querySelector('.capture-editor-layout > .capture-properties'));assert.ok(d.getElementById('capture-sample').src.startsWith('data:image/jpeg;'));
 await d.getElementById('capture-calibrate').onclick();assert.equal(d.getElementById('capture-auto-align').checked,true);
 const margin=d.querySelector('.capture-margin');margin.value='2';margin.oninput();
 const anchor=d.querySelector('.capture-anchor-toggle');anchor.checked=true;anchor.onchange();const text=d.querySelector('.capture-anchor-options input');text.value='Matrícula';text.oninput();
 await d.querySelector('.capture-read-field').onclick();assert.equal(previewOptions.autoAlign,true);assert.equal(previewOptions.alignmentReference.points.length,3);assert.match(d.querySelector('.capture-field-result').textContent,/00125478/);
 d.getElementById('project-naming').value='ocr';d.getElementById('project-naming').onchange();assert.equal(d.getElementById('project-naming-field-row').hidden,false);
 d.getElementById('project-naming-field').value='matricula';
 const surface=d.getElementById('capture-regions');surface.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});surface.setPointerCapture=()=>{};
 surface.onpointerdown({button:0,clientX:500,clientY:500,pointerId:1,preventDefault(){}});surface.onpointerup({clientX:800,clientY:700});
 assert.equal(d.querySelectorAll('#capture-field-list fieldset').length,2);
 await d.getElementById('capture-model-save').onclick();assert.equal(saved.fields.length,2);assert.equal(saved.fields[0].margin,.02);assert.equal(saved.fields[0].anchor.text,'Matrícula');assert.equal(saved.autoAlign,true);assert.equal(saved.alignmentReference.points.length,3);assert.ok(Math.abs(saved.fields[1].region.width-.3)<1e-10);assert.equal(assigned,false);assert.equal(w.captureUI.selectedTemplate().version,2);assert.equal(d.getElementById('project-naming-field').value,'matricula');assert.equal(d.getElementById('capture-editor').open,false);
});
