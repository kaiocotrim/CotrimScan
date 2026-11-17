const fs = require('node:fs');
const path = require('node:path');

// Copia o build da interface web (apps/web/dist) para apps/desktop/renderer,
// que é carregado pelo processo principal do Electron e empacotado.
const source = path.resolve(__dirname, '..', '..', 'web', 'dist');
const target = path.resolve(__dirname, '..', 'renderer');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  console.error(`Build da interface não encontrado em ${source}. Execute o build do @cotrimscan/web antes.`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Interface copiada para ${target}`);
