const fs = require('node:fs/promises');
const path = require('node:path');
const {randomBytes, scrypt: derive, timingSafeEqual} = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(derive);

function createAuth(file) {
 let account = null, authenticated = false, pending = false, failures = 0, retryAt = 0, initializationError = null;
 const ready = fs.readFile(file, 'utf8').then(text => {
  const data = JSON.parse(text);
  if(data.version !== 1 || typeof data.username !== 'string' || !/^[a-f0-9]{32}$/.test(data.salt) || !/^[a-f0-9]{128}$/.test(data.hash)) throw Error('Arquivo de conta local inválido.');
  account = data;
 }).catch(error => { if(error.code !== 'ENOENT') initializationError = error; });
 async function exclusive(fn) {
  await ready;
  if(initializationError) throw initializationError;
  if(pending) throw Error('Aguarde a autenticação em andamento.');
  pending = true;
  try { return await fn(); } finally { pending = false; }
 }
 return {
  async status() { await ready; if(initializationError) throw initializationError; return {hasAccount: !!account, authenticated, username: authenticated ? account.username : null}; },
  requireSession() { if(!authenticated) throw Error('Faça login para acessar o scanner.'); },
  register(username, password) { return exclusive(async () => {
   if(account) throw Error('Já existe uma conta neste computador. Faça login.');
   if(typeof username !== 'string' || !/^[\p{L}\p{N}_.-]{3,40}$/u.test(username.trim())) throw Error('Use de 3 a 40 letras, números, pontos, traços ou sublinhados no usuário.');
   if(typeof password !== 'string' || password.length < 8 || password.length > 256) throw Error('Use uma senha de 8 a 256 caracteres.');
   const salt = randomBytes(16).toString('hex');
   const hash = (await scrypt(password, salt, 64)).toString('hex');
   const data = {version: 1, username: username.trim(), salt, hash};
   await fs.mkdir(path.dirname(file), {recursive: true, mode: 0o700});
   await fs.writeFile(file, JSON.stringify(data), {flag: 'wx', mode: 0o600});
   account = data;
   authenticated = true;
   return {username: account.username};
  }); },
  login(username, password) { return exclusive(async () => {
   if(!account) throw Error('Crie a primeira conta para continuar.');
   if(Date.now() < retryAt) throw Error('Muitas tentativas. Aguarde 30 segundos antes de tentar novamente.');
   if(typeof username !== 'string' || typeof password !== 'string' || password.length > 256) throw Error('Usuário ou senha incorretos.');
   const hash = await scrypt(password, account.salt, 64);
   if(!timingSafeEqual(hash, Buffer.from(account.hash, 'hex')) || username.trim().toLowerCase() !== account.username.toLowerCase()) {
    failures++;
    if(failures >= 5) { retryAt = Date.now() + 30000; failures = 0; }
    throw Error('Usuário ou senha incorretos.');
   }
   failures = 0; retryAt = 0; authenticated = true;
   return {username: account.username};
  }); },
  logout() { if(pending) throw Error('Aguarde a autenticação em andamento.'); authenticated = false; }
 };
}
module.exports = {createAuth};
