const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/main.cjs'),'utf8');
const discovery=source.slice(source.indexOf('async function listScanners('),source.indexOf('async function selectedScanner('));
function fixture({wiaFails=false,twainFails=false}={}){
 const calls=[];
 const context={process:{platform:'win32'},sane:{listDevices:async()=>[]},wia:{listDevices:async()=>{calls.push('wia');if(wiaFails)throw Error('WIA indisponível');return [{id:'wia:test',driver:'wia'}];}},scanService:{ensure:async()=>{calls.push('ensure');if(twainFails)throw Error('TWAIN indisponível');}},escl:{refreshDevices:async()=>calls.push('refresh'),listDevices:async()=>{calls.push('twain');return {devices:[{id:'canon',driver:'escl-local'}],forkError:null};}},scannerConfig:{loadScannerConfig:async()=>({manual:[]})},scannerConfigFile:()=>'',log:{error(){}}};
 vm.createContext(context);vm.runInContext(discovery,context);return {calls,list:context.listScanners};
}
test('busca WIA e TWAIN mesmo com dispositivo WIA encontrado',async()=>{
 const f=fixture(),result=await f.list();assert.deepEqual(Array.from(result.devices,d=>d.id),['wia:test','canon']);assert.ok(f.calls.includes('ensure'));assert.ok(f.calls.includes('twain'));
});
test('atualizar reenumera TWAIN mesmo com WIA disponível',async()=>{
 const f=fixture();await f.list({refresh:true});assert.ok(f.calls.includes('wia'));assert.ok(f.calls.includes('refresh'));assert.ok(f.calls.indexOf('refresh')<f.calls.indexOf('twain'));
});
test('falha TWAIN mantém WIA e informa erro',async()=>{
 const result=await fixture({twainFails:true}).list();assert.ok(result.devices.some(d=>d.id==='wia:test'));assert.equal(result.forkError,'TWAIN indisponível');
});
test('falha WIA não impede detecção TWAIN',async()=>{
 const result=await fixture({wiaFails:true}).list();assert.ok(result.devices.some(d=>d.id==='canon'));
});
test('Linux lista scanner SANE sem depender da inicialização do serviço .NET',async()=>{
 const context={process:{platform:'linux'},sane:{listDevices:async()=>[{id:'sane:canon',name:'CANON P-208II',driver:'sane'}]},wia:{listDevices:async()=>[]},scanService:{ensure:async()=>{throw Error('não deve iniciar');}},escl:{listDevices:async()=>({devices:[],forkError:'Serviço indisponível'})},scannerConfig:{loadScannerConfig:async()=>({manual:[]})},scannerConfigFile:()=>'',log:{error(){}}};
 vm.createContext(context);vm.runInContext(discovery,context);
 const result=await context.listScanners();assert.equal(result.devices[0].name,'CANON P-208II');assert.equal(result.forkError,null);
});
test('enumeração SANE preserva identificador USB e exclui câmeras',()=>{
 const {parseDevices}=require('../src/sane-scanner.cjs');
 const devices=parseDevices('canon_dr:libusb:001:005\tCANON\tP-208II\tscanner\nv4l:/dev/video0\tNoname\tCamera\tvirtual device\n');
 assert.equal(devices.length,1);assert.equal(devices[0].saneId,'canon_dr:libusb:001:005');
});
