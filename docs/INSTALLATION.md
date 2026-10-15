# Installation and first Flow

Use Homey Pro (Early 2023) with firmware **12.5.0 or later**. Homey Cloud is not supported. If you are upgrading an existing installation, read [Migration](MIGRATION.md) first.

## 1. Check your coordinate source

You need a source that already supplies **numeric latitude and longitude to a Homey Flow**. Verify that it produces a current coordinate pair before connecting it to GeoZones. For an iPhone, the source and its location permissions must be configured separately. GeoZones does not obtain the phone's position or link automatically to another app's devices.

The exact source trigger depends on that source. Use its coordinate-update trigger and tokens, or an existing bridge/Flow that provides the pair. Home Assistant can be part of a separately configured bridge; it is not a built-in GeoZones source. A Homey user's home/away state alone does not provide latitude and longitude.

## 2. Install and create a zone

1. Open the [App Store page](https://homey.app/a/com.roue.geozones/) and check the version offered. Use the [test link](https://homey.app/a/com.roue.geozones/test/) only if you intend to install the Test channel.
2. Install on your Homey Pro, then open **GeoZones > Settings > Zones**.
3. Choose **Add circle** or **Add polygon**, enter a unique name, configure its geometry and keep **Active** enabled. Click **Save**.
4. For an initial check, leave entry/exit delays, circle hysteresis and subject filters at their defaults. Add these once coordinate updates work.

## 3. Add a Manual subject

In Homey, open **Devices > Add device > GeoZones > Manual subject**. Choose a unique name, such as `Demo subject`, an optional subject type such as `person`, and keep the subject enabled. Start with a **Minimum move distance** of `0 m` for the first check.

The device has no position until valid coordinates arrive. A latitude or longitude of `0` is valid; an empty value is not.

## 4. Send a coordinate pair

Create this Flow using your existing source:

| Flow part | Select |
| --- | --- |
| When | Your source's coordinate-update trigger |
| Then | Your GeoZones subject device → **Set position to [latitude], [longitude] and evaluate** |
| Latitude / Longitude | The numeric tokens for the same position update |

Do not exchange latitude and longitude. Latitude must be between `-90` and `90`; longitude between `-180` and `180`. If your source updates the two values separately, obtain a complete, consistent pair before sending it.

The action stores and evaluates the position. Its result tokens include **Zone**, **Previous zone**, **Zone tags**, **Movement state** and **Speed (km/h)**. In Advanced Flow, connect any action consuming these results **after this action completes**.

## 5. React to a zone change

Create a second Flow:

| Flow part | Select |
| --- | --- |
| When | Your GeoZones subject device → **Changed zone** |
| Then | For example, a notification containing that trigger's **Previous zone** and **Zone** tokens |

Use the tokens supplied by this **Changed zone** trigger when recording the event. A variable or parallel action may still contain another value. For an entry or exit restricted to a place, use the device trigger **Zone transition — [entry/exit]: [zone] / [zones] / [tag] / [tags]** and fill the relevant filter.

**Changed zone** includes changes to or from `not_defined` when no zone matches. The entry/exit trigger's **Zone** and **Zone tags** describe the place being entered or left; they should not be read as a snapshot of the current zone after every transition.

## 6. Verify before using your real source

For a synthetic check, create an active circle named `Demo zone` centered on `0, 0`, radius `100 m`, without delays or hysteresis. Send `0, 0` to the subject: it should enter `Demo zone`. Send `0.01, 0`: it should leave. Other overlapping zones or filters can affect the winning zone. Remove the demonstration zone and subject when finished.

Reconnect your source, check the device's coordinates and **Last update**, and verify one real arrival and departure. Then tune delays, hysteresis and movement filtering for your source's precision and update rate. Delayed evaluation uses the last received coordinates; it does not request a new GPS fix.

**Freshness:** Last update is GeoZones' reception time, not the source's GPS-fix time. Positions never expire automatically. Replaying cached coordinates can refresh Last update, so also check the original source timestamp when available. The app card **Get subject state for [subject]** exposes **Last update** for your own freshness checks; compare it with your chosen age limit in your Flow logic.

The settings **Help** tab contains 15 practical sections in English, French, Dutch and German. It follows Homey's language when opened; reopen settings after changing that language.
