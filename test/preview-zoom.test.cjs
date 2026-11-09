const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const {attach}=require('../src/preview-zoom.js');
function fixture(t){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8'),{pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,v=d.getElementById('document-viewport'),image=d.getElementById('document-preview'),stage=d.getElementById('zoom-stage');
 let width=600,height=600;
 Object.defineProperties(v,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
 Object.defineProperties(image,{naturalWidth:{get:()=>1200},naturalHeight:{get:()=>1600}});
 v.getBoundingClientRect=()=>({left:100,top:50,right:100+width,bottom:50+height,width,height});
 image.getBoundingClientRect=()=>{const iw=parseFloat(image.style.width)||1200,ih=parseFloat(image.style.height)||1600;const left=100+((parseFloat(stage.style.width)||width)-iw)/2-v.scrollLeft,top=50+((parseFloat(stage.style.height)||height)-ih)/2-v.scrollTop;return {left,top,right:left+iw,bottom:top+ih,width:iw,height:ih};};
 const api=attach(d);api.setImage('data:image/jpeg;base64,YQ==','Documento');image.dispatchEvent(new w.Event('load'));
 return {w,d,v,image,stage,api,resize:(a,b)=>{width=a;height=b;api.refresh();}};
}
test('zoom ajusta a folha, permite tamanho original e limita a ampliação',t=>{
 const f=fixture(t);assert.equal(Math.round(parseFloat(f.image.style.height)),552);
 assert.equal(f.d.getElementById('zoom-level').value,'fit');
 f.d.getElementById('zoom-level').value='1';f.d.getElementById('zoom-level').dispatchEvent(new f.w.Event('change'));
 assert.equal(parseFloat(f.image.style.width),1200);assert.equal(parseFloat(f.image.style.height),1600);assert.ok(f.v.scrollTop>0);
 f.api.zoom(20);assert.equal(parseFloat(f.image.style.width),4800);assert.equal(f.d.getElementById('zoom-in').disabled,true);
 assert.equal(f.image.src,'data:image/jpeg;base64,YQ==');
 f.api.zoom(.001);assert.equal(parseFloat(f.image.style.width),120);assert.equal(f.d.getElementById('zoom-out').disabled,true);
 f.api.fitToScreen();f.resize(350,600);assert.ok(parseFloat(f.image.style.width)<=302.01);assert.equal(f.v.scrollLeft,0);
});
test('zoom mantém o detalhe sob o ponteiro e permite arrastar a página ampliada',t=>{
 const f=fixture(t);f.api.zoom(1);const point={x:300,y:250};
 const before=f.image.getBoundingClientRect(),u=(point.x-before.left)/before.width,v=(point.y-before.top)/before.height;
 const wheel=new f.w.WheelEvent('wheel',{ctrlKey:true,deltaY:-120,clientX:point.x,clientY:point.y,cancelable:true});f.v.dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,true);
 const after=f.image.getBoundingClientRect();assert.ok(Math.abs((point.x-after.left)/after.width-u)<.0001);assert.ok(Math.abs((point.y-after.top)/after.height-v)<.0001);
 const left=f.v.scrollLeft;f.v.dispatchEvent(new f.w.MouseEvent('pointerdown',{button:0,clientX:350,clientY:300,cancelable:true}));f.v.dispatchEvent(new f.w.MouseEvent('pointermove',{clientX:390,clientY:300}));assert.ok(Math.abs(f.v.scrollLeft-(left-40))<.001);
 f.v.dispatchEvent(new f.w.MouseEvent('pointerup'));assert.equal(f.v.classList.contains('is-panning'),false);
});
test('lupa amplia a região correta, some ao sair e é limpa ao trocar a imagem',t=>{
 const f=fixture(t);f.api.zoom(1);const button=f.d.getElementById('zoom-loupe'),lens=f.d.getElementById('document-loupe');button.click();
 assert.equal(button.getAttribute('aria-pressed'),'true');f.v.dispatchEvent(new f.w.MouseEvent('pointermove',{clientX:400,clientY:350}));
 assert.equal(lens.hidden,false);assert.equal(lens.style.backgroundSize,'3600px 4800px');assert.ok(lens.style.backgroundImage.includes('data:image/jpeg'));
 f.v.dispatchEvent(new f.w.Event('scroll'));assert.equal(lens.hidden,true);
 f.api.setImage('data:image/jpeg;base64,Yg==','Outra página');f.image.dispatchEvent(new f.w.Event('load'));assert.equal(f.d.getElementById('zoom-level').value,'fit');
 f.api.clear();assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(f.stage.hidden,true);
});
test('atalhos ficam restritos à imagem e não alteram o texto do OCR',t=>{
 const f=fixture(t),box=f.d.getElementById('ocr-result-text');box.value='Texto + e -';
 const before=f.image.style.width;box.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'+',bubbles:true}));assert.equal(f.image.style.width,before);assert.equal(box.value,'Texto + e -');
 f.v.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'+',bubbles:true,cancelable:true}));assert.notEqual(f.image.style.width,before);
 f.v.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'0',bubbles:true,cancelable:true}));assert.equal(f.d.getElementById('zoom-level').value,'fit');
 f.api.syncControls(true);assert.equal(f.d.getElementById('zoom-in').disabled,true);f.api.syncControls(false);assert.equal(f.d.getElementById('zoom-in').disabled,false);
});
