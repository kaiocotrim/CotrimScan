const fs = require('node:fs/promises');
const path = require('node:path');
const {deviceId} = require('@cotrimscan/scan-core/escl-client');

const MAX_MANUAL = 20;
const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;

function normalizeManual(item) {
  if (!item || typeof item !== 'object') return null;
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, 120) : '';
  const host = typeof item.host === 'string' ? item.host.trim() : '';
  const port = Number(item.port);
  if (!name || !HOST_PATTERN.test(host) || !Number.isInteger(port) || port < 1024 || port > 65535) return null;
  return {name, host, port};
}

function normalizeConfig(value) {
  const manual = Array.isArray(value?.manual) ? value.manual.map(normalizeManual).filter(Boolean).slice(0, MAX_MANUAL) : [];
  const selected = typeof value?.selected === 'string' ? value.selected : null;
  return {selected, manual};
}

async function loadScannerConfig(file) {
  try {
    return normalizeConfig(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch {
    return normalizeConfig({});
  }
}

// Writes to a temporary file first so a crash never leaves a truncated configuration.
async function saveScannerConfig(file, config) {
  const normalized = normalizeConfig(config);
  await fs.mkdir(path.dirname(file), {recursive: true});
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(normalized, null, 2));
  await fs.rename(temp, file);
  return normalized;
}

function addManual(config, input) {
  const entry = normalizeManual(input);
  if (!entry) throw Error('Informe um nome, um endereço válido e uma porta entre 1024 e 65535.');
  if (config.manual.length >= MAX_MANUAL) throw Error(`Limite de ${MAX_MANUAL} scanners manuais atingido.`);
  if (config.manual.some(item => deviceId(item.host, item.port) === deviceId(entry.host, entry.port))) throw Error('Este scanner já foi adicionado.');
  return {...config, manual: [...config.manual, entry]};
}

function removeManual(config, id) {
  const manual = config.manual.filter(item => deviceId(item.host, item.port) !== id);
  return {selected: config.selected === id ? null : config.selected, manual};
}

function selectDevice(config, devices, id) {
  if (id !== null && !devices.some(device => device.id === id)) throw Error('Scanner não encontrado. Atualize a lista de scanners.');
  return {...config, selected: id};
}

// Resolves the chosen device or throws a user-facing message.
function resolveSelected(config, devices) {
  if (!config.selected) throw Error('Selecione um scanner antes de digitalizar.');
  const device = devices.find(item => item.id === config.selected);
  if (!device) throw Error('O scanner selecionado não está disponível. Verifique a conexão e atualize a lista.');
  return device;
}

module.exports = {MAX_MANUAL, normalizeConfig, loadScannerConfig, saveScannerConfig, addManual, removeManual, selectDevice, resolveSelected};
