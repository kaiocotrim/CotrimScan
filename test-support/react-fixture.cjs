const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    module._compile(output, filename);
  };
}
function mount(t, node, setup) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLImageElement', 'SVGSVGElement', 'Image', 'MouseEvent', 'Event']) global[key] = window[key];
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.requestAnimationFrame = callback => callback();
  global.ResizeObserver = class { observe() {} disconnect() {} };
  setup?.(window);
  const React = require('react'), { createRoot } = require('react-dom/client');
  const root = createRoot(window.document.getElementById('root'));
  React.act(() => root.render(node));
  t.after(() => { React.act(() => root.unmount()); dom.window.close(); });
  return { window, document: window.document, React, act: React.act, root };
}
module.exports = { mount };
