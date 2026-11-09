# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for **ORES**, the electricity and gas
distribution network operator of Wallonia (Belgium). A Node.js service (Node 22+, ESM, no
build step) running in its own sandboxed Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. Started from the official JavaScript template.

Today it reports the **network status** (outages, planned works, delays) of the configured
address, from the public ORES outage map. **Consumption** (gas, electricity) is planned
through the my.ores.be portal and not implemented yet: that portal has no public API, the
itsme / eID sign-in cannot be automated (never try to work around it), and the SPA refresh
tokens it issues last 24 h without sliding. Only the e-mail / password sign-in may work.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/incidents.test.js        # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI runs `format:check`, `lint` and `test` on Node 22 and 24, and builds the Docker
image: run the three commands before pushing.

## Architecture

```
index.js                     SDK wiring only: handlers registered before connect()
src/ores/breakdownApi.js     GET https://ores-breakdownmapapi-prd.azurewebsites.net/breakdown
src/ores/incidents.js        PURE: date parsing, name/house-number matching, classification
src/ores/monitor.js          baseline + diff -> scene events; summary of a snapshot
src/service.js               refresh timer, states, events, widget nudge, connection status
src/devices/networkStatus.js device + 4 binary features (energy-sensor / binary)
src/scenes.js                scene actions (read-only)
src/widgets.js               dashboard widget
src/actions.js               Configuration screen actions
src/i18n.js                  every user-facing text, en / fr / de / es
src/storage.js               JSON store under /data
```

### The outage map endpoint

Undocumented, unauthenticated, ~1 MB JSON array. Each incident: `id`, `businessId`
(reference), `status` (`active` | `resolved` | `cancelled`), `failure` (unplanned:
`plannedEndDateTime`) **or** `interruption` (planned: `plannedFrom`, `plannedTo`),
`isDelayed`, `endDateTime`, `originalEndDate`, `lastUpdatedDateTime`,
`impactedCustomerCount`, `impactedCities[]` (`cityName`, `zipCode`, `streets[]` with
`streetNumberRanges[]` `{ from, to, rangeType: odd|even }`). Some dates have no offset: they
are UTC. Incidents stay `active` long after their end: `classifyIncident` treats them as
ended unless delayed and recently updated. Read every field defensively. Cache the raw map
(one minute) and never poll faster than once a minute.

## Rules

- **External ids are forever.** Device `network-status` / platform id `address`, its
  feature keys, the manifest `config_schema` / `actions` / `scene_triggers` /
  `scene_actions` / `widgets` keys and the scene event data keys: never rename them.
- **Scene events**: one per transition (`diffIncidents`), never on the seed read, flat
  primitive data limited to the keys the trigger declares (`fields` + `variables`). Scene
  actions never publish states nor events (loop risk).
- **The container rootfs is read-only.** Write only under `/data` (`ORES_DATA_DIR`). Never
  log tokens, passwords, cookies or the user's address.
- **Versions belong to the Release workflow** (Actions → Release). Never edit `version` in
  `package.json` or the manifest, nor the `docker_image` tag, by hand.
  `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a
  version heading.
- **Four languages.** Every user-facing text exists in English, French, German and Spanish:
  manifest texts (`{ en, fr, de, es }` objects, never plain strings), `src/i18n.js`
  messages, `docs/{en,fr,de,es}.md`. `test/i18n.test.js` enforces it. The catalog
  `description` holds 10 to 100 characters per language.
- **Transport tag** is `cloud` (manifest `transports`). Add `local` only with a real local
  channel.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in English.
  Tests never touch the network: inject `fetchBreakdowns` / `fetchImpl` and a clock.
