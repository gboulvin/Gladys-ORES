# ORES for Gladys Assistant

This integration watches the **ORES** distribution network (Wallonia, Belgium) for your
address: outages in progress, planned works with a power cut, announced delays. It reads the
public ORES outage map ([Outages and interruptions](https://www.ores.be/pannes-et-interruptions/)).

> **Unofficial** integration, not affiliated with ORES. It uses the unauthenticated web
> service behind the public outage map of ores.be, which ORES may change at any time.

Tag: **cloud** (the integration queries the ORES website, nothing is read locally).

## Configuration

| Field                        | Required | Purpose                                                              |
| ---------------------------- | -------- | -------------------------------------------------------------------- |
| Zip code                     | yes      | The municipality to watch.                                           |
| Locality                     | no       | Only when several localities share the same zip code.                |
| Street                       | no       | To know whether **your** street is hit, not only the municipality.   |
| House number                 | no       | Narrows to your side of the street (ORES publishes odd/even ranges). |
| Planned works horizon (days) | no       | Works announced further ahead are ignored (7 days by default).       |
| Refresh interval (s)         | no       | How often the map is read (300 s by default, 60 s minimum).          |

Without a street, the whole municipality counts as "your address". Street names are compared
without accents, case nor punctuation: "Rue de l'Église" matches "RUE DE L EGLISE".

The **Test the ORES outage map** button checks that the map answers and tells how many
incidents it sees on the network and in your municipality.

## The "ORES network status" device

Once installed, create the device from the **Discover** tab. It exposes four binary sensors
(0/1):

- **Outage at my address**: an unplanned outage hits you;
- **Planned works at my address**: planned works with a power cut are in progress at home;
- **Upcoming planned works at my address**: works are announced within the chosen horizon;
- **Incident in my municipality**: at least one outage or works site is in progress there.

Use them in the standard "device state" scenes and on the dashboard.

## Scene triggers

| Trigger                      | When                                    |
| ---------------------------- | --------------------------------------- |
| ORES outage or works started | an outage or a works site begins        |
| ORES outage or works ended   | an outage or works in progress are over |
| ORES outage or works delayed | ORES announces a later end              |
| ORES planned works announced | new planned works appear on the map     |

Filters: **Type** (outage / planned works) and **Where** (at my address / elsewhere in my
municipality). Variables for the next actions: `{{triggerEvent.data.reference}}`, `city`,
`start_time`, `end_time` (ISO dates, UTC) and `customers` (customers impacted).

The first read after the installation (or an address change) is the baseline: incidents
already running fire nothing. The state is kept under `/data`, so a restart neither replays
nor misses a transition.

## Scene actions

- **Check an address on the ORES network**: any address (second home, relative...). Outputs:
  `outage`, `planned_interruption`, `upcoming_interruption`, `commune_incidents`,
  `reference`, `end_time`, `next_start_time`.
- **Get the ORES network status**: the last known status of your address, no network call,
  same outputs.

## Widget

The **ORES network status** widget shows the live sensors, the status of your address, the
number of incidents in the municipality, the list of outages and works (details on tap) and
a **Refresh** button.

## Gas and electricity consumption

Not available yet. The my.ores.be portal has no public API, and its itsme / eID sign-in
cannot be automated. A next version will add them through the my.ores.be e-mail / password
sign-in, if it allows it.

## Privacy

Only the public incident list is downloaded. Your address never leaves your Gladys: the
matching runs locally.
