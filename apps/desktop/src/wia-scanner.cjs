const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const run = promisify(execFile);
const script = path.join(__dirname, 'wia-scanner.ps1');

async function scanTwain(device, options, dir, onPage, expectedPages) {
  const candidates = [
    path.join(process.resourcesPath || __dirname, 'naps2-cli', 'NAPS2.Console.exe'),
    path.resolve(__dirname, '../../../.local/naps2-cli/App/NAPS2.Console.exe'),
    path.join(process.env.ProgramFiles || '', 'NAPS2', 'NAPS2.Console.exe')
  ];
  const cli = candidates.find(file => require('node:fs').existsSync(file));
  if (!cli) throw Error('Instale o NAPS2 para digitalizar a amostra frente e verso.');
  const call = args => run(cli, args, {windowsHide:true, timeout:120000});
  const {stdout} = await call(['--listdevices','--driver','twain']);
  const model = name => name.toLowerCase().replace(/\s+#\d+$/, '').replace(/\s+(usb|twain)$/, '').trim();
  const matches = stdout.trim().split(/\r?\n/).filter(name => model(name) === model(device.name));
  if (matches.length !== 1) throw Error('Não foi possível identificar o driver TWAIN do scanner selecionado.');
  await call(['--noprofile','--driver','twain','--device',matches[0],'--source','duplex',
    '--dpi',String(options.dpi),'--bitdepth',({RGB24:'color',Grayscale8:'gray',BlackAndWhite1:'bw'})[options.colorMode],
    '-o',path.join(dir,'page-$(nnnn).jpg')]);
  const pages = (await fs.readdir(dir)).filter(name => /^page-\d+\.jpg$/i.test(name)).sort();
  if (!pages.length || (expectedPages !== 200 && pages.length !== expectedPages)) {
    throw Error('O scanner retornou '+pages.length+' imagens. Eram esperadas '+expectedPages+'.');
  }
  for (const page of pages) await onPage(await fs.readFile(path.join(dir,page)));
  return pages.length;
}

async function invoke(args, timeout = 30000) {
  try {
    const {stdout} = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {timeout, maxBuffer: 1024 * 1024, windowsHide: true});
    return stdout.trim();
  } catch (error) {
    throw Error(`Falha ao consultar scanner WIA: ${String(error.stderr || error.message).trim()}`);
  }
}

async function listDevices() {
  if (process.platform !== 'win32') return [];
  const result = await invoke(['-Action', 'list']);
  return (result ? [].concat(JSON.parse(result)) : []).map(item => ({id: `wia:${item.id}`, name: item.name, driver: 'wia', wiaId: item.id}));
}

async function scanDevice(device, options, onPage) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cotrimscan-wia-'));
  try {
    if (options.duplex || options.maxPages === 2) {
      return await scanTwain(device, options, dir, onPage, options.maxPages);
    }
    const count = Number(await invoke(['-Action', 'scan', '-DeviceId', device.wiaId, '-OutputDir', dir, '-Dpi', String(options.dpi), '-Source', options.source, '-ColorMode', options.colorMode, '-Duplex', String(options.duplex), '-MaxPages', String(options.maxPages)], 300000));
    if (!Number.isInteger(count) || count < 1 || count > options.maxPages) throw Error('O scanner WIA não retornou páginas válidas.');
    for (let index = 0; index < count; index++) await onPage(await fs.readFile(path.join(dir, `page-${index}.jpg`)));
    return count;
  } finally { await fs.rm(dir, {recursive: true, force: true}); }
}

module.exports = {listDevices, scanDevice};
