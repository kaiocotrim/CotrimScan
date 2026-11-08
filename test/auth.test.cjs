const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createAuth}=require('../src/auth.cjs');
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'naps2-auth-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 return path.join(dir,'account.json');
}
test('cria conta com hash e exige novo login após reiniciar',async t=>{
 const file=await fixture(t),auth=createAuth(file);
 assert.deepEqual(await auth.status(),{hasAccount:false,authenticated:false,username:null});
 assert.throws(()=>auth.requireSession(),/Faça login/);
 await assert.rejects(auth.register('ab','12345678'),/usuário/);
 await assert.rejects(auth.register('kaio','curta'),/senha/);
 await auth.register('kaio','senha-segura-123');
 auth.requireSession();
 const stored=await fs.readFile(file,'utf8');
 assert.ok(!stored.includes('senha-segura-123'));
 assert.equal(JSON.parse(stored).hash.length,128);
 if(process.platform!=='win32') assert.equal((await fs.stat(file)).mode & 0o777,0o600);
 await assert.rejects(auth.register('outro','outra-senha'),/Já existe/);
 const restarted=createAuth(file);
 assert.equal((await restarted.status()).authenticated,false);
 await assert.rejects(restarted.login('kaio','errada'),/incorretos/);
 await assert.rejects(restarted.login('outro','senha-segura-123'),/incorretos/);
 assert.throws(()=>restarted.requireSession(),/Faça login/);
 await restarted.login('kaio','senha-segura-123');
 restarted.requireSession();
 restarted.logout();
 assert.throws(()=>restarted.requireSession(),/Faça login/);
});
test('limita tentativas de senha',async t=>{
 const auth=createAuth(await fixture(t));
 await auth.register('kaio','senha-segura');auth.logout();
 for(let i=0;i<5;i++) await assert.rejects(auth.login('kaio','errada'),/incorretos/);
 await assert.rejects(auth.login('kaio','senha-segura'),/30 segundos/);
 assert.throws(()=>auth.requireSession(),/Faça login/);
});
test('arquivo de conta corrompido não permite novo cadastro',async t=>{
 const file=await fixture(t);
 await fs.writeFile(file,'{}');
 const auth=createAuth(file);
 await assert.rejects(auth.status(),/inválido/);
 await assert.rejects(auth.register('kaio','senha-segura'),/inválido/);
 assert.throws(()=>auth.requireSession(),/Faça login/);
});

test('usuário ignora maiúsculas, mas a senha continua exata',async t=>{
 const file=await fixture(t),auth=createAuth(file);
 await auth.register('Kaio','Senha-Exata-123');
 auth.logout();
 const restarted=createAuth(file);
 await assert.rejects(restarted.login('kaio','senha-exata-123'),/incorretos/);
 assert.throws(()=>restarted.requireSession(),/Faça login/);
 assert.deepEqual(await restarted.login('  kAiO  ','Senha-Exata-123'),{username:'Kaio'});
 restarted.requireSession();
 assert.equal(JSON.parse(await fs.readFile(file,'utf8')).username,'Kaio');
});
