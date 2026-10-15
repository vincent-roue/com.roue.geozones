# GeoZones 2.0.5 — publication candidate

Version 2.0.5 prepares GeoZones version 2 for review with completed translations, clearer store information and documentation. Build 17 is available in Test and its certification request is under review. These notes do not announce approval or a stable release.

Version 2.0.4 was released to Test. Version 2.0.5 adds the final Flow-title correction required by the Store guidelines; the remaining preparation below is retained.

## Changes in 2.0.5

- Refresh the store description in English, French, Dutch and German.
- Review and complete all four languages in settings, pairing, Flow cards and server messages, including map controls and movement-state choices.
- Correct untranslated distance labels, transition grammar and error messages that previously fell back to English.
- Expand in-app Help to 15 practical sections and 45 paragraphs per language, covering first setup, fields, Flow results, filters, delays, source age, backups, migration and troubleshooting.
- Read Homey's language through the backend before rendering settings and help; normalize regional codes and handle unsupported languages and unavailable metadata.
- Check language completeness, nonempty text, parameter preservation and translated error paths.
- Explain the manual-subject model and the requirement for a separate coordinate source connected through Flows.
- Expand installation, migration, troubleshooting and privacy documentation.
- Clarify position freshness, retained coordinates and the meaning of the last-update field.
- Prepare forum text, reviewer notes and release checks.
- Replace Store artwork with a real demonstration-map capture and provide a distinct manual-subject icon on a 960-pixel canvas.

The zone engine, Flow identifiers, technical values, drivers and permission scope are unchanged from version 2.0.3. Interface text, initial language selection and server error handling have changed to select the translated messages. Reopen settings after changing Homey's language. See the [language audit](LANGUAGE-AUDIT.md) for the reviewed scope and limits.

## Runtime inherited from 2.0.3

- Preserve original legacy configuration and subject data before migration, with verified backups and resumable recovery.
- Recover legacy subjects as manual devices through Add device. Retired cards remain removed; affected Flows must be adapted.
- Correct coordinate validation, concurrent position/configuration writes, movement conditions and transition tag filtering.
- Improve zone editing, malformed polygon handling and delayed evaluation.
- Retain the supplied position timestamp during a simple recalculation.
- Bundle map libraries locally and keep the settings usable when map resources are unavailable.
- Download exports in the browser and clean up files created by the previous public-export mechanism.

## Installation and upgrade

GeoZones targets local Homey Pro devices with firmware 12.5.0 or later. Add a manual subject, then supply latitude and longitude using its position Flow action. GeoZones does not obtain a phone's position itself.

Before upgrading from an old linked-subject version, read the [migration guide](../MIGRATION.md). Download the preserved backup, recover each subject through Add device and reconnect its source using current cards. Uninstalling removes app settings, so retain the download first.

See the [installation guide](../INSTALLATION.md), [troubleshooting](../TROUBLESHOOTING.md) and [privacy guide](../PRIVACY.md).

## Validation and remaining work

The localized 2.0.5 candidate has nine automated suites, covering language completeness, preserved parameters, translated errors, interface interactions and actual help startup in all four languages. Startup checks include regional codes, a conflicting browser language, unsupported-language fallback and unavailable or delayed metadata. Final results, the latest uploaded draft, archive checksum and publication-level package validation are recorded in [validation evidence](VALIDATION.json) and the [release checklist](../RELEASE_CHECKLIST.md).

The 2.0.3 runtime has been observed on Homey Pro 2023 with source-driven position updates. These checks do not constitute complete hardware acceptance: legacy recovery and all iPhone/restart/import/delay scenarios still require confirmation.

Positions remain available until replaced and do not expire automatically. A recent update supplied to GeoZones does not prove the age of the original GPS measurement. Check the source when freshness matters.

The [App Store test page](https://homey.app/a/com.roue.geozones/test/) identifies the currently installable test version. Preparing or uploading this candidate as a draft does not change that version by itself.
