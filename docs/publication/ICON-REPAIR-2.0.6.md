# GeoZones 2.0.6 — icon compatibility update

As checked on 16 October 2026, **2.0.6 build 18 is officially Live** and installed on Homey Pro 2023. The developer portal confirms Live status. It was released to Test before submission; 2.0.5 build 17 was the preceding Live version.

## Scope and verification

The app icon keeps its existing shape and 960 × 960 canvas. Its SVG geometry is flattened and uses explicit black paths. Application logic, zone calculations, Flow cards, identifiers and permissions are unchanged from 2.0.5. These observations do not establish that the previous SVG was broken.

- All nine automated suites and Homey publication-level validation pass.
- All 76 uploaded package files match the prepared candidate and official SDK shim.
- Installation and restart on Homey Pro 2023 preserved the settings backup, configuration and both existing subject identities. Both subjects report available after restart.
- The Homey web interface contains the new base64 SVG, decoded size **322 bytes**, and visibly renders the expected white pin on its app background.

These checks cover this update and its Homey icon display; remaining legacy-migration, iPhone, import and delay acceptance scenarios are not treated as completed.

## Store display remains unresolved

The Chrome views of **both the Homey Test Store and the Live Store still show the blue circle without the pin**, including after build 18. Store rendering is therefore not confirmed as repaired.

Checks of the same build's icon resource found different response headers depending on the request: without `Origin`, the response lacked `Access-Control-Allow-Origin` and `Vary`; with `Origin`, it included `Access-Control-Allow-Origin: *` and `Vary: Origin`. The cache lifetime was four hours. This is consistent with a cache/CORS inconsistency affecting cross-origin display; changing the packaged SVG does not change those service headers. It does not establish the previous SVG as the cause.

The prepared Athom follow-up note remains an unsent draft; the messaging control was disabled after Live publication.

[Live installation](https://homey.app/a/com.roue.geozones/) · [Homey build 18](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/18) · [Publication status](STATUS.fr.md)
