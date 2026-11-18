const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateTemplate,renderTemplate}=require('../src/name-template.cjs');
const {namingMode,documentFilename}=require('../src/document-naming.cjs');

test('nome composto preserva matrícula corrigida e zeros à esquerda',()=>{
 const items=validateTemplate({file:[{kind:'ocr',fieldId:'matricula'},{kind:'text',text:'_'},{kind:'date',dateFormat:'AAAAMMDD'},{kind:'text',text:'_'},{kind:'counter',digits:4,start:1,increment:1}],folder:[]}).file;
 const name=renderTemplate(items,{fields:[{id:'matricula',value:'001234'}],sequence:1,date:new Date(2026,10,18)});
 assert.equal(name,'001234_20261118_0001');
 assert.equal(renderTemplate(items,{fields:[{id:'matricula',value:'001235'}],sequence:2,date:new Date(2026,10,18)}),'001235_20261118_0002');
});

test('valor OCR obrigatório inválido impede nomeação',()=>{
 assert.throws(()=>renderTemplate([{kind:'ocr',fieldId:'matricula'}],{fields:[],sequence:1}),/Campo OCR/);
});

test('modo personalizado usa seu próprio modelo e preserva o nome padrão como base',async()=>{
 assert.equal(namingMode('custom'),'custom');
 const output={filename:'pagina-original.jpg',buffer:Buffer.from('imagem'),extension:'jpg'};
 assert.deepEqual(await documentFilename({namingMode:'custom'},'pagina',output,'diretorio'),output);
});
