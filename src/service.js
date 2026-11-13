// -----------------------------------------------------------------------------
// ORES service: the runtime glue between the network monitors and Gladys.
//
// - refresh(): resolve the watched addresses (home + optional second address),
//   read the outage map ONCE, then for every address publish the device
//   states and the scene events; nudge the dashboard widget and report the
//   connection status;
// - start()/stop(): the refresh timer, at the interval of the configuration;
// - checkAddress(): the incidents of ANY address (scene action), read-only.
//
// The raw map is cached one minute: a scene checking several addresses, or a
// widget button tapped twice, never hammers the ORES endpoint.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { fetchBreakdowns as defaultFetchBreakdowns } from './ores/breakdownApi.js';
import { createMonitor, eventData, summarize } from './ores/monitor.js';
import { selectIncidents } from './ores/incidents.js';
import { networkStatus } from './devices/networkStatus.js';
import { activeSlots } from './devices/index.js';
import { createAddressResolver, SLOTS } from './addresses.js';
import { ml } from './i18n.js';

const logger = createLogger({ name: 'ores' });

const RAW_CACHE_MS = 60 * 1000;

// Baseline file per slot: the primary one predates the second address.
const BASELINE_FILES = {
  [SLOTS.PRIMARY]: 'network-status.json',
  [SLOTS.SECONDARY]: 'network-status-secondary.json',
};

// Connection status message of an address that could not be resolved.
const ADDRESS_ERRORS = {
  no_address: 'noAddress',
  no_house: 'noHouse',
  geocoding: 'geocodingFailed',
};

/**
 * @param {object} deps
 * @param {object} deps.gladys GladysIntegration (or the fake one in tests)
 * @param {() => object} deps.getConfig current normalized config
 * @param {() => Promise<object[]>} [deps.fetchBreakdowns]
 * @param {(name: string) => object} [deps.createStorage] JSON store factory (src/storage.js)
 * @param {object} [deps.addressResolver] see src/addresses.js
 * @param {(point: object) => Promise<object>} [deps.reverseGeocode]
 * @param {() => Date} [deps.clock]
 * @param {() => void} [deps.onWidgetsChanged]
 */
export function createOresService({
  gladys,
  getConfig,
  fetchBreakdowns = defaultFetchBreakdowns,
  createStorage = () => undefined,
  reverseGeocode,
  addressResolver,
  clock = () => new Date(),
  onWidgetsChanged = () => {},
}) {
  let cache = null; // { at, data }
  let timer = null;
  let running = null;
  const addresses = new Map(); // slot -> { address, error }

  const resolver =
    addressResolver ??
    createAddressResolver({
      gladys,
      clock,
      storage: createStorage('home-address.json'),
      ...(reverseGeocode ? { reverseGeocode } : {}),
    });

  async function fetchRaw() {
    const now = clock().getTime();
    if (cache && now - cache.at < RAW_CACHE_MS) {
      return cache.data;
    }
    const data = await fetchBreakdowns();
    cache = { at: now, data };
    return data;
  }

  const monitors = Object.fromEntries(
    Object.values(SLOTS).map((slot) => [
      slot,
      createMonitor({
        fetchIncidents: fetchRaw,
        storage: createStorage(BASELINE_FILES[slot]),
        clock,
      }),
    ]),
  );

  async function refreshSlot(slot, config) {
    const { address, error } = await resolver.resolve(config, slot);
    addresses.set(slot, { address, error });
    const target = address
      ? { ...address, planned_horizon_days: config.planned_horizon_days }
      : { zip_code: '', address_error: error };
    const { events, snapshot } = await monitors[slot].refresh(target);
    if (!snapshot.error) {
      await networkStatus.publishSnapshot(gladys, snapshot, slot);
    }
    for (const { key, incident } of events) {
      logger.info(`Scene event ${key} <- ${incident.reference} (${slot}, ${incident.scope})`);
      try {
        await gladys.publishSceneEvent(key, { ...eventData(incident, key), address: slot });
      } catch (err) {
        logger.error(`publishSceneEvent ${key} failed`, err);
      }
    }
    return snapshot;
  }

  async function doRefresh() {
    const config = getConfig();
    const snapshots = {};
    for (const slot of activeSlots(config)) {
      snapshots[slot] = await refreshSlot(slot, config);
    }

    // The connection status speaks for the home first: an unresolved home
    // address, then an unreachable map, else all good.
    const primary = snapshots[SLOTS.PRIMARY];
    const mapError = Object.values(snapshots).find(
      (snapshot) => snapshot.error && !ADDRESS_ERRORS[snapshot.error],
    );
    if (ADDRESS_ERRORS[primary.error]) {
      await gladys.setConnectionStatus(false, ml(ADDRESS_ERRORS[primary.error])).catch(() => {});
    } else if (mapError) {
      logger.warn(`Outage map read failed: ${mapError.error}`);
      await gladys.setConnectionStatus(false, ml('mapUnreachable')).catch(() => {});
    } else {
      await gladys.setConnectionStatus(true).catch(() => {});
    }
    onWidgetsChanged();
    return primary;
  }

  return {
    /** Read the map now (concurrent calls share the same read). Resolves the home snapshot. */
    refresh() {
      if (!running) {
        running = doRefresh().finally(() => {
          running = null;
        });
      }
      return running;
    },

    /** Last snapshot of an address slot, without any network call. */
    getSnapshot: (slot = SLOTS.PRIMARY) =>
      monitors[slot]?.getSnapshot() ?? monitors.primary.getSnapshot(),

    /** Last resolved address of a slot: `{ address, error }` (never logged). */
    getAddress: (slot = SLOTS.PRIMARY) => addresses.get(slot) ?? { address: null, error: null },

    /** The service clock (injected in tests). */
    now: () => clock(),

    /** Raw map (cached), for the test action. */
    fetchRaw,

    /** Re-read the Gladys houses at the next refresh (reconnection). */
    invalidateHouses: () => resolver.invalidate?.(),

    /**
     * Incidents of an arbitrary address. Read-only: no state, no scene event
     * (an event fired by a scene action could loop through the scene).
     */
    async checkAddress(address, { horizonDays = getConfig().planned_horizon_days } = {}) {
      const raw = await fetchRaw();
      const incidents = selectIncidents(raw, address, { now: clock(), horizonDays });
      return { incidents, summary: summarize(incidents) };
    },

    /** (Re)start the refresh timer, reading the map right away. */
    start() {
      this.stop();
      const intervalMs = getConfig().poll_frequency * 1000;
      timer = setInterval(() => {
        this.refresh().catch((err) => logger.error('Scheduled refresh failed', err));
      }, intervalMs);
      return this.refresh().catch((err) => logger.error('Initial refresh failed', err));
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
