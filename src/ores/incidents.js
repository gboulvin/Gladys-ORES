// -----------------------------------------------------------------------------
// ORES incidents: classification and address matching.
//
// One raw incident of the outage map carries either a `failure` (an unplanned
// outage) or an `interruption` (planned works, with `plannedFrom` /
// `plannedTo`), a `status` (`active`, `resolved`, `cancelled`) and the list of
// the impacted municipalities, streets and house number ranges.
//
// Everything here is pure (no I/O, `now` injected) so it is fully testable.
// -----------------------------------------------------------------------------

export const INCIDENT_KINDS = { OUTAGE: 'outage', PLANNED: 'planned' };
export const INCIDENT_PHASES = { UPCOMING: 'upcoming', IN_PROGRESS: 'in_progress', ENDED: 'ended' };

// An incident still flagged `active` long after its announced end and without
// any update is a leftover of the map, not a current outage.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * Parse an ORES date. Some fields come without an offset
 * (`2026-02-04T11:02:28.46`): they are UTC, like their offset-carrying
 * siblings.
 * @returns {Date|null}
 */
export function parseOresDate(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasOffset ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize a street or city name for comparison: no accents, no case, no
 * punctuation ("Rue de l'Église" === "RUE DE L EGLISE").
 */
export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Leading number of a house number ("12/A" -> 12, "45/RT" -> 45, "B3" -> null).
 */
export function parseHouseNumber(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Whether a house number falls in one of the ORES ranges of a street. A range
 * is `{ from, to, rangeType: 'odd' | 'even' }`; an unknown range type matches
 * both sides of the street.
 */
export function houseNumberInRanges(houseNumber, ranges) {
  const number = parseHouseNumber(houseNumber);
  if (number === null || !Array.isArray(ranges)) {
    return false;
  }
  return ranges.some((range) => {
    const from = parseHouseNumber(range?.from);
    const to = parseHouseNumber(range?.to) ?? from;
    if (from === null) {
      return false;
    }
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    if (number < low || number > high) {
      return false;
    }
    if (range.rangeType === 'odd') {
      return number % 2 === 1;
    }
    if (range.rangeType === 'even') {
      return number % 2 === 0;
    }
    return true;
  });
}

/**
 * Where an incident hits a given address.
 * @param {object} incident raw ORES incident
 * @param {{ zip_code: string, city?: string, street?: string, house_number?: string }} address
 * @returns {{ commune: boolean, address: boolean, cities: string[] }}
 *   `commune`: the incident impacts the municipality (zip code, and city name
 *   when given); `address`: it impacts the street (and the house number when
 *   given) — or the municipality when no street is configured.
 */
export function matchAddress(incident, address) {
  const zip = String(address?.zip_code ?? '').trim();
  const result = { commune: false, address: false, cities: [] };
  if (!zip || !Array.isArray(incident?.impactedCities)) {
    return result;
  }
  const wantedCity = normalizeName(address.city);
  const wantedStreet = normalizeName(address.street);
  const houseNumber = String(address.house_number ?? '').trim();

  for (const city of incident.impactedCities) {
    if (String(city?.zipCode ?? '').trim() !== zip) {
      continue;
    }
    if (wantedCity && normalizeName(city.cityName) !== wantedCity) {
      continue;
    }
    result.commune = true;
    if (city.cityName && !result.cities.includes(city.cityName)) {
      result.cities.push(city.cityName);
    }
    if (!wantedStreet) {
      result.address = true;
      continue;
    }
    for (const street of city.streets ?? []) {
      if (normalizeName(street?.streetName) !== wantedStreet) {
        continue;
      }
      if (!houseNumber || houseNumberInRanges(houseNumber, street.streetNumberRanges)) {
        result.address = true;
      }
    }
  }
  return result;
}

/**
 * Classify a raw incident at a given instant.
 * @returns {{ id: string, reference: string, kind: string, phase: string,
 *   startsAt: Date|null, endsAt: Date|null, delayed: boolean, customers: number }}
 */
export function classifyIncident(incident, now = new Date()) {
  const kind = incident?.failure ? INCIDENT_KINDS.OUTAGE : INCIDENT_KINDS.PLANNED;
  const delayed = incident?.isDelayed === true;
  const lastUpdate =
    parseOresDate(incident?.lastUpdatedDateTime) ?? parseOresDate(incident?.creationAt);

  let startsAt;
  let endsAt;
  if (kind === INCIDENT_KINDS.OUTAGE) {
    startsAt = parseOresDate(incident.creationAt);
    endsAt =
      parseOresDate(incident.endDateTime) ??
      parseOresDate(incident.failure?.plannedEndDateTime) ??
      parseOresDate(incident.originalEndDate);
  } else {
    startsAt = parseOresDate(incident?.interruption?.plannedFrom);
    endsAt =
      parseOresDate(incident?.endDateTime) ??
      parseOresDate(incident?.interruption?.plannedTo) ??
      parseOresDate(incident?.originalEndDate);
  }

  let phase;
  if (incident?.status !== 'active') {
    phase = INCIDENT_PHASES.ENDED;
  } else if (startsAt && now < startsAt) {
    phase = INCIDENT_PHASES.UPCOMING;
  } else if (endsAt && now > endsAt) {
    // Past its announced end: still running only when ORES says it is late
    // AND keeps updating it, otherwise it is a leftover of the map.
    const fresh = lastUpdate && now - lastUpdate < STALE_AFTER_MS;
    const overrun = delayed || kind === INCIDENT_KINDS.OUTAGE;
    phase = overrun && fresh ? INCIDENT_PHASES.IN_PROGRESS : INCIDENT_PHASES.ENDED;
  } else {
    phase = INCIDENT_PHASES.IN_PROGRESS;
  }

  const customers = Number(incident?.impactedCustomerCount);
  return {
    id: String(incident?.id ?? incident?.businessId ?? ''),
    reference: String(incident?.businessId ?? ''),
    kind,
    phase,
    startsAt,
    endsAt,
    delayed,
    customers: Number.isFinite(customers) ? customers : 0,
  };
}

/**
 * The incidents relevant to an address, classified, sorted by start date.
 * Ended incidents are dropped; incidents announced beyond the horizon too.
 * @param {object[]} rawIncidents
 * @param {object} address config address fields
 * @param {{ now?: Date, horizonDays?: number }} [options]
 */
export function selectIncidents(rawIncidents, address, { now = new Date(), horizonDays = 7 } = {}) {
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const selected = [];
  for (const raw of rawIncidents ?? []) {
    const match = matchAddress(raw, address);
    if (!match.commune) {
      continue;
    }
    const incident = classifyIncident(raw, now);
    if (incident.phase === INCIDENT_PHASES.ENDED || !incident.id) {
      continue;
    }
    if (incident.phase === INCIDENT_PHASES.UPCOMING && incident.startsAt > horizon) {
      continue;
    }
    selected.push({
      ...incident,
      scope: match.address ? 'address' : 'commune',
      city: match.cities.join(', '),
    });
  }
  return selected.sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
}
