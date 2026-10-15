# GeoZones

Create reusable geographic zones and use them in Homey Flows. Draw circles or polygons, group places with tags, and evaluate a person, vehicle or other subject through a GeoZones **Manual subject** device.

GeoZones needs latitude and longitude from a source you already use. Your Flow sends those coordinates to the subject device; GeoZones calculates the zone, transitions, movement and distances. It does not locate phones, read Homey users' GPS positions, or include a native Find My or Home Assistant integration. “Manual” describes how coordinates enter the device: your Flow can supply them automatically.

## Compatibility and installation

The supported target is **Homey Pro (Early 2023), firmware 12.5.0 or later**. This app uses the local platform and does not support Homey Cloud.

- [Homey App Store](https://homey.app/a/com.roue.geozones/)
- [Test channel](https://homey.app/a/com.roue.geozones/test/) — check the displayed version and channel before installing.
- [Installation and first Flow](docs/INSTALLATION.md) · [Guide en français](docs/INSTALLATION.fr.md)

For a first setup, create a zone in GeoZones settings, add a Manual subject in Homey's Devices page, then connect your location source to **Set position to [latitude], [longitude] and evaluate**. Use that device's **Changed zone** trigger to react to the result.

## What you can build

- Circle and polygon zones, priorities, tags, and subject/name/type filters.
- Entry and exit delays, circle hysteresis, and a movement threshold per subject.
- Device and app Flow cards for zone changes, entry/exit transitions, coordinate evaluation and straight-line distances.
- Configuration import/export, configuration history, and recovery of legacy subjects as manual devices.

When zones overlap, the highest priority wins; equal priorities select the smallest area. A subject has one current winning zone. Positions do not expire automatically. **Last update** records receipt of a position update by GeoZones, not the time the phone obtained a GPS fix; a source can send an old fix again. Check freshness at the source and in your Flows when it matters.

## Upgrading and support

**Version 2 changes the subject and Flow model.** Older automatic source links and many v1 cards have been removed. Read the [migration guide](docs/MIGRATION.md) before updating an existing installation, then rebuild affected Flows and reconnect coordinate updates.

See [troubleshooting](docs/TROUBLESHOOTING.md), [privacy and backups](docs/PRIVACY.md), and the [changelog](CHANGELOG.md). For help, use the [Homey Community topic](https://community.homey.app/t/app-pro-geozones/153017) or [GitHub issues](https://github.com/vincent-roue/com.roue.geozones/issues). Include the app version, Homey model/firmware, reproduction steps and a sanitized Flow example. Keep real coordinates, location history, names and credentials out of public reports.
