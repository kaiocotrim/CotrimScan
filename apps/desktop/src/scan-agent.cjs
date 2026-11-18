const http=require('node:http');
const fs=require('node:fs/promises');
const {randomBytes,timingSafeEqual}=require('node:crypto');

const DEFAULT_PORT=9877;
const MAX_BODY=4096;
const MAX_PAGES=200;
const SOURCES=['Feeder','Platen'];
const COLOR_MODES=['RGB24','Grayscale8','BlackAndWhite1'];
const LOOPBACK_HOSTS=['127.0.0.1','localhost'];

// Loads agent.json from userData. Creates it on first run with a random token that is kept across restarts.
async function loadAgentConfig(file){
 try{
  const parsed=JSON.parse(await fs.readFile(file,'utf8'));
  if(typeof parsed.token==='string'&&/^[0-9a-f]{64}$/.test(parsed.token)&&Number.isInteger(parsed.port)&&Array.isArray(parsed.allowedOrigins))return parsed;
 }catch{}
 const config={port:DEFAULT_PORT,token:randomBytes(32).toString('hex'),allowedOrigins:[]};
 await fs.writeFile(file,JSON.stringify(config,null,2),{mode:0o600});
 return config;
}

function send(res,status,body,headers={}){
 const payload=body===undefined?'':JSON.stringify(body);
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
 res.end(payload);
}

function readBody(req){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0;
  req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY){reject(Object.assign(Error('Requisição muito grande.'),{status:413}));req.destroy();return;}chunks.push(chunk);});
  req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error',reject);
 });
}

function parseScanOptions(raw){
 let input;
 try{input=raw?JSON.parse(raw):{};}catch{throw Object.assign(Error('JSON inválido.'),{status:400});}
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Corpo inválido.'),{status:400});
 const dpi=input.dpi===undefined?300:input.dpi;
 const source=input.source===undefined?'Feeder':input.source;
 const colorMode=input.colorMode===undefined?'RGB24':input.colorMode;
 const duplex=input.duplex===undefined?false:input.duplex;
 const maxPages=input.maxPages===undefined?MAX_PAGES:input.maxPages;
 const device=input.device;
 if(typeof device!=='string'||!device||device.length>300)throw Object.assign(Error('Informe o scanner (device).'),{status:400});
 if(!Number.isInteger(dpi)||dpi<75||dpi>1200)throw Object.assign(Error('DPI inválido.'),{status:400});
 if(!SOURCES.includes(source))throw Object.assign(Error('Origem inválida.'),{status:400});
 if(!COLOR_MODES.includes(colorMode))throw Object.assign(Error('Modo de cor inválido.'),{status:400});
 if(typeof duplex!=='boolean')throw Object.assign(Error('Duplex inválido.'),{status:400});
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES)throw Object.assign(Error('Quantidade de páginas inválida.'),{status:400});
 return {device,dpi,source,colorMode,duplex,maxPages};
}

function tokenMatches(header,token){
 if(typeof header!=='string'||!header.startsWith('Bearer '))return false;
 const given=Buffer.from(header.slice(7).trim(),'utf8');
 const expected=Buffer.from(token,'utf8');
 return given.length===expected.length&&timingSafeEqual(given,expected);
}

// Local HTTP agent that exposes the scanner to other local apps (e.g. DocReport) through a Bearer token.
// listDevices() resolves to {devices:[{id,name,driver,host,port}], forkError}.
// acquire(options, onPage) receives options.device (resolved from listDevices) and must resolve with the number of pages,
// calling onPage(jpegBuffer) for each page.
function createScanAgent({config,listDevices=async()=>({devices:[]}),acquire,isBusy=()=>false,log=()=>{}}){
 let server=null,busy=false,port=null;
 const allowed=new Set(config.allowedOrigins||[]);

 function cors(req,res){
  const origin=req.headers.origin;
  if(!origin)return true;
  if(!allowed.has(origin))return false;
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network','true');
  res.setHeader('Access-Control-Max-Age','600');
  res.setHeader('Vary','Origin');
  return true;
 }

 async function handle(req,res){
  // Reject DNS-rebinding attempts: the Host header must be a loopback name for this port.
  const host=String(req.headers.host||'').replace(/:\d+$/,'');
  if(!LOOPBACK_HOSTS.includes(host))return send(res,400,{error:'Host inválido.'});
  if(!cors(req,res))return send(res,403,{error:'Origem não permitida.'});
  if(req.method==='OPTIONS')return res.writeHead(204).end();
  if(!tokenMatches(req.headers.authorization,config.token))return send(res,401,{error:'Token inválido.'},{'WWW-Authenticate':'Bearer'});

  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method==='GET'&&url.pathname==='/status')return send(res,200,{ok:true,name:'CotrimScan Scan Agent',version:2,busy:busy||isBusy()});
  if(req.method==='GET'&&url.pathname==='/devices'){
   const {devices,forkError}=await listDevices();
   return send(res,200,{devices:devices.map(({id,name,driver})=>({id,name,driver})),...(forkError?{error:forkError}:{})});
  }
  if(req.method==='POST'&&url.pathname==='/scan'){
   const options=parseScanOptions(await readBody(req));
   const {devices}=await listDevices();
   const device=devices.find(item=>item.id===options.device);
   if(!device)return send(res,400,{error:'Scanner desconhecido ou indisponível. Consulte GET /devices.'});
   if(busy||isBusy())return send(res,409,{error:'O scanner está ocupado. Aguarde e tente novamente.'});
   busy=true;
   try{
    const pages=[];
    await acquire({...options,device},async buffer=>{pages.push({mime:'image/jpeg',data:Buffer.from(buffer).toString('base64')});});
    if(!pages.length)return send(res,422,{error:'Nenhuma página foi recebida.'});
    return send(res,200,{count:pages.length,pages});
   }finally{busy=false;}
  }
  return send(res,404,{error:'Rota não encontrada.'});
 }

 return {
  start(){
   return new Promise((resolve,reject)=>{
    server=http.createServer((req,res)=>{
     handle(req,res).catch(error=>{
      const status=error.status||500;
      log('scan-agent',error);
      if(!res.headersSent)send(res,status,{error:status===500?'Falha na digitalização.':error.message});
     });
    });
    server.once('error',reject);
    server.listen(config.port,'127.0.0.1',()=>{
     port=server.address().port;
     server.unref();
     resolve({port});
    });
   });
  },
  stop(){
   return new Promise(resolve=>{
    if(!server)return resolve();
    server.close(()=>{server=null;port=null;resolve();});
   });
  },
  address(){return port;},
  busy:()=>busy
 };
}

module.exports={DEFAULT_PORT,MAX_PAGES,loadAgentConfig,createScanAgent,parseScanOptions,tokenMatches};
