import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { NETWORK_STATUS_WIDGET, WIDGETS, refreshWidgets } from '../src/widgets.js';
import { createOresService } from '../src/service.js';
import { normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { ADDRESS, NOW, outageAtAddress, plannedInCommune } from './fixtures.js';

const widget = WIDGETS[NETWORK_STATUS_WIDGET];

function setup({
  raw = [outageAtAddress(), plannedInCommune()],
  config = ADDRESS,
  fail = false,
} = {}) {
  const gladys = createFakeGladys();
  const cfg = normalizeConfig(config);
  const service = createOresService({
    gladys,
    getConfig: () => cfg,
    fetchBreakdowns: async () => {
      if (fail) throw new Error('unreachable');
      return raw;
    },
    clock: () => NOW,
  });
  const get = (language = 'en') =>
    widget.get(gladys, { settings: {}, language, units: 'metric', config: cfg, service });
  return { gladys, service, get, config: cfg };
}

test('the content is rendered exactly as sent, in every language', async () => {
  const { service, get } = setup();
  await service.refresh();
  for (const language of LANGUAGES) {
    assert.deepEqual(validateWidgetContent(await get(language)), [], language);
  }
});

test('empty, unconfigured and unreachable states are valid too', async () => {
  for (const options of [{ raw: [] }, { config: {} }, { fail: true }]) {
    const { service, get } = setup(options);
    await service.refresh();
    assert.deepEqual(validateWidgetContent(await get('fr')), []);
  }
});

test('the outage at my address shows in danger', async () => {
  const { service, get } = setup();
  await service.refresh();
  const content = await get('fr');
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items[0].color, 'danger');
  assert.equal(status.items[0].value, 'Panne en cours');
  const cards = content.components.find((c) => c.type === 'card-list');
  assert.equal(cards.items.length, 2);
});

test('the live tiles reference published features', async () => {
  const { gladys, get, config } = setup();
  const featureIds = new Set(
    buildDiscoveredDevices(gladys, config).flatMap((d) => d.features.map((f) => f.external_id)),
  );
  const tiles = (await get()).components.filter((c) => c.device_feature);
  assert.ok(tiles.length > 0);
  for (const tile of tiles) {
    assert.ok(featureIds.has(tile.device_feature), tile.device_feature);
  }
});

test('the refresh button is handled and answers a short toast', async () => {
  const { gladys, service, get } = setup();
  const buttons = (await get()).components.filter((c) => c.type === 'button' && c.action);
  for (const { action } of buttons) {
    const toast = await widget.action(gladys, {
      actionKey: action.key,
      params: action.params ?? {},
      settings: {},
      service,
    });
    for (const language of LANGUAGES) {
      assert.ok(toast[language].length <= 200);
    }
  }
});

test('an unknown widget action fails', async () => {
  const { gladys, service } = setup();
  await assert.rejects(
    widget.action(gladys, { actionKey: 'nope', params: {}, settings: {}, service }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
