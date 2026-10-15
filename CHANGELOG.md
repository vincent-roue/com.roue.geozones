# Changelog

## 2.0.4 — publication candidate

- Keep the zone engine, Flow identifiers and permission scope of the tested 2.0.3 release.
- Complete and review English, French, Dutch and German text in settings, pairing, Flow cards and server errors; translate map controls and movement choices without changing their identifiers.
- Expand in-app Help to 15 practical sections and 45 paragraphs in each language, checked against app behavior and the setup, migration and troubleshooting guides.
- Read Homey's backend language before rendering settings and help, with regional-code normalization and explicit compatibility/unsupported-language fallbacks.
- Add checks for language completeness, nonempty text, preserved parameters and translated error paths.
- Add a ninth test suite covering real settings/help startup, conflicting browser languages and missing or delayed language metadata.
- Clarify that external sources and Flows provide coordinates to manual subject devices.
- Explain source freshness, position reception times and the absence of automatic position expiry.
- Add installation, migration, privacy and troubleshooting guides, plus publication drafts.
- Refresh Store images and provide a distinct manual-subject icon.
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
