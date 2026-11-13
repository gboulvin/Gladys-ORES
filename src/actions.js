// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { classifyIncident, INCIDENT_PHASES } from './ores/incidents.js';
import { ml } from './i18n.js';

const logger = createLogger({ name: 'actions' });

export const ACTIONS = {
  // Reach the outage map and tell what it sees for the configured address.
  async test_connection(gladys, { service }) {
    logger.info('Action test_connection');
    try {
      const raw = await service.fetchRaw();
      const now = service.now();
      const total = raw.filter(
        (incident) => classifyIncident(incident, now).phase !== INCIDENT_PHASES.ENDED,
      ).length;
      const snapshot = await service.refresh();
      const commune = snapshot.incidents.filter(
        (incident) => incident.phase === INCIDENT_PHASES.IN_PROGRESS,
      ).length;
      return ml('testOk', { total, commune });
    } catch (err) {
      return ml('testFailed', { error: err.message });
    }
  },
};
