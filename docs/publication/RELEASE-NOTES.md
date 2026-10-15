# GeoZones 2.0.4 — publication candidate

Version 2.0.4 prepares the existing GeoZones version 2 runtime for review with clearer store information and documentation. It is a candidate; these notes do not announce certification or a stable release.

## Changes in 2.0.4

- Refresh the store description in English, French, Dutch and German.
- Explain the manual-subject model and the requirement for a separate coordinate source connected through Flows.
- Expand installation, migration, troubleshooting and privacy documentation.
- Clarify position freshness, retained coordinates and the meaning of the last-update field.
- Prepare forum text, reviewer notes and release checks.
- Replace Store artwork with a real demonstration-map capture and provide a distinct manual-subject icon on a 960-pixel canvas.

**The application runtime is unchanged from version 2.0.3.** This candidate introduces no new runtime fixes, drivers or permissions.

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

The 2.0.4 candidate passed eight automated suites and Homey's publication-level package validation. Its 70 application logic and interface source files match the tested 2.0.3 baseline. The candidate is uploaded as Draft build 14; see [validation evidence](VALIDATION.json) and the [release checklist](../RELEASE_CHECKLIST.md).

The 2.0.3 runtime has been observed on Homey Pro 2023 with source-driven position updates. These checks do not constitute complete hardware acceptance: legacy recovery and all iPhone/restart/import/delay scenarios still require confirmation.

Positions remain available until replaced and do not expire automatically. A recent update supplied to GeoZones does not prove the age of the original GPS measurement. Check the source when freshness matters.

The [App Store test page](https://homey.app/a/com.roue.geozones/test/) identifies the currently installable test version. Preparing or uploading this candidate as a draft does not change that version by itself.
