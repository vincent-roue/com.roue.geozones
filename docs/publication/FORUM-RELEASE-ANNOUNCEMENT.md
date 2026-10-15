# Forum announcement for the Live release

Maintainer instruction: the text below is a prepared draft. Post it only after Athom approval and after verifying that version 2.0.5 is actually available on the Live Store page. Replace preparation-branch documentation links with `main` after merging the source changes. Do not use this text to announce a Draft or Test build as Live.

---

GeoZones 2.0.5 is now available for Homey Pro: [install from the Homey App Store](https://homey.app/a/com.roue.geozones/).

Define your places once, then reuse them in Flows. GeoZones supports circles and polygons, tags and priorities, and manual subject devices supplied with coordinates by your own Flows. The app calculates the resulting zone, transitions, movement and distances. A separate location source is required; GeoZones does not obtain phone GPS positions itself.

**Upgrading from an older version:** the automatic linked-subject model and its old Flow cards have been removed. Preserve your backup, recover previous subjects through Add device, and rebuild affected Flows. Read the [migration guide](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/MIGRATION.md) before updating.

This version completes English, French, Dutch and German text and expands the embedded Help to 15 practical sections per language. Settings and Help follow Homey's language from the start; reopen settings after changing it. Setup, migration and position freshness are clarified, and presentation is updated. The zone engine, Flow identifiers and permissions are unchanged from the 2.0.3 test release. Positions are last known values and do not expire automatically; check freshness at your location source.

[Installation guide](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/INSTALLATION.md) · [Guide en français](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/INSTALLATION.fr.md) · [Troubleshooting](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/TROUBLESHOOTING.md)

Please share setup feedback or reproducible problems in this topic. Include your app version, Homey firmware and the type of coordinate source, and remove private location and account data from examples.
