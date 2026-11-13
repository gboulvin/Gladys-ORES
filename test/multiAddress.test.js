// Home (Gladys house, geocoded) + second address, end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createOresService } from '../src/service.js';
import { normalizeConfig } from '../src/config.js';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { networkStatus, FEATURE } from '../src/devices/networkStatus.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { NETWORK_STATUS_WIDGET, WIDGETS } from '../src/widgets.js';
import { ACTIONS } from '../src/actions.js';
import { NOW, elsewhere, outageAtAddress, plannedInCommune } from './fixtures.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const HOUSES = [{ id: 'h', name: 'Maison', selector: 'maison', latitude: 50.46, longitude: 4.86 }];
// The house geocodes to the address of the fixtures' outage.
const HOME = { zip_code: '5000', city: '', street: "Rue de l'Église", house_number: '12' };
// The second address is in Liège, where the `elsewhere()` outage is.
const CONFIG = normalizeConfig({ second_name: 'Parents', second_zip_code: '4000' });

function setup({ houses = HOUSES, config = CONFIG } = {}) {
  const gladys = createFakeGladys({ houses });
  const state = { raw: [outageAtAddress(), plannedInCommune()], now: NOW, geocodes: 0 };
  const service = createOresService({
    gladys,
    getConfig: () => config,
    fetchBreakdowns: async () => state.raw,
    reverseGeocode: async () => {
      state.geocodes += 1;
      return HOME;
    },
    clock: () => state.now,
  });
  const later = () => {
    state.now = new Date(state.now.getTime() + 2 * 60 * 1000);
  };
  return { gladys, service, state, later };
}

test('a second address adds a second device, with its own external id', async () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(gladys, CONFIG);
  assert.equal(devices.length, 2);
  assert.equal(devices[1].name, 'ORES network status (Parents)');
  assert.notEqual(devices[0].external_id, devices[1].external_id);
  assert.equal(
    devices[0].external_id,
    gladys.externalIds('network-status', 'address').device,
    'the home device keeps the 0.1 external id',
  );
  await gladys.publishDiscoveredDevices(devices);
  assert.equal(buildDiscoveredDevices(gladys, normalizeConfig()).length, 1);
});

test('the home follows the Gladys house, the second address its own fields', async () => {
  const { gladys, service, state } = setup();
  state.raw = [outageAtAddress(), elsewhere()];
  await service.refresh();
  const value = (feature, slot) =>
    gladys.fake.lastState(networkStatus.featureExternalId(gladys, feature, slot));
  assert.equal(value(FEATURE.OUTAGE, 'primary'), 1, 'outage at the geocoded home');
  assert.equal(value(FEATURE.OUTAGE, 'secondary'), 1, 'whole Liège municipality');
  assert.equal(state.geocodes, 1);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(service.getAddress('primary').address, HOME);
});

test('scene events carry the address slot, a declared filter', async () => {
  const { gladys, service, state, later } = setup();
  state.raw = [outageAtAddress(), elsewhere()];
  await service.refresh();
  later();
  state.raw = [];
  await service.refresh();
  const events = gladys.fake.sceneEvents;
  assert.deepEqual(events.map((e) => [e.key, e.data.address]).sort(), [
    ['outage_ended', 'primary'],
    ['outage_ended', 'secondary'],
  ]);
  for (const { key, data } of events) {
    const trigger = manifest.scene_triggers.find((t) => t.key === key);
    const declared = [...trigger.fields, ...trigger.variables].map((f) => f.key);
    for (const name of Object.keys(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
    }
    const options = trigger.fields.find((f) => f.key === 'address').options.map((o) => o.value);
    assert.ok(options.includes(data.address));
  }
});

test('no located Gladys house: the connection status says so', async () => {
  const { gladys, service } = setup({ houses: [], config: normalizeConfig() });
  await service.refresh();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /maison Gladys/);
});

test('get_network_status targets the chosen address', async () => {
  const { gladys, service, state } = setup();
  state.raw = [elsewhere()];
  await service.refresh();
  const home = await SCENE_ACTIONS.get_network_status(gladys, { fields: {}, service });
  const second = await SCENE_ACTIONS.get_network_status(gladys, {
    fields: { address: 'secondary' },
    service,
  });
  assert.equal(home.outage, false);
  assert.equal(second.outage, true);
});

test('the widget shows the address of its settings', async () => {
  const { gladys, service } = setup();
  await service.refresh();
  const widget = WIDGETS[NETWORK_STATUS_WIDGET];
  for (const address of ['primary', 'secondary']) {
    const content = await widget.get(gladys, {
      settings: { address },
      language: 'fr',
      units: 'metric',
      config: CONFIG,
      service,
    });
    assert.deepEqual(validateWidgetContent(content), []);
    const tile = content.components.find((c) => c.device_feature);
    assert.equal(
      tile.device_feature,
      networkStatus.featureExternalId(gladys, FEATURE.OUTAGE, address),
    );
    const status = content.components.find((c) => c.type === 'status');
    assert.equal(status.items[0].label, address === 'primary' ? 'Domicile' : 'Parents');
  }
});

test('the test action lists both addresses', async () => {
  const { gladys, service } = setup();
  const message = await ACTIONS.test_connection(gladys, { service, config: CONFIG });
  assert.match(message.fr, /Domicile \(5000 Rue de l'Église 12\)/);
  assert.match(message.fr, /Parents \(4000\)/);
  for (const text of Object.values(message)) {
    assert.ok(!text.includes('{'), 'every placeholder is filled');
  }
});
