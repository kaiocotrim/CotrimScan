const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const sharp=require('sharp');

test('WIA entrega a primeira prévia antes de terminar o lote',async()=>{
 const source=await fs.readFile(path.join(__dirname,'../src/wia-scanner.cjs'),'utf8');
 const jpeg=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).jpeg().toBuffer();
 let finished=false,firstBeforeFinish=false;
 const mockExecFile=(_exe,args,_options,done)=>{
  const child={stdout:new EventEmitter(),kill(){}};
  const folder=args[args.indexOf('-OutputDirectory')+1];
  setTimeout(async()=>{
   try{
    for(let i=1;i<=2;i++){
     const file=path.join(folder,`page-${i}.jpg`);await fs.writeFile(file,jpeg);
     const line=JSON.stringify({file})+'\n';
     child.stdout.emit('data',line.slice(0,9));child.stdout.emit('data',line.slice(9));
     if(i===1)await new Promise(resolve=>setTimeout(resolve,40));
    }
    finished=true;done(null,'','');
   }catch(error){done(error,'',String(error));}
  },0);
  return child;
 };
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,__dirname:path.join(__dirname,'../src'),process:{platform:'win32'},Buffer,require:name=>name==='node:child_process'?{execFile:mockExecFile}:require(name)});
 const pages=[];
 const count=await module.exports.scan(300,'Feeder','RGB24',false,async page=>{pages.push(page);if(pages.length===1)firstBeforeFinish=!finished;});
 assert.equal(count,2);assert.equal(pages.length,2);assert.equal(firstBeforeFinish,true);
});
