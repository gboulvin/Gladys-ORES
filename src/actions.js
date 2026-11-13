// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { classifyIncident, INCIDENT_PHASES } from './ores/incidents.js';
import { activeSlots } from './devices/index.js';
import { SLOTS } from './addresses.js';
import { LANGUAGES, ml, tr } from './i18n.js';

const logger = createLogger({ name: 'actions' });

/** Short form of an address, for the user only (never logged). */
export function formatAddress(address) {
  const street = [address.street, address.house_number].filter(Boolean).join(' ');
  return [address.zip_code, address.city, street].filter(Boolean).join(' ');
}

/** The display name of an address slot, in one language. */
export function slotName(language, slot, config) {
  if (slot === SLOTS.SECONDARY) {
    return config.second_name || tr(language, 'secondAddress');
  }
  return tr(language, 'home');
}

export const ACTIONS = {
  // Reach the outage map, then tell which address each slot watches and what
  // the map sees there: the way to check the geocoded home address.
  async test_connection(gladys, { service, config }) {
    logger.info('Action test_connection');
    try {
      const raw = await service.fetchRaw();
      const now = service.now();
      const total = raw.filter(
        (incident) => classifyIncident(incident, now).phase !== INCIDENT_PHASES.ENDED,
      ).length;
      await service.refresh();
      const lines = activeSlots(config).map((slot) => {
        const { address } = service.getAddress(slot);
        const count = service
          .getSnapshot(slot)
          .incidents.filter((incident) => incident.phase === INCIDENT_PHASES.IN_PROGRESS).length;
        return { slot, address, count };
      });
      return Object.fromEntries(
        LANGUAGES.map((lang) => {
          const details = lines
            .map(({ slot, address, count }) => {
              const name = slotName(lang, slot, config);
              return address
                ? tr(lang, 'testAddress', { name, address: formatAddress(address), count })
                : tr(lang, 'testAddressMissing', { name });
            })
            .join(' ');
          return [lang, tr(lang, 'testOk', { total, details })];
        }),
      );
    } catch (err) {
      return ml('testFailed', { error: err.message });
    }
  },
};
