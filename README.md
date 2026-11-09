# ORES — Gladys Assistant integration

External integration for [Gladys Assistant](https://gladysassistant.com) that watches the
**ORES** distribution network (Wallonia, Belgium) for your address: outages in progress,
planned works with a power cut, announced delays. Built from the official
[JavaScript template](https://github.com/GladysAssistant/integration-template-js) with
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

> **Unofficial**, not affiliated with ORES. It reads the unauthenticated web service behind
> the public outage map of [ores.be](https://www.ores.be/pannes-et-interruptions/), which is
> undocumented and may change at any time.

- **Transport tag:** `cloud`.
- **Languages:** English, French, German, Spanish (manifest, messages, widget, docs).
- **Gladys:** 5.1.0 or later (scene triggers, scene actions and widgets).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) ·
[Español](docs/es.md).

## Features

| Surface        | What                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Device         | `ORES network status`: outage / planned works / upcoming works at my address, incident in my municipality (binary sensors) |
| Scene triggers | `outage_started`, `outage_ended`, `outage_delayed`, `interruption_scheduled` (filters: type, where)                        |
| Scene actions  | `check_address` (any address), `get_network_status` (last known status of yours)                                           |
| Widget         | `network_status`: live tiles, status rows, incident list, refresh button                                                   |
| Config action  | `test_connection`: reach the outage map and count the incidents                                                            |

Gas and electricity consumption are **not** implemented yet: my.ores.be has no public API
and its itsme / eID sign-in cannot be automated. See [CHANGELOG.md](CHANGELOG.md).

## Project structure

```
index.js                     SDK wiring only (handlers registered before connect())
src/ores/breakdownApi.js     ORES outage map client (public endpoint)
src/ores/incidents.js        pure logic: dates, address matching, classification
src/ores/monitor.js          baseline + transitions -> scene events
src/service.js               refresh loop: states, events, widget nudge, connection status
src/devices/networkStatus.js the device and its binary features
src/scenes.js                scene action handlers
src/widgets.js               dashboard widget
src/actions.js               Configuration screen actions
src/i18n.js                  en / fr / de / es texts
src/storage.js               JSON store under /data (baseline across restarts)
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys
test/                        node --test, against the SDK's fake Gladys, no network
```

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
```

Run against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="ores" \
ORES_DATA_DIR=./.data \
LOG_LEVEL=debug \
npm start
```

## Release

Describe the changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), then
**Actions → Release → Run workflow** (`patch`, `minor` or `major`). The workflow bumps
`package.json` and the manifest, rolls the changelog, tags, builds the multi-arch image to
`ghcr.io/gboulvin/gladys-ores` and publishes the GitHub Release.

## License

Apache-2.0
