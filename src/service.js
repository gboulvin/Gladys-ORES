// -----------------------------------------------------------------------------
// ORES service: the runtime glue between the network monitor and Gladys.
//
// - refresh(): read the outage map, publish the device states and the scene
//   events, nudge the dashboard widget, report the connection status;
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
import { ml } from './i18n.js';

const logger = createLogger({ name: 'ores' });

const RAW_CACHE_MS = 60 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.gladys GladysIntegration (or the fake one in tests)
 * @param {() => object} deps.getConfig current normalized config
 * @param {() => Promise<object[]>} [deps.fetchBreakdowns]
 * @param {object} [deps.storage] baseline store (see src/storage.js)
 * @param {() => Date} [deps.clock]
 * @param {(key: string) => void} [deps.onWidgetsChanged]
 */
export function createOresService({
  gladys,
  getConfig,
  fetchBreakdowns = defaultFetchBreakdowns,
  storage,
  clock = () => new Date(),
  onWidgetsChanged = () => {},
}) {
  let cache = null; // { at, data }
  let timer = null;
  let running = null;

  async function fetchRaw() {
    const now = clock().getTime();
    if (cache && now - cache.at < RAW_CACHE_MS) {
      return cache.data;
    }
    const data = await fetchBreakdowns();
    cache = { at: now, data };
    return data;
  }

  const monitor = createMonitor({ fetchIncidents: fetchRaw, storage, clock });

  async function doRefresh() {
    const config = getConfig();
    const { events, snapshot } = await monitor.refresh(config);

    if (snapshot.error === 'no_address') {
      await gladys.setConnectionStatus(false, ml('noAddress')).catch(() => {});
    } else if (snapshot.error) {
      logger.warn(`Outage map read failed: ${snapshot.error}`);
      await gladys.setConnectionStatus(false, ml('mapUnreachable')).catch(() => {});
    } else {
      await gladys.setConnectionStatus(true).catch(() => {});
      await networkStatus.publishSnapshot(gladys, snapshot);
    }

    for (const { key, incident } of events) {
      logger.info(`Scene event ${key} <- ${incident.reference} (${incident.scope})`);
      try {
        await gladys.publishSceneEvent(key, eventData(incident, key));
      } catch (err) {
        logger.error(`publishSceneEvent ${key} failed`, err);
      }
    }
    onWidgetsChanged();
    return snapshot;
  }

  return {
    /** Read the map now (concurrent calls share the same read). */
    refresh() {
      if (!running) {
        running = doRefresh().finally(() => {
          running = null;
        });
      }
      return running;
    },

    getSnapshot: () => monitor.getSnapshot(),

    /** Raw map (cached), for the test action. */
    fetchRaw,

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
