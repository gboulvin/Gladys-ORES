// -----------------------------------------------------------------------------
// Device registry.
//
// Each device type lives in its own file and exposes:
//   - key                        : short identifier (used in logs)
//   - deviceExternalId(gladys)   : the device external_id
//   - buildDevice(gladys, config): the discovery payload sent to Gladys
// -----------------------------------------------------------------------------

import { networkStatus } from './networkStatus.js';

export const DEVICE_BLUEPRINTS = [networkStatus];

/**
 * Build the discovery payload for Gladys (all devices).
 */
export function buildDiscoveredDevices(gladys, config) {
  return DEVICE_BLUEPRINTS.map((bp) => bp.buildDevice(gladys, config));
}
