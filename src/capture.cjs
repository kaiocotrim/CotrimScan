const {randomUUID}=require('node:crypto');
const {writeJson,readJson}=require('./document-naming.cjs');
const fs=require('node:fs/promises'),path=require('node:path');
function template(input){
 if(input==null)return null;
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80||!Array.isArray(input.fields)||input.fields.length<1||input.fields.length>30)throw Error('Informe o nome do modelo e de 1 a 30 campos.');
 const ids=new Set(),names=new Set();
 const fields=input.fields.map(field=>{
  const {id,name,type,required,region,digits}=field;
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id)||typeof name!=='string'||!name.trim()||name.length>80||names.has(name.trim().toLowerCase()))throw Error('Campos devem ter nomes e identificadores únicos.');
  ids.add(id);names.add(name.trim().toLowerCase());
  if(!['text','identifier','cpf','date'].includes(type)||typeof required!=='boolean'||!region||!['x','y','width','height'].every(k=>Number.isFinite(region[k]))||region.x<0||region.y<0||region.width<.005||region.height<.005||region.x+region.width>1.000001||region.y+region.height>1.000001)throw Error('Tipo ou região do campo inválido.');
  if(digits!=null&&(!Number.isInteger(digits)||digits<1||digits>100))throw Error('Quantidade de dígitos inválida.');
  const margin=field.margin??0;
  if(!Number.isFinite(margin)||margin<0||margin>.1)throw Error('A margem deve ficar entre 0 e 10% da página.');
  let anchor=null;
  if(field.anchor!=null){const a=field.anchor;if(typeof a.text!=='string'||!a.text.trim()||a.text.length>100||!['right','below'].includes(a.direction)||!Number.isFinite(a.gap)||a.gap<0||a.gap>.2)throw Error('Referência de campo inválida.');anchor={text:a.text.trim(),direction:a.direction,gap:a.gap};}
  return {id,name:name.trim(),type,required,margin,anchor,region:{x:region.x,y:region.y,width:region.width,height:region.height},...(digits?{digits}:{})};
 });
 const autoAlign=input.autoAlign??false,ref=input.alignmentReference??null;
 if(typeof autoAlign!=='boolean')throw Error('Alinhamento inválido.');
 let alignmentReference=null;
 if(ref){
  if(!Number.isFinite(ref.aspect)||ref.aspect<.2||ref.aspect>5||!Array.isArray(ref.points)||ref.points.length<3||ref.points.length>150||ref.points.some(p=>!p||typeof p.key!=='string'||!/^[a-z]{3,80}$/.test(p.key)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>ref.aspect)||new Set(ref.points.map(p=>p.key)).size!==ref.points.length)throw Error('Referência de alinhamento inválida.');
  alignmentReference={aspect:ref.aspect,points:ref.points.map(p=>({key:p.key,x:p.x,y:p.y}))};
 }
 if(autoAlign&&!alignmentReference)throw Error('Calibre o alinhamento usando a folha de exemplo.');
 return {autoAlign,alignmentReference,id:typeof input.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)?input.id:randomUUID(),version:Number.isInteger(input.version)&&input.version>0?input.version:1,name:input.name.trim(),fields};
}
function validation(field,value){
 if(!value.trim())return field.required?'Campo obrigatório.':'';
 if(field.type==='identifier'&&!/^\d+$/.test(value))return 'Use somente dígitos.';
 if(field.digits&&(!/^\d+$/.test(value)||value.length!==field.digits))return `Esperado: ${field.digits} dígitos.`;
 if(field.type==='cpf'){
  const n=value.replace(/[.\-\s]/g,'');
  if(!/^\d{11}$/.test(n)||/^(\d)\1{10}$/.test(n))return 'CPF inválido.';
  for(const count of [9,10]){let sum=0;for(let i=0;i<count;i++)sum+=Number(n[i])*(count+1-i);const digit=(sum*10%11)%10;if(digit!==Number(n[count]))return 'CPF inválido.';}
 }
 if(field.type==='date'){
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value),d=m&&new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  if(!m||d.getFullYear()!==Number(m[3])||d.getMonth()!==Number(m[2])-1||d.getDate()!==Number(m[1]))return 'Use uma data válida em DD/MM/AAAA.';
 }
 return '';
}
function createTemplates(root){
 const file=path.join(root,'capture-models.json');
 return {
  async list(){return await readJson(file)||[];},
  async save(input){const model=template(input),models=await this.list(),previous=models.find(m=>m.id===model.id);model.version=previous?previous.version+1:1;await fs.mkdir(root,{recursive:true});await writeJson(file,[...models.filter(m=>m.id!==model.id),model]);return model;}
 };
}
function extract(image,model,dpi,{calibrate=false}={}){
 const {execFile}=require('node:child_process');
 const worker=path.join(__dirname,'document-zones-worker.cjs').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
 return new Promise((resolve,reject)=>{
  const child=execFile(process.platform==='linux'&&process.versions.electron?'node':process.execPath,[worker,JSON.stringify(calibrate?{fields:[]}:template(model)),String(dpi),calibrate?'calibrate':'extract'],{windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},maxBuffer:2*1024*1024,timeout:180000},(error,stdout)=>{
   if(error)return reject(Error(calibrate?'Não foi possível calibrar. Use uma folha nítida com pelo menos três palavras distintas e distribuídas pela página.':'Não foi possível extrair os campos. A página foi preservada; tente novamente.'));
   try{resolve(JSON.parse(stdout));}catch{reject(Error('Resposta de captura inválida.'));}
  });child.stdin.on('error',()=>{});child.stdin.end(image);
 });
}
function sampleBuffer(url){
 if(typeof url!=='string'||url.length>42*1024*1024||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url))throw Error('Digitalize uma folha de exemplo antes de ler o campo.');
 return Buffer.from(url.slice(url.indexOf(',')+1),'base64');
}
async function calibrate(url,dpi){
 if(![150,300,600].includes(dpi))throw Error('Resolução inválida.');
 return extract(sampleBuffer(url),null,dpi,{calibrate:true});
}
async function preview(url,field,dpi,options={}){
 const image=sampleBuffer(url);
 if(![150,300,600].includes(dpi))throw Error('Resolução inválida.');
 const model=template({name:'Teste de campo',fields:[field],autoAlign:options.autoAlign,alignmentReference:options.alignmentReference});
 const result=await extract(image,model,dpi);
 const value=result.fields[0];return {...value,error:value.error||validation(value,value.value)};
}
module.exports={calibrate,preview,template,validation,createTemplates,extract};
