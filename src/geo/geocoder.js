// -----------------------------------------------------------------------------
// Reverse geocoding of the Gladys house: coordinates -> postal address.
//
// Gladys only exposes the coordinates of a house (`getHouses()`, manifest
// `location: true`), while the ORES outage map speaks zip codes, streets and
// house number ranges. OpenStreetMap Nominatim turns the coordinates into an
// address, ONCE per coordinates: the result is cached under /data and the
// coordinates are never sent anywhere else. Nominatim usage policy: an
// identifying User-Agent, at most one request per second, cache the results.
// -----------------------------------------------------------------------------

export const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

const USER_AGENT = 'gladys-ores-integration (+https://github.com/gboulvin/Gladys-ORES)';
const DEFAULT_TIMEOUT_MS = 15_000;

export class GeocodingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeocodingError';
  }
}

/**
 * Turn a Nominatim `address` object into the integration address fields.
 * The locality is left empty on purpose: OSM and ORES name the localities of a
 * merged municipality differently ("Namur" vs "JAMBES"), the zip code is the
 * reliable key.
 */
export function toOresAddress(address) {
  const zip = String(address?.postcode ?? '')
    .trim()
    .match(/^\d{4}/);
  if (!zip) {
    return null;
  }
  return {
    zip_code: zip[0],
    city: '',
    street: String(address.road ?? address.pedestrian ?? address.street ?? '').trim(),
    house_number: String(address.house_number ?? '')
      .split(/[;,]/)[0]
      .trim(),
  };
}

/**
 * @param {{ latitude: number, longitude: number }} point
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ zip_code: string, city: string, street: string, house_number: string }>}
 */
export async function reverseGeocode(
  { latitude, longitude },
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'fr',
  }).toString();
  let response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new GeocodingError(`OpenStreetMap unreachable: ${err.message}`);
  }
  if (!response.ok) {
    throw new GeocodingError(`OpenStreetMap answered HTTP ${response.status}`);
  }
  const body = await response.json().catch(() => null);
  if (body?.address?.country_code && body.address.country_code !== 'be') {
    throw new GeocodingError('The Gladys house is not located in Belgium');
  }
  const address = toOresAddress(body?.address);
  if (!address) {
    throw new GeocodingError('No postal address found at the Gladys house location');
  }
  return address;
}
