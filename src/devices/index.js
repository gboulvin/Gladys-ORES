// -----------------------------------------------------------------------------
// Device registry: one "ORES network status" device per watched address.
// -----------------------------------------------------------------------------

import { hasSecondary, SLOTS } from '../addresses.js';
import { networkStatus } from './networkStatus.js';

/** The address slots that have a device, in order. */
export function activeSlots(config) {
  return hasSecondary(config) ? [SLOTS.PRIMARY, SLOTS.SECONDARY] : [SLOTS.PRIMARY];
}

/**
 * Build the discovery payload for Gladys (all devices).
 */
export function buildDiscoveredDevices(gladys, config) {
  return activeSlots(config).map((slot) =>
    networkStatus.buildDevice(gladys, slot, slot === SLOTS.SECONDARY ? config.second_name : ''),
  );
}
