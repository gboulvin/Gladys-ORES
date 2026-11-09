import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIncident,
  houseNumberInRanges,
  matchAddress,
  normalizeName,
  parseHouseNumber,
  parseOresDate,
  selectIncidents,
} from '../src/ores/incidents.js';
import { ADDRESS, NOW, elsewhere, outageAtAddress, plannedInCommune } from './fixtures.js';

test('parseOresDate reads dates with and without offset as UTC', () => {
  assert.equal(
    parseOresDate('2026-02-04T11:02:28.4609174').toISOString(),
    '2026-02-04T11:02:28.460Z',
  );
  assert.equal(
    parseOresDate('2026-04-03T10:00:00+00:00').toISOString(),
    '2026-04-03T10:00:00.000Z',
  );
  assert.equal(parseOresDate(null), null);
  assert.equal(parseOresDate('not a date'), null);
});

test('names are compared without accents, case nor punctuation', () => {
  assert.equal(normalizeName("Rue de l'Église"), 'RUE DE L EGLISE');
  assert.equal(normalizeName('  chemin d’Harnoy '), 'CHEMIN D HARNOY');
});

test('house numbers follow the odd/even ranges of ORES', () => {
  assert.equal(parseHouseNumber('12/A'), 12);
  assert.equal(parseHouseNumber('B3'), null);
  const ranges = [
    { from: '2', to: '20/A', rangeType: 'even' },
    { from: '1', to: '5', rangeType: 'odd' },
  ];
  assert.equal(houseNumberInRanges('12', ranges), true);
  assert.equal(houseNumberInRanges('12/B', ranges), true);
  assert.equal(houseNumberInRanges('3', ranges), true);
  assert.equal(houseNumberInRanges('7', ranges), false, 'odd, beyond the odd range');
  assert.equal(houseNumberInRanges('22', ranges), false);
  assert.equal(houseNumberInRanges('', ranges), false);
});

test('matchAddress tells the municipality from the address', () => {
  assert.deepEqual(matchAddress(outageAtAddress(), ADDRESS), {
    commune: true,
    address: true,
    cities: ['NAMUR'],
  });
  const commune = matchAddress(plannedInCommune(), ADDRESS);
  assert.equal(commune.commune, true);
  assert.equal(commune.address, false);
  assert.equal(matchAddress(elsewhere(), ADDRESS).commune, false);
});

test('without a street, the whole municipality is the address', () => {
  const match = matchAddress(plannedInCommune(), { zip_code: '5000' });
  assert.equal(match.address, true);
});

test('the locality narrows a zip code shared by several localities', () => {
  assert.equal(matchAddress(outageAtAddress(), { zip_code: '5000', city: 'Namur' }).commune, true);
  assert.equal(
    matchAddress(outageAtAddress(), { zip_code: '5000', city: 'Jambes' }).commune,
    false,
  );
});

test('a wrong house number keeps the incident at the municipality level', () => {
  const match = matchAddress(outageAtAddress(), { ...ADDRESS, house_number: '7' });
  assert.equal(match.commune, true);
  assert.equal(match.address, false);
});

test('classifyIncident: outage in progress, planned works upcoming', () => {
  const outage = classifyIncident(outageAtAddress(), NOW);
  assert.equal(outage.kind, 'outage');
  assert.equal(outage.phase, 'in_progress');
  assert.equal(outage.customers, 42);
  assert.equal(outage.reference, 'P091126001');

  const planned = classifyIncident(plannedInCommune(), NOW);
  assert.equal(planned.kind, 'planned');
  assert.equal(planned.phase, 'upcoming');
});

test('planned works run between their planned bounds', () => {
  const inside = new Date(NOW.getTime() + 25 * 3600 * 1000);
  assert.equal(classifyIncident(plannedInCommune(), inside).phase, 'in_progress');
});

test('resolved, cancelled and stale incidents are ended', () => {
  assert.equal(classifyIncident(outageAtAddress({ status: 'resolved' }), NOW).phase, 'ended');
  assert.equal(classifyIncident(plannedInCommune({ status: 'cancelled' }), NOW).phase, 'ended');
  // Planned works long past their end, still "active" on the map.
  const later = new Date(NOW.getTime() + 30 * 24 * 3600 * 1000);
  assert.equal(classifyIncident(plannedInCommune(), later).phase, 'ended');
});

test('a delayed incident past its end stays in progress while ORES updates it', () => {
  const justAfter = new Date(NOW.getTime() + 29 * 3600 * 1000);
  const delayed = plannedInCommune({
    isDelayed: true,
    lastUpdatedDateTime: new Date(justAfter.getTime() - 3600 * 1000).toISOString(),
  });
  assert.equal(classifyIncident(delayed, justAfter).phase, 'in_progress');
  assert.equal(classifyIncident(plannedInCommune(), justAfter).phase, 'ended');
});

test('selectIncidents keeps the municipality, sorted, within the horizon', () => {
  const raw = [plannedInCommune(), elsewhere(), outageAtAddress(), { garbage: true }, null];
  const selected = selectIncidents(raw, ADDRESS, { now: NOW, horizonDays: 7 });
  assert.deepEqual(
    selected.map((i) => [i.id, i.scope]),
    [
      ['aaaa-1', 'address'],
      ['bbbb-2', 'commune'],
    ],
  );
  assert.equal(selectIncidents(raw, ADDRESS, { now: NOW, horizonDays: 0.5 }).length, 1);
});
