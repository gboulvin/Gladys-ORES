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
  // Address watched on the ORES network. Only the zip code is required.
  zip_code: '',
  city: '',
  street: '',
  house_number: '',
  // Planned works announced further ahead than this are ignored.
  planned_horizon_days: 7,
  // Seconds between two reads of the ORES outage map.
  poll_frequency: 300,
};

const MIN_POLL_SECONDS = 60;

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
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    zip_code: text(raw.zip_code ?? DEFAULT_CONFIG.zip_code),
    city: text(raw.city ?? DEFAULT_CONFIG.city),
    street: text(raw.street ?? DEFAULT_CONFIG.street),
    house_number: text(raw.house_number ?? DEFAULT_CONFIG.house_number),
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
