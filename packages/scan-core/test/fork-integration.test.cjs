const test = require('node:test');
const assert = require('node:assert/strict');
const escl = require('../src/escl-client.cjs');

const E2E = process.env.COTRIM_FORK_E2E === '1';

test('listDevices reports offline fork without throwing and keeps manual devices', async () => {
  const {devices, forkError} = await escl.listDevices({
    forkUrl: 'http://127.0.0.1:1',
    manual: [{name: 'Manual', host: '192.168.0.10', port: 9880}]
  });
  assert.ok(forkError);
  assert.deepEqual(devices.map(device => device.id), ['escl:192.168.0.10:9880']);
});

test('fork integration: lists TWAIN devices exposed by the NAPS2 WebScan service', {skip: !E2E && 'defina COTRIM_FORK_E2E=1 com o fork em execução'}, async () => {
  const {devices, forkError} = await escl.listDevices();
  assert.equal(forkError, null);
  assert.ok(Array.isArray(devices));
  for (const device of devices) {
    assert.match(device.id, /^escl:127\.0\.0\.1:\d+$/);
    assert.equal(device.driver, escl.DRIVER_LOCAL);
  }
});

test('fork integration: refresh endpoint responds', {skip: !E2E && 'defina COTRIM_FORK_E2E=1 com o fork em execução'}, async () => {
  const result = await escl.refreshDevices();
  assert.ok(result !== undefined);
});
