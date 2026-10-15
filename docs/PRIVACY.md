# Privacy, location data and backups

GeoZones evaluates coordinates supplied by your Flows. It does not obtain a phone's location, request phone account credentials, or include an analytics service. Your chosen location source, bridge and Homey services have their own privacy and security behavior.

## Data stored on Homey

The app stores zone geometry, names/tags, configuration history, subject settings and last known state in Homey app settings and device storage. Subject state includes coordinates, update time, zone and movement information. Recovery snapshots may also retain legacy subject data and historical source references.

The `homey:manager:geolocation` permission reads Homey's configured location for distance calculations. It does not give GeoZones access to phone GPS positions. The app does not request the broad `homey:manager:api` permission.

Coordinates are last known values and do not automatically expire. For normal manual updates, **Last update** is the time GeoZones receives the position, not the source's GPS-fix time. A repeated old fix may therefore have a recent reception time.

## Map requests

Leaflet and Leaflet.draw are bundled locally with their licenses. The settings interface does not need an external JavaScript CDN. Opening or moving the map requests tiles from **OpenStreetMap**; its tile service receives the requesting network address and requests identifying the geographic area viewed. Zone evaluation does not require map tiles.

## Exports, history and migration snapshots

Copy/Download exports are created directly in your browser. The app does not create a new publicly served export file on Homey. Configuration exports, history and migration backups may contain precise locations and identifiable names; store them privately and sanitize any example you share.

Configuration history retention is configurable in **Settings > General**. Migration snapshots are retained separately to support recovery; that history setting does not establish a deletion period for the original migration backup. Snapshots survive normal restarts and updates. Download needed backups before uninstalling: app settings are removed on uninstall.

The migration snapshot is checked for integrity, which does not make its downloaded contents anonymous or encrypted. GeoZones removes files matching its old generated-export naming convention from its userdata directory at startup; copies you previously downloaded or shared are outside the app's control.

## Diagnostics and support

Normal diagnostic messages can contain subject and zone names. Optional **heavy debug** logging can also include coordinates and detailed state. Enable it only while investigating a problem and disable it afterward. Review logs before sharing them, and keep credentials, private identifiers, names, positions and location history out of public GitHub issues or forum posts. The app does not automatically send exported backups to its developer.
