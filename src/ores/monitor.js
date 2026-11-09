// -----------------------------------------------------------------------------
// Network status monitor.
//
// Fetches the ORES outage map, keeps the incidents relevant to the configured
// address, and turns the difference with the previous read into scene events:
//   - outage_started          an incident (outage or planned works) begins;
//   - outage_ended            an incident in progress is over;
//   - outage_delayed          an incident in progress is late (later end);
//   - interruption_scheduled  new planned works are announced.
//
// The very first read (and the first read after an address change) only seeds
// the baseline: the incidents already running are not "new". The baseline is
// saved under /data, so a restart does not replay or miss the transitions.
// -----------------------------------------------------------------------------

import { INCIDENT_PHASES, selectIncidents } from './incidents.js';

export const SCENE_TRIGGERS = {
  OUTAGE_STARTED: 'outage_started',
  OUTAGE_ENDED: 'outage_ended',
  OUTAGE_DELAYED: 'outage_delayed',
  INTERRUPTION_SCHEDULED: 'interruption_scheduled',
};

const toIso = (date) => (date instanceof Date ? date.toISOString() : null);
const fromIso = (value) => (value ? new Date(value) : null);

/** Address fingerprint: a change of address restarts the baseline. */
export function addressKey(config) {
  return [config.zip_code, config.city, config.street, config.house_number]
    .map((part) =>
      String(part ?? '')
        .trim()
        .toUpperCase(),
    )
    .join('|');
}

/** JSON-friendly incident (dates as ISO strings), as stored and served. */
function serialize(incident) {
  return { ...incident, startsAt: toIso(incident.startsAt), endsAt: toIso(incident.endsAt) };
}

function deserialize(incident) {
  return { ...incident, startsAt: fromIso(incident.startsAt), endsAt: fromIso(incident.endsAt) };
}

/**
 * Flat scene event data: only primitives, the keys the manifest declares for
 * that trigger (announced works are always planned: no `kind` filter there).
 */
export function eventData(incident, key) {
  return {
    ...(key === SCENE_TRIGGERS.INTERRUPTION_SCHEDULED ? {} : { kind: incident.kind }),
    scope: incident.scope,
    reference: incident.reference,
    city: incident.city,
    start_time: toIso(incident.startsAt),
    end_time: toIso(incident.endsAt),
    customers: incident.customers,
  };
}

/**
 * Compare two incident lists and list the transitions.
 * @returns {{ key: string, incident: object }[]}
 */
export function diffIncidents(previous, current) {
  const events = [];
  const before = new Map(previous.map((incident) => [incident.id, incident]));
  const now = new Map(current.map((incident) => [incident.id, incident]));
  const inProgress = (incident) => incident?.phase === INCIDENT_PHASES.IN_PROGRESS;

  for (const incident of current) {
    const old = before.get(incident.id);
    if (inProgress(incident) && !inProgress(old)) {
      events.push({ key: SCENE_TRIGGERS.OUTAGE_STARTED, incident });
    } else if (inProgress(incident) && inProgress(old)) {
      const newlyDelayed = incident.delayed && !old.delayed;
      const pushedBack =
        incident.endsAt && old.endsAt && incident.endsAt.getTime() > old.endsAt.getTime();
      if (newlyDelayed || pushedBack) {
        events.push({ key: SCENE_TRIGGERS.OUTAGE_DELAYED, incident });
      }
    } else if (incident.phase === INCIDENT_PHASES.UPCOMING && !old) {
      events.push({ key: SCENE_TRIGGERS.INTERRUPTION_SCHEDULED, incident });
    }
  }
  for (const old of previous) {
    if (inProgress(old) && !inProgress(now.get(old.id))) {
      events.push({ key: SCENE_TRIGGERS.OUTAGE_ENDED, incident: now.get(old.id) ?? old });
    }
  }
  return events;
}

/**
 * Summary of a snapshot for the configured address.
 */
export function summarize(incidents) {
  const atAddress = incidents.filter((incident) => incident.scope === 'address');
  const running = (incident) => incident.phase === INCIDENT_PHASES.IN_PROGRESS;
  return {
    outage: atAddress.some((i) => running(i) && i.kind === 'outage'),
    plannedInProgress: atAddress.some((i) => running(i) && i.kind === 'planned'),
    upcoming: atAddress.some((i) => i.phase === INCIDENT_PHASES.UPCOMING),
    communeInProgress: incidents.filter(running).length,
    communeUpcoming: incidents.filter((i) => i.phase === INCIDENT_PHASES.UPCOMING).length,
    nextAtAddress: atAddress.find((i) => i.phase === INCIDENT_PHASES.UPCOMING) ?? null,
    currentAtAddress: atAddress.find(running) ?? null,
  };
}

/**
 * @param {object} deps
 * @param {() => Promise<object[]>} deps.fetchIncidents raw ORES incidents
 * @param {{ load: () => Promise<object|null>, save: (data: object) => Promise<void> }} [deps.storage]
 * @param {() => Date} [deps.clock]
 */
export function createMonitor({ fetchIncidents, storage, clock = () => new Date() }) {
  let state = null; // { addressKey, incidents, fetchedAt, error }
  let loaded = false;

  async function loadOnce() {
    if (loaded) {
      return;
    }
    loaded = true;
    const saved = await storage?.load().catch(() => null);
    if (saved && Array.isArray(saved.incidents)) {
      state = { ...saved, incidents: saved.incidents.map(deserialize), error: null };
    }
  }

  return {
    /**
     * Read the outage map now.
     * @returns {Promise<{ events: object[], snapshot: object }>} the scene
     * events to publish (none on a seed read or on an error) and the snapshot.
     */
    async refresh(config) {
      await loadOnce();
      const key = addressKey(config);
      const now = clock();
      if (!config.zip_code) {
        state = { addressKey: key, incidents: [], fetchedAt: null, error: 'no_address' };
        return { events: [], snapshot: this.getSnapshot() };
      }
      let raw;
      try {
        raw = await fetchIncidents();
      } catch (err) {
        // Keep the last known incidents: an unreachable map is not an all clear.
        state = {
          addressKey: key,
          incidents: state?.addressKey === key ? state.incidents : [],
          fetchedAt: state?.addressKey === key ? state.fetchedAt : null,
          error: err.message,
          seeded: state?.addressKey === key && state.seeded,
        };
        return { events: [], snapshot: this.getSnapshot() };
      }
      const incidents = selectIncidents(raw, config, {
        now,
        horizonDays: config.planned_horizon_days,
      });
      const seeded = state?.addressKey === key && state.seeded && state.fetchedAt;
      const events = seeded ? diffIncidents(state.incidents, incidents) : [];
      state = {
        addressKey: key,
        incidents,
        fetchedAt: now.toISOString(),
        error: null,
        seeded: true,
      };
      await storage
        ?.save({
          addressKey: key,
          fetchedAt: state.fetchedAt,
          seeded: true,
          incidents: incidents.map(serialize),
        })
        .catch(() => {});
      return { events, snapshot: this.getSnapshot() };
    },

    /** Last known state, without any network call. */
    getSnapshot() {
      const incidents = state?.incidents ?? [];
      return {
        fetchedAt: state?.fetchedAt ?? null,
        error: state?.error ?? null,
        incidents,
        summary: summarize(incidents),
      };
    },
  };
}
