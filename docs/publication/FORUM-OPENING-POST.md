# GeoZones for Homey Pro — reusable geographic zones for your Flows

GeoZones lets you define places once and reuse them across your Homey Flows. Create circles or draw polygons, provide a subject's latitude and longitude, then use the resulting zone, tags, movement state and distances in your automations.

**The app is available through the [Homey App Store test channel](https://homey.app/a/com.roue.geozones/test/).** Version 2.0.5 is being prepared for review with completed English, French, Dutch and German translations, updated documentation and store information. Its zone engine, Flow identifiers and permissions are unchanged from the 2.0.3 test release. A stable release has not been announced.

## How version 2 works

GeoZones uses **manual subject devices**. A subject can represent a person, car, bicycle or another location you want to evaluate. “Manual” describes how the app receives coordinates: a Flow supplies latitude and longitude from a source you choose. That Flow can run automatically.

GeoZones does not obtain an iPhone's position itself and does not automatically select Homey users or connect to another app's devices. You need a working location source that exposes coordinates to your Flows. Your source determines how often positions arrive and whether they are current.

The supported platform is Homey Pro with firmware 12.5.0 or later. Testing so far includes Homey Pro 2023. This package targets the local Homey platform.

## What you can do

- Define circles and polygons, with priorities to control overlapping places.
- Add tags and filter which subjects or subject types a zone applies to.
- Use circle hysteresis and transition delays to adjust zone changes.
- Trigger Flows when a subject changes zone, enters or leaves a place, or moves.
- Check a subject's current zone, tags and movement, and calculate distances.
- Import and export zone configuration and restore configuration history.

Zone evaluation runs on Homey. The settings interface includes its map libraries locally; the background map uses OpenStreetMap tiles. See the privacy guide for what those map requests disclose.

## Getting started

1. Install the app from the test link above.
2. Open the app's Settings and create a zone.
3. Choose **Add device → GeoZones → Manual subject**.
4. Use the subject's Flow action that sets latitude and longitude and evaluates the position. Connect the coordinate tags from your location source.
5. Use that subject's zone-change trigger or a zone/tag condition in another Flow.

The [installation guide](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/INSTALLATION.md) explains the complete setup and source requirements. The embedded Help also provides 15 practical sections and 45 paragraphs in each of the four languages, covering setup, fields, Flows, source age, recovery and troubleshooting. Settings and Help use Homey's language when opened; reopen them after changing that language. The [troubleshooting guide](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/TROUBLESHOOTING.md) covers missing updates and unexpected zone changes.

## Upgrading from an older version

The old automatic linked-subject model and its obsolete Flow cards have been removed. The app no longer requests the broad Homey Web API permission used by that model.

Version 2.0.3 added protected backups and recovery of legacy subjects. Download the backup, recover each subject through **Add device**, then reconnect its coordinate source using the current Flow cards. Affected old Flows require adaptation; their automatic source links are not resumed. Read the [migration guide](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/MIGRATION.md) before upgrading or uninstalling an older installation.

## Position freshness and testing

A subject keeps its last supplied position until another update arrives. Positions do not expire automatically. The subject's `last_update` records the position update supplied to GeoZones and is preserved during a simple recalculation; it does not independently establish the age of your source's GPS measurement. Check your source as well when freshness matters.

The localized 2.0.5 candidate has nine automated test suites, including language completeness, parameter preservation, translated error paths and real help startup in all four languages. Its latest results, draft and package validation are recorded in the publication evidence. Real testing of 2.0.3 on Homey Pro 2023 has confirmed startup, retained configuration, coordinate evaluation and source-driven updates. Testing of the complete legacy migration and all iPhone setup scenarios on hardware is still incomplete.

Feedback is welcome in this topic. Please include the app and Homey firmware versions, the type of coordinate source, the Flow trigger, the expected result and what happened. Remove exact coordinates, account details and private exports before sharing diagnostics.

[Source code and documentation](https://github.com/vincent-roue/com.roue.geozones) · [Privacy guide](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/PRIVACY.md) · [Test channel](https://homey.app/a/com.roue.geozones/test/)

---

Preparation note for the maintainer: this is a complete replacement opening-post draft and has not been posted. Documentation links intentionally use `prepare-publication-2.0.4`. Confirm that branch is accessible before posting. After it is merged, change those links to `main` and verify them. Keep the version/channel paragraph consistent with the actual store state at posting time.
