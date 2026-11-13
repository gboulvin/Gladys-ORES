// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): the ORES network status
// of the configured address.
//
// - live tiles bound to the device features (they follow the published states);
// - a status list: my address, my municipality, last update;
// - the incidents of the municipality as a card list (detail panel on tap);
// - a "Refresh" button reading the outage map now.
//
// The content is built in the language of the viewing user (`language`).
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { networkStatus, FEATURE } from './devices/networkStatus.js';
import { INCIDENT_KINDS, INCIDENT_PHASES } from './ores/incidents.js';
import { formatDate, ml, tr } from './i18n.js';
import { hasSecondary, SLOTS } from './addresses.js';
import { slotName } from './actions.js';

const logger = createLogger({ name: 'widgets' });

export const NETWORK_STATUS_WIDGET = 'network_status';

const WIDGET_ACTIONS = { REFRESH: 'refresh' };

const MAX_CARDS = 8;

const OUTAGE_MAP_URL = 'https://www.ores.be/pannes-et-interruptions/';

function addressStatus(summary, language) {
  if (summary.outage) {
    return { value: tr(language, 'statusOutage'), color: WIDGET_COLORS.DANGER };
  }
  if (summary.plannedInProgress) {
    return { value: tr(language, 'statusPlanned'), color: WIDGET_COLORS.WARNING };
  }
  if (summary.nextAtAddress) {
    return {
      value: tr(language, 'statusUpcoming', {
        date: formatDate(summary.nextAtAddress.startsAt, language),
      }),
      color: WIDGET_COLORS.INFO,
    };
  }
  return { value: tr(language, 'statusOk'), color: WIDGET_COLORS.SUCCESS };
}

function incidentCard(incident, language) {
  const running = incident.phase === INCIDENT_PHASES.IN_PROGRESS;
  let badge;
  if (running && incident.delayed) {
    badge = { text: tr(language, 'badgeDelayed'), color: WIDGET_COLORS.DANGER };
  } else if (running) {
    badge = { text: tr(language, 'badgeInProgress'), color: WIDGET_COLORS.WARNING };
  } else {
    badge = { text: tr(language, 'badgeUpcoming'), color: WIDGET_COLORS.INFO };
  }
  const kind = tr(language, incident.kind === INCIDENT_KINDS.OUTAGE ? 'kindOutage' : 'kindPlanned');
  const where = incident.scope === 'address' ? tr(language, 'atMyAddress') : incident.city;
  const card = {
    title: `${kind} · ${where}`.slice(0, 60),
    subtitle: `${formatDate(incident.startsAt, language)} → ${formatDate(incident.endsAt, language)}`,
    badge,
    description: tr(language, 'incidentDescription', {
      reference: incident.reference,
      start: formatDate(incident.startsAt, language),
      end: formatDate(incident.endsAt, language),
      customers: incident.customers,
    }),
    links: [{ url: OUTAGE_MAP_URL, label: tr(language, 'outageMap') }],
  };
  if (incident.startsAt) {
    card.date = incident.startsAt.toISOString();
  }
  return card;
}

/** Content of the widget, from a monitor snapshot. */
export function buildNetworkStatusContent(
  gladys,
  { snapshot, language, configured, slot = SLOTS.PRIMARY, name },
) {
  const { summary, incidents } = snapshot;
  const tiles = [
    [FEATURE.OUTAGE, 'statusOutage', 'zap-off'],
    [FEATURE.COMMUNE_INCIDENT, 'municipality', 'map-pin'],
  ].map(([feature, label, icon]) => ({
    type: 'value',
    label: tr(language, label).slice(0, 24),
    icon,
    device_feature: networkStatus.featureExternalId(gladys, feature, slot),
  }));

  let address;
  if (!configured) {
    address = { value: tr(language, 'notConfigured'), color: WIDGET_COLORS.NEUTRAL };
  } else if (snapshot.error) {
    address = { value: tr(language, 'unreachable'), color: WIDGET_COLORS.WARNING };
  } else {
    address = addressStatus(summary, language);
  }

  const components = [
    ...tiles,
    incidents.length > 0
      ? {
          type: 'card-list',
          display: 'list',
          items: incidents.slice(0, MAX_CARDS).map((incident) => incidentCard(incident, language)),
        }
      : { type: 'text', variant: 'caption', text: tr(language, 'noIncidentText').slice(0, 80) },
    {
      type: 'status',
      items: [
        { label: (name ?? tr(language, 'myAddress')).slice(0, 40), icon: 'home', ...address },
        {
          label: tr(language, 'municipality'),
          icon: 'map',
          value: tr(language, 'inProgressCount', { count: summary.communeInProgress }),
          color: summary.communeInProgress > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
        },
        {
          label: tr(language, 'lastUpdate'),
          icon: 'clock',
          value: snapshot.fetchedAt
            ? formatDate(new Date(snapshot.fetchedAt), language)
            : tr(language, 'never'),
          color: WIDGET_COLORS.NEUTRAL,
        },
      ],
    },
    {
      type: 'button',
      label: tr(language, 'refresh'),
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.REFRESH },
    },
  ];
  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [NETWORK_STATUS_WIDGET]: {
    // `settings.address`: which address this widget instance shows.
    async get(gladys, { settings, language, config, service }) {
      const slot =
        settings?.address === SLOTS.SECONDARY && hasSecondary(config)
          ? SLOTS.SECONDARY
          : SLOTS.PRIMARY;
      logger.debug(`onWidgetGet <- ${NETWORK_STATUS_WIDGET} (${slot})`);
      const { error } = service.getAddress(slot);
      return buildNetworkStatusContent(gladys, {
        snapshot: service.getSnapshot(slot),
        language,
        configured: !['no_address', 'no_house', 'geocoding'].includes(error),
        slot,
        name: slotName(language, slot, config),
      });
    },

    // The toast is a multi-language object: Gladys picks the user language.
    async action(gladys, { actionKey, service }) {
      logger.info(`onWidgetAction <- ${NETWORK_STATUS_WIDGET}.${actionKey}`);
      if (actionKey === WIDGET_ACTIONS.REFRESH) {
        const snapshot = await service.refresh();
        return ml(snapshot.error ? 'refreshFailed' : 'refreshed');
      }
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },
};

/** Ask the core to re-pull every widget now (rate-limited core-side). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
