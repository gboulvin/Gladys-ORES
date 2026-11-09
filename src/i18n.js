// -----------------------------------------------------------------------------
// User-facing texts, in the four languages of the integration (English,
// French, German, Spanish). English is mandatory everywhere and the fallback
// of the core for any other language.
//
//   - ml(key, vars)        -> multi-language object { en, fr, de, es }, for
//                             the texts Gladys localizes itself (action
//                             messages, connection status, toasts);
//   - tr(language, key, vars) -> one string, for the widget contents built for
//                             the language of the viewing user.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const LOCALES = { en: 'en-GB', fr: 'fr-BE', de: 'de-BE', es: 'es-ES' };
const TIME_ZONE = 'Europe/Brussels';

const MESSAGES = {
  noAddress: {
    en: 'Enter your zip code in the configuration.',
    fr: 'Indiquez votre code postal dans la configuration.',
    de: 'Geben Sie Ihre Postleitzahl in der Konfiguration ein.',
    es: 'Indique su código postal en la configuración.',
  },
  mapUnreachable: {
    en: 'ORES outage map unreachable, retrying at the next refresh.',
    fr: 'Carte des pannes ORES injoignable, nouvel essai au prochain rafraîchissement.',
    de: 'ORES-Störungskarte nicht erreichbar, neuer Versuch bei der nächsten Aktualisierung.',
    es: 'Mapa de averías de ORES inaccesible, nuevo intento en la próxima actualización.',
  },
  testOk: {
    en: 'ORES outage map reached: {total} incidents on the network, {commune} in your municipality.',
    fr: 'Carte des pannes ORES joignable : {total} incidents sur le réseau, {commune} dans votre commune.',
    de: 'ORES-Störungskarte erreichbar: {total} Vorfälle im Netz, {commune} in Ihrer Gemeinde.',
    es: 'Mapa de averías de ORES accesible: {total} incidencias en la red, {commune} en su municipio.',
  },
  testFailed: {
    en: 'ORES outage map unreachable: {error}',
    fr: 'Carte des pannes ORES injoignable : {error}',
    de: 'ORES-Störungskarte nicht erreichbar: {error}',
    es: 'Mapa de averías de ORES inaccesible: {error}',
  },
  refreshed: {
    en: 'Network status refreshed.',
    fr: 'Statut du réseau actualisé.',
    de: 'Netzstatus aktualisiert.',
    es: 'Estado de la red actualizado.',
  },
  refreshFailed: {
    en: 'Refresh failed, the ORES outage map is unreachable.',
    fr: "Échec de l'actualisation, la carte des pannes ORES est injoignable.",
    de: 'Aktualisierung fehlgeschlagen, die ORES-Störungskarte ist nicht erreichbar.',
    es: 'Error al actualizar, el mapa de averías de ORES es inaccesible.',
  },
  // Widget texts.
  myAddress: { en: 'My address', fr: 'Mon adresse', de: 'Meine Adresse', es: 'Mi dirección' },
  municipality: { en: 'Municipality', fr: 'Commune', de: 'Gemeinde', es: 'Municipio' },
  lastUpdate: {
    en: 'Last update',
    fr: 'Dernière mise à jour',
    de: 'Letzte Aktualisierung',
    es: 'Última actualización',
  },
  statusOk: { en: 'No incident', fr: 'Aucun incident', de: 'Keine Störung', es: 'Sin incidencias' },
  statusOutage: {
    en: 'Outage in progress',
    fr: 'Panne en cours',
    de: 'Störung im Gange',
    es: 'Avería en curso',
  },
  statusPlanned: {
    en: 'Planned works in progress',
    fr: 'Travaux en cours',
    de: 'Geplante Arbeiten im Gange',
    es: 'Trabajos en curso',
  },
  statusUpcoming: {
    en: 'Works on {date}',
    fr: 'Travaux le {date}',
    de: 'Arbeiten am {date}',
    es: 'Trabajos el {date}',
  },
  inProgressCount: {
    en: '{count} in progress',
    fr: '{count} en cours',
    de: '{count} im Gange',
    es: '{count} en curso',
  },
  never: { en: 'Never', fr: 'Jamais', de: 'Nie', es: 'Nunca' },
  unreachable: { en: 'Unreachable', fr: 'Injoignable', de: 'Nicht erreichbar', es: 'Inaccesible' },
  notConfigured: {
    en: 'Not configured',
    fr: 'Non configurée',
    de: 'Nicht konfiguriert',
    es: 'Sin configurar',
  },
  kindOutage: { en: 'Outage', fr: 'Panne', de: 'Störung', es: 'Avería' },
  kindPlanned: { en: 'Planned works', fr: 'Travaux', de: 'Arbeiten', es: 'Trabajos' },
  badgeInProgress: { en: 'In progress', fr: 'En cours', de: 'Im Gange', es: 'En curso' },
  badgeUpcoming: { en: 'Upcoming', fr: 'À venir', de: 'Geplant', es: 'Previsto' },
  badgeDelayed: { en: 'Delayed', fr: 'En retard', de: 'Verspätet', es: 'Retrasado' },
  atMyAddress: {
    en: 'At my address',
    fr: 'À mon adresse',
    de: 'An meiner Adresse',
    es: 'En mi dirección',
  },
  incidentDescription: {
    en: 'Reference {reference}. From {start} to {end}. {customers} customers impacted.',
    fr: 'Référence {reference}. Du {start} au {end}. {customers} clients impactés.',
    de: 'Referenz {reference}. Von {start} bis {end}. {customers} betroffene Kunden.',
    es: 'Referencia {reference}. Del {start} al {end}. {customers} clientes afectados.',
  },
  unknownDate: { en: 'unknown', fr: 'inconnu', de: 'unbekannt', es: 'desconocido' },
  noIncidentText: {
    en: 'No outage nor planned works in your municipality.',
    fr: 'Aucune panne ni aucuns travaux planifiés dans votre commune.',
    de: 'Keine Störung und keine geplanten Arbeiten in Ihrer Gemeinde.',
    es: 'Ninguna avería ni trabajos previstos en su municipio.',
  },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  outageMap: {
    en: 'ORES outage map',
    fr: 'Carte des pannes ORES',
    de: 'ORES-Störungskarte',
    es: 'Mapa de averías ORES',
  },
};

function interpolate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined ? match : String(vars[name]),
  );
}

export function hasMessage(key) {
  return Object.hasOwn(MESSAGES, key);
}

/** Multi-language object of a message. */
export function ml(key, vars = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message: ${key}`);
  }
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, interpolate(message[lang], vars)]));
}

/** Pick a supported language, English otherwise. */
export function resolveLanguage(language) {
  const short = String(language ?? '')
    .slice(0, 2)
    .toLowerCase();
  return LANGUAGES.includes(short) ? short : 'en';
}

/** One message in one language. */
export function tr(language, key, vars = {}) {
  return ml(key, vars)[resolveLanguage(language)];
}

/** A date in the language of the user, Belgian time. */
export function formatDate(date, language) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return tr(language, 'unknownDate');
  }
  return new Intl.DateTimeFormat(LOCALES[resolveLanguage(language)], {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const MESSAGE_KEYS = Object.keys(MESSAGES);
export { MESSAGES };
