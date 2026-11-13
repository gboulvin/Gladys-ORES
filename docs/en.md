# ORES for Gladys Assistant

This integration watches the **ORES** distribution network (Wallonia, Belgium) at your home
and, optionally, at a second address: outages in progress, planned works with a power cut,
announced delays. It reads the public ORES outage map
([Outages and interruptions](https://www.ores.be/pannes-et-interruptions/)).

> **Unofficial** integration, not affiliated with ORES. It uses the unauthenticated web service
> behind the public outage map of ores.be, which ORES may change at any time.

Tag: **cloud** (the integration queries the ORES website, nothing is read locally).

## Configuration

### Home

By default, the home is **your Gladys house** (Settings → Houses, with its position on the
map). The integration asks Gladys for the location of the houses (an authorization shown at
install time). Gladys only gives GPS coordinates, so the integration turns them **once** into
a postal address through
[OpenStreetMap Nominatim](https://operations.osmfoundation.org/policies/nominatim/), then
caches the result under `/data`. The coordinates are sent nowhere else, never to ORES.

| Field        | Purpose                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| Home address | "Gladys house location" (default) or "Address typed below".                    |
| Gladys house | Name of the house to watch when Gladys has several (empty: the first located). |

The **Test the ORES outage map** button shows the address found: check it. When it is wrong
(imprecise position, house at a street corner...), choose "Address typed below" and fill in
the fields.

Coming from version 0.1? As long as you do not save the configuration, the address you typed
keeps being used.

### Address typed by hand

| Field        | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| Zip code     | Required in manual mode: the municipality to watch.                  |
| Locality     | Only when several localities share the same zip code.                |
| Street       | To know whether **your** street is hit, not only the municipality.   |
| House number | Narrows to your side of the street (ORES publishes odd/even ranges). |

Without a street, the whole municipality counts as "your address". Street names are compared
without accents, case nor punctuation: "Rue de l'Église" matches "RUE DE L EGLISE".

### Second address (optional)

Another address to watch: second home, relatives, workplace... Give it a **name** (e.g.
"Parents") and fill in at least its zip code. It gets its own device, and the scene triggers,
the scene action and the widget can target it. Empty the zip code to disable it.

### Other settings

- **Planned works horizon (days)**: works announced further ahead are ignored (7 by default).
- **Refresh interval (s)**: how often the map is read (300 s by default, 60 s minimum).

## The "ORES network status" devices

Create them from the **Discover** tab: one for the home, one for the second address. Each
exposes four binary sensors (0/1):

- **Outage at my address**: an unplanned outage hits the address;
- **Planned works at my address**: planned works with a power cut are in progress there;
- **Upcoming planned works at my address**: works are announced within the chosen horizon;
- **Incident in my municipality**: at least one outage or works site is in progress there.

## Scene triggers

| Trigger                      | When                                    |
| ---------------------------- | --------------------------------------- |
| ORES outage or works started | an outage or a works site begins        |
| ORES outage or works ended   | an outage or works in progress are over |
| ORES outage or works delayed | ORES announces a later end              |
| ORES planned works announced | new planned works appear on the map     |

Filters: **Address** (home / second address), **Type** (outage / planned works) and **Where**
(at the address / elsewhere in the municipality). Variables for the next actions:
`{{triggerEvent.data.reference}}`, `city`, `start_time`, `end_time` (ISO dates, UTC) and
`customers` (customers impacted).

The first read after the installation (or an address change) is the baseline: incidents
already running fire nothing. The state is kept under `/data`, so a restart neither replays nor
misses a transition.

## Scene actions

- **Check an address on the ORES network**: any address, typed in the scene. Outputs:
  `outage`, `planned_interruption`, `upcoming_interruption`, `commune_incidents`, `reference`,
  `end_time`, `next_start_time`.
- **Get the ORES network status**: the last known status of the home or of the second address
  (**Address** field), no network call, same outputs.

## Widget

The **ORES network status** widget shows the live sensors, the status of the address, the
number of incidents in the municipality, the list of outages and works (details on tap) and a
**Refresh** button. Its **Address** setting picks the home or the second address: add two
widgets to see both.

## Gas and electricity consumption

Not available yet. The my.ores.be portal has no public API, and its itsme / eID sign-in cannot
be automated. A next version will add them through the my.ores.be e-mail / password sign-in,
if it allows it.

## Privacy

- Only the public incident list is downloaded from ORES. Your addresses never leave your
  Gladys: the matching runs locally.
- In "Gladys house" mode, the coordinates of the house are sent once to OpenStreetMap
  Nominatim (then each time the house moves). Type your address by hand to avoid it.
- The addresses are never written to the logs.
