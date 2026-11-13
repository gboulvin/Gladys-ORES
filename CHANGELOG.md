# Changelog

All notable changes to this integration are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release workflow moves that
section under the version it ships, and the section becomes the notes of the version's
GitHub Release.

## [Unreleased]

## [0.1.0] - 2026-11-13

### Added

- ORES network status of your address, read from the public ORES outage map: outage in
  progress, planned works in progress, upcoming planned works, incident in the municipality
  (binary sensors of the "ORES network status" device).
- Address matching by zip code, locality, street and house number (odd/even ranges of ORES),
  insensitive to accents, case and punctuation.
- Scene triggers: outage or works started, ended, delayed, and planned works announced,
  filtered by type (outage / planned works) and place (my address / my municipality), with
  the reference, locality, start, end and customers impacted as variables.
- Scene actions: check any address on the ORES network, get the last known status of yours.
- "ORES network status" dashboard widget: live sensors, status of the address and the
  municipality, list of outages and works, refresh button.
- "Test the ORES outage map" action in the Configuration screen.
- English, French, German and Spanish texts and documentation.
- The network status baseline is kept under `/data`: a restart neither replays nor misses
  a transition.

[Unreleased]: https://github.com/gboulvin/Gladys-ORES/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gboulvin/Gladys-ORES/releases/tag/v0.1.0
