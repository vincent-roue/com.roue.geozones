# GeoZones 2.0.5 — notes prepared for Athom review

GeoZones 2.0.5 build 17 was released to Test and submitted to Athom certification on 15 October 2026. The portal confirms that the app is under review. Automatic publication after approval is enabled; approval and Live availability are still pending.

## Product and platform

GeoZones defines reusable geographic zones for Homey Flows. It evaluates coordinates supplied by a user's own Flows and exposes zone, tag, movement and distance results. The package uses SDK 3, targets the local Homey platform and declares firmware compatibility `>=12.5.0`. Hardware observations so far were made on Homey Pro 2023.

The current model consists of manual subject devices. GeoZones does not fetch phone positions, authenticate to a phone account or automatically attach to another app's devices. A separate coordinate source and user-configured Flow are required. The [installation guide](../INSTALLATION.md) explains that distinction and the setup.

Version 2.0.4 was released to Test. Version 2.0.5 adds the final Flow-title correction required by the Store guidelines; the remaining preparation below is retained.

## Changes in 2.0.5

Version 2.0.5 changes release metadata, store text, presentation assets and documentation, and completes English, French, Dutch and German text across settings, pairing, Flow cards and server messages. Interface and server error paths now select the translated messages, and map controls and movement choices use the selected language. The zone engine, Flow identifiers, technical values, drivers and permissions are unchanged from the 2.0.3 test release. The [release notes](RELEASE-NOTES.md) distinguish this work from the engine and recovery fixes introduced in 2.0.3; the [language audit](LANGUAGE-AUDIT.md) records coverage and review limits.

In-app Help now contains 15 sections and 45 paragraphs per language, from first setup through Flow semantics, source freshness, backups, migration and troubleshooting. Its instructions were checked against the implemented behavior and repository guides. Settings obtain Homey's language through backend metadata before rendering; compatibility helpers and then browser language are fallbacks when Homey's language cannot be determined. Unsupported Homey languages use English. The view must be reopened after changing Homey's language.

## Permission rationale

The only requested permission is `homey:manager:geolocation`.

The app reads Homey's configured latitude and longitude through the SDK geolocation manager to calculate a subject's **distance to Homey**. The calculation is implemented by `computeDistanceToHomeyText` in [lib/subject-device.js](../../lib/subject-device.js). It uses the subject's supplied coordinates and Homey's configured location, then exposes a formatted distance on the subject device. The function returns an empty distance if usable Homey coordinates are unavailable.

This permission is used for the Homey reference location. It does not provide or request a phone's position.

The broad `homey:manager:api` permission was removed with automatic linked subjects in version 2.0.2 and has not been restored. The current manifest contains only the `subject_manual` driver. Retired linked-subject Flow cards remain removed.

## Migration and compatibility

Version 2.0.3 introduced verified raw backups before legacy conversion, recovery records and resumable recovery through normal device pairing. Tests cover the legacy formats found in the project, including schema versions 4, 20 and 23, plus current schema 25 repair cases.

Original subject data and source references are preserved for recovery. The app does not recreate retired cards or resume old automatic source links. Users recover each subject through Add device and connect their source to the current position action. The [migration guide](../MIGRATION.md) explains the required manual steps and the need to download a backup before uninstalling.

Migration tests cover interrupted writes, backup verification failure, retry, repeated startup, concurrent recovery/import, duplicate identifiers and colliding legacy names. These tests use simulated Homey settings and devices. A complete legacy-to-current recovery on physical hardware remains to be confirmed.

## Validation evidence and its limits

The 2.0.3 base passed eight automated suites:

1. Existing unit tests.
2. Locale consistency.
3. API concurrency, migration status and private exports.
4. Subject engine regressions.
5. Flow behavior and coordinate validation.
6. Legacy migration and recovery.
7. Configuration storage.
8. Settings interaction, map fallback, downloads and translations.

The localized 2.0.5 candidate adds a ninth suite for actual settings/help startup. It checks all four languages, regional codes, a different browser language, unsupported-language fallback and missing or delayed metadata. The existing suites also cover language completeness, nonempty strings, preserved parameters and real translated error paths. Final results, the latest draft identifier, publication-level package validation and archive checksum are recorded with the package actually uploaded; see [validation evidence](VALIDATION.json) and the [release checklist](../RELEASE_CHECKLIST.md).

Physical Homey Pro 2023 observations of 2.0.3 confirmed startup, preserved configuration, coordinate evaluation and source-driven updates. This is partial hardware acceptance. It does not establish exhaustive iPhone source behavior, full legacy migration on hardware, or every restart/import/delay scenario.

The application has not been proven equivalent to a separate legacy HomeyScript. That comparison uses different zone configuration and Flow wiring, so it is not used as proof of complete runtime correctness.

## Privacy and operational semantics

Zone evaluation runs locally. Zone configuration, subject state and recovery backups are stored in Homey app/device storage. No analytics service is configured. Exports are generated for browser download rather than left in publicly served app storage.

Leaflet and Leaflet.draw are bundled with their licenses. The settings map requests OpenStreetMap tiles, which disclose the requesting IP and the area viewed to the tile provider. Other settings and zone evaluation remain usable without those tiles. See [privacy documentation](../PRIVACY.md).

Positions do not automatically expire. The subject's last-update field records a position update supplied to GeoZones and is retained during a recalculation. The Flow action does not establish the age of the upstream GPS reading; the documentation asks users to check their source when freshness matters. A device without its first valid position remains unknown.

## Review preparation boundary

Build 17 is in certification after its Test release. The review retains the partial hardware-test limitations above. The portal remains the authoritative source for approval and Live publication.
