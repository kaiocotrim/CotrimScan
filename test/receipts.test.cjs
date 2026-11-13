const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {processScan}=require('../src/mobile-image-quality.cjs');
const {cropReceiptContent}=require('../src/mobile-image-receipts.cjs');
const {createProjects}=require('../src/projects.cjs');
async function fixture(background='white'){
 return sharp(Buffer.from(`<svg width="1200" height="1600"><rect width="1200" height="1600" fill="${background}"/><rect x="240" y="600" width="720" height="210" fill="#fffdf4"/><text x="270" y="650" font-family="Arial" font-size="23">CANHOTO 123456789 - RECEBIDO</text><path d="M280 720 Q350 680 400 740 T600 720" stroke="#184cae" stroke-width="3" fill="none"/><path d="M260 785 H940" stroke="#aaa" stroke-width="1"/></svg>`)).png().toBuffer();
}
test('canhoto horizontal pequeno tem recorte por contorno, mantendo assinatura',async()=>{
 const input=await fixture('#30343a');
 const result=await processScan(input,{documentType:'receipt'});
 const meta=await sharp(result.image).metadata();
 assert.equal(result.cropMethod,'outline');assert.ok(meta.width>690&&meta.width<750);assert.ok(meta.height>190&&meta.height<240);
 const rgb=await sharp(result.image).removeAlpha().raw().toBuffer();let blue=0;
 for(let i=0;i<rgb.length;i+=3)if(rgb[i+2]>rgb[i]+35&&rgb[i+2]>rgb[i+1]+15)blue++;
 assert.ok(blue>350);
});
test('fundo branco usa todo o conteudo com margem; branco vazio nao e recortado',async()=>{
 const input=await fixture(),result=await processScan(input,{documentType:'receipt'}),meta=await sharp(result.image).metadata();
 assert.equal(result.cropMethod,'content');assert.ok(meta.width>775&&meta.width<850);assert.ok(meta.height>225&&meta.height<300);
 const blank=await sharp({create:{width:600,height:800,channels:3,background:'white'}}).png().toBuffer();
 assert.deepEqual(await cropReceiptContent(blank),blank);
 const unknown=await fixture('#888888');assert.deepEqual(await cropReceiptContent(unknown),unknown);
});
test('perfil persiste, reprocessa original e exporta PDF no tamanho do canhoto',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrim-receipt-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const projects=createProjects(dir),input={name:'Canhotos',port:9880,dpi:300,source:'Feeder',documentType:'receipt',duplex:true};
 const project=await projects.create(input);assert.equal((await projects.info(project.id)).documentType,'receipt');
 await assert.rejects(projects.create({...input,documentType:'invalid'}),/Tipo/);
 const normal=await projects.create({...input,documentType:undefined});assert.equal(normal.documentType,'document');
 const image=await fixture();await projects.append(project.id,image);
 const result=await projects.enhance(project.id,0);assert.equal(result.cropMethod,'content');assert.deepEqual(await projects.original(project.id,0),image);
 const meta=await sharp(result.image).metadata();
 const output=await projects.pageOutput(project.id,0);assert.equal(output.extension,'pdf');
 const pdf=output.buffer;
 const doc=await require('pdf-lib').PDFDocument.load(pdf),size=doc.getPages()[0].getSize();
 assert.ok(Math.abs(size.width/size.height-meta.width/meta.height)<.001);
});
test('scanner recebe lote de canhotos, recorta cada pagina e salva PDFs preservando originais',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cotrim-receipt-ipc-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const original=await sharp(await fixture()).jpeg({quality:98}).toBuffer();
 const handlers=new Map(),sent=[];let win;
 class Window{constructor(){win=this;this.webContents={mainFrame:{},setWindowOpenHandler(){},on(){},session:{setPermissionRequestHandler(){}},send:(name,page)=>sent.push(page)};}isDestroyed(){return false;}removeMenu(){}loadFile(){}}
 const electron={app:{whenReady:()=>Promise.resolve(),getPath:()=>dir,setName(){},setPath(){},on(){}},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{}};
 const src=path.join(__dirname,'../src');
 require('node:vm').runInNewContext(await fs.readFile(path.join(src,'main.cjs'),'utf8'),{__dirname:src,require(name){
  if(name==='electron')return electron;
  if(name==='./wia-scanner.cjs')return {available:async()=>false};
  if(name==='./scanner.cjs')return {...require('../src/scanner.cjs'),scan:async(port,dpi,source,onPage)=>{await onPage(original);await onPage(original);return 2;}};
  return name.startsWith('./')?require(path.join(src,name)):require(name);
 }});
 await new Promise(resolve=>setImmediate(resolve));const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 const invoke=(name,...args)=>handlers.get(name)(event,...args);
 await invoke('auth:register','usuario','senha-segura');
 const output=path.join(dir,'outputs');await fs.mkdir(output);
 const project=await invoke('projects:create',{name:'Canhotos',port:9880,dpi:300,source:'Feeder',documentType:'receipt',outputs:[output]});
 await invoke('projects:open',project.id);const result=await invoke('scan');assert.equal(result.pages,2);assert.equal(result.warnings.length,0);assert.equal(sent.length,2);
 for(const page of sent){assert.equal(page.hasProcessed,true);const meta=await sharp(Buffer.from(page.url.split(',')[1],'base64')).metadata();assert.ok(meta.height<350);}
 const files=await fs.readdir(output);assert.equal(files.length,2);assert.ok(files.every(file=>file.endsWith('.pdf')));
 const opened=await invoke('projects:open',project.id);assert.equal(opened.pages.length,2);
 assert.equal(await invoke('pages:original',0),'data:image/jpeg;base64,'+original.toString('base64'));
});
