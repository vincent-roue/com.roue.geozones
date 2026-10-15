# Troubleshooting

Start with one enabled Manual subject, one active circle, no filters, no delays, no hysteresis and a `0 m` movement threshold. Follow the synthetic check in [Installation](INSTALLATION.md), then add your real source and restore each setting one at a time.

## No subject or coordinate source appears

Create a subject from **Devices > Add device > GeoZones > Manual subject**. GeoZones 2 does not automatically discover or link devices from other apps, or expose Homey users as GPS sources. Your own Flow must supply latitude and longitude to the device. A source/bridge must already make those numbers available in Homey; GeoZones does not include native phone tracking, Find My or Home Assistant integration.

If an old subject is missing after an upgrade, use the recovery section of the Manual subject pairing screen. See [Migration](MIGRATION.md).

## The position is absent, wrong or old

- Verify that **Set position to [latitude], [longitude] and evaluate** actually ran for the intended device and that the subject is enabled.
- Supply numbers from one coordinate pair. Check latitude/longitude order and ranges. Empty or invalid coordinates fail; `0` is a valid coordinate.
- A movement threshold can retain the previous coordinates when a new point is too close. Temporarily set the subject's **Minimum move distance** to `0 m` when diagnosing this.
- **Last update** measures when GeoZones received an update. It does not prove that the GPS fix was recent: a source can repeat cached coordinates. Check the source timestamp and update frequency too.

Positions do not automatically expire. **Evaluate subject**, app restarts and delay timers reuse stored coordinates and retain their update time. If a maximum age matters, use **Get subject state for [subject]** to obtain **Last update**, add your own age check, and also reject stale fixes upstream where the source provides their original timestamp. The legacy-named **Source stale** output does not provide automatic freshness detection for manual subjects.

## A different zone wins, or no zone matches

Check that the zone is active, saved and correctly drawn. Confirm its subject-name/type filters and spelling. Explicit name filters are more specific than type filters. If several zones match, higher priority wins; at equal priority, the smaller area wins. Only one zone becomes the subject's current zone.

`not_defined` means that no eligible zone matched. A large encompassing zone can keep winning between smaller zones, so leaving a small zone need not produce `not_defined`.

Circle hysteresis increases the exit boundary; it does not enlarge initial entry and does not apply to polygons. Entry/exit delays intentionally postpone transitions. A switch to another winning zone uses the destination's entry delay; a transition to no zone uses the previous zone's exit delay. Timers evaluate the latest stored coordinates; they do not refresh the location source.

## A Flow does not fire, or its log shows the wrong zone

Use the subject device's **Changed zone** trigger for current-zone changes, including transitions to/from `not_defined`. **Was recalculated** can fire even when the zone stays the same; **Position changed** requires the stored coordinates to change. Repeated recalculations are not repeated zone entries.

For an entry/exit trigger, check its transition and optional zone/tag filters. Its **Zone** and **Zone tags** describe the place entered or left. **Changed zone** supplies the resulting **Zone** and **Previous zone**.

Use the event's own tokens for an event log. If you store result tokens in variables before logging them, connect the logging step after the writes complete in Advanced Flow. Parallel branches can read previous variable values. Use **Get subject state for [subject]** when you need a current snapshot instead of an event record.

After a v1 upgrade, rebuild retired cards even if the old Flow still appears. Subject recovery does not rebuild Flows or reconnect location sources.

## Map, import or recovery problems

Map tiles need access to OpenStreetMap. Missing tiles do not stop zone evaluation; use the numeric circle/polygon fields to inspect geometry. Copy/Download exports the current browser draft; save a valid configuration before relying on it as a backup.

Import merge works by top-level section, not by individual zone. A supplied `zones` section replaces the whole current zone list. Export first. For recovery errors, retain/download the previous-data backup and check [Migration](MIGRATION.md) before restarting or removing anything.

## Reporting an issue

If settings or Help appear in an unexpected language, check Homey's language and reopen the settings. English, French, Dutch and German are supported; other Homey languages use English. The browser language is only a fallback when Homey's language cannot be determined. Help contains 15 sections covering setup, fields, Flows and recovery without needing to open the repository.

Use [GitHub issues](https://github.com/vincent-roue/com.roue.geozones/issues) or the [Homey Community topic](https://community.homey.app/t/app-pro-geozones/153017). Include app version/channel, Homey model/firmware, exact card title, steps, expected/actual result and a minimal synthetic example. Describe the coordinate source and whether it supplies a GPS-fix timestamp.

Detailed logging is available in **Settings > General > Enable detailed logging**. Enable it only while reproducing the problem, then turn it off. Both normal and detailed logs may expose names/places; detailed logs can also include coordinates. Remove private names, positions, location history, identifiers and credentials from public reports. Read [Privacy](PRIVACY.md) before sharing exports or diagnostics.
