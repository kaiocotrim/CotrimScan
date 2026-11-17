const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const sharp=require('sharp');

test('TWAIN entrega as miniaturas após encerrar o lote',async()=>{
 const source=await fs.readFile(path.join(__dirname,'../src/naps2-twain.cjs'),'utf8');
 const jpeg=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).jpeg().toBuffer();
 let finished=false,firstBeforeFinish=false;
 const mockExecFile=(_exe,args,_options,done)=>{
  const output=args[args.indexOf('-o')+1];
  const folder=path.dirname(output);
  setTimeout(async()=>{
   try{
    await fs.writeFile(path.join(folder,'page-001.jpg'),jpeg);
    setTimeout(async()=>{
     await fs.writeFile(path.join(folder,'page-002.jpg'),jpeg);
     finished=true;done(null,'','');
    },350);
   }catch(error){done(error,'',String(error));}
  },0);
  return {kill(){}};
 };
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,__dirname:path.join(__dirname,'../src'),process:{platform:'win32',env:{}},Buffer,setInterval,clearInterval,require:name=>name==='node:child_process'?{execFile:mockExecFile}:require(name)});
 const count=await module.exports.scan({exe:'mock',name:'Canon DR-C340 TWAIN'},300,'Feeder','RGB24',true,async()=>{if(!firstBeforeFinish)firstBeforeFinish=!finished;},2);
 assert.equal(count,2);
 assert.equal(firstBeforeFinish,false);
});

test('falha WIA tenta o mesmo scanner pelo NAPS2 TWAIN',async()=>{
 const source=await fs.readFile(path.join(__dirname,'../src/naps2-twain.cjs'),'utf8');
 const jpeg=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).jpeg().toBuffer();
 const drivers=[];
 const mockExecFile=(_exe,args,_options,done)=>{
  const driver=args[args.indexOf('--driver')+1];drivers.push(driver);
  setTimeout(async()=>{
   if(driver==='wia')return done(Error('WIA falhou'),'','WIA falhou');
   const output=args[args.indexOf('-o')+1];
   await fs.writeFile(path.join(path.dirname(output),'page-001.jpg'),jpeg);
   done(null,'','');
  },0);
  return {kill(){}};
 };
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,__dirname:path.join(__dirname,'../src'),process:{platform:'win32',env:{}},Buffer,require:name=>name==='node:child_process'?{execFile:mockExecFile}:require(name)});
 const pages=[];
 assert.equal(await module.exports.scan({exe:'mock',name:'Canon DR-C340 TWAIN'},300,'Feeder','RGB24',true,async page=>pages.push(page),2),1);
 assert.equal(pages.length,1);
 assert.deepEqual(drivers,['wia','twain']);
});
