const path = require('node:path');
const {spawnSync} = require('node:child_process');

const project = path.resolve(__dirname, '../../../packages/scan-share/NAPS2.WebScan.LocalService.csproj');
const output = path.resolve(__dirname, '../scan-share-publish');
const result = spawnSync('dotnet', ['publish', project, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '-o', output], {stdio: 'inherit', shell: process.platform === 'win32'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
