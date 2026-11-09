// -----------------------------------------------------------------------------
// ORES breakdown map client.
//
// ORES publishes no documented API. The public outage map of www.ores.be
// ("Pannes et travaux") reads a public, unauthenticated JSON endpoint: the list
// of the current incidents of the network (unplanned failures and planned
// interruptions), each with the municipalities, streets and house number
// ranges it impacts. This module only fetches and sanity-checks that list.
//
// The endpoint is undocumented: its shape may change without notice. Every
// field is therefore read defensively (see src/ores/incidents.js), and a
// response that is not an array is an error, never an "all clear".
// -----------------------------------------------------------------------------

export const BREAKDOWN_API_URL = 'https://ores-breakdownmapapi-prd.azurewebsites.net/breakdown';

const DEFAULT_TIMEOUT_MS = 20_000;

export class OresApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'OresApiError';
    this.status = status;
  }
}

/**
 * Fetch the raw incident list of the ORES outage map.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl] injectable fetch (tests)
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object[]>}
 */
export async function fetchBreakdowns({ fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetchImpl(BREAKDOWN_API_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'gladys-ores-integration' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new OresApiError(`ORES outage map unreachable: ${err.message}`);
  }
  if (!response.ok) {
    throw new OresApiError(`ORES outage map answered HTTP ${response.status}`, {
      status: response.status,
    });
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new OresApiError('ORES outage map answered an invalid JSON document');
  }
  if (!Array.isArray(body)) {
    throw new OresApiError('ORES outage map answered an unexpected format');
  }
  return body;
}
