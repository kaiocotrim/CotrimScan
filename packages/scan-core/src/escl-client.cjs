const scanner = require('./scanner.cjs');

const FORK_URL = 'http://127.0.0.1:5000';
const DRIVER_LOCAL = 'escl-local';
const DRIVER_MANUAL = 'escl-manual';

function deviceId(host, port) {
  return `escl:${host}:${port}`;
}

async function fetchJson(url, init = {}) {
  let response;
  try {
    response = await fetch(url, {...init, redirect: 'error', signal: AbortSignal.timeout(5000)});
  } catch {
    throw Error(`Serviço NAPS2 WebScan indisponível em ${new URL(url).origin}.`);
  }
  if (!response.ok) throw Error(`Serviço NAPS2 WebScan respondeu com erro ${response.status}.`);
  return response.json();
}

// Lists the TWAIN devices shared by the NAPS2 WebScan service plus manually added eSCL devices.
// Never throws for an offline service: the error is returned so manual devices stay usable.
async function listDevices({forkUrl = FORK_URL, manual = []} = {}) {
  let local = [];
  let forkError = null;
  try {
    const list = await fetchJson(`${forkUrl}/api/scanners`);
    local = list.map(item => ({id: deviceId('127.0.0.1', item.port), name: item.name, host: '127.0.0.1', port: item.port, driver: DRIVER_LOCAL}));
  } catch (error) {
    forkError = error.message;
  }
  const manualDevices = manual.map(item => ({id: deviceId(item.host, item.port), name: item.name, host: item.host, port: item.port, driver: DRIVER_MANUAL}));
  const seen = new Set();
  const devices = [...local, ...manualDevices].filter(device => {
    if (seen.has(device.id)) return false;
    seen.add(device.id);
    return true;
  });
  return {devices, forkError};
}

// Asks the NAPS2 WebScan service to enumerate TWAIN devices again. Interrupts scans in progress.
async function refreshDevices(forkUrl = FORK_URL) {
  return fetchJson(`${forkUrl}/api/scanners/refresh`, {method: 'POST'});
}

function scanDevice(device, options, onPage) {
  return scanner.scan(device.port, options.dpi, options.source, onPage, options.colorMode, options.duplex, options.maxPages, device.host);
}

function connectDevice(device) {
  return scanner.connect(device.port, device.host);
}

module.exports = {FORK_URL, DRIVER_LOCAL, DRIVER_MANUAL, deviceId, listDevices, refreshDevices, scanDevice, connectDevice};
