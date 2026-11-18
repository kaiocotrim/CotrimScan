const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const cfg=require('../src/scanner-config.cjs');

const LOCAL={id:'escl:127.0.0.1:9880',name:'Canon DR-C340',driver:'escl-local',host:'127.0.0.1',port:9880};

test('addManual valida entrada, evita duplicados e aplica limite',()=>{
 let config=cfg.normalizeConfig(null);
 config=cfg.addManual(config,{name:'Mesa 2',host:'192.168.0.50',port:9880});
 assert.equal(config.manual.length,1);
 assert.throws(()=>cfg.addManual(config,{name:'Outro',host:'192.168.0.50',port:9880}),/já foi adicionado/);
 assert.throws(()=>cfg.addManual(config,{name:'Ruim',host:'host invalido!',port:9880}),/endereço válido/);
 assert.throws(()=>cfg.addManual(config,{name:'Porta',host:'10.0.0.1',port:80}),/porta/);
 let full=cfg.normalizeConfig(null);
 for(let i=0;i<cfg.MAX_MANUAL;i++)full=cfg.addManual(full,{name:'S'+i,host:'10.0.0.'+(i+1),port:9880});
 assert.throws(()=>cfg.addManual(full,{name:'Extra',host:'10.0.1.1',port:9880}),/Limite/);
});

test('selectDevice exige dispositivo presente na lista e aceita null',()=>{
 const config=cfg.normalizeConfig(null);
 assert.equal(cfg.selectDevice(config,[LOCAL],LOCAL.id).selected,LOCAL.id);
 assert.equal(cfg.selectDevice({...config,selected:LOCAL.id},[LOCAL],null).selected,null);
 assert.throws(()=>cfg.selectDevice(config,[LOCAL],'escl:10.0.0.9:9880'),/não encontrado/);
});

test('resolveSelected informa ausência de seleção e dispositivo indisponível',()=>{
 assert.equal(cfg.resolveSelected({selected:LOCAL.id,manual:[]},[LOCAL]),LOCAL);
 assert.throws(()=>cfg.resolveSelected({selected:null,manual:[]},[LOCAL]),/Selecione um scanner/);
 assert.throws(()=>cfg.resolveSelected({selected:LOCAL.id,manual:[]},[]),/não está disponível/);
});

test('removeManual remove entrada e limpa a seleção quando necessário',()=>{
 const added=cfg.addManual(cfg.normalizeConfig(null),{name:'Mesa',host:'192.168.0.50',port:9880});
 const id='escl:192.168.0.50:9880';
 const removed=cfg.removeManual({...added,selected:id},id);
 assert.equal(removed.manual.length,0);
 assert.equal(removed.selected,null);
});

test('saveScannerConfig e loadScannerConfig persistem; arquivo inválido vira padrão',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'scanner-config-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'nested','scanner.json');
 const config=cfg.addManual({...cfg.normalizeConfig(null),selected:'escl:192.168.0.50:9880'},{name:'Mesa',host:'192.168.0.50',port:9880});
 await cfg.saveScannerConfig(file,config);
 const loaded=await cfg.loadScannerConfig(file);
 assert.deepEqual(loaded,config);
 await fs.writeFile(file,'{not json');
 assert.deepEqual(await cfg.loadScannerConfig(file),{selected:null,manual:[]});
 assert.deepEqual(await cfg.loadScannerConfig(path.join(dir,'missing.json')),{selected:null,manual:[]});
});
