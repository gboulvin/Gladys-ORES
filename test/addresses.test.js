import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createAddressResolver, manualAddress, pickHouse, SLOTS } from '../src/addresses.js';
import { reverseGeocode, toOresAddress, NOMINATIM_REVERSE_URL } from '../src/geo/geocoder.js';
import { normalizeConfig } from '../src/config.js';
import { fakeFetch } from './fixtures.js';

const HOUSES = [
  { id: 'h1', name: 'Chalet', selector: 'chalet', latitude: null, longitude: null },
  { id: 'h2', name: 'Maison', selector: 'maison', latitude: 50.4669, longitude: 4.8675 },
  { id: 'h3', name: 'Ardennes', selector: 'ardennes', latitude: 50.1, longitude: 5.6 },
];

const NOMINATIM = {
  address: {
    house_number: '12',
    road: "Rue de l'Église",
    town: 'Namur',
    postcode: '5000',
    country_code: 'be',
  },
};

test('pickHouse: by name, else the first located house', () => {
  assert.equal(pickHouse(HOUSES, '').name, 'Maison');
  assert.equal(pickHouse(HOUSES, ' ardennes ').name, 'Ardennes');
  assert.equal(pickHouse(HOUSES, 'Chalet'), null, 'an unlocated house cannot be watched');
  assert.equal(pickHouse([], ''), null);
});

test('manualAddress reads the fields of a slot', () => {
  const config = normalizeConfig({
    zip_code: '5000',
    second_zip_code: '6700',
    second_street: 'Grand-Rue',
  });
  assert.equal(manualAddress(config, SLOTS.PRIMARY).zip_code, '5000');
  assert.deepEqual(manualAddress(config, SLOTS.SECONDARY), {
    zip_code: '6700',
    city: '',
    street: 'Grand-Rue',
    house_number: '',
  });
  assert.equal(manualAddress(normalizeConfig(), SLOTS.SECONDARY), null);
});

test('toOresAddress keeps the zip code, street and first house number', () => {
  assert.deepEqual(toOresAddress({ postcode: '5000', road: 'Rue de Fer', house_number: '3;5' }), {
    zip_code: '5000',
    city: '',
    street: 'Rue de Fer',
    house_number: '3',
  });
  assert.equal(toOresAddress({ road: 'Rue de Fer' }), null);
});

test('reverseGeocode calls Nominatim with an identifying User-Agent', async () => {
  let call;
  const fetchImpl = async (url, options) => {
    call = { url, options };
    return fakeFetch(NOMINATIM)();
  };
  const address = await reverseGeocode({ latitude: 50.4669, longitude: 4.8675 }, { fetchImpl });
  assert.equal(address.zip_code, '5000');
  assert.ok(call.url.startsWith(NOMINATIM_REVERSE_URL));
  assert.match(call.url, /lat=50.4669&lon=4.8675/);
  assert.match(call.options.headers['User-Agent'], /gladys-ores/);
});

test('reverseGeocode refuses a house outside Belgium or without address', async () => {
  await assert.rejects(
    reverseGeocode(
      { latitude: 48.85, longitude: 2.35 },
      { fetchImpl: fakeFetch({ address: { postcode: '75001', country_code: 'fr' } }) },
    ),
    /not located in Belgium/,
  );
  await assert.rejects(
    reverseGeocode({ latitude: 0, longitude: 0 }, { fetchImpl: fakeFetch({ error: 'none' }) }),
    /No postal address/,
  );
});

function resolverWith({ houses = HOUSES, geocode, storage } = {}) {
  const gladys = createFakeGladys({ houses });
  const calls = [];
  let now = new Date('2026-11-13T12:00:00Z');
  const resolver = createAddressResolver({
    gladys,
    storage,
    clock: () => now,
    reverseGeocode: async (point) => {
      calls.push(point);
      if (geocode) return geocode(point);
      return toOresAddress(NOMINATIM.address);
    },
  });
  return { resolver, calls, advance: (ms) => (now = new Date(now.getTime() + ms)) };
}

test('the home is the geocoded Gladys house, geocoded once', async () => {
  const { resolver, calls } = resolverWith();
  const config = normalizeConfig();
  assert.equal(config.address_source, 'house');
  const first = await resolver.resolve(config, SLOTS.PRIMARY);
  assert.deepEqual(first, {
    address: { zip_code: '5000', city: '', street: "Rue de l'Église", house_number: '12' },
    error: null,
  });
  await resolver.resolve(config, SLOTS.PRIMARY);
  assert.equal(calls.length, 1, 'cached');
  assert.deepEqual(calls[0], { latitude: 50.4669, longitude: 4.8675 });
});

test('the geocoding cache survives a restart', async () => {
  let saved = null;
  const storage = { load: async () => saved, save: async (data) => (saved = data) };
  await resolverWith({ storage }).resolver.resolve(normalizeConfig(), SLOTS.PRIMARY);
  const again = resolverWith({ storage });
  await again.resolver.resolve(normalizeConfig(), SLOTS.PRIMARY);
  assert.equal(again.calls.length, 0);
});

test('a failed geocoding is retried after an hour only', async () => {
  const { resolver, calls, advance } = resolverWith({
    geocode: () => {
      throw new Error('down');
    },
  });
  const config = normalizeConfig();
  assert.equal((await resolver.resolve(config, SLOTS.PRIMARY)).error, 'geocoding');
  await resolver.resolve(config, SLOTS.PRIMARY);
  assert.equal(calls.length, 1);
  advance(61 * 60 * 1000);
  await resolver.resolve(config, SLOTS.PRIMARY);
  assert.equal(calls.length, 2);
});

test('no located house, or the typed address, or the second address', async () => {
  const { resolver, calls } = resolverWith({ houses: [HOUSES[0]] });
  assert.equal((await resolver.resolve(normalizeConfig(), SLOTS.PRIMARY)).error, 'no_house');
  const manual = normalizeConfig({ address_source: 'manual', zip_code: '4000' });
  assert.equal((await resolver.resolve(manual, SLOTS.PRIMARY)).address.zip_code, '4000');
  const second = normalizeConfig({ second_zip_code: '6700' });
  assert.equal((await resolver.resolve(second, SLOTS.SECONDARY)).address.zip_code, '6700');
  assert.equal((await resolver.resolve(normalizeConfig(), SLOTS.SECONDARY)).error, 'no_address');
  assert.equal(calls.length, 0);
});
