const {test}=require('node:test'),assert=require('node:assert/strict');
const sharp=require('sharp'),g=require('../src/document-zone-geometry.cjs'),capture=require('../src/capture.cjs');
const field=()=>({id:'matricula',name:'Matrícula',type:'identifier',digits:8,required:true,region:{x:.62,y:.105,width:.3,height:.065}});
async function image({transform='',label='MATRICULA',extra='',valueTransform=''}={}){
 const svg=`<svg width="1600" height="1200"><rect width="1600" height="1200" fill="white"/><g transform="${transform}" font-family="Arial" font-size="44"><text x="100" y="110">DOCUMENTO</text><text x="100" y="450">CONTRATO</text><text x="100" y="800">CLIENTE</text><text x="900" y="1000">ASSINATURA</text><g transform="${valueTransform}"><text x="700" y="180">${label}</text><text x="1000" y="180">00125478</text></g>${extra}</g></svg>`;
 return sharp(Buffer.from(svg)).jpeg({quality:97}).toBuffer();
}
test('geometria encontra transformação com rotação, escala, deslocamento e um outlier',()=>{
 const reference={aspect:1.4,points:[{key:'documento',x:.1,y:.2},{key:'cliente',x:.7,y:.2},{key:'assinatura',x:.1,y:1.1},{key:'contrato',x:.7,y:1.1}]},t={a:1.02*Math.cos(.06),b:1.02*Math.sin(.06),tx:.025,ty:-.01};
 const words=reference.points.map((p,i)=>{const q=g.apply(t,p);return {key:p.key,confidence:95,x:q.x-.01,y:(q.y-.01)/1.4,width:.02,height:.02/1.4};});words[3].x=.95;
 const found=g.alignment(reference,words,1.4);assert.ok(found);assert.equal(found.matches,3);assert.ok(Math.abs(found.a-t.a)<1e-8);assert.ok(Math.abs(found.b-t.b)<1e-8);
 const p={x:.4,y:.8},back=g.inverse(found,g.apply(found,p));assert.ok(Math.abs(back.x-p.x)<1e-8);assert.ok(Math.abs(back.y-p.y)<1e-8);
 assert.deepEqual(g.expand({x:.01,y:0,width:.1,height:.1},.02),{x:0,y:0,width:.13,height:.12000000000000001});
 assert.equal(g.alignment(reference,[],1.4),null);
 assert.deepEqual(g.anchoredRegion({width:.2,height:.1},{direction:'below',gap:.02},{x:.3,y:.4,width:.1,height:.05}),{x:.3,y:.47000000000000003,width:.2,height:.1});
 assert.equal(g.findAnchor([{key:'numero',line:0,confidence:90,x:.1,y:.1,width:.1,height:.02},{key:'matricula',line:0,confidence:90,x:.2,y:.1,width:.1,height:.02}],'Número matrícula').length,1);
});
test('novas opções são validadas e modelos antigos continuam sem alinhamento',()=>{
 const legacy=capture.template({name:'Modelo',fields:[field()]});assert.equal(legacy.autoAlign,false);assert.equal(legacy.fields[0].margin,0);assert.equal(legacy.fields[0].anchor,null);
 for(const margin of [-1,.11,NaN,'1'])assert.throws(()=>capture.template({name:'Modelo',fields:[{...field(),margin}]}),/margem/);
 assert.throws(()=>capture.template({name:'Modelo',autoAlign:true,fields:[field()]}),/Calibre/);
 assert.throws(()=>capture.template({name:'Modelo',fields:[{...field(),anchor:{text:'',direction:'right',gap:0}}]}),/Referência/);
});
test('OCR real tolera margem e encontra campo deslocado por referência textual',async()=>{
 const shifted=await image({valueTransform:'translate(120 90)'}),f={...field(),anchor:{text:'MATRICULA',direction:'right',gap:.015},margin:.01};
 const result=await capture.extract(shifted,{name:'Referência',fields:[f]},300);
 assert.equal(result.fields[0].value,'00125478');assert.equal(result.fields[0].location.anchorFound,true);assert.ok(result.fields[0].resolvedRegion.y>.14);
 const absent=await capture.extract(await image({label:'OUTRO'}),{name:'Referência',fields:[f]},300);assert.equal(absent.fields[0].value,'');assert.match(absent.fields[0].error,/não encontrado/);
 const repeated=await capture.extract(await image({extra:'<text x="700" y="600">MATRICULA</text>'}),{name:'Referência',fields:[f]},300);assert.equal(repeated.fields[0].value,'');assert.match(repeated.fields[0].error,/repetida/);
});
test('OCR real calibra a amostra e alinha página deslocada e inclinada sem alterar a imagem',async()=>{
 const original=await image(),url='data:image/jpeg;base64,'+original.toString('base64');
 const {reference}=await capture.calibrate(url,300);assert.ok(reference.points.length>=3);
 const model={name:'Alinhado',autoAlign:true,alignmentReference:reference,fields:[{...field(),margin:.008}]};
 const shifted=await image({transform:'translate(28 16) rotate(3 800 600)'}),before=Buffer.from(shifted);
 const result=await capture.extract(shifted,model,300);assert.deepEqual(shifted,before);
 assert.equal(result.fields[0].value,'00125478',JSON.stringify(result));assert.equal(result.fields[0].location.aligned,true);assert.ok(result.fields[0].location.matches>=3);
 const combined=await capture.extract(shifted,{...model,fields:[{...field(),margin:.01,anchor:{text:'MATRICULA',direction:'right',gap:.015}}]},300);
 assert.equal(combined.fields[0].value,'00125478');assert.equal(combined.fields[0].location.anchorFound,true);assert.equal(combined.fields[0].location.aligned,true);
 const blank=await sharp({create:{width:1600,height:1200,channels:3,background:'white'}}).jpeg().toBuffer();
 const missing=await capture.extract(blank,model,300);assert.equal(missing.fields[0].value,'');assert.match(missing.fields[0].error,/alinhar/);
});
