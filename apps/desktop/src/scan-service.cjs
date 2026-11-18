const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');

function createScanService({app, userDataPath}) {
  let child = null;
  let starting = null;
  const url = 'http://127.0.0.1:5000/api/scanners';

  async function available() {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1000)});
      return response.ok;
    } catch { return false; }
  }

  async function ensure() {
    if (await available()) return;
    if (starting) return starting;
    starting = (async () => {
      const project = path.resolve(__dirname, '../../../packages/scan-share/NAPS2.WebScan.LocalService.csproj');
      const exe = path.join(process.resourcesPath, 'scan-share', 'NAPS2.WebScan.LocalService.exe');
      if (app.isPackaged && !fs.existsSync(exe)) throw Error('Componente de digitalização não encontrado. Reinstale o CotrimScan.');
      const command = app.isPackaged ? exe : 'dotnet';
      const args = app.isPackaged ? [] : ['run', '--project', project];
      child = spawn(command, args, {
        cwd: app.isPackaged ? path.dirname(exe) : path.dirname(project),
        windowsHide: true,
        env: {...process.env, ScanShare__PortsFile: path.join(userDataPath, 'scanner-ports.json')},
        stdio: 'ignore'
      });
      child.once('error', () => { child = null; });
      child.once('exit', () => { child = null; });
      for (let attempt = 0; attempt < 30; attempt++) {
        if (await available()) return;
        if (!child) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      throw Error('O componente de digitalização não iniciou. Verifique o driver TWAIN e os logs do aplicativo.');
    })();
    try { await starting; } finally { starting = null; }
  }

  function stop() { if (child) { child.kill(); child = null; } }
  return {ensure, stop};
}

module.exports = {createScanService};
