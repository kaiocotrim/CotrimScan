const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
function namingMode(value='default'){
 if(!['default','qr','barcode','ocr'].includes(value))throw Error('Opção de nome dos arquivos inválida.');return value;
}
function safeCodeName(value){
 if(typeof value!=='string')return null;
 let stem=Array.from(value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g,'-').replace(/\s+/g,' ').trim()).slice(0,100).join('').replace(/^[.\s-]+|[.\s-]+$/g,'');
 while(Buffer.byteLength(stem,'utf8')>180)stem=Array.from(stem).slice(0,-1).join('');
 if(!stem)return null;
 if(/^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(stem))stem='_'+stem;
 return stem;
}
async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return null;throw error;}}
async function writeJson(file,data){
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify(data),{flag:'wx',mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
}
async function documentFilename(data,page,output,dir){
 if(data.namingMode==='default')return output;
 const file=path.join(dir,page+'-name.json');
 const previous=await readJson(file);
 let result;
 if(data.namingMode==='ocr'){
  const capture=await readJson(path.join(dir,page+'-capture.json'));
  const field=capture?.template.id===data.captureTemplate?.id?capture?.fields.find(f=>f.id===data.namingFieldId):null;
  if(!field||!field.value.trim()||field.error||capture.imageChanged&&!field.reviewed)return {...output,warning:'O campo OCR escolhido está vazio, inválido ou precisa de revisão. O nome padrão foi mantido.'};
  result={mode:'ocr',status:'found',text:field.value,fieldId:field.id};
 }else{
  let source;try{source=await fs.readFile(path.join(dir,page+'.source'));}catch(error){if(error.code!=='ENOENT')throw error;source=await fs.readFile(path.join(dir,page+'.jpg'));}
  const image=await fs.readFile(path.join(dir,page+'.jpg'));
  const hash=createHash('sha256').update(source).update(image).digest('hex');
  result=previous?.mode===data.namingMode&&previous.hash===hash?previous:null;
  if(!result){
   try{
    let decoded;
    try{decoded=await require('./document-codes.cjs').readDocumentCode(source,data.namingMode);}catch(error){if(image.equals(source))throw error;decoded={status:'not-found'};}
    if(decoded.status==='not-found'&&!image.equals(source))decoded=await require('./document-codes.cjs').readDocumentCode(image,data.namingMode);
    result={mode:data.namingMode,hash,...decoded};
   }catch{return {...output,warning:'Não foi possível ler o código. O documento foi salvo com o nome padrão.'};}
  }
 }
 const label=data.namingMode==='ocr'?'campo OCR':data.namingMode==='qr'?'QR Code':'código de barras';
 const base=result.status==='found'?safeCodeName(result.text):null;
 if(!base){
  await writeJson(file,result);
  return {...output,warning:result.status==='ambiguous'?`Foram encontrados códigos diferentes do tipo ${label}. O documento foi salvo com o nome padrão.`:`Nenhum ${label} válido foi encontrado. O documento foi salvo com o nome padrão.`};
 }
 const reserved=new Set();
 for(const other of data.pages){if(other===page)continue;const name=await readJson(path.join(dir,other+'-name.json'));if(name?.stem)reserved.add(name.stem.toLocaleLowerCase('en-US'));}
 async function occupied(stem){
  if(reserved.has(stem.toLocaleLowerCase('en-US')))return true;
  for(const folder of data.outputs){
   try{if(!(await fs.readFile(path.join(folder,`${stem}.${output.extension}`))).equals(output.buffer))return true;}
   catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return false;
 }
 const retained=previous?.mode===data.namingMode&&previous.text===result.text&&typeof previous.stem==='string'&&(previous.stem===base||previous.stem.startsWith(base+'-')&&/^\d+$/.test(previous.stem.slice(base.length+1)))?previous.stem:null;
 let stem=retained||base;
 if(await occupied(stem)){
  stem=base;let suffix=2;
  while(await occupied(stem)){stem=`${base}-${suffix++}`;if(suffix>10000)throw Error('Há muitos arquivos com esse código. Escolha outra pasta de saída.');}
 }
 await writeJson(file,{...result,stem});
 return {...output,filename:`${stem}.${output.extension}`,code:result.text};
}
module.exports={namingMode,safeCodeName,documentFilename,readJson,writeJson};
