// -----------------------------------------------------------------------------
// Watched addresses.
//
// Two slots, each with its own device, baseline and scene event tag:
//   - `primary`: the home. By default the address of the Gladys house
//     (coordinates reverse-geocoded once, see src/geo/geocoder.js), or the
//     address typed in the configuration (`address_source: manual`);
//   - `secondary`: an optional other address typed in the configuration
//     (second home, relatives...).
//
// The slot keys travel in the scene events and the widget settings: never
// rename them.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { reverseGeocode as defaultReverseGeocode } from './geo/geocoder.js';

const logger = createLogger({ name: 'addresses' });

export const SLOTS = { PRIMARY: 'primary', SECONDARY: 'secondary' };
export const ADDRESS_SOURCES = { HOUSE: 'house', MANUAL: 'manual' };

// A failed geocoding is retried at most once an hour (Nominatim policy).
const GEOCODE_RETRY_MS = 60 * 60 * 1000;
// The houses are re-read every 6 hours: Gladys sends no update event.
const HOUSES_TTL_MS = 6 * 60 * 60 * 1000;

const roundCoordinate = (value) => Number(value).toFixed(5);

/** The address typed for a slot, or null when it has no zip code. */
export function manualAddress(config, slot) {
  const prefix = slot === SLOTS.SECONDARY ? 'second_' : '';
  const address = {
    zip_code: config[`${prefix}zip_code`],
    city: config[`${prefix}city`],
    street: config[`${prefix}street`],
    house_number: config[`${prefix}house_number`],
  };
  return address.zip_code ? address : null;
}

/** Whether the second address is configured. */
export function hasSecondary(config) {
  return Boolean(config.second_zip_code);
}

/** Pick the Gladys house: by name when given, else the first located one. */
export function pickHouse(houses, name) {
  const located = (houses ?? []).filter(
    (house) => Number.isFinite(house?.latitude) && Number.isFinite(house?.longitude),
  );
  const wanted = String(name ?? '')
    .trim()
    .toLowerCase();
  if (wanted) {
    return located.find((house) => String(house.name).trim().toLowerCase() === wanted) ?? null;
  }
  return located[0] ?? null;
}

/**
 * @param {object} deps
 * @param {object} deps.gladys
 * @param {(point: object) => Promise<object>} [deps.reverseGeocode]
 * @param {{ load: Function, save: Function }} [deps.storage] geocoding cache
 * @param {() => Date} [deps.clock]
 */
export function createAddressResolver({
  gladys,
  reverseGeocode = defaultReverseGeocode,
  storage,
  clock = () => new Date(),
}) {
  let houses = null; // { at, list }
  let cache = null; // { key, address }
  let cacheLoaded = false;
  let lastFailure = null; // { key, at, error }

  async function loadHouses() {
    const now = clock().getTime();
    if (!houses || now - houses.at > HOUSES_TTL_MS) {
      houses = { at: now, list: await gladys.getHouses() };
    }
    return houses.list;
  }

  async function geocode(house) {
    const key = `${roundCoordinate(house.latitude)},${roundCoordinate(house.longitude)}`;
    if (!cacheLoaded) {
      cacheLoaded = true;
      cache = (await storage?.load().catch(() => null)) ?? null;
    }
    if (cache?.key === key && cache.address) {
      return cache.address;
    }
    const now = clock().getTime();
    if (lastFailure?.key === key && now - lastFailure.at < GEOCODE_RETRY_MS) {
      throw new Error(lastFailure.error);
    }
    try {
      const address = await reverseGeocode({
        latitude: house.latitude,
        longitude: house.longitude,
      });
      cache = { key, address };
      await storage?.save(cache).catch(() => {});
      // The address itself is personal data: never logged.
      logger.info('Gladys house address resolved');
      return address;
    } catch (err) {
      lastFailure = { key, at: now, error: err.message };
      throw err;
    }
  }

  return {
    /**
     * The address of a slot.
     * @returns {Promise<{ address: object|null, error: string|null }>}
     *   `error`: `no_address` (nothing configured), `no_house` (no located
     *   Gladys house), `geocoding` (the house could not be turned into an
     *   address).
     */
    async resolve(config, slot) {
      if (slot === SLOTS.SECONDARY || config.address_source === ADDRESS_SOURCES.MANUAL) {
        const address = manualAddress(config, slot);
        return { address, error: address ? null : 'no_address' };
      }
      let house;
      try {
        house = pickHouse(await loadHouses(), config.house_name);
      } catch (err) {
        logger.warn(`Reading the Gladys houses failed: ${err.message}`);
        return { address: null, error: 'no_house' };
      }
      if (!house) {
        return { address: null, error: 'no_house' };
      }
      try {
        return { address: await geocode(house), error: null };
      } catch (err) {
        logger.warn(`Geocoding the Gladys house failed: ${err.message}`);
        return { address: null, error: 'geocoding' };
      }
    },

    /** Forget the houses read: re-read them at the next resolve. */
    invalidate() {
      houses = null;
    },
  };
}
