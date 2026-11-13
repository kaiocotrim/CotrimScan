const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { mount } = require('../test-support/react-fixture.cjs');
const { CertificateDialogs, useCertificate } = require('../src/ui/CertificateDialogs.tsx');

test('diálogo React libera certificado A1 para a sessão', async t => {
  let password, completed = false;
  function Trigger() { const certificate = useCertificate(); return React.createElement('button', { onClick: () => { void certificate.ensure().then(() => { completed = true; }); } }, 'Assinar'); }
  const f = mount(t, React.createElement(CertificateDialogs, null, React.createElement(Trigger)), window => {
    window.certificates = { status: async () => ({ ready: false, type: 'a1' }), prepare: async value => { password = value; } };
  });
  await f.act(async () => { f.document.querySelector('button').click(); await Promise.resolve(); });
  const input = f.document.querySelector('.certificate-dialog input');
  assert.ok(input);
  f.act(() => { Object.getOwnPropertyDescriptor(f.window.HTMLInputElement.prototype, 'value').set.call(input, 'segredo'); input.dispatchEvent(new f.window.Event('input', { bubbles: true })); });
  await f.act(async () => { f.document.querySelector('.certificate-dialog form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
  assert.equal(password, 'segredo');
  assert.equal(completed, true);
  assert.equal(f.document.querySelector('.certificate-dialog'), null);
});
