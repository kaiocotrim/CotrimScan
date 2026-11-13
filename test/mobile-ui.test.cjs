const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { mount } = require('../test-support/react-fixture.cjs');
const { MobileDialog } = require('../src/ui/MobileDialog.tsx');

test('diálogo React mantém QR ao receber atualizações da conexão', async t => {
  let notify;
  const state = { active: true, sessionId: 'sessao', url: 'http://localhost/#token=abc', qr: 'data:image/png;base64,YQ==', qrExpiresAt: Date.now() + 60000, pending: [] };
  const f = mount(t, React.createElement(MobileDialog, { project: { id: 'p1', name: 'Projeto' }, onClose() {} }), window => {
    window.mobile = {
      addresses: async () => [{ name: 'Rede local', address: '192.168.1.2' }],
      status: async () => state,
      onState: callback => { notify = callback; return () => {}; },
    };
  });
  await f.act(async () => { await Promise.resolve(); });
  assert.equal(f.document.querySelector('[aria-labelledby="mobile-title"] img').src, state.qr);
  f.act(() => notify({ ...state, qr: undefined, connected: { name: 'Celular' } }));
  assert.equal(f.document.querySelector('[aria-labelledby="mobile-title"] img').src, state.qr);
  assert.match(f.document.querySelector('[aria-labelledby="mobile-title"]').textContent, /Celular/);
});
