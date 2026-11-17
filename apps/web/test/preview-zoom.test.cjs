const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { mount } = require('../test-support/react-fixture.cjs');
const { PreviewZoom } = require('../src/ui/PreviewZoom.tsx');
function fixture(t) {
  global.ResizeObserver = class { observe() {} disconnect() {} };
  const f = mount(t, React.createElement(PreviewZoom, { page: { id: 0, url: 'data:image/jpeg;base64,YQ==' }, pageIndex: 0 }), window => {
    Object.defineProperties(window.HTMLElement.prototype, { clientWidth: { configurable: true, get() { return this.id === 'document-viewport' ? 600 : 0; } }, clientHeight: { configurable: true, get() { return this.id === 'document-viewport' ? 600 : 0; } } });
    Object.defineProperties(window.HTMLImageElement.prototype, { naturalWidth: { configurable: true, get: () => 1200 }, naturalHeight: { configurable: true, get: () => 1600 } });
  });
  const canvas = f.document.querySelector('#document-viewport'), image = f.document.querySelector('#document-preview');
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, right: 700, bottom: 650, width: 600, height: 600 });
  image.getBoundingClientRect = () => { const w = parseFloat(image.style.width), h = parseFloat(image.style.height), stage = image.parentElement; const left = 100 + (parseFloat(stage.style.width) - w) / 2 - canvas.scrollLeft, top = 50 + (parseFloat(stage.style.height) - h) / 2 - canvas.scrollTop; return { left, top, right: left + w, bottom: top + h, width: w, height: h }; };
  f.act(() => image.dispatchEvent(new f.window.Event('load', { bubbles: true })));
  return { ...f, canvas, image };
}
test('zoom React ajusta a folha e limita a ampliação', t => {
  const f = fixture(t), plus = f.document.querySelector('[aria-label="Aumentar zoom"]'), minus = f.document.querySelector('[aria-label="Diminuir zoom"]'), select = f.document.querySelector('[aria-label="Nível de zoom"]');
  assert.equal(Math.round(parseFloat(f.image.style.height)), 552);
  assert.equal(select.value, 'fit');
  f.act(() => plus.click()); assert.ok(parseFloat(f.image.style.height) > 552);
  for (let i = 0; i < 15; i++) f.act(() => plus.click());
  assert.equal(plus.disabled, true);
  f.act(() => minus.click()); assert.equal(plus.disabled, false);
  f.act(() => [...f.document.querySelectorAll('[aria-label="Zoom do documento"] button')].find(item => item.textContent === 'Ajustar à tela').click());
  assert.equal(select.value, 'fit');
});
test('lupa e atalhos operam na prévia React', t => {
  const f = fixture(t), loupe = [...f.document.querySelectorAll('[aria-label="Zoom do documento"] button')].find(item => item.textContent.includes('Lupa'));
  f.act(() => loupe.click()); assert.equal(loupe.getAttribute('aria-pressed'), 'true');
  f.act(() => f.canvas.dispatchEvent(new f.window.MouseEvent('pointermove', { bubbles: true, clientX: 400, clientY: 350 })));
  assert.ok(f.document.querySelector('[aria-label="Detalhe ampliado do documento"]'));
  f.act(() => loupe.click()); assert.equal(f.document.querySelector('[aria-label="Detalhe ampliado do documento"]'), null);
  f.act(() => f.canvas.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: '+', bubbles: true })));
  assert.notEqual(f.document.querySelector('[aria-label="Nível de zoom"]').value, 'fit');
  f.act(() => f.canvas.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: '0', bubbles: true })));
  assert.equal(f.document.querySelector('[aria-label="Nível de zoom"]').value, 'fit');
});
