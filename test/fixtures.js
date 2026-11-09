// Synthetic ORES outage map incidents, shaped like the real endpoint answers
// (fields, date formats with and without offset, odd/even ranges). Built
// relative to a fixed instant so the tests never depend on the clock.

export const NOW = new Date('2026-11-09T12:00:00Z');

const hours = (h) => new Date(NOW.getTime() + h * 3600 * 1000).toISOString();
// Some ORES dates carry no offset (UTC): reproduce it.
const noOffset = (iso) => iso.replace('Z', '').replace(/\.\d+$/, '.1234567');

export const ADDRESS = {
  zip_code: '5000',
  city: '',
  street: "Rue de l'Église",
  house_number: '12',
};

export function outageAtAddress(overrides = {}) {
  return {
    id: 'aaaa-1',
    businessId: 'P091126001',
    status: 'active',
    coordinates: { latitude: 50.46, longitude: 4.86 },
    creationAt: noOffset(hours(-1)),
    closeAt: null,
    isDelayed: false,
    endDateTime: null,
    originalEndDate: hours(2).replace('Z', '+00:00'),
    lastUpdatedDateTime: hours(-0.5).replace('Z', '+00:00'),
    generator: null,
    impactedCustomerCount: 42,
    failure: { isExceptionalSituation: false, plannedEndDateTime: hours(2).replace('Z', '+00:00') },
    interruption: null,
    impactedCities: [
      {
        cityName: 'NAMUR',
        zipCode: '5000',
        streets: [
          {
            streetName: 'RUE DE L EGLISE',
            streetNumberRanges: [
              { from: '2', to: '20/A', rangeType: 'even' },
              { from: '1', to: '5', rangeType: 'odd' },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

export function plannedInCommune(overrides = {}) {
  return {
    id: 'bbbb-2',
    businessId: 'C101126002',
    status: 'active',
    coordinates: { latitude: 50.47, longitude: 4.87 },
    creationAt: noOffset(hours(-72)),
    closeAt: null,
    isDelayed: false,
    endDateTime: null,
    originalEndDate: hours(28).replace('Z', '+00:00'),
    lastUpdatedDateTime: hours(-24).replace('Z', '+00:00'),
    generator: null,
    impactedCustomerCount: 12,
    failure: null,
    interruption: {
      plannedFrom: hours(24).replace('Z', '+00:00'),
      plannedTo: hours(28).replace('Z', '+00:00'),
      interventions: [],
    },
    impactedCities: [
      {
        cityName: 'NAMUR',
        zipCode: '5000',
        streets: [
          {
            streetName: 'AVENUE DE LA GARE',
            streetNumberRanges: [{ from: '1', to: '9', rangeType: 'odd' }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

export function elsewhere(overrides = {}) {
  return outageAtAddress({
    id: 'cccc-3',
    businessId: 'P091126003',
    impactedCities: [{ cityName: 'LIEGE', zipCode: '4000', streets: [] }],
    ...overrides,
  });
}

/** A fetch answering the given JSON body. */
export function fakeFetch(body, { status = 200 } = {}) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}
