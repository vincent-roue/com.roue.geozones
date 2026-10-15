# Upgrading to GeoZones 2

Version 2 uses **Manual subject devices** updated by Flow cards. Upgrading from v1 is **not transparent**: automatic links to other apps' location devices and many old Flow cards are removed. Existing Flows are not rewritten into the new model.

This guide covers the v1 → v2 change. Moving from the 2.0.3 Test version to 2.0.4 keeps the same manual-device model and does not restore retired cards or linked sources.

## Before updating

1. Export your current GeoZones configuration and keep a Homey backup if available.
2. Record which Flows update or use each subject. Note names/types, source coordinates, filters and any deliberate delays or hysteresis.
3. Check the version and channel offered by the Store. Plan time to rebuild affected Flows before relying on the new installation.

The permission changed from broad Homey Web API access to **Homey geolocation** access. The latter is used for distance to Homey's configured location; it does not give phone GPS access. Homey documents that adding permissions prevents automatic updates, so the upgrade may require a manual update/authorization. See [Homey permissions](https://apps.developer.homey.app/the-basics/app/permissions).

## Recover legacy subjects

At startup, GeoZones preserves original legacy settings and verifies its migration snapshot before converting data. This includes available subject state and previous source references. A preserved source reference does not reconnect that source.

1. Open **GeoZones Settings > General** and inspect **Recover previous subjects**. Use **Download previous-data backup** and store the file privately.
2. Open **Devices > Add device > GeoZones > Manual subject**.
3. In **Recover legacy subjects**, select one previous subject and choose **Recover this subject**. Retain its name where possible. Recovery creates a device with the available settings, coordinates and last saved state, including its original update time.
4. Repeat for each pending subject. If a recovery name changes, review subject-name filters in your zones.
5. Reconnect coordinate updates using the new device's **Set position to [latitude], [longitude] and evaluate** action. Verify that the external source provides a current pair.
6. Rebuild affected Flows, then check arrival, departure, delays, tags and any use of the no-match state.

Recovery requires **Add device**; preparing and preserving the data does not create the devices automatically. Migration backups remain available across normal app restarts and updates. Download them before any uninstall: uninstalling the app removes its local settings.

## Replace old Flow patterns

Compared with the public v1.0.3 manifest, v2 retires 47 Flow card IDs, adds 24 and retains 10. These counts do not imply that preserved IDs keep every old argument or token contract. Review each affected Flow.

The [retired card reference](RETIRED_FLOW_CARDS.md) lists the removed identifiers.

| Previous pattern | Current approach |
| --- | --- |
| Automatically linked location source | A Flow supplies coordinates to a Manual subject device |
| Create/update a subject by an app-level card | Add/recover the device, then use **Set position to [latitude], [longitude] and evaluate** |
| Subject entered/left one or several zones | Device trigger **Zone transition — [entry/exit]: [zone] / [zones] / [tag] / [tags]**, with the required filter |
| Subject changed zone | Device trigger **Changed zone**; inspect its **Zone** and **Previous zone** tokens |
| Check a subject's zone or movement | Device conditions **Is in zone ([zone], [zones], [tag], [tags])** or **Is [state]** |
| Re-evaluate an existing subject | Device action **Evaluate subject**; this uses saved coordinates |
| Distances from a subject | Device **Calculate distance to …** cards |
| Read a subject's current values | App action **Get subject state for [subject]** |

Select the current cards afresh instead of relying on an old card's appearance. Filters and available tokens differ. **Changed zone** includes transitions to/from `not_defined`. Entry/exit trigger tokens describe the zone involved in that transition, including the zone just left. Use their event tokens for logs and notifications.

## Imports and errors

Legacy imports preserve recoverable subject data, but do not restore retired Flows. **Import and merge sections** replaces an entire supplied top-level section: supplying `zones` replaces all current zones, rather than adding zones individually. An empty `zones` array removes all zones. Export first and inspect the confirmation before applying an import.

If migration or recovery cannot verify a required backup, inspect General for the error and download any available verified backup. Keep the original data and report the problem with a sanitized example. A restart can retry an interrupted operation; do not uninstall as a first recovery step. If an already paired legacy subject reports a recovery failure, restart GeoZones and check its restored state before retrying.

After recovery, old coordinates remain old: recalculation and delayed evaluation do not make them fresh. New manual updates record receipt time, not the GPS-fix time. Positions do not expire automatically. See [installation](INSTALLATION.md) and [troubleshooting](TROUBLESHOOTING.md).
