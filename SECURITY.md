# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the ORES websites and services the integration talks to (report those to
ORES directly).

## What the integration handles

- It downloads the public ORES outage map, without any account or credential.
- The addresses you configure stay in your Gladys: the matching runs locally and
  they are never sent to ORES nor written to the logs.
- In "Gladys house" mode, the integration reads the house coordinates (manifest
  `location: true`) and sends them once to OpenStreetMap Nominatim to find the
  postal address; the result is cached under `/data`. A leak of these
  coordinates or of the address anywhere else is a vulnerability.
- Its only writable location is `/data`, where it keeps the last known network
  status.

A future version reading your consumption from my.ores.be would store your ORES
credentials in the Gladys configuration: they must never appear in the logs, in
an error message or in an issue. Treat any such leak as a vulnerability.
