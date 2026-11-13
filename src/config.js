// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`; the SDK fetches it (`getConfig()`) and
// notifies every change (`onConfigUpdated()`). This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined` or with numbers typed as strings.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in
// the `config_schema` of the manifest (checked by test/manifest.test.js).
export const DEFAULT_CONFIG = {
  // Home address: the Gladys house (reverse-geocoded) or the address typed
  // below ('house' | 'manual').
  address_source: 'house',
  // Name of the Gladys house when there are several (empty: the first located).
  house_name: '',
  // Home address typed by hand (address_source: manual). Zip code required.
  zip_code: '',
  city: '',
  street: '',
  house_number: '',
  // Optional second address (second home, relatives...): on when it has a
  // zip code.
  second_name: '',
  second_zip_code: '',
  second_city: '',
  second_street: '',
  second_house_number: '',
  // Planned works announced further ahead than this are ignored.
  planned_horizon_days: 7,
  // Seconds between two reads of the ORES outage map.
  poll_frequency: 300,
};

const MIN_POLL_SECONDS = 60;

const TEXT_KEYS = [
  'house_name',
  'zip_code',
  'city',
  'street',
  'house_number',
  'second_name',
  'second_zip_code',
  'second_city',
  'second_street',
  'second_house_number',
];

// Version 0.1 had no address source and watched the typed address: a config
// saved then (zip code filled, no source) keeps watching it.
function addressSource(raw, texts) {
  if (raw.address_source === 'house' || raw.address_source === 'manual') {
    return raw.address_source;
  }
  return texts.zip_code ? 'manual' : DEFAULT_CONFIG.address_source;
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(Math.max(number, min), max);
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const texts = Object.fromEntries(
    TEXT_KEYS.map((key) => [key, text(raw[key] ?? DEFAULT_CONFIG[key])]),
  );
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    ...texts,
    address_source: addressSource(raw, texts),
    planned_horizon_days: boundedNumber(
      raw.planned_horizon_days,
      DEFAULT_CONFIG.planned_horizon_days,
      1,
      60,
    ),
    poll_frequency: boundedNumber(
      raw.poll_frequency,
      DEFAULT_CONFIG.poll_frequency,
      MIN_POLL_SECONDS,
      3600,
    ),
  };
}
