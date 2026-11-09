// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// - check_address       incidents of ANY address (a second home, a relative),
//                        read straight from the outage map;
// - get_network_status  the last known status of the configured address,
//                        without any network call.
//
// Both are read-only: they never publish a state nor a scene event (an event
// fired by a scene action could loop through the scene). A scene action is
// never a condition: the outcome is an output the scene author gates on.
//
// Scene TRIGGERS need no handler: the service fires them from the monitor
// transitions (see src/ores/monitor.js and src/service.js).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'scenes' });

const iso = (date) => (date instanceof Date ? date.toISOString() : '');

/** Declared outputs of a status summary (scalars only). */
export function statusOutputs(summary) {
  const current = summary.currentAtAddress;
  const next = summary.nextAtAddress;
  return {
    outage: summary.outage,
    planned_interruption: summary.plannedInProgress,
    upcoming_interruption: summary.upcoming,
    commune_incidents: summary.communeInProgress,
    reference: current?.reference ?? next?.reference ?? '',
    end_time: iso(current?.endsAt),
    next_start_time: iso(next?.startsAt),
  };
}

export const SCENE_ACTIONS = {
  async check_address(gladys, { fields, service }) {
    logger.info(`Scene action check_address <- ${fields.zip_code}`);
    const { summary } = await service.checkAddress({
      zip_code: fields.zip_code,
      city: fields.city,
      street: fields.street,
      house_number: fields.house_number,
    });
    return statusOutputs(summary);
  },

  async get_network_status(gladys, { service }) {
    logger.info('Scene action get_network_status');
    return statusOutputs(service.getSnapshot().summary);
  },
};
