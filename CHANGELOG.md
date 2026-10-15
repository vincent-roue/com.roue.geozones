# Changelog

## 2.0.4 — publication candidate

- Keep the runtime and Flow behavior of the tested 2.0.3 release.
- Clarify that external sources and Flows provide coordinates to manual subject devices.
- Explain source freshness, position reception times and the absence of automatic position expiry.
- Add installation, migration, privacy and troubleshooting guides, plus publication drafts.
- Synchronize the public repository with the tested manual-subject implementation; remove checked-in dependencies and obsolete development files.

## 2.0.3 — test channel

- Preserve raw legacy configuration, subject state and source references before migration.
- Recover legacy subjects through manual-device pairing without broad Homey Web API access.
- Keep obsolete Flow cards removed. Rebuild affected Flows with the current cards.
- Fix input editing, invalid polygons, coordinate validation, simultaneous writes and Flow filters.
- Resume delayed zone evaluation without treating a recalculation as a new position sample.
- Bundle mapping libraries locally; tolerate unavailable map libraries or tiles.
- Export directly in the browser and remove previous public export files at startup.
- Add migration, runtime, Flow, UI and API regression tests.

## 2.0.2

- Remove linked subjects and the homey:manager:api permission.
