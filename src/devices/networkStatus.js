// -----------------------------------------------------------------------------
// Device: ORES NETWORK STATUS
//
// One read-only device per watched address (see src/addresses.js), fed by the
// network monitor (see
// src/ores/monitor.js) at the refresh interval of the configuration. Its
// binary features drive the standard "device state" scene triggers and the
// dashboard; the richer details (reference, end time, customers) travel with
// the scene events of the manifest `scene_triggers`.
//
// The device is not polled by Gladys: the monitor runs its own timer, so the
// scene triggers fire even before the user creates the device.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { SLOTS } from '../addresses.js';

const DEVICE_TYPE = 'network-status';

// The outage map gives no id to "the user's connection": each device stands
// for one watched address slot. Never change them: Gladys keys the history on
// them (`address` predates the second slot, hence the asymmetry).
const PLATFORM_DEVICE_IDS = { [SLOTS.PRIMARY]: 'address', [SLOTS.SECONDARY]: 'address-2' };

const DEVICE_NAMES = {
  [SLOTS.PRIMARY]: 'ORES network status',
  [SLOTS.SECONDARY]: 'ORES network status (second address)',
};

const idsOf = (gladys, slot = SLOTS.PRIMARY) =>
  gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_IDS[slot]);

export const FEATURE = {
  OUTAGE: 'outage',
  PLANNED_IN_PROGRESS: 'planned-interruption',
  UPCOMING: 'upcoming-interruption',
  COMMUNE_INCIDENT: 'commune-incident',
};

const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

const binaryFeature = (ids, key, name) => ({
  name,
  external_id: ids.feature(key),
  category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
  type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.BINARY,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 1,
});

export const networkStatus = {
  key: DEVICE_TYPE,

  deviceExternalId(gladys, slot = SLOTS.PRIMARY) {
    return idsOf(gladys, slot).device;
  },

  featureExternalId(gladys, feature, slot = SLOTS.PRIMARY) {
    return idsOf(gladys, slot).feature(feature);
  },

  /** @param {string} [name] user label of the second address */
  buildDevice(gladys, slot = SLOTS.PRIMARY, name = '') {
    const ids = idsOf(gladys, slot);
    const label = slot === SLOTS.SECONDARY && name ? `ORES network status (${name})` : '';
    return {
      name: label || DEVICE_NAMES[slot],
      external_id: ids.device,
      features: [
        binaryFeature(ids, FEATURE.OUTAGE, 'Outage at my address'),
        binaryFeature(ids, FEATURE.PLANNED_IN_PROGRESS, 'Planned works at my address'),
        binaryFeature(ids, FEATURE.UPCOMING, 'Upcoming planned works at my address'),
        binaryFeature(ids, FEATURE.COMMUNE_INCIDENT, 'Incident in my municipality'),
      ],
    };
  },

  /**
   * Publish the binary states of a monitor snapshot. Only the changed values
   * are sent, plus a heartbeat every 30 minutes.
   */
  async publishSnapshot(gladys, snapshot, slot = SLOTS.PRIMARY) {
    const { summary } = snapshot;
    const states = [
      [FEATURE.OUTAGE, summary.outage],
      [FEATURE.PLANNED_IN_PROGRESS, summary.plannedInProgress],
      [FEATURE.UPCOMING, summary.upcoming],
      [FEATURE.COMMUNE_INCIDENT, summary.communeInProgress > 0],
    ].map(([feature, value]) => ({
      device_feature_external_id: this.featureExternalId(gladys, feature, slot),
      state: value ? 1 : 0,
    }));
    await gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
  },
};
