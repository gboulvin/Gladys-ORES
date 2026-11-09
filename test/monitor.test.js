import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMonitor, diffIncidents, eventData, SCENE_TRIGGERS } from '../src/ores/monitor.js';
import { selectIncidents } from '../src/ores/incidents.js';
import { createJsonStore } from '../src/storage.js';
import { normalizeConfig } from '../src/config.js';
import { ADDRESS, NOW, outageAtAddress, plannedInCommune } from './fixtures.js';

const config = normalizeConfig(ADDRESS);
const at = (h) => new Date(NOW.getTime() + h * 3600 * 1000);
const select = (raw, now = NOW) => selectIncidents(raw, config, { now, horizonDays: 7 });

test('diffIncidents: start, delay, end and announcement', () => {
  const none = [];
  const started = select([outageAtAddress(), plannedInCommune()]);
  assert.deepEqual(
    diffIncidents(none, started).map((e) => e.key),
    [SCENE_TRIGGERS.OUTAGE_STARTED, SCENE_TRIGGERS.INTERRUPTION_SCHEDULED],
  );

  const delayed = select([outageAtAddress({ isDelayed: true }), plannedInCommune()]);
  assert.deepEqual(
    diffIncidents(started, delayed).map((e) => e.key),
    [SCENE_TRIGGERS.OUTAGE_DELAYED],
  );

  const resolved = select([outageAtAddress({ status: 'resolved' }), plannedInCommune()]);
  const ended = diffIncidents(delayed, resolved);
  assert.deepEqual(
    ended.map((e) => e.key),
    [SCENE_TRIGGERS.OUTAGE_ENDED],
  );
  assert.equal(ended[0].incident.reference, 'P091126001', 'the ended event keeps its details');

  // Planned works reaching their start: one "started", no new announcement.
  const running = select([plannedInCommune()], at(25));
  assert.deepEqual(
    diffIncidents(select([plannedInCommune()]), running).map((e) => e.key),
    [SCENE_TRIGGERS.OUTAGE_STARTED],
  );
});

test('eventData is flat and primitive', () => {
  const [incident] = select([outageAtAddress()]);
  const data = eventData(incident, SCENE_TRIGGERS.OUTAGE_STARTED);
  for (const value of Object.values(data)) {
    assert.ok(value === null || typeof value !== 'object');
  }
  assert.equal(data.scope, 'address');
  assert.equal(data.kind, 'outage');
  assert.equal(eventData(incident, SCENE_TRIGGERS.INTERRUPTION_SCHEDULED).kind, undefined);
});

test('the first read seeds the baseline without events', async () => {
  let raw = [outageAtAddress()];
  const monitor = createMonitor({ fetchIncidents: async () => raw, clock: () => NOW });
  const first = await monitor.refresh(config);
  assert.deepEqual(first.events, []);
  assert.equal(first.snapshot.summary.outage, true);

  raw = [];
  const second = await monitor.refresh(config);
  assert.deepEqual(
    second.events.map((e) => e.key),
    [SCENE_TRIGGERS.OUTAGE_ENDED],
  );
  assert.equal(second.snapshot.summary.outage, false);
});

test('an unreachable map keeps the last known incidents and fires nothing', async () => {
  let fail = false;
  const monitor = createMonitor({
    fetchIncidents: async () => {
      if (fail) throw new Error('boom');
      return [outageAtAddress()];
    },
    clock: () => NOW,
  });
  await monitor.refresh(config);
  fail = true;
  const { events, snapshot } = await monitor.refresh(config);
  assert.deepEqual(events, []);
  assert.equal(snapshot.error, 'boom');
  assert.equal(snapshot.summary.outage, true);
  fail = false;
  assert.deepEqual((await monitor.refresh(config)).events, [], 'no replay after the error');
});

test('an address change re-seeds the baseline', async () => {
  const monitor = createMonitor({
    fetchIncidents: async () => [outageAtAddress()],
    clock: () => NOW,
  });
  await monitor.refresh(normalizeConfig({ zip_code: '4000' }));
  const { events } = await monitor.refresh(config);
  assert.deepEqual(events, [], 'not "started": only the watched address changed');
});

test('no zip code: no read, an explicit error', async () => {
  let calls = 0;
  const monitor = createMonitor({
    fetchIncidents: async () => {
      calls += 1;
      return [];
    },
  });
  const { snapshot } = await monitor.refresh(normalizeConfig());
  assert.equal(snapshot.error, 'no_address');
  assert.equal(calls, 0);
});

test('the baseline survives a restart through the JSON store', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ores-'));
  try {
    const store = createJsonStore('state.json', dir);
    const before = createMonitor({
      fetchIncidents: async () => [outageAtAddress()],
      storage: store,
      clock: () => NOW,
    });
    await before.refresh(config);

    // "Restart": a new monitor, the outage resolved meanwhile.
    const after = createMonitor({
      fetchIncidents: async () => [],
      storage: store,
      clock: () => at(1),
    });
    const { events } = await after.refresh(config);
    assert.deepEqual(
      events.map((e) => e.key),
      [SCENE_TRIGGERS.OUTAGE_ENDED],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
