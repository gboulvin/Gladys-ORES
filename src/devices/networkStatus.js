// -----------------------------------------------------------------------------
// Device: ORES NETWORK STATUS
//
// One read-only device per installation, fed by the network monitor (see
// src/ores/monitor.js) at the refresh interval of the configuration. Its
// binary features drive the standard "device state" scene triggers and the
// dashboard; the richer details (reference, end time, customers) travel with
// the scene events of the manifest `scene_triggers`.
//
// The device is not polled by Gladys: the monitor runs its own timer, so the
// scene triggers fire even before the user creates the device.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'network-status';

// The outage map gives no id to "the user's connection": the device stands for
// the installation itself. Never change it: Gladys keys the history on it.
const PLATFORM_DEVICE_ID = 'address';

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

  deviceExternalId(gladys) {
    return gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID).device;
  },

  featureExternalId(gladys, feature) {
    return gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID).feature(feature);
  },

  buildDevice(gladys) {
    const ids = gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID);
    return {
      name: 'ORES network status',
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
  async publishSnapshot(gladys, snapshot) {
    const { summary } = snapshot;
    const states = [
      [FEATURE.OUTAGE, summary.outage],
      [FEATURE.PLANNED_IN_PROGRESS, summary.plannedInProgress],
      [FEATURE.UPCOMING, summary.upcoming],
      [FEATURE.COMMUNE_INCIDENT, summary.communeInProgress > 0],
    ].map(([feature, value]) => ({
      device_feature_external_id: this.featureExternalId(gladys, feature),
      state: value ? 1 : 0,
    }));
    await gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
  },
};
