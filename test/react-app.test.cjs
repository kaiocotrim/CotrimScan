const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { mount } = require('../test-support/react-fixture.cjs');
const { App } = require('../src/ui/App.tsx');

function input(f, selector, value) {
  const element = f.document.querySelector(selector);
  assert.ok(element, selector);
  Object.getOwnPropertyDescriptor(f.window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new f.window.Event('input', { bubbles: true }));
}
async function click(f, text) {
  const button = [...f.document.querySelectorAll('button')].find(item => item.textContent.includes(text));
  assert.ok(button, text);
  await f.act(async () => { button.click(); await Promise.resolve(); });
}
test('React percorre cadastro, projeto, scanner, OCR, exportação e logout por IPC', async t => {
  let onPage, created = null, exported = false, loggedOut = false, scanned = false;
  const project = { id: 'p1', name: 'Contrato', pageCount: 0, port: 9880, dpi: 300, source: 'Feeder', colorMode: 'RGB24', processingMode: 'auto', outputs: ['C:/saida'], signature: { type: 'none' } };
  const mock = {
    localAuth: {
      status: async () => ({ authenticated: false, hasAccount: false, username: '' }),
      register: async (username, password) => { assert.equal(username, 'operador'); assert.equal(password, 'segredo123'); return { authenticated: true, hasAccount: true, username }; },
      login: async () => { throw Error('Não esperado'); },
      logout: async () => { loggedOut = true; },
    },
    projects: {
      list: async () => created ? [created] : [],
      create: async input => { created = { ...project, ...input }; return created; },
      open: async () => ({ project: created, pages: [] }),
      close: async () => {},
      export: async () => { exported = true; return { pages: 1, outputs: 1, warnings: [] }; },
    },
    scanner: {
      onPage: callback => { onPage = callback; },
      scan: async () => { scanned = true; onPage({ id: 0, url: 'data:image/jpeg;base64,YQ==', projectId: project.id }); return { pages: 1, warnings: [] }; },
      ocr: async id => ({ id, url: 'data:image/jpeg;base64,YQ==', hasOcr: true }),
      readOcr: async () => ({ text: 'Contrato 123', confidence: 92, edited: false, revision: 'r1' }),
    },
    certificates: { status: async () => ({ type: 'none', ready: true }) },
    mobile: { onState: () => {}, onReceived: () => {} },
  };
  const f = mount(t, React.createElement(App), window => Object.assign(window, mock));
  await f.act(async () => { await Promise.resolve(); });
  f.act(() => { input(f, 'input[autocomplete="username"]', 'operador'); input(f, 'input[autocomplete="new-password"]', 'segredo123'); input(f, 'input[placeholder="Confirme sua senha"]', 'segredo123'); });
  await f.act(async () => { f.document.querySelector('#auth-view form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
  assert.ok(f.document.querySelector('#projects-view'));
  await click(f, 'Novo projeto');
  f.act(() => input(f, 'input[placeholder^="Ex.: Contratos"]', 'Contrato'));
  await click(f, 'Saídas');
  await click(f, 'Digitar um caminho');
  f.act(() => input(f, '#project-editor input[required]', 'C:/saida'));
  await f.act(async () => { f.document.querySelector('#project-editor form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
  assert.equal(created.name, 'Contrato');
  const folder = f.document.querySelector('[aria-label^="Abrir projeto"]');
  await f.act(async () => { folder.dispatchEvent(new f.window.MouseEvent('dblclick', { bubbles: true })); await Promise.resolve(); });
  assert.ok(f.document.querySelector('#scanner-view'));
  await click(f, 'Digitalizar');
  assert.equal(scanned, true);
  assert.equal(f.document.querySelectorAll('#pages article').length, 1);
  await click(f, 'Reconhecer texto');
  assert.equal(f.document.querySelector('#ocr-text').value, 'Contrato 123');
  await click(f, 'Enviar para saídas');
  assert.equal(exported, true);
  await click(f, 'Sair');
  assert.equal(loggedOut, true);
  assert.ok(f.document.querySelector('#auth-view'));
});
test('React autentica uma conta existente e exibe erro de senha', async t => {
  let attempts = 0;
  const f = mount(t, React.createElement(App), window => {
    window.localAuth = {
      status: async () => ({ authenticated: false, hasAccount: true, username: '' }),
      login: async (username, password) => { attempts++; if (password !== 'correta') throw new Error('Senha inválida.'); return { authenticated: true, hasAccount: true, username }; },
      register: async () => { throw Error('Não esperado'); },
      logout: async () => {},
    };
    window.projects = { list: async () => [] };
    window.scanner = { onPage: () => () => {} };
    window.mobile = { onReceived: () => () => {} };
  });
  await f.act(async () => { await Promise.resolve(); });
  f.act(() => { input(f, 'input[autocomplete="username"]', 'operador'); input(f, 'input[autocomplete="current-password"]', 'errada'); });
  await f.act(async () => { f.document.querySelector('#auth-view form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
  assert.match(f.document.querySelector('[role="status"]').textContent, /Senha inválida/);
  f.act(() => input(f, 'input[autocomplete="current-password"]', 'correta'));
  await f.act(async () => { f.document.querySelector('#auth-view form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
  assert.equal(attempts, 2);
  assert.ok(f.document.querySelector('#projects-view'));
});
