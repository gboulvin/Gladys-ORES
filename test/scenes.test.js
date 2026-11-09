import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { createOresService } from '../src/service.js';
import { normalizeConfig } from '../src/config.js';
import { ADDRESS, NOW, outageAtAddress, plannedInCommune } from './fixtures.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const outputsOf = (key) =>
  manifest.scene_actions.find((action) => action.key === key).outputs.map((o) => o.key);

function setup() {
  const gladys = createFakeGladys();
  const service = createOresService({
    gladys,
    getConfig: () => normalizeConfig(ADDRESS),
    fetchBreakdowns: async () => [outageAtAddress(), plannedInCommune()],
    clock: () => NOW,
  });
  return { gladys, service };
}

function assertDeclaredScalars(key, outputs) {
  const declared = outputsOf(key);
  assert.deepEqual(Object.keys(outputs).sort(), [...declared].sort());
  for (const value of Object.values(outputs)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value));
  }
}

test('check_address reads any address, without event nor state', async () => {
  const { gladys, service } = setup();
  const outputs = await SCENE_ACTIONS.check_address(gladys, {
    fields: { zip_code: '5000', street: 'Avenue de la Gare', house_number: '3' },
    service,
  });
  assertDeclaredScalars('check_address', outputs);
  assert.equal(outputs.outage, false);
  assert.equal(outputs.upcoming_interruption, true);
  assert.equal(outputs.reference, 'C101126002');
  assert.match(outputs.next_start_time, /^2026-11-10T12:00:00/);
  assert.equal(gladys.fake.sceneEvents.length, 0);
  assert.equal(gladys.fake.states.length, 0);
});

test('get_network_status serves the last snapshot', async () => {
  const { gladys, service } = setup();
  await service.refresh();
  const outputs = await SCENE_ACTIONS.get_network_status(gladys, { fields: {}, service });
  assertDeclaredScalars('get_network_status', outputs);
  assert.equal(outputs.outage, true);
  assert.equal(outputs.commune_incidents, 1);
  assert.equal(outputs.reference, 'P091126001');
});

test('get_network_status before any read reports no incident', async () => {
  const { gladys, service } = setup();
  const outputs = await SCENE_ACTIONS.get_network_status(gladys, { fields: {}, service });
  assert.equal(outputs.outage, false);
  assert.equal(outputs.end_time, '');
});
