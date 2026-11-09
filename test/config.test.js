import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig trims the address and keeps the zip code a string', () => {
  const config = normalizeConfig({ zip_code: 5000, street: '  Rue de Fer ', house_number: 12 });
  assert.equal(config.zip_code, '5000');
  assert.equal(config.street, 'Rue de Fer');
  assert.equal(config.house_number, '12');
});

test('normalizeConfig coerces and bounds the numbers coming from a form', () => {
  const config = normalizeConfig({ poll_frequency: '600', planned_horizon_days: '14' });
  assert.equal(config.poll_frequency, 600);
  assert.equal(config.planned_horizon_days, 14);
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, 60);
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 300);
});
