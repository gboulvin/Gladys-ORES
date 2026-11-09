import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createOresService } from '../src/service.js';
import { normalizeConfig } from '../src/config.js';
import { networkStatus, FEATURE } from '../src/devices/networkStatus.js';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { ACTIONS } from '../src/actions.js';
import { ADDRESS, NOW, outageAtAddress, plannedInCommune } from './fixtures.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

function setup({ raw = [outageAtAddress(), plannedInCommune()], config = ADDRESS } = {}) {
  const gladys = createFakeGladys();
  const state = { raw, fail: false, calls: 0, now: NOW };
  const service = createOresService({
    gladys,
    getConfig: () => normalizeConfig(config),
    fetchBreakdowns: async () => {
      state.calls += 1;
      if (state.fail) throw new Error('unreachable');
      return state.raw;
    },
    clock: () => state.now,
  });
  return { gladys, service, state };
}

const later = (state, minutes) => {
  state.now = new Date(state.now.getTime() + minutes * 60 * 1000);
};

test('the discovered device passes the checks of Gladys', async () => {
  const gladys = createFakeGladys();
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, normalizeConfig()));
  assert.equal(gladys.fake.discoveredDevices.length, 1);
});

test('refresh publishes the states and reports the connection', async () => {
  const { gladys, service } = setup();
  await service.refresh();
  const value = (feature) =>
    gladys.fake.lastState(networkStatus.featureExternalId(gladys, feature));
  assert.equal(value(FEATURE.OUTAGE), 1);
  assert.equal(value(FEATURE.PLANNED_IN_PROGRESS), 0);
  assert.equal(value(FEATURE.UPCOMING), 0, 'the planned works are elsewhere in the municipality');
  assert.equal(value(FEATURE.COMMUNE_INCIDENT), 1);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('transitions become scene events with declared keys only', async () => {
  const { gladys, service, state } = setup();
  await service.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the seed read fires nothing');

  later(state, 2);
  state.raw = [plannedInCommune(), plannedInCommune({ id: 'dddd-4', businessId: 'C4' })];
  await service.refresh();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((e) => e.key),
    ['interruption_scheduled', 'outage_ended'],
  );

  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = manifest.scene_triggers.find((t) => t.key === key);
    const declared = [...trigger.fields, ...trigger.variables].map((f) => f.key);
    for (const name of Object.keys(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
    }
  }
});

test('an unreachable map flags the connection without clearing the states', async () => {
  const { gladys, service, state } = setup();
  await service.refresh();
  later(state, 2);
  state.fail = true;
  await service.refresh();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.equal(
    gladys.fake.lastState(networkStatus.featureExternalId(gladys, FEATURE.OUTAGE)),
    1,
    'the last known outage stays',
  );
});

test('no zip code: the connection status asks for it', async () => {
  const { gladys, service, state } = setup({ config: {} });
  await service.refresh();
  assert.equal(state.calls, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /code postal/);
});

test('the raw map is cached one minute', async () => {
  const { service, state } = setup();
  await service.refresh();
  await service.checkAddress({ zip_code: '5000' });
  assert.equal(state.calls, 1);
  later(state, 2);
  await service.checkAddress({ zip_code: '5000' });
  assert.equal(state.calls, 2);
});

test('the test action answers in the four languages', async () => {
  const { gladys, service } = setup();
  const message = await ACTIONS.test_connection(gladys, { service });
  assert.deepEqual(Object.keys(message).sort(), ['de', 'en', 'es', 'fr']);
  assert.match(message.en, /2 incidents on the network, 1 in your municipality/);
});

test('the test action reports an unreachable map', async () => {
  const { gladys, service, state } = setup();
  state.fail = true;
  const message = await ACTIONS.test_connection(gladys, { service });
  assert.match(message.fr, /injoignable/);
});
