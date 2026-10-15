/* global Homey, L */
let HomeyApp;
let config = null;
let history = [];
let selectedZoneId = null;
let map = null;
let zoneLayers = new Map();
let drawnItems = null;
let drawHandlers = {};
let currentLang = 'en';
let currentTab = 'zones';
let editorErrors = {};
const zoneDrafts = new Map();
let migrationStatus = null;
let isSaving = false;
let saveDisabledStates = new Map();

const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];
const cleanText = value => String(value ?? '').trim();
const clone = value => JSON.parse(JSON.stringify(value));
const PALETTE = ['#2F6FED', '#E05263', '#2F9E44', '#7A42F4', '#F08C00', '#0B7285', '#C2255C', '#5F3DC4', '#A61E4D', '#1D4ED8'];

function parseCsvKeepCase(value) {
  const seen = new Set();
  const out = [];
  for (const item of String(value || '').split(',').map(v => v.trim()).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

const UI = {
  en: {
    tabs: { zones: 'Zones', general: 'General', io: 'Import / Export', help: 'Help' },
    migration: {
      title: 'Recover previous subjects',
      pending: 'Previous subjects awaiting recovery: __count__. Already recovered: __recovered__.',
      complete: 'Previous subjects recovered: __recovered__.',
      error: 'Recovery status could not be verified.',
      instructions: 'To recover subjects, add a GeoZones device from Devices and choose the previous subjects in the manual-subject pairing screen. Recovery requires this action. Check and reconnect your Flows afterwards; linked location sources must be replaced by coordinate updates from a Flow.',
      downloadBackup: 'Download previous-data backup',
      backupPrivacy: 'This backup can contain sensitive names, positions and source information. It is downloaded directly in your browser; store it securely.',
      noBackup: 'No verified backup is available.',
    },
    actions: { save: 'Save', reload: 'Reload', addCircle: 'Add circle', addPolygon: 'Add polygon', fitAll: 'Fit all', deleteZone: 'Delete zone' },
    map: {
      zoomIn: 'Zoom in', zoomOut: 'Zoom out',
      circleStart: 'Click and drag to draw a circle.', circleEnd: 'Release to finish drawing.', radius: 'Radius',
      polygonStart: 'Click to start drawing a polygon.', polygonContinue: 'Click to add another point.', polygonEnd: 'Click the first point to close the polygon.',
      intersectionError: 'Polygon edges cannot cross.',
    },
    common: { name: 'Name', color: 'Color', active: 'Active', inactive: 'Inactive', priority: 'Priority', tags: 'Tags', empty: '—' },
    zones: {
      editor: 'Zone',
      selectZone: 'Select a zone',
      circle: 'Circle',
      polygon: 'Polygon',
      centerLat: 'Center latitude',
      centerLng: 'Center longitude',
      radius: 'Radius (m)',
      points: 'Polygon points (JSON)',
      advanced: 'Advanced options',
      entryDelay: 'Entry delay (s)',
      entryDelayHelp: "Delay before switching to a new winning zone. Uses the latest stored coordinates, without requesting a new GPS fix.",
      exitDelay: 'Exit delay (s)',
      exitDelayHelp: "Delay before switching from the current zone to no zone. A direct switch to another zone uses that destination’s entry delay.",
      hysteresis: 'Hysteresis (m)',
      hysteresisHelp: 'For circles only. Enlarges the circle exit threshold to reduce border bouncing.',
      appliesWithoutSubject: 'Apply to coordinates without subject',
      appliesWithoutSubjectHelp: 'Used by cards that evaluate raw coordinates without a subject device.',
      subjectFilterMode: 'Subject filter',
      subjectFilterHelp: "Include only allows the listed names even if their type is excluded. Exclude rejects the listed names; other subjects still pass through the subject-type filter. Names are matched without letter-case differences.",
      subjectFilterValues: 'Subjects (comma-separated names)',
      subjectTypeMode: 'Subject type filter',
      subjectTypeFilterHelp: 'Allow all subject types, only the listed types, or all except the listed types. Subject types are free text values such as person, car, bike or pet.',
      subjectTypeValues: 'Subject types (comma-separated)',
      filterAll: 'All',
      filterInclude: 'Include only',
      filterExclude: 'Exclude',
      filterPriority: "Explicit name inclusion takes priority over type; with Exclude, subjects not listed still pass through the type filter.",
      addTag: 'Add tag',
      tagPlaceholder: 'Enter a tag',
      tagsHelp: 'Tags are free text values that describe how a zone is used, for example home, work, school, charging or family. Keep the same spelling everywhere you reuse them.',
    },
    general: {
      historyTitle: 'Configuration history',
      historyHelp: "Previous saved configurations, limited by this retention and at most 100 entries. Does not back up devices or Flows.",
      historyDays: 'Retention (days)',
      debugTitle: 'Debug',
      heavyDebug: 'Enable detailed logging',
      heavyDebugHelp: 'Enable detailed logging only when you need to diagnose a problem. It adds decision logs for zone evaluation and should not stay enabled longer than necessary.',
    },
    io: {
      exportTitle: 'Export',
      copy: 'Copy',
      download: 'Download',
      importTitle: 'Import',
      copyCurrent: 'Copy current configuration',
      loadFile: 'Load file',
      importReplace: 'Import and replace',
      importMerge: 'Import and merge sections',
      importWarning: "Exports can contain sensitive coordinates. Importing zones replaces the entire current zone list, not individual zones. In merge mode, general and interface options merge their supplied fields. Export first and inspect the confirmation.",
      history: 'History',
      restore: 'Restore',
      remove: 'Delete',
    },
    help: {
      "title": "Help",
      "intro": "GeoZones turns coordinates supplied by your own source into reusable geographic zones for Homey Flows. It does not locate phones itself. Start with the first four sections, then open the topics you need.",
      "sections": [
        {
          "title": "1. First setup",
          "body": [
            "You need GeoZones on a compatible local Homey Pro, plus a separate source that already supplies latitude and longitude to Homey. Phone presence alone is not a coordinate source; GeoZones does not include native phone GPS, Find My or Home Assistant tracking.",
            "Create and save one active circle in Zones. In Homey, open Devices > Add device > GeoZones > Manual subject, give it a unique name and keep it enabled. Start with a minimum movement distance of 0 m, no filters, no delays and no hysteresis.",
            "Create a Flow that runs when your source updates its position. Use the subject device action Set position to [latitude], [longitude] and evaluate, supplying both numbers from the same position sample. Manual means that a Flow supplies the coordinates; that Flow can run automatically."
          ]
        },
        {
          "title": "2. Draw, edit and save zones",
          "body": [
            "Choose Add circle, then drag on the map; or choose Add polygon, add its corners and select the first point again to close it. Select a zone to edit its name, color, activity, priority and geometry. Fit all adjusts the map to show all zone shapes in the current draft.",
            "For a circle, set its center latitude/longitude and radius in meters. A polygon needs at least three valid points, a measurable area and no crossing sides. Its numeric editor accepts a JSON array of {lat, lng} points. A zone name must be unique; reserved state names such as not_defined cannot be used.",
            "Edits stay in the browser draft until Save succeeds. Reload replaces that draft with the stored configuration and discards unsaved changes. Save applies the configuration and recalculates subjects using their stored coordinates; it does not ask the location source for a new fix."
          ]
        },
        {
          "title": "3. Subjects and coordinate input",
          "body": [
            "A subject is a Homey device representing a person, vehicle, pet or other item. Create one device per subject. Its optional subject type is free text; use the same spelling in its settings, zone filters and Flows. Renaming a subject requires reviewing name-based filters.",
            "The position action needs a complete pair: latitude from -90 to 90 and longitude from -180 to 180. Do not swap them. Zero is valid; an empty value is not. If your source sends the two values separately, collect a complete consistent pair before running the action.",
            "A new subject has no usable position until it receives valid coordinates. The separate Evaluate subject action reuses its saved position. It does not start phone tracking or update the source."
          ]
        },
        {
          "title": "4. Check your first Flow",
          "body": [
            "For an isolated synthetic check, use a test subject and an active circle named Demo, centered on latitude 0 and longitude 0 with a radius of 100 m. Keep filters, delays, hysteresis and the movement threshold at zero/default values, and ensure no other eligible zone overlaps it.",
            "Send 0, 0: the current zone should become Demo. Send 0.01, 0: it should become not_defined if no other eligible zone contains the point. Create a second Flow with the subject trigger Changed zone and use that event’s Zone and Previous zone tokens in a notification.",
            "Remove the demonstration subject and zone after testing. Reconnect your real coordinate source, verify an arrival and departure, then add the filters and delays you need one at a time. Check the original source timestamp as well as the received coordinates."
          ]
        },
        {
          "title": "5. Priority and the winning zone",
          "body": [
            "GeoZones considers only active zones that allow the subject or raw-coordinate evaluation. If several eligible zones contain the position, the highest numeric priority wins. At equal priority, the smallest area wins. Only one winning zone becomes the current zone.",
            "An inactive zone cannot become the current zone. not_defined means that no eligible zone matched; it does not necessarily mean that coordinates are missing. A larger surrounding zone can win when a subject leaves a smaller one, so leaving a zone need not produce not_defined.",
            "Check priority, geometry, activity and filters when the result is unexpected. Color is only a visual aid and does not affect matching."
          ]
        },
        {
          "title": "6. Tags, types and subject filters",
          "body": [
            "Tags describe a zone’s use, for example home, work or charging. Subject types describe subjects, for example person, car or pet. Both are freely chosen text, not automatic categories. Names, types and tags are matched without letter-case differences; keep their spelling consistent. Lists use commas.",
            "With the subject filter All, the subject-type filter decides eligibility. Include only accepts only the listed subject names: a listed subject is allowed even when its type would be excluded. Exclude rejects the listed names; other subjects still pass through the subject-type filter. A subject without a type matches an excluded-type filter but not an included-type filter.",
            "Apply to coordinates without subject controls the app cards that evaluate raw coordinates. These cards have no subject name/type or previous state, so subject filters, transition delays and previous-zone hysteresis do not apply. They evaluate the winning eligible zone and its tags, not every geometrically overlapping zone."
          ]
        },
        {
          "title": "7. Delays and circle hysteresis",
          "body": [
            "The entry delay postpones a switch to a new winning zone. For a direct move from zone A to zone B, B’s entry delay applies. The exit delay of the previous zone applies when the result becomes no zone. If the candidate changes while waiting, the pending transition is recalculated.",
            "Delay timers evaluate the latest stored coordinates; they do not request a fresh GPS position or prove continuous real-world presence. Use a reliable update source and check its age when a delayed action matters.",
            "Hysteresis applies only to circles: the current circle’s exit boundary is extended by the configured meters. A 100 m radius with 20 m hysteresis can retain the current circle up to 120 m. Initial entry still uses 100 m, polygons have no hysteresis, and zone priorities still apply."
          ]
        },
        {
          "title": "8. Movement threshold and disabling",
          "body": [
            "Minimum move distance is configured per subject device. An update closer than that threshold keeps the previous stored coordinates to reduce GPS jitter. The first valid position is accepted because there is no previous position. Use 0 m while diagnosing a source or a zone boundary.",
            "An update inside that movement threshold still records its reception time and evaluates the retained position; it is not discarded completely. Movement and speed are derived from supplied positions and timing, not independent motion sensors or proof that a person is moving.",
            "Disabling a subject rejects position updates and clears its current zone and pending transition while retaining the last coordinates and their time. Re-enabling evaluates that stored position; it does not refresh it from the phone."
          ]
        },
        {
          "title": "9. Events, results and reliable logs",
          "body": [
            "Changed zone fires when the current zone changes, including transitions to or from not_defined. Zone transition distinguishes entry and exit; its Zone and Zone tags describe the place entered or left. Position changed requires changed stored coordinates, while Was recalculated can fire even when position and zone stay the same.",
            "Use tokens from the triggering event for event logs. Previous zone is a stored transition value, not a full travel history: A to B reports A, A to no zone keeps A, and no zone to B resets it to not_defined. Get subject state returns the current snapshot instead of an event record.",
            "In Advanced Flow, connect actions that use returned results after the position/evaluation card finishes. If you copy tokens into variables, finish those writes before logging the variables. Parallel branches can otherwise read an older value. Global subject and subject-type filters combine together; selected zone and tag filters are alternatives."
          ]
        },
        {
          "title": "10. Conditions and distances",
          "body": [
            "Subject zone conditions use the subject’s stored current zone, including any pending delay. Raw-coordinate conditions instead calculate their own winning zone immediately, without changing a subject. A point can be geometrically inside a selected zone yet fail a raw-coordinate condition when another eligible zone wins.",
            "For zone/tag occupancy checks, At least means that at least one current occupant matches the selected subjects or types. Only means that every current occupant matches and that the zone is not empty; it does not require every subject in your selection to be present.",
            "Distance Flow actions return straight-line geographic distances in meters, not road routes or travel times. Distance to a zone is zero inside it and otherwise the shortest distance to its boundary; this geometric distance does not apply the zone’s activity or subject filters. The device value Distance to Homey is displayed in kilometers and uses Homey’s configured location, not the phone’s GPS."
          ]
        },
        {
          "title": "11. Position age and source limits",
          "body": [
            "Last update (last_update) records when GeoZones received coordinates. It does not tell you when the source measured the GPS fix. A source that repeats cached coordinates can therefore make the reception time look recent. Check the source’s own timestamp and update frequency too.",
            "Stored positions do not expire automatically. Recalculation, delay timers and app restarts reuse the last position and do not make it fresh. Get subject state exposes Last update so your Flows can apply an age rule; reject old source fixes upstream when their original timestamp is available.",
            "The legacy output Source stale does not implement automatic freshness detection for manual subjects. Phone permissions, locked-screen behavior, battery saving and offline periods are managed by your external source. Test those conditions before relying on an arrival, departure or alarm Flow."
          ]
        },
        {
          "title": "12. Export, import and history",
          "body": [
            "Copy and Download export the current browser configuration draft, including unsaved changes. Save a valid configuration first when you need a verified configuration backup. A configuration export is not a full backup of manual devices, their runtime state, Homey Flows or the external source; the legacy-data backup is a separate download.",
            "Import and replace replaces the configuration. Import and merge sections does not merge individual zones: supplying zones replaces the entire current zone list, while supplied fields in general and ui are merged into those settings. An empty zones array deletes all zones. Export first, inspect the confirmation and keep private coordinate files secure.",
            "History contains previous saved configurations, limited by the retention in General and at most 100 entries. Restore applies the selected configuration and recalculates subjects; it does not restore old GPS fixes or Flows. Deleting a history entry removes that saved version."
          ]
        },
        {
          "title": "13. Upgrade and recover old subjects",
          "body": [
            "Older linked-subject versions require migration. GeoZones preserves and verifies original legacy data before conversion, but preserved source references do not recreate automatic links and retired Flow cards are not restored.",
            "In General, inspect Recover previous subjects and download the previous-data backup privately. Then use Devices > Add device > GeoZones > Manual subject, choose each old subject in the recovery section and recover it. Keep its name where possible; otherwise review subject-name filters.",
            "Reconnect coordinates through the current position Flow card and rebuild affected Flows. Check the restored position’s age. If recovery reports an error, keep the backup and original data, inspect the message and restart to retry an interrupted operation. Do not uninstall as a first recovery step: uninstalling removes app settings."
          ]
        },
        {
          "title": "14. Troubleshooting",
          "body": [
            "No update or wrong zone: verify the intended subject is enabled, the position Flow actually runs, both coordinates are valid and current, and the zone is saved and active. Temporarily use one circle with no filters, delays, hysteresis or movement threshold. Then restore each option separately.",
            "Missing map: map tiles need Internet access to OpenStreetMap, but missing tiles do not stop zone calculations. Existing geometry remains available in numeric fields. An invalid edit blocks saving and export until corrected. Reload discards unsaved changes; copy any unfinished values you want to keep separately before reloading.",
            "Use detailed logging in General only while reproducing a problem, then turn it off. For a report, include app version, Homey model/firmware, exact card, source and sanitized steps with expected and actual results. Share a minimal synthetic example rather than private movement history."
          ]
        },
        {
          "title": "15. Language and privacy",
          "body": [
            "This help and the settings use the language reported by Homey when the page opens: English, French, Dutch or German. Other Homey languages fall back to English. Reopen the settings after changing Homey’s language. Your own zone names, tags, subject types and stored technical values are not translated.",
            "Map tiles come from OpenStreetMap; tile requests reveal the viewed map area and your network address to that service. Zone evaluation runs in the app on Homey. Your external location source has its own network traffic and privacy rules.",
            "Exports, migration backups and logs can contain names, coordinates and location history. Store them privately and remove sensitive data before sharing a report. This help is available within the app without opening the repository; map imagery still needs its tile service."
          ]
        }
      ]
    },
    messages: {
      saved: 'Saved',
      loaded: 'Loaded',
      invalidJson: 'Invalid JSON file.',
      invalidImport: 'Import an exported configuration object. Replacing requires zones or legacy subject data; an empty or unrelated JSON value is not a configuration.',
      confirmReplace: 'Replace the current configuration with this import? Its zones replace all current zones. An empty zones array deletes every zone.',
      confirmMergeZones: 'The imported zones replace all current zones. An empty zones array deletes every zone. Continue?',
      downloadFailed: 'Unable to download the export file.',
      exportReady: 'Export file generated.',
      importApplied: 'Import applied.'
      ,invalidPolygonJson: 'Use a JSON array of at least three valid {lat, lng} points.',
      invalidZoneNumber: 'Enter valid numbers within the allowed coordinate and distance ranges.',
      zoneNameRequired: 'A zone name is required.',
      configUnavailable: 'The configuration could not load. Reload the settings before exporting.',
      mapUnavailable: 'The map could not load. Existing zones and the other settings remain available. Reopen the settings to retry.',
    },
  },
  fr: {
    tabs: { zones: 'Zones', general: 'Général', io: 'Import / Export', help: 'Aide' },
    migration: {
      title: 'Récupérer les anciens sujets',
      pending: 'Anciens sujets à récupérer : __count__. Déjà récupérés : __recovered__.',
      complete: 'Anciens sujets récupérés : __recovered__.',
      error: 'L’état de récupération n’a pas pu être vérifié.',
      instructions: 'Pour récupérer les sujets, ajoutez un appareil GeoZones depuis Appareils et choisissez les anciens sujets dans l’écran d’association des sujets manuels. Cette action est nécessaire. Vérifiez et reconnectez ensuite vos Flows ; les anciennes sources liées doivent être remplacées par des mises à jour de coordonnées depuis un Flow.',
      downloadBackup: 'Télécharger la sauvegarde des anciennes données',
      backupPrivacy: 'Cette sauvegarde peut contenir des noms, positions et informations de source sensibles. Elle est téléchargée directement dans votre navigateur ; conservez-la en sécurité.',
      noBackup: 'Aucune sauvegarde vérifiée n’est disponible.',
    },
    actions: { save: 'Enregistrer', reload: 'Recharger', addCircle: 'Ajouter un cercle', addPolygon: 'Ajouter un polygone', fitAll: 'Ajuster à toutes les zones', deleteZone: 'Supprimer la zone' },
    map: {
      zoomIn: 'Zoomer', zoomOut: 'Dézoomer',
      circleStart: 'Cliquez et faites glisser pour dessiner un cercle.', circleEnd: 'Relâchez pour terminer le dessin.', radius: 'Rayon',
      polygonStart: 'Cliquez pour commencer un polygone.', polygonContinue: 'Cliquez pour ajouter un point.', polygonEnd: 'Cliquez sur le premier point pour fermer le polygone.',
      intersectionError: 'Les côtés du polygone ne peuvent pas se croiser.',
    },
    common: { name: 'Nom', color: 'Couleur', active: 'Active', inactive: 'Inactive', priority: 'Priorité', tags: 'Tags', empty: '—' },
    zones: {
      editor: 'Zone',
      selectZone: 'Sélectionnez une zone',
      circle: 'Cercle',
      polygon: 'Polygone',
      centerLat: 'Latitude du centre',
      centerLng: 'Longitude du centre',
      radius: 'Rayon (m)',
      points: 'Points du polygone (JSON)',
      advanced: 'Options avancées',
      entryDelay: 'Délai avant entrée (s)',
      entryDelayHelp: "Délai avant de passer à une nouvelle zone gagnante. Utilise les dernières coordonnées enregistrées, sans demander une nouvelle mesure GPS.",
      exitDelay: 'Délai avant sortie (s)',
      exitDelayHelp: "Délai avant de passer de la zone courante à aucune zone. Un passage direct vers une autre zone utilise le délai d’entrée de cette destination.",
      hysteresis: 'Hystérésis (m)',
      hysteresisHelp: 'Pour les cercles uniquement. Agrandit le seuil de sortie du cercle pour limiter les bascules près du bord.',
      appliesWithoutSubject: 'Appliquer aux coordonnées sans sujet',
      appliesWithoutSubjectHelp: 'Utilisé par les cartes qui évaluent des coordonnées brutes sans appareil sujet.',
      subjectFilterMode: 'Filtre des sujets',
      subjectFilterHelp: "Inclure seulement autorise les noms listés même si leur type est exclu. Exclure rejette les noms listés ; les autres sujets restent soumis au filtre de type. La casse des noms n’a pas d’importance.",
      subjectFilterValues: 'Sujets (noms séparés par des virgules)',
      subjectTypeMode: 'Filtre des types de sujet',
      subjectTypeFilterHelp: 'Autorisez tous les types, uniquement les types listés ou tous sauf les types listés. Les types de sujet sont des valeurs libres, par exemple personne, voiture, vélo ou animal.',
      subjectTypeValues: 'Types de sujet (séparés par des virgules)',
      filterAll: 'Tous',
      filterInclude: 'Inclure seulement',
      filterExclude: 'Exclure',
      filterPriority: "L’inclusion explicite par nom prime sur le type ; en mode Exclure, les sujets non listés restent soumis au filtre de type.",
      addTag: 'Ajouter un tag',
      tagPlaceholder: 'Saisir un tag',
      tagsHelp: 'Les tags sont des valeurs libres qui décrivent l’usage d’une zone, par exemple maison, travail, école, recharge ou famille. Gardez la même orthographe partout où vous les réutilisez.',
    },
    general: {
      historyTitle: 'Historique de configuration',
      historyHelp: "Configurations précédemment enregistrées, selon cette durée et dans la limite de 100 entrées. Ne sauvegarde pas les appareils ni les Flows.",
      historyDays: 'Rétention (jours)',
      debugTitle: 'Diagnostic',
      heavyDebug: 'Activer la journalisation détaillée',
      heavyDebugHelp: 'Activez la journalisation détaillée seulement pour diagnostiquer un problème. Elle ajoute des journaux de décision pour l’évaluation des zones et ne doit pas rester activée plus longtemps que nécessaire.',
    },
    io: {
      exportTitle: 'Export',
      copy: 'Copier',
      download: 'Télécharger',
      importTitle: 'Import',
      copyCurrent: 'Copier la configuration actuelle',
      loadFile: 'Charger un fichier',
      importReplace: 'Importer et remplacer',
      importMerge: 'Importer et fusionner les sections',
      importWarning: "Les exports peuvent contenir des coordonnées sensibles. Importer des zones remplace toute la liste actuelle, sans fusion zone par zone. En mode fusion, les options générales et d’interface fusionnent les champs fournis. Exportez d’abord et vérifiez la confirmation.",
      history: 'Historique',
      restore: 'Restaurer',
      remove: 'Supprimer',
    },
    help: {
      "title": "Aide",
      "intro": "GeoZones transforme les coordonnées fournies par votre propre source en zones géographiques réutilisables dans les Flows Homey. L’application ne localise pas elle-même les téléphones. Commencez par les quatre premières rubriques, puis ouvrez celles dont vous avez besoin.",
      "sections": [
        {
          "title": "1. Première configuration",
          "body": [
            "Il vous faut GeoZones sur un Homey Pro local compatible, ainsi qu’une source distincte qui fournit déjà latitude et longitude à Homey. La présence d’un téléphone ne fournit pas à elle seule des coordonnées ; GeoZones n’intègre ni suivi GPS du téléphone, ni Localiser, ni suivi par Home Assistant.",
            "Créez et enregistrez un cercle actif dans Zones. Dans Homey, ouvrez Appareils > Ajouter un appareil > GeoZones > Sujet manuel, choisissez un nom unique et laissez le sujet activé. Pour commencer, réglez la distance minimale de mouvement sur 0 m et n’utilisez ni filtres, ni délais, ni hystérésis.",
            "Créez un Flow déclenché lorsque votre source met sa position à jour. Utilisez l’action du sujet Mettre la position à [latitude], [longitude] et évaluer, en fournissant les deux nombres issus de la même mesure de position. Manuel signifie qu’un Flow fournit les coordonnées ; ce Flow peut s’exécuter automatiquement."
          ]
        },
        {
          "title": "2. Dessiner, modifier et enregistrer les zones",
          "body": [
            "Choisissez Ajouter un cercle, puis faites glisser le pointeur sur la carte ; ou choisissez Ajouter un polygone, placez ses sommets et sélectionnez à nouveau le premier point pour le fermer. Sélectionnez une zone pour modifier son nom, sa couleur, son activation, sa priorité et sa géométrie. Ajuster à toutes les zones affiche toutes les formes présentes dans le brouillon actuel.",
            "Pour un cercle, indiquez la latitude et la longitude du centre ainsi que le rayon en mètres. Un polygone doit comporter au moins trois points valides, avoir une surface mesurable et ne pas avoir de côtés qui se croisent. Son éditeur numérique accepte un tableau JSON de points {lat, lng}. Chaque nom de zone doit être unique ; les noms d’état réservés comme not_defined ne sont pas autorisés.",
            "Les modifications restent dans le brouillon du navigateur jusqu’à ce qu’Enregistrer réussisse. Recharger remplace ce brouillon par la configuration enregistrée et abandonne les modifications non enregistrées. L’enregistrement applique la configuration et recalcule les sujets à partir de leurs coordonnées stockées ; il ne demande pas de nouvelle position à la source."
          ]
        },
        {
          "title": "3. Sujets et saisie des coordonnées",
          "body": [
            "Un sujet est un appareil Homey représentant une personne, un véhicule, un animal ou un autre élément. Créez un appareil par sujet. Le type de sujet est facultatif et libre : utilisez la même orthographe dans ses réglages, les filtres des zones et les Flows. Si vous renommez un sujet, vérifiez les filtres qui utilisent son nom.",
            "L’action de position exige une paire complète : latitude de -90 à 90 et longitude de -180 à 180. Ne les inversez pas. Zéro est valide ; une valeur vide ne l’est pas. Si votre source fournit les deux valeurs séparément, rassemblez une paire complète et cohérente avant d’exécuter l’action.",
            "Un nouveau sujet n’a pas de position exploitable tant qu’il n’a pas reçu de coordonnées valides. L’action distincte Évaluer le sujet réutilise sa position enregistrée. Elle ne lance pas le suivi du téléphone et ne met pas la source à jour."
          ]
        },
        {
          "title": "4. Vérifier le premier Flow",
          "body": [
            "Pour un essai isolé avec des données fictives, utilisez un sujet de test et un cercle actif nommé Demo, centré sur la latitude 0 et la longitude 0, avec un rayon de 100 m. Laissez les filtres, délais, hystérésis et seuil de mouvement à zéro ou à leurs valeurs par défaut, et vérifiez qu’aucune autre zone admissible ne le chevauche.",
            "Envoyez 0, 0 : la zone actuelle doit devenir Demo. Envoyez 0.01, 0 : elle doit devenir not_defined si aucune autre zone admissible ne contient ce point. Créez un second Flow avec le déclencheur du sujet A changé de zone et utilisez les jetons Zone et Zone précédente de cet événement dans une notification.",
            "Supprimez le sujet et la zone de démonstration après l’essai. Rebranchez votre véritable source de coordonnées, vérifiez une arrivée et un départ, puis ajoutez les filtres et délais nécessaires un par un. Vérifiez aussi l’horodatage d’origine de la source, en plus des coordonnées reçues."
          ]
        },
        {
          "title": "5. Priorité et zone retenue",
          "body": [
            "GeoZones examine uniquement les zones actives qui autorisent le sujet ou l’évaluation de coordonnées brutes. Si plusieurs zones admissibles contiennent la position, la priorité numérique la plus élevée l’emporte. À priorité égale, la plus petite surface l’emporte. Une seule zone retenue devient la zone actuelle.",
            "Une zone inactive ne peut pas devenir la zone actuelle. not_defined signifie qu’aucune zone admissible ne correspond ; cela ne signifie pas forcément que les coordonnées sont absentes. Une grande zone englobante peut être retenue lorsqu’un sujet quitte une petite zone : quitter une zone ne produit donc pas toujours not_defined.",
            "Si le résultat vous surprend, vérifiez la priorité, la géométrie, l’activation et les filtres. La couleur sert uniquement de repère visuel et n’influence pas la correspondance."
          ]
        },
        {
          "title": "6. Tags, types et filtres des sujets",
          "body": [
            "Les tags décrivent l’usage d’une zone, par exemple maison, travail ou recharge. Les types de sujet décrivent les sujets, par exemple personne, voiture ou animal. Ces textes sont libres : ce ne sont pas des catégories automatiques. Les noms, types et tags sont comparés sans distinguer majuscules et minuscules ; gardez une orthographe cohérente. Séparez les éléments des listes par des virgules.",
            "Avec le filtre des sujets Tous, le filtre des types de sujet détermine l’admissibilité. Inclure seulement n’accepte que les noms de sujets listés : un sujet listé est autorisé même si son type serait exclu. Exclure rejette les noms listés ; les autres sujets restent soumis au filtre des types. Un sujet sans type est accepté par un filtre d’exclusion de types, mais pas par un filtre d’inclusion de types.",
            "Appliquer aux coordonnées sans sujet contrôle les cartes de l’application qui évaluent des coordonnées brutes. Ces cartes n’ont ni nom ou type de sujet, ni état précédent : les filtres des sujets, les délais de transition et l’hystérésis de la zone précédente ne s’appliquent pas. Elles évaluent la zone admissible retenue et ses tags, pas toutes les zones géométriquement superposées."
          ]
        },
        {
          "title": "7. Délais et hystérésis des cercles",
          "body": [
            "Le délai avant entrée reporte le passage vers une nouvelle zone retenue. Pour un passage direct de la zone A à la zone B, c’est le délai avant entrée de B qui s’applique. Le délai avant sortie de la zone précédente s’applique lorsque le résultat devient aucune zone. Si la zone candidate change pendant l’attente, la transition en attente est recalculée.",
            "Les minuteries des délais évaluent les dernières coordonnées stockées ; elles ne demandent pas de nouvelle position GPS et ne prouvent pas une présence physique continue. Utilisez une source fiable et vérifiez l’ancienneté de ses données lorsqu’une action différée est importante.",
            "L’hystérésis ne s’applique qu’aux cercles : la limite de sortie du cercle actuel est agrandie du nombre de mètres configuré. Un rayon de 100 m avec une hystérésis de 20 m peut maintenir le sujet dans le cercle jusqu’à 120 m. L’entrée initiale utilise toujours 100 m, les polygones n’ont pas d’hystérésis et les priorités des zones restent applicables."
          ]
        },
        {
          "title": "8. Seuil de mouvement et désactivation",
          "body": [
            "La distance minimale de mouvement se règle sur chaque appareil sujet. Si une mise à jour déplace le sujet de moins que ce seuil, les coordonnées stockées précédentes sont conservées pour limiter les fluctuations GPS. La première position valide est acceptée puisqu’il n’existe pas de position précédente. Utilisez 0 m pour diagnostiquer une source ou une limite de zone.",
            "Une mise à jour à l’intérieur de ce seuil enregistre tout de même son heure de réception et évalue la position conservée ; elle n’est pas entièrement ignorée. Le mouvement et la vitesse sont déduits des positions fournies et de leur chronologie ; ils ne proviennent pas de capteurs de mouvement indépendants et ne prouvent pas qu’une personne se déplace.",
            "Désactiver un sujet rejette les mises à jour de position et efface sa zone actuelle ainsi que sa transition en attente, tout en conservant ses dernières coordonnées et leur date. La réactivation évalue cette position stockée ; elle ne l’actualise pas depuis le téléphone."
          ]
        },
        {
          "title": "9. Événements, résultats et journaux fiables",
          "body": [
            "A changé de zone se déclenche lorsque la zone actuelle change, y compris vers ou depuis not_defined. Transition de zone distingue entrée et sortie ; ses jetons Zone et Tags de zone décrivent le lieu rejoint ou quitté. La position a changé exige une modification des coordonnées stockées, tandis qu’A été recalculé peut se déclencher même si la position et la zone restent identiques.",
            "Utilisez les jetons de l’événement déclencheur pour consigner un événement. Zone précédente est une valeur de transition enregistrée, pas un historique complet des déplacements : de A à B, elle vaut A ; de A à aucune zone, elle conserve A ; d’aucune zone à B, elle revient à not_defined. Récupérer l’état du sujet renvoie l’état actuel plutôt qu’un événement passé.",
            "Dans Advanced Flow, reliez les actions qui utilisent les résultats après la fin de la carte de position ou d’évaluation. Si vous copiez les jetons dans des variables, terminez ces écritures avant de journaliser les variables. Des branches parallèles peuvent sinon lire une ancienne valeur. Dans les déclencheurs globaux, les filtres de sujet et de type de sujet se cumulent ; les filtres de zone et de tag sont des alternatives."
          ]
        },
        {
          "title": "10. Conditions et distances",
          "body": [
            "Les conditions de zone d’un sujet utilisent sa zone actuelle stockée, en tenant compte d’un éventuel délai en attente. Les conditions sur coordonnées brutes calculent immédiatement leur propre zone retenue, sans modifier de sujet. Un point peut être géométriquement dans la zone sélectionnée mais ne pas satisfaire une condition sur coordonnées brutes si une autre zone admissible l’emporte.",
            "Pour les vérifications d’occupation d’une zone ou d’un tag, au moins signifie qu’au moins un occupant actuel correspond aux sujets ou types sélectionnés. Seulement signifie que tous les occupants actuels correspondent et que la zone n’est pas vide ; cela n’exige pas que tous les sujets de votre sélection soient présents.",
            "Les actions Flow de distance renvoient des distances géographiques en ligne droite et en mètres, pas des itinéraires routiers ou des temps de trajet. La distance à une zone est nulle à l’intérieur, sinon c’est la plus courte distance jusqu’à sa limite ; ce calcul géométrique ne tient pas compte de l’activation ou des filtres de sujet de la zone. La valeur de l’appareil Distance jusqu’à Homey s’affiche en kilomètres et utilise la position configurée de Homey, pas le GPS du téléphone."
          ]
        },
        {
          "title": "11. Ancienneté de la position et limites de la source",
          "body": [
            "Dernière mise à jour (last_update) indique quand GeoZones a reçu les coordonnées. Elle n’indique pas quand la source a mesuré la position GPS. Une source qui répète des coordonnées en cache peut donc afficher une réception récente pour une ancienne position. Vérifiez également l’horodatage propre à la source et sa fréquence de mise à jour.",
            "Les positions stockées n’expirent pas automatiquement. Les recalculs, minuteries et redémarrages de l’application réutilisent la dernière position sans la rendre récente. Récupérer l’état du sujet fournit Dernière mise à jour pour appliquer une règle d’ancienneté dans vos Flows ; rejetez les anciennes mesures en amont lorsque leur horodatage d’origine est disponible.",
            "L’ancienne sortie Source périmée n’assure pas la détection automatique des positions anciennes pour les sujets manuels. Les autorisations du téléphone, le comportement écran verrouillé, l’économie d’énergie et les périodes hors connexion relèvent de votre source externe. Testez ces situations avant de vous fier à un Flow d’arrivée, de départ ou d’alarme."
          ]
        },
        {
          "title": "12. Export, import et historique",
          "body": [
            "Copier et Télécharger exportent le brouillon de configuration actuel du navigateur, y compris les modifications non enregistrées. Enregistrez d’abord une configuration valide pour disposer d’une sauvegarde de configuration vérifiée. Un export de configuration ne sauvegarde pas intégralement les appareils manuels, leur état de fonctionnement, les Flows Homey ou la source externe ; la sauvegarde des anciennes données est un téléchargement distinct.",
            "Importer et remplacer remplace la configuration. Importer et fusionner les sections ne fusionne pas les zones une par une : fournir zones remplace toute la liste actuelle des zones, tandis que les champs fournis dans general et ui sont fusionnés avec ces réglages. Un tableau zones vide supprime toutes les zones. Exportez d’abord, lisez la confirmation et conservez les fichiers de coordonnées en lieu sûr.",
            "L’historique contient les configurations enregistrées précédentes, selon la durée de rétention définie dans Général, dans une limite de 100 entrées. Restaurer applique la configuration sélectionnée et recalcule les sujets ; cette action ne restaure pas d’anciennes mesures GPS ou des Flows. Supprimer une entrée d’historique retire cette version enregistrée."
          ]
        },
        {
          "title": "13. Mettre à jour et récupérer les anciens sujets",
          "body": [
            "Les anciennes versions utilisant des sujets liés nécessitent une migration. GeoZones conserve et vérifie les données anciennes d’origine avant conversion, mais les références de source préservées ne recréent pas les liaisons automatiques et les cartes Flow retirées ne sont pas restaurées.",
            "Dans Général, consultez Récupérer les anciens sujets et téléchargez la sauvegarde des anciennes données en la gardant privée. Utilisez ensuite Appareils > Ajouter un appareil > GeoZones > Sujet manuel, choisissez chaque ancien sujet dans la rubrique de récupération et récupérez-le. Gardez son nom si possible ; sinon, vérifiez les filtres qui utilisent les noms des sujets.",
            "Rebranchez les coordonnées avec la carte Flow actuelle de position et reconstruisez les Flows concernés. Vérifiez l’ancienneté de la position restaurée. Si la récupération signale une erreur, gardez la sauvegarde et les données d’origine, lisez le message et redémarrez pour réessayer une opération interrompue. Ne commencez pas par désinstaller : la désinstallation supprime les réglages de l’application."
          ]
        },
        {
          "title": "14. Dépannage",
          "body": [
            "Aucune mise à jour ou mauvaise zone : vérifiez que le sujet visé est activé, que le Flow de position s’exécute, que les deux coordonnées sont valides et récentes et que la zone est enregistrée et active. Utilisez temporairement un seul cercle, sans filtres, délais, hystérésis ni seuil de mouvement. Réactivez ensuite chaque option séparément.",
            "Carte absente : ses tuiles nécessitent un accès Internet à OpenStreetMap, mais leur absence n’empêche pas les calculs de zone. La géométrie existante reste accessible dans les champs numériques. Une modification invalide bloque l’enregistrement et l’export tant qu’elle n’est pas corrigée. Recharger abandonne les modifications non enregistrées ; copiez séparément les valeurs inachevées que vous souhaitez garder avant de recharger.",
            "Activez la journalisation détaillée dans Général uniquement le temps de reproduire un problème, puis désactivez-la. Pour un signalement, indiquez la version de l’application, le modèle et le micrologiciel Homey, la carte exacte, la source ainsi que des étapes anonymisées avec les résultats attendus et obtenus. Partagez un exemple minimal avec des données fictives plutôt qu’un historique de déplacements privés."
          ]
        },
        {
          "title": "15. Langue et confidentialité",
          "body": [
            "Cette aide et les réglages utilisent la langue communiquée par Homey à l’ouverture de la page : anglais, français, néerlandais ou allemand. Les autres langues Homey utilisent l’anglais par défaut. Rouvrez les réglages après avoir changé la langue de Homey. Vos noms de zones, tags, types de sujet et valeurs techniques enregistrées ne sont pas traduits.",
            "Les tuiles de la carte proviennent d’OpenStreetMap ; leurs requêtes communiquent à ce service la région consultée et votre adresse réseau. L’évaluation des zones s’effectue dans l’application sur Homey. Votre source de position externe a ses propres échanges réseau et règles de confidentialité.",
            "Les exports, sauvegardes de migration et journaux peuvent contenir des noms, des coordonnées et un historique de localisation. Gardez-les privés et retirez les données sensibles avant de partager un signalement. Cette aide est disponible dans l’application sans ouvrir le dépôt de code ; les images de la carte nécessitent toujours l’accès au service de tuiles."
          ]
        }
      ]
    },
    messages: {
      saved: 'Enregistré',
      loaded: 'Chargé',
      invalidJson: 'Fichier JSON invalide.',
      invalidImport: 'Importez un objet de configuration exporté. Le remplacement exige des zones ou des données de sujets anciens ; une valeur JSON vide ou sans rapport n’est pas une configuration.',
      confirmReplace: 'Remplacer la configuration actuelle par cet import ? Ses zones remplacent toutes les zones actuelles. Un tableau zones vide supprime toutes les zones.',
      confirmMergeZones: 'Les zones importées remplacent toutes les zones actuelles. Un tableau zones vide supprime toutes les zones. Continuer ?',
      downloadFailed: 'Impossible de télécharger le fichier d’export.',
      exportReady: 'Fichier d’export généré.',
      importApplied: 'Import appliqué.'
      ,invalidPolygonJson: 'Utilisez un tableau JSON d’au moins trois points {lat, lng} valides.',
      invalidZoneNumber: 'Saisissez des nombres valides dans les limites des coordonnées et des distances.',
      zoneNameRequired: 'Un nom de zone est requis.',
      configUnavailable: 'La configuration n’a pas pu être chargée. Rechargez les réglages avant d’exporter.',
      mapUnavailable: 'La carte n’a pas pu être chargée. Les zones existantes et les autres réglages restent disponibles. Rouvrez les réglages pour réessayer.',
    },
  },
  nl: {
    tabs: { zones: 'Zones', general: 'Algemeen', io: 'Import / Export', help: 'Help' },
    migration: {
      title: 'Vorige onderwerpen herstellen',
      pending: 'Oude onderwerpen die wachten op herstel: __count__. Al hersteld: __recovered__.',
      complete: 'Oude onderwerpen hersteld: __recovered__.',
      error: 'De herstelstatus kon niet worden gecontroleerd.',
      instructions: 'Voeg vanuit Apparaten een GeoZones-apparaat toe en kies de vorige onderwerpen bij het koppelen van een handmatig onderwerp. Deze actie is nodig voor herstel. Controleer en verbind daarna je Flows opnieuw; gekoppelde locatiebronnen moeten worden vervangen door coördinaatupdates vanuit een Flow.',
      downloadBackup: 'Back-up van vorige gegevens downloaden',
      backupPrivacy: 'Deze back-up kan gevoelige namen, posities en broninformatie bevatten. Hij wordt rechtstreeks in je browser gedownload; bewaar hem veilig.',
      noBackup: 'Er is geen gecontroleerde back-up beschikbaar.',
    },
    actions: { save: 'Opslaan', reload: 'Herladen', addCircle: 'Cirkel toevoegen', addPolygon: 'Polygoon toevoegen', fitAll: 'Alles tonen', deleteZone: 'Zone verwijderen' },
    map: {
      zoomIn: 'Inzoomen', zoomOut: 'Uitzoomen',
      circleStart: 'Klik en sleep om een cirkel te tekenen.', circleEnd: 'Laat los om het tekenen te voltooien.', radius: 'Straal',
      polygonStart: 'Klik om een polygoon te beginnen.', polygonContinue: 'Klik om een punt toe te voegen.', polygonEnd: 'Klik op het eerste punt om de polygoon te sluiten.',
      intersectionError: 'De zijden van de polygoon mogen elkaar niet kruisen.',
    },
    common: { name: 'Naam', color: 'Kleur', active: 'Actief', inactive: 'Inactief', priority: 'Prioriteit', tags: 'Tags', empty: '—' },
    zones: {
      editor: 'Zone',
      selectZone: 'Selecteer een zone',
      circle: 'Cirkel',
      polygon: 'Polygoon',
      centerLat: 'Breedtegraad middelpunt',
      centerLng: 'Lengtegraad middelpunt',
      radius: 'Straal (m)',
      points: 'Polygoonpunten (JSON)',
      advanced: 'Geavanceerde opties',
      entryDelay: 'Ingangsvertraging (s)',
      entryDelayHelp: "Vertraging voordat naar een nieuwe winnende zone wordt overgeschakeld. Gebruikt de laatst opgeslagen coördinaten, zonder een nieuwe GPS-meting op te vragen.",
      exitDelay: 'Uitgangsvertraging (s)',
      exitDelayHelp: "Vertraging voordat de huidige zone wordt verlaten zonder nieuwe zone. Bij een directe overgang naar een andere zone geldt de ingangsvertraging van die bestemming.",
      hysteresis: 'Hysterese (m)',
      hysteresisHelp: 'Alleen voor cirkels. Vergroot de cirkel-uitgangsdrempel om schommelingen aan de rand te beperken.',
      appliesWithoutSubject: 'Toepassen op coördinaten zonder onderwerp',
      appliesWithoutSubjectHelp: 'Gebruikt door kaarten die ruwe coördinaten zonder onderwerpapparaat evalueren.',
      subjectFilterMode: 'Onderwerpfilter',
      subjectFilterHelp: "Alleen opnemen staat de opgegeven namen toe, ook als hun type is uitgesloten. Uitsluiten weigert de opgegeven namen; andere onderwerpen worden nog aan het typefilter getoetst. Hoofdletters maken bij namen geen verschil.",
      subjectFilterValues: 'Onderwerpen (kommagescheiden namen)',
      subjectTypeMode: 'Onderwerpstypefilter',
      subjectTypeFilterHelp: 'Sta alle onderwerpstypen toe, alleen de opgegeven typen of alle behalve de opgegeven typen. Onderwerpstypen zijn vrije tekstwaarden, bijvoorbeeld persoon, auto, fiets of huisdier.',
      subjectTypeValues: 'Onderwerpstypen (kommagescheiden)',
      filterAll: 'Alle',
      filterInclude: 'Alleen opnemen',
      filterExclude: 'Uitsluiten',
      filterPriority: "Expliciet opnemen op naam gaat vóór het type; bij Uitsluiten worden niet-opgegeven onderwerpen nog aan het typefilter getoetst.",
      addTag: 'Tag toevoegen',
      tagPlaceholder: 'Voer een tag in',
      tagsHelp: 'Tags zijn vrije tekstwaarden die beschrijven waarvoor een zone wordt gebruikt, bijvoorbeeld thuis, werk, school, opladen of familie. Gebruik overal dezelfde schrijfwijze.',
    },
    general: {
      historyTitle: 'Configuratiegeschiedenis',
      historyHelp: "Eerder opgeslagen configuraties, beperkt door deze bewaartermijn en tot maximaal 100 versies. Maakt geen back-up van apparaten of Flows.",
      historyDays: 'Bewaartermijn (dagen)',
      debugTitle: 'Debug',
      heavyDebug: 'Gedetailleerde logging inschakelen',
      heavyDebugHelp: 'Schakel gedetailleerde logging alleen in om een probleem te onderzoeken. Het voegt beslissingslogs toe voor zone-evaluatie en moet niet langer aan blijven dan nodig.',
    },
    io: {
      exportTitle: 'Export',
      copy: 'Kopiëren',
      download: 'Downloaden',
      importTitle: 'Import',
      copyCurrent: 'Huidige configuratie kopiëren',
      loadFile: 'Bestand laden',
      importReplace: 'Importeren en vervangen',
      importMerge: 'Secties importeren en samenvoegen',
      importWarning: "Exports kunnen gevoelige coördinaten bevatten. Geïmporteerde zones vervangen de hele huidige zonelijst; er wordt niet per zone samengevoegd. Bij samenvoegen worden de opgegeven algemene en interfacevelden gecombineerd. Exporteer eerst en controleer de bevestiging.",
      history: 'Geschiedenis',
      restore: 'Herstellen',
      remove: 'Verwijderen',
    },
    help: {
      "title": "Help",
      "intro": "GeoZones zet coördinaten van je eigen locatiebron om in herbruikbare geografische zones voor Homey Flows. De app bepaalt zelf geen telefoonlocaties. Begin met de eerste vier onderdelen en open daarna de onderwerpen die je nodig hebt.",
      "sections": [
        {
          "title": "1. Eerste installatie",
          "body": [
            "Je hebt GeoZones op een compatibele lokale Homey Pro nodig, plus een aparte bron die al breedte- en lengtegraad aan Homey levert. Alleen weten of een telefoon aanwezig is, levert geen coördinaten op. GeoZones heeft geen ingebouwde telefoon-GPS of tracking via Find My of Home Assistant.",
            "Maak in Zones één actieve cirkel en sla die op. Open in Homey Apparaten > Apparaat toevoegen > GeoZones > Handmatig onderwerp, geef het onderwerp een unieke naam en laat het ingeschakeld. Begin met een minimale bewegingsafstand van 0 m, zonder filters, vertragingen of hysterese.",
            "Maak een Flow die wordt gestart wanneer je bron de positie bijwerkt. Gebruik de actie van het onderwerpapparaat om de positie op [breedtegraad], [lengtegraad] in te stellen en te evalueren. Geef beide getallen uit dezelfde positiemeting door. Handmatig betekent dat een Flow de coördinaten aanlevert; die Flow kan automatisch worden uitgevoerd."
          ]
        },
        {
          "title": "2. Zones tekenen, bewerken en opslaan",
          "body": [
            "Kies Cirkel toevoegen en sleep op de kaart. Of kies Polygoon toevoegen, voeg de hoekpunten toe en selecteer het eerste punt opnieuw om de vorm te sluiten. Selecteer een zone om de naam, kleur, actieve status, prioriteit en vorm te bewerken. Alles tonen past de kaart aan zodat alle zonevormen in het huidige concept zichtbaar zijn.",
            "Stel voor een cirkel de breedte- en lengtegraad van het middelpunt en de straal in meters in. Een polygoon heeft minstens drie geldige punten, een meetbaar oppervlak en geen kruisende zijden nodig. De numerieke editor accepteert een JSON-array van punten met {lat, lng}. Een zonenaam moet uniek zijn; gereserveerde statusnamen zoals not_defined zijn niet toegestaan.",
            "Wijzigingen blijven in het browserconcept totdat Opslaan is gelukt. Herladen vervangt dat concept door de opgeslagen configuratie en verwijdert niet-opgeslagen wijzigingen. Opslaan past de configuratie toe en berekent onderwerpen opnieuw met hun opgeslagen coördinaten; er wordt geen nieuwe positie bij de locatiebron opgevraagd."
          ]
        },
        {
          "title": "3. Onderwerpen en coördinaten invoeren",
          "body": [
            "Een onderwerp is een Homey-apparaat dat een persoon, voertuig, huisdier of ander object voorstelt. Maak voor elk onderwerp één apparaat. Het optionele onderwerpstype is vrije tekst; gebruik dezelfde schrijfwijze in de apparaatinstellingen, zonefilters en Flows. Controleer filters op naam wanneer je een onderwerp hernoemt.",
            "De positieactie heeft een volledig paar nodig: een breedtegraad van -90 tot 90 en een lengtegraad van -180 tot 180. Verwissel ze niet. Nul is geldig; een lege waarde niet. Als je bron beide waarden afzonderlijk verstuurt, verzamel dan eerst een volledig paar dat bij dezelfde positie hoort voordat je de actie uitvoert.",
            "Een nieuw onderwerp heeft pas een bruikbare positie nadat het geldige coördinaten heeft ontvangen. De aparte actie Onderwerp evalueren gebruikt de opgeslagen positie opnieuw. Die actie start geen telefoontracking en werkt de bron niet bij."
          ]
        },
        {
          "title": "4. Je eerste Flow controleren",
          "body": [
            "Gebruik voor een afzonderlijke fictieve test een testonderwerp en een actieve cirkel met de naam Demo, met het middelpunt op breedtegraad 0 en lengtegraad 0 en een straal van 100 m. Laat filters, vertragingen, hysterese en bewegingsdrempel op nul of hun standaardwaarde staan. Zorg dat geen andere toegestane zone de cirkel overlapt.",
            "Verstuur 0, 0: de huidige zone moet Demo worden. Verstuur 0.01, 0: de zone moet not_defined worden als geen andere toegestane zone het punt bevat. Maak een tweede Flow met de onderwerptrigger Van zone veranderd en gebruik de tokens Zone en Vorige zone van dat gebeurtenisbericht in een melding.",
            "Verwijder na de test het demonstratieonderwerp en de demonstratiezone. Verbind je echte locatiebron opnieuw, controleer een aankomst en vertrek en voeg daarna de gewenste filters en vertragingen één voor één toe. Controleer naast de ontvangen coördinaten ook het oorspronkelijke tijdstip bij de bron."
          ]
        },
        {
          "title": "5. Prioriteit en de winnende zone",
          "body": [
            "GeoZones bekijkt alleen actieve zones die het onderwerp of een evaluatie zonder onderwerp toestaan. Als meerdere toegestane zones de positie bevatten, wint de hoogste numerieke prioriteit. Bij gelijke prioriteit wint het kleinste oppervlak. Slechts één winnende zone wordt de huidige zone.",
            "Een inactieve zone kan niet de huidige zone worden. not_defined betekent dat geen toegestane zone overeenkwam; het betekent niet noodzakelijk dat coördinaten ontbreken. Een grotere omliggende zone kan winnen wanneer een onderwerp een kleinere verlaat. Het verlaten van een zone hoeft dus niet tot not_defined te leiden.",
            "Controleer prioriteit, vorm, actieve status en filters als het resultaat onverwacht is. Kleur is alleen een visueel hulpmiddel en heeft geen invloed op de beoordeling."
          ]
        },
        {
          "title": "6. Tags, typen en onderwerpfilters",
          "body": [
            "Tags beschrijven het gebruik van een zone, bijvoorbeeld thuis, werk of opladen. Onderwerpstypen beschrijven onderwerpen, bijvoorbeeld persoon, auto of huisdier. Beide zijn vrij gekozen tekst en geen automatische categorieën. Bij namen, typen en tags wordt geen onderscheid gemaakt tussen hoofdletters en kleine letters; houd de schrijfwijze wel gelijk. Scheid waarden in lijsten met komma’s.",
            "Als het onderwerpfilter op Alle staat, bepaalt het filter op onderwerpstype of een onderwerp is toegestaan. Alleen opnemen staat uitsluitend de opgegeven onderwerpnamen toe: een opgegeven onderwerp is toegestaan, ook als het type anders zou worden uitgesloten. Uitsluiten weigert de opgegeven namen; andere onderwerpen worden nog aan het typefilter getoetst. Een onderwerp zonder type wordt toegestaan door een typefilter dat uitsluit, maar niet door een typefilter dat alleen opgegeven typen opneemt.",
            "Toepassen op coördinaten zonder onderwerp regelt de appkaarten die losse coördinaten evalueren. Deze kaarten hebben geen onderwerpnaam, type of vorige status. Onderwerpfilters, overgangsvertragingen en hysterese op basis van de vorige zone zijn daarom niet van toepassing. Ze beoordelen de winnende toegestane zone en de tags daarvan, niet elke zone die het punt geometrisch overlapt."
          ]
        },
        {
          "title": "7. Vertragingen en cirkelhysterese",
          "body": [
            "De ingangsvertraging stelt een overgang naar een nieuwe winnende zone uit. Bij een rechtstreekse overgang van zone A naar zone B geldt de ingangsvertraging van B. De uitgangsvertraging van de vorige zone geldt wanneer het resultaat geen zone meer is. Als de kandidaat-zone tijdens het wachten verandert, wordt de nog niet voltooide overgang opnieuw berekend.",
            "Vertragingstimers evalueren de laatst opgeslagen coördinaten. Ze vragen geen nieuwe GPS-positie op en bewijzen niet dat iemand in werkelijkheid onafgebroken aanwezig is geweest. Gebruik een betrouwbare bron van updates en controleer de ouderdom van de positie als een vertraagde actie belangrijk is.",
            "Hysterese geldt alleen voor cirkels: de uitgangsgrens van de huidige cirkel wordt met het ingestelde aantal meters verruimd. Een straal van 100 m met 20 m hysterese kan de huidige cirkel tot 120 m vasthouden. Voor de eerste binnenkomst blijft 100 m gelden. Polygonen hebben geen hysterese en zoneprioriteiten blijven van toepassing."
          ]
        },
        {
          "title": "8. Bewegingsdrempel en uitschakelen",
          "body": [
            "De minimale bewegingsafstand wordt per onderwerpapparaat ingesteld. Bij een update op een kleinere afstand dan deze drempel blijven de vorige opgeslagen coördinaten behouden om GPS-ruis te verminderen. De eerste geldige positie wordt geaccepteerd omdat er nog geen vorige positie is. Gebruik 0 m bij het onderzoeken van een bron of zonegrens.",
            "Een update binnen de bewegingsdrempel registreert nog steeds het ontvangsttijdstip en evalueert de behouden positie; de update wordt dus niet volledig genegeerd. Beweging en snelheid worden afgeleid van aangeleverde posities en tijdstippen. Ze komen niet van aparte bewegingssensoren en bewijzen niet dat een persoon beweegt.",
            "Het uitschakelen van een onderwerp weigert positie-updates en wist de huidige zone en de nog niet voltooide overgang. De laatste coördinaten en hun tijdstip blijven bewaard. Opnieuw inschakelen evalueert die opgeslagen positie; de positie wordt niet opnieuw bij de telefoon opgehaald."
          ]
        },
        {
          "title": "9. Gebeurtenissen, resultaten en betrouwbare logs",
          "body": [
            "Van zone veranderd wordt geactiveerd wanneer de huidige zone verandert, ook bij overgangen naar of vanuit not_defined. Zoneovergang onderscheidt binnenkomst en vertrek; de tokens Zone en Zone-tags beschrijven de plek die wordt betreden of verlaten. Positie gewijzigd vereist gewijzigde opgeslagen coördinaten. Werd opnieuw berekend kan ook worden geactiveerd als de positie en zone gelijk blijven.",
            "Gebruik voor gebeurtenislogs de tokens van de gebeurtenis die de Flow startte. Vorige zone is een opgeslagen overgangswaarde, geen volledige reisgeschiedenis: bij A naar B is de waarde A, bij A naar geen zone blijft A behouden en bij geen zone naar B wordt de waarde not_defined. Onderwerpstatus ophalen geeft de huidige momentopname terug, geen gebeurtenisrecord.",
            "Verbind in Advanced Flow acties die geretourneerde resultaten gebruiken pas na voltooiing van de positie- of evaluatiekaart. Als je tokens naar variabelen kopieert, laat die schrijfacties dan eerst voltooien voordat je de variabelen logt. Parallelle takken kunnen anders een oudere waarde lezen. Bij globale triggers moeten het onderwerpfilter en het typefilter allebei overeenkomen; geselecteerde zone- en tagfilters zijn alternatieven."
          ]
        },
        {
          "title": "10. Voorwaarden en afstanden",
          "body": [
            "Zonevoorwaarden voor een onderwerp gebruiken de opgeslagen huidige zone, inclusief een nog niet verstreken vertraging. Voorwaarden voor losse coördinaten berekenen direct hun eigen winnende zone, zonder een onderwerp te wijzigen. Een punt kan geometrisch in de gekozen zone liggen en toch niet aan zo’n voorwaarde voldoen als een andere toegestane zone wint.",
            "Bij bezettingscontroles voor zones en tags betekent Ten minste dat minstens één huidig aanwezig onderwerp overeenkomt met de geselecteerde onderwerpen of typen. Alleen betekent dat alle huidige aanwezigen overeenkomen en dat de zone niet leeg is. Het vereist niet dat elk onderwerp uit je selectie aanwezig is.",
            "Flow-acties voor afstanden geven hemelsbrede geografische afstanden in meters, geen wegroutes of reistijden. De afstand tot een zone is nul binnen de zone en anders de kortste afstand tot de grens. Bij deze geometrische afstand zijn de actieve status en onderwerpfilters van de zone niet van toepassing. Afstand tot Homey op het apparaat wordt in kilometers weergegeven en gebruikt de ingestelde locatie van Homey, niet de GPS van de telefoon."
          ]
        },
        {
          "title": "11. Ouderdom van posities en beperkingen van de bron",
          "body": [
            "Laatste update (last_update) registreert wanneer GeoZones coördinaten heeft ontvangen. Het vertelt niet wanneer de bron de GPS-positie heeft gemeten. Een bron die coördinaten uit een cache herhaalt, kan het ontvangsttijdstip daardoor recent laten lijken. Controleer ook het eigen tijdstip en de updatefrequentie van de bron.",
            "Opgeslagen posities verlopen niet automatisch. Herberekeningen, vertragingstimers en herstarts van de app gebruiken de laatste positie opnieuw en maken die niet actueler. Onderwerpstatus ophalen geeft Laatste update door, zodat je Flows een regel voor de ouderdom kunnen toepassen. Weiger oude metingen al bij de bron of in de aanleverende Flow wanneer hun oorspronkelijke tijdstip beschikbaar is.",
            "De oude uitvoer Bron verouderd voert voor handmatige onderwerpen geen automatische controle op actualiteit uit. Telefoonmachtigingen, gedrag bij een vergrendeld scherm, energiebesparing en offlineperioden worden door je externe bron geregeld. Test deze omstandigheden voordat je op een aankomst-, vertrek- of alarm-Flow vertrouwt."
          ]
        },
        {
          "title": "12. Export, import en geschiedenis",
          "body": [
            "Kopiëren en Downloaden exporteren het huidige configuratieconcept uit je browser, inclusief niet-opgeslagen wijzigingen. Sla eerst een geldige configuratie op als je een gecontroleerde configuratieback-up nodig hebt. Een configuratie-export is geen volledige back-up van handmatige apparaten, hun actuele status, Homey Flows of de externe bron. De back-up van oude gegevens is een aparte download.",
            "Importeren en vervangen vervangt de configuratie. Secties importeren en samenvoegen voegt geen afzonderlijke zones samen: aangeleverde zones vervangen de volledige huidige zonelijst, terwijl aangeleverde velden in general en ui met die instellingen worden samengevoegd. Een lege zones-array verwijdert alle zones. Exporteer eerst, lees de bevestiging en bewaar bestanden met privécoördinaten veilig.",
            "De geschiedenis bevat eerder opgeslagen configuraties, beperkt tot de bewaartermijn in Algemeen en maximaal 100 items. Herstellen past de gekozen configuratie toe en berekent onderwerpen opnieuw; oude GPS-posities of Flows worden niet hersteld. Een geschiedenisitem verwijderen wist die opgeslagen versie."
          ]
        },
        {
          "title": "13. Bijwerken en oude onderwerpen herstellen",
          "body": [
            "Oudere versies met gekoppelde onderwerpen moeten worden gemigreerd. GeoZones bewaart en controleert de oorspronkelijke oude gegevens vóór de omzetting. Bewaarde bronverwijzingen maken echter geen automatische koppelingen opnieuw aan en verwijderde Flow-kaarten worden niet teruggezet.",
            "Bekijk in Algemeen het onderdeel Vorige onderwerpen herstellen en download de back-up van vorige gegevens naar een veilige privéopslag. Open daarna Apparaten > Apparaat toevoegen > GeoZones > Handmatig onderwerp, kies elk oud onderwerp in het herstelgedeelte en herstel het. Behoud waar mogelijk de naam; controleer anders filters op onderwerpnaam.",
            "Verbind de coördinaten opnieuw via de huidige positiekaart en bouw betrokken Flows opnieuw op. Controleer de ouderdom van de herstelde positie. Bewaar bij een herstelfout de back-up en oorspronkelijke gegevens, lees de melding en herstart om een onderbroken bewerking opnieuw te proberen. Verwijder de app niet als eerste herstelstap: daarmee worden de appinstellingen gewist."
          ]
        },
        {
          "title": "14. Problemen oplossen",
          "body": [
            "Geen update of een verkeerde zone: controleer of het bedoelde onderwerp is ingeschakeld, de positie-Flow werkelijk wordt uitgevoerd, beide coördinaten geldig en actueel zijn en de zone opgeslagen en actief is. Gebruik tijdelijk één cirkel zonder filters, vertragingen, hysterese of bewegingsdrempel. Zet daarna elke optie afzonderlijk terug.",
            "Ontbrekende kaart: kaarttegels vereisen internettoegang tot OpenStreetMap, maar ontbrekende tegels stoppen de zoneberekeningen niet. De bestaande vorm blijft via numerieke velden beschikbaar. Een ongeldige wijziging blokkeert opslaan en exporteren totdat die is hersteld. Herladen verwijdert niet-opgeslagen wijzigingen; kopieer onafgemaakte waarden die je wilt bewaren daarom eerst apart.",
            "Gebruik gedetailleerde logging in Algemeen alleen tijdens het reproduceren van een probleem en schakel die daarna uit. Vermeld in een melding de appversie, het Homey-model en de firmware, de exacte kaart, de bron en geanonimiseerde stappen met verwacht en werkelijk resultaat. Deel een klein fictief voorbeeld in plaats van je eigen verplaatsingsgeschiedenis."
          ]
        },
        {
          "title": "15. Taal en privacy",
          "body": [
            "Deze help en de instellingen gebruiken de taal die Homey bij het openen van de pagina doorgeeft: Engels, Frans, Nederlands of Duits. Voor andere Homey-talen wordt Engels gebruikt. Open de instellingen opnieuw nadat je de taal van Homey hebt gewijzigd. Je eigen zonenamen, tags, onderwerpstypen en opgeslagen technische waarden worden niet vertaald.",
            "Kaarttegels komen van OpenStreetMap; de aanvragen delen het bekeken kaartgebied en je netwerkadres met die dienst. Zoneberekeningen worden in de app op Homey uitgevoerd. Je externe locatiebron heeft eigen netwerkverkeer en privacyregels.",
            "Exports, migratieback-ups en logs kunnen namen, coördinaten en locatiegeschiedenis bevatten. Bewaar ze privé en verwijder gevoelige gegevens voordat je een melding deelt. Deze help is beschikbaar in de app zonder de repository te openen; kaartbeelden hebben nog wel hun tegeldienst nodig."
          ]
        }
      ]
    },
    messages: {
      saved: 'Opgeslagen',
      loaded: 'Geladen',
      invalidJson: 'Ongeldig JSON-bestand.',
      invalidImport: 'Importeer een geëxporteerd configuratieobject. Vervangen vereist zones of oude onderwerpgegevens; een lege of ongerelateerde JSON-waarde is geen configuratie.',
      confirmReplace: 'De huidige configuratie vervangen door deze import? De zones vervangen alle huidige zones. Een lege zones-array verwijdert alle zones.',
      confirmMergeZones: 'De geïmporteerde zones vervangen alle huidige zones. Een lege zones-array verwijdert alle zones. Doorgaan?',
      downloadFailed: 'Exportbestand kan niet worden gedownload.',
      exportReady: 'Exportbestand gegenereerd.',
      importApplied: 'Import toegepast.',
      invalidPolygonJson: 'Gebruik een JSON-array met minstens drie geldige {lat, lng}-punten.',
      invalidZoneNumber: 'Voer geldige getallen binnen de toegestane coördinaat- en afstandsgrenzen in.',
      zoneNameRequired: 'Een zonenaam is vereist.',
      configUnavailable: 'De configuratie kon niet laden. Herlaad de instellingen voordat je exporteert.',
      mapUnavailable: 'De kaart kon niet laden. Bestaande zones en de andere instellingen blijven beschikbaar. Open de instellingen opnieuw om het nogmaals te proberen.',
    },
  },
  de: {
    tabs: { zones: 'Zonen', general: 'Allgemein', io: 'Import / Export', help: 'Hilfe' },
    migration: {
      title: 'Frühere Subjekte wiederherstellen',
      pending: 'Noch wiederherzustellende frühere Subjekte: __count__. Bereits wiederhergestellt: __recovered__.',
      complete: 'Wiederhergestellte frühere Subjekte: __recovered__.',
      error: 'Der Wiederherstellungsstatus konnte nicht geprüft werden.',
      instructions: 'Fügen Sie unter Geräte ein GeoZones-Gerät hinzu und wählen Sie beim Koppeln eines manuellen Subjekts die früheren Subjekte aus. Diese Aktion ist erforderlich. Prüfen und verbinden Sie danach Ihre Flows erneut; verknüpfte Standortquellen müssen durch Koordinatenaktualisierungen aus einem Flow ersetzt werden.',
      downloadBackup: 'Sicherung früherer Daten herunterladen',
      backupPrivacy: 'Diese Sicherung kann sensible Namen, Positionen und Quelleninformationen enthalten. Sie wird direkt im Browser heruntergeladen; bewahren Sie sie sicher auf.',
      noBackup: 'Keine geprüfte Sicherung verfügbar.',
    },
    actions: { save: 'Speichern', reload: 'Neu laden', addCircle: 'Kreis hinzufügen', addPolygon: 'Polygon hinzufügen', fitAll: 'Alles anzeigen', deleteZone: 'Zone löschen' },
    map: {
      zoomIn: 'Vergrößern', zoomOut: 'Verkleinern',
      circleStart: 'Klicken und ziehen Sie, um einen Kreis zu zeichnen.', circleEnd: 'Lassen Sie los, um die Zeichnung abzuschließen.', radius: 'Radius',
      polygonStart: 'Klicken Sie, um ein Polygon zu beginnen.', polygonContinue: 'Klicken Sie, um einen Punkt hinzuzufügen.', polygonEnd: 'Klicken Sie auf den ersten Punkt, um das Polygon zu schließen.',
      intersectionError: 'Die Seiten des Polygons dürfen sich nicht kreuzen.',
    },
    common: { name: 'Name', color: 'Farbe', active: 'Aktiv', inactive: 'Inaktiv', priority: 'Priorität', tags: 'Tags', empty: '—' },
    zones: {
      editor: 'Zone',
      selectZone: 'Zone auswählen',
      circle: 'Kreis',
      polygon: 'Polygon',
      centerLat: 'Breitengrad des Mittelpunkts',
      centerLng: 'Längengrad des Mittelpunkts',
      radius: 'Radius (m)',
      points: 'Polygonpunkte (JSON)',
      advanced: 'Erweiterte Optionen',
      entryDelay: 'Eintrittsverzögerung (s)',
      entryDelayHelp: "Verzögerung vor dem Wechsel in eine neue Gewinnerzone. Verwendet die zuletzt gespeicherten Koordinaten, ohne eine neue GPS-Messung anzufordern.",
      exitDelay: 'Austrittsverzögerung (s)',
      exitDelayHelp: "Verzögerung vor dem Wechsel von der aktuellen Zone zu keiner Zone. Beim direkten Wechsel in eine andere Zone gilt die Eintrittsverzögerung des Ziels.",
      hysteresis: 'Hysterese (m)',
      hysteresisHelp: 'Nur für Kreise. Vergrößert die Austrittsschwelle des Kreises, um Schwanken am Rand zu reduzieren.',
      appliesWithoutSubject: 'Auf Koordinaten ohne Subjekt anwenden',
      appliesWithoutSubjectHelp: 'Wird von Karten verwendet, die rohe Koordinaten ohne Subjektgerät auswerten.',
      subjectFilterMode: 'Subjektfilter',
      subjectFilterHelp: "Nur einschließen erlaubt die aufgeführten Namen auch dann, wenn ihr Typ ausgeschlossen ist. Ausschließen lehnt die aufgeführten Namen ab; andere Subjekte werden weiterhin nach Typ gefiltert. Groß- und Kleinschreibung der Namen spielen keine Rolle.",
      subjectFilterValues: 'Subjekte (kommagetrennte Namen)',
      subjectTypeMode: 'Subjekttypfilter',
      subjectTypeFilterHelp: 'Wählen Sie, ob alle Subjekttypen, nur die angegebenen Typen oder alle außer den angegebenen Typen zugelassen sind. Subjekttypen sind freie Textwerte, zum Beispiel Person, Auto, Fahrrad oder Haustier.',
      subjectTypeValues: 'Subjekttypen (kommagetrennt)',
      filterAll: 'Alle',
      filterInclude: 'Nur einschließen',
      filterExclude: 'Ausschließen',
      filterPriority: "Ein ausdrücklicher Einschluss nach Namen hat Vorrang vor dem Typ; bei Ausschließen werden nicht aufgeführte Subjekte weiterhin nach Typ gefiltert.",
      addTag: 'Tag hinzufügen',
      tagPlaceholder: 'Tag eingeben',
      tagsHelp: 'Tags sind freie Textwerte, die die Nutzung einer Zone beschreiben, zum Beispiel Zuhause, Arbeit, Schule, Laden oder Familie. Verwenden Sie überall dieselbe Schreibweise.',
    },
    general: {
      historyTitle: 'Konfigurationsverlauf',
      historyHelp: "Früher gespeicherte Konfigurationen, begrenzt durch diese Aufbewahrungsdauer und auf höchstens 100 Einträge. Sichert keine Geräte oder Flows.",
      historyDays: 'Aufbewahrung (Tage)',
      debugTitle: 'Debug',
      heavyDebug: 'Detaillierte Protokollierung aktivieren',
      heavyDebugHelp: 'Aktivieren Sie die detaillierte Protokollierung nur, um ein Problem zu untersuchen. Sie fügt Entscheidungslogs für die Zonenauswertung hinzu und sollte nicht länger als nötig aktiv bleiben.',
    },
    io: {
      exportTitle: 'Export',
      copy: 'Kopieren',
      download: 'Herunterladen',
      importTitle: 'Import',
      copyCurrent: 'Von aktueller Version kopieren',
      loadFile: 'Datei laden',
      importReplace: 'Importieren und ersetzen',
      importMerge: 'Abschnitte importieren und zusammenführen',
      importWarning: "Exporte können sensible Koordinaten enthalten. Importierte Zonen ersetzen die gesamte aktuelle Zonenliste; einzelne Zonen werden nicht zusammengeführt. Beim Zusammenführen werden die angegebenen allgemeinen und Oberflächenfelder kombiniert. Exportieren Sie zuerst und prüfen Sie die Bestätigung.",
      history: 'Verlauf',
      restore: 'Wiederherstellen',
      remove: 'Löschen',
    },
    help: {
      "title": "Hilfe",
      "intro": "GeoZones wandelt Koordinaten aus Ihrer eigenen Standortquelle in wiederverwendbare geografische Zonen für Homey Flows um. Die App ortet selbst keine Telefone. Beginnen Sie mit den ersten vier Abschnitten und öffnen Sie anschließend die Themen, die Sie benötigen.",
      "sections": [
        {
          "title": "1. Erste Einrichtung",
          "body": [
            "Sie benötigen GeoZones auf einem kompatiblen lokalen Homey Pro und eine separate Quelle, die bereits Breiten- und Längengrad an Homey liefert. Die reine Anwesenheit eines Telefons liefert keine Koordinaten. GeoZones enthält weder eine eigene Telefon-GPS-Ortung noch eine integrierte Ortung über Find My oder Home Assistant.",
            "Erstellen und speichern Sie unter Zonen einen aktiven Kreis. Öffnen Sie in Homey Geräte > Gerät hinzufügen > GeoZones > Manuelles Subjekt, vergeben Sie einen eindeutigen Namen und lassen Sie das Subjekt aktiviert. Beginnen Sie mit einer minimalen Bewegungsdistanz von 0 m, ohne Filter, Verzögerungen oder Hysterese.",
            "Erstellen Sie einen Flow, der bei einer Positionsaktualisierung Ihrer Quelle ausgeführt wird. Verwenden Sie die Aktion des Subjektgeräts, um die Position auf [Breitengrad], [Längengrad] zu setzen und auszuwerten. Übergeben Sie beide Zahlen aus derselben Positionsmessung. Manuell bedeutet, dass ein Flow die Koordinaten liefert; dieser Flow kann automatisch ausgeführt werden."
          ]
        },
        {
          "title": "2. Zonen zeichnen, bearbeiten und speichern",
          "body": [
            "Wählen Sie Kreis hinzufügen und ziehen Sie auf der Karte. Oder wählen Sie Polygon hinzufügen, setzen Sie die Eckpunkte und wählen Sie den ersten Punkt erneut, um die Form zu schließen. Wählen Sie eine Zone aus, um Name, Farbe, Aktivierung, Priorität und Form zu bearbeiten. Alles anzeigen passt den Kartenausschnitt so an, dass alle Zonenformen des aktuellen Entwurfs sichtbar sind.",
            "Legen Sie für einen Kreis Breiten- und Längengrad des Mittelpunkts sowie den Radius in Metern fest. Ein Polygon benötigt mindestens drei gültige Punkte, eine messbare Fläche und darf keine sich kreuzenden Seiten haben. Der numerische Editor akzeptiert ein JSON-Array aus Punkten mit {lat, lng}. Ein Zonenname muss eindeutig sein; reservierte Zustandsnamen wie not_defined sind nicht zulässig.",
            "Änderungen bleiben im Browserentwurf, bis Speichern erfolgreich abgeschlossen ist. Neu laden ersetzt diesen Entwurf durch die gespeicherte Konfiguration und verwirft ungespeicherte Änderungen. Speichern wendet die Konfiguration an und berechnet Subjekte anhand ihrer gespeicherten Koordinaten neu. Dabei wird keine neue Position von der Standortquelle angefordert."
          ]
        },
        {
          "title": "3. Subjekte und Koordinateneingabe",
          "body": [
            "Ein Subjekt ist ein Homey-Gerät, das eine Person, ein Fahrzeug, ein Haustier oder ein anderes Objekt darstellt. Erstellen Sie für jedes Subjekt ein eigenes Gerät. Der optionale Subjekttyp ist frei wählbarer Text; verwenden Sie in Geräteeinstellungen, Zonenfiltern und Flows dieselbe Schreibweise. Prüfen Sie namensbasierte Filter, wenn Sie ein Subjekt umbenennen.",
            "Die Positionsaktion benötigt ein vollständiges Paar: einen Breitengrad von -90 bis 90 und einen Längengrad von -180 bis 180. Vertauschen Sie die Werte nicht. Null ist gültig, ein leerer Wert nicht. Wenn Ihre Quelle beide Werte getrennt sendet, sammeln Sie zunächst ein vollständiges, zusammengehöriges Koordinatenpaar und führen Sie dann die Aktion aus.",
            "Ein neues Subjekt hat erst dann eine nutzbare Position, wenn es gültige Koordinaten erhalten hat. Die separate Aktion Subjekt auswerten verwendet die gespeicherte Position erneut. Sie startet keine Telefonortung und aktualisiert die Quelle nicht."
          ]
        },
        {
          "title": "4. Den ersten Flow prüfen",
          "body": [
            "Verwenden Sie für einen getrennten Test mit fiktiven Daten ein Testsubjekt und einen aktiven Kreis namens Demo mit Mittelpunkt auf Breitengrad 0, Längengrad 0 und einem Radius von 100 m. Lassen Sie Filter, Verzögerungen, Hysterese und Bewegungsschwelle auf null beziehungsweise den Standardwerten. Stellen Sie sicher, dass keine andere zulässige Zone den Kreis überlappt.",
            "Senden Sie 0, 0: Die aktuelle Zone sollte Demo werden. Senden Sie 0.01, 0: Die Zone sollte not_defined werden, wenn keine andere zulässige Zone den Punkt enthält. Erstellen Sie einen zweiten Flow mit dem Subjektauslöser Zone gewechselt und verwenden Sie dessen Ereignis-Token Zone und Vorherige Zone in einer Benachrichtigung.",
            "Entfernen Sie nach dem Test das Demosubjekt und die Demozone. Verbinden Sie Ihre echte Standortquelle erneut, prüfen Sie eine Ankunft in der Zone und einen Austritt aus ihr und ergänzen Sie anschließend die gewünschten Filter und Verzögerungen einzeln. Prüfen Sie neben den empfangenen Koordinaten auch den ursprünglichen Zeitstempel der Quelle."
          ]
        },
        {
          "title": "5. Priorität und die gewinnende Zone",
          "body": [
            "GeoZones berücksichtigt nur aktive Zonen, die das Subjekt beziehungsweise eine Auswertung ohne Subjekt zulassen. Enthalten mehrere zulässige Zonen die Position, gewinnt die höchste numerische Priorität. Bei gleicher Priorität gewinnt die kleinste Fläche. Nur eine gewinnende Zone wird zur aktuellen Zone.",
            "Eine inaktive Zone kann nicht zur aktuellen Zone werden. not_defined bedeutet, dass keine zulässige Zone passte; es bedeutet nicht zwangsläufig, dass Koordinaten fehlen. Verlässt ein Subjekt eine kleinere Zone, kann eine größere umgebende Zone gewinnen. Das Verlassen einer Zone muss daher nicht zu not_defined führen.",
            "Prüfen Sie bei unerwarteten Ergebnissen Priorität, Form, Aktivierung und Filter. Die Farbe dient nur der Darstellung und beeinflusst die Auswertung nicht."
          ]
        },
        {
          "title": "6. Tags, Typen und Subjektfilter",
          "body": [
            "Tags beschreiben die Nutzung einer Zone, beispielsweise Zuhause, Arbeit oder Laden. Subjekttypen beschreiben Subjekte, beispielsweise Person, Auto oder Haustier. Beides sind frei gewählte Texte und keine automatischen Kategorien. Namen, Typen und Tags werden ohne Unterscheidung der Groß- und Kleinschreibung verglichen; verwenden Sie dennoch eine einheitliche Schreibweise. Trennen Sie Listenwerte mit Kommas.",
            "Steht der Subjektfilter auf Alle, entscheidet der Subjekttypfilter über die Zulässigkeit. Nur einschließen lässt ausschließlich die aufgeführten Subjektnamen zu: Ein aufgeführtes Subjekt ist erlaubt, auch wenn sein Typ sonst ausgeschlossen wäre. Ausschließen weist die aufgeführten Namen ab; alle anderen Subjekte werden weiterhin anhand des Typfilters geprüft. Ein Subjekt ohne Typ besteht einen ausschließenden Typfilter, aber keinen Filter, der nur bestimmte Typen einschließt.",
            "Auf Koordinaten ohne Subjekt anwenden steuert die App-Karten, die einzelne Koordinaten auswerten. Diese Karten besitzen weder Subjektname und -typ noch einen vorherigen Zustand. Subjektfilter, Übergangsverzögerungen und Hysterese aufgrund der vorherigen Zone gelten deshalb nicht. Die Karten werten die gewinnende zulässige Zone und deren Tags aus, nicht jede geometrisch überlappende Zone."
          ]
        },
        {
          "title": "7. Verzögerungen und Kreishysterese",
          "body": [
            "Die Eintrittsverzögerung verschiebt den Wechsel in eine neue gewinnende Zone. Bei einem direkten Wechsel von Zone A zu Zone B gilt die Eintrittsverzögerung von B. Die Austrittsverzögerung der vorherigen Zone gilt, wenn keine Zone mehr als Ergebnis vorliegt. Ändert sich die mögliche Zielzone während der Wartezeit, wird der ausstehende Übergang neu berechnet.",
            "Verzögerungstimer werten die zuletzt gespeicherten Koordinaten aus. Sie fordern keine neue GPS-Position an und beweisen keine ununterbrochene Anwesenheit in der realen Welt. Verwenden Sie eine zuverlässige Aktualisierungsquelle und prüfen Sie das Alter der Position, wenn eine verzögerte Aktion wichtig ist.",
            "Hysterese gilt nur für Kreise: Die Austrittsgrenze des aktuellen Kreises wird um die eingestellten Meter erweitert. Bei 100 m Radius und 20 m Hysterese kann der aktuelle Kreis bis zu 120 m beibehalten werden. Für den ersten Eintritt gelten weiterhin 100 m. Polygone haben keine Hysterese, und die Zonenprioritäten gelten weiterhin."
          ]
        },
        {
          "title": "8. Bewegungsschwelle und Deaktivieren",
          "body": [
            "Die minimale Bewegungsdistanz wird pro Subjektgerät eingestellt. Liegt eine Aktualisierung näher als diese Schwelle an der gespeicherten Position, bleiben die bisherigen Koordinaten erhalten, um GPS-Schwankungen zu reduzieren. Die erste gültige Position wird angenommen, weil es noch keine vorherige gibt. Verwenden Sie bei der Prüfung einer Quelle oder Zonengrenze 0 m.",
            "Auch eine Aktualisierung innerhalb der Bewegungsschwelle erfasst ihren Empfangszeitpunkt und wertet die beibehaltene Position aus; sie wird nicht vollständig verworfen. Bewegung und Geschwindigkeit werden aus gelieferten Positionen und Zeitpunkten abgeleitet. Sie stammen nicht von unabhängigen Bewegungssensoren und beweisen nicht, dass sich eine Person bewegt.",
            "Das Deaktivieren eines Subjekts weist Positionsaktualisierungen ab und löscht seine aktuelle Zone sowie den ausstehenden Übergang. Die letzten Koordinaten und deren Zeitpunkt bleiben erhalten. Das erneute Aktivieren wertet diese gespeicherte Position aus; sie wird nicht vom Telefon aktualisiert."
          ]
        },
        {
          "title": "9. Ereignisse, Ergebnisse und verlässliche Protokolle",
          "body": [
            "Zone gewechselt wird ausgelöst, wenn sich die aktuelle Zone ändert, einschließlich Wechseln zu oder von not_defined. Der Zonenübergang unterscheidet Eintritt und Austritt; seine Token Zone und Zonen-Tags beschreiben den betretenen oder verlassenen Ort. Position geändert setzt geänderte gespeicherte Koordinaten voraus. Wurde neu berechnet kann auch ausgelöst werden, wenn Position und Zone gleich bleiben.",
            "Verwenden Sie für Ereignisprotokolle die Token des auslösenden Ereignisses. Vorherige Zone ist ein gespeicherter Übergangswert und kein vollständiger Reiseverlauf: Bei A nach B ist der Wert A, bei A nach keiner Zone bleibt A erhalten, und bei keiner Zone nach B wird er auf not_defined zurückgesetzt. Subjektzustand abrufen liefert den aktuellen Stand statt eines Ereignisdatensatzes.",
            "Verbinden Sie in Advanced Flow Aktionen, die zurückgegebene Ergebnisse verwenden, so, dass sie erst nach Abschluss der Positions- oder Auswertungskarte ausgeführt werden. Wenn Sie Token in Variablen kopieren, lassen Sie diese Schreibvorgänge vor dem Protokollieren der Variablen abschließen. Parallele Zweige können sonst einen älteren Wert lesen. Bei globalen Auslösern müssen Subjekt- und Subjekttypfilter beide passen; ausgewählte Zonen- und Tagfilter sind Alternativen."
          ]
        },
        {
          "title": "10. Bedingungen und Entfernungen",
          "body": [
            "Zonenbedingungen für ein Subjekt verwenden dessen gespeicherte aktuelle Zone und berücksichtigen damit auch eine noch laufende Verzögerung. Bedingungen für einzelne Koordinaten berechnen dagegen sofort ihre eigene gewinnende Zone, ohne ein Subjekt zu ändern. Ein Punkt kann geometrisch innerhalb der gewählten Zone liegen und die Koordinatenbedingung dennoch nicht erfüllen, wenn eine andere zulässige Zone gewinnt.",
            "Bei Belegungsprüfungen für Zonen und Tags bedeutet Mindestens, dass mindestens ein aktuell anwesendes Subjekt zu den ausgewählten Subjekten oder Typen passt. Nur bedeutet, dass alle aktuell Anwesenden passen und die Zone nicht leer ist. Es müssen dafür nicht alle Subjekte Ihrer Auswahl anwesend sein.",
            "Flow-Aktionen für Entfernungen liefern geografische Luftlinienentfernungen in Metern, keine Straßenrouten oder Reisezeiten. Die Entfernung zu einer Zone beträgt innerhalb der Zone null und entspricht sonst der kürzesten Entfernung zu ihrer Grenze. Für diese geometrische Entfernung gelten weder die Aktivierung noch die Subjektfilter der Zone. Entfernung zu Homey wird am Gerät in Kilometern angezeigt und verwendet den eingestellten Standort von Homey, nicht das GPS des Telefons."
          ]
        },
        {
          "title": "11. Alter der Position und Grenzen der Quelle",
          "body": [
            "Letzte Aktualisierung (last_update) erfasst, wann GeoZones Koordinaten empfangen hat. Sie sagt nicht aus, wann die Quelle die GPS-Position gemessen hat. Eine Quelle, die zwischengespeicherte Koordinaten wiederholt, kann den Empfangszeitpunkt deshalb aktuell erscheinen lassen. Prüfen Sie auch den eigenen Zeitstempel und das Aktualisierungsintervall der Quelle.",
            "Gespeicherte Positionen laufen nicht automatisch ab. Neuberechnungen, Verzögerungstimer und App-Neustarts verwenden die letzte Position weiter und machen sie nicht aktueller. Subjektzustand abrufen stellt Letzte Aktualisierung bereit, damit Ihre Flows eine Altersregel anwenden können. Weisen Sie alte Messungen bereits in der Quelle oder im liefernden Flow ab, wenn ihr ursprünglicher Zeitstempel verfügbar ist.",
            "Die alte Ausgabe Quelle veraltet führt bei manuellen Subjekten keine automatische Aktualitätsprüfung durch. Telefonberechtigungen, Verhalten bei gesperrtem Bildschirm, Energiesparen und Offline-Zeiten werden von Ihrer externen Quelle bestimmt. Testen Sie diese Bedingungen, bevor Sie sich auf einen Ankunfts-, Abwesenheits- oder Alarm-Flow verlassen."
          ]
        },
        {
          "title": "12. Export, Import und Verlauf",
          "body": [
            "Kopieren und Herunterladen exportieren den aktuellen Konfigurationsentwurf im Browser, einschließlich ungespeicherter Änderungen. Speichern Sie zuerst eine gültige Konfiguration, wenn Sie eine geprüfte Konfigurationssicherung benötigen. Ein Konfigurationsexport ist keine vollständige Sicherung manueller Geräte, ihrer aktuellen Zustände, der Homey Flows oder der externen Quelle. Die Sicherung alter Daten wird separat heruntergeladen.",
            "Importieren und ersetzen ersetzt die Konfiguration. Abschnitte importieren und zusammenführen führt keine einzelnen Zonen zusammen: Übergebene Zonen ersetzen die gesamte aktuelle Zonenliste, während übergebene Felder in general und ui mit diesen Einstellungen zusammengeführt werden. Ein leeres zones-Array löscht alle Zonen. Exportieren Sie zuerst, prüfen Sie die Bestätigung und bewahren Sie Dateien mit privaten Koordinaten sicher auf.",
            "Der Verlauf enthält frühere gespeicherte Konfigurationen, begrenzt durch die Aufbewahrungsdauer unter Allgemein und höchstens 100 Einträge. Wiederherstellen wendet die ausgewählte Konfiguration an und berechnet Subjekte neu; alte GPS-Positionen oder Flows werden nicht wiederhergestellt. Das Löschen eines Verlaufseintrags entfernt diese gespeicherte Version."
          ]
        },
        {
          "title": "13. Aktualisieren und alte Subjekte wiederherstellen",
          "body": [
            "Ältere Versionen mit verknüpften Subjekten erfordern eine Migration. GeoZones bewahrt und prüft die ursprünglichen alten Daten vor der Umwandlung. Erhaltene Quellenverweise erstellen jedoch keine automatischen Verknüpfungen neu, und entfernte Flow-Karten werden nicht wiederhergestellt.",
            "Prüfen Sie unter Allgemein den Abschnitt Frühere Subjekte wiederherstellen und laden Sie die Sicherung früherer Daten in einen geschützten privaten Speicher herunter. Öffnen Sie anschließend Geräte > Gerät hinzufügen > GeoZones > Manuelles Subjekt, wählen Sie jedes alte Subjekt im Wiederherstellungsbereich aus und stellen Sie es wieder her. Behalten Sie den Namen möglichst bei; prüfen Sie andernfalls die Filter auf Subjektnamen.",
            "Verbinden Sie die Koordinaten erneut über die aktuelle Positionskarte und erstellen Sie betroffene Flows neu. Prüfen Sie das Alter der wiederhergestellten Position. Bewahren Sie bei einem Wiederherstellungsfehler die Sicherung und Originaldaten auf, lesen Sie die Meldung und starten Sie die App neu, um einen unterbrochenen Vorgang erneut zu versuchen. Deinstallieren Sie die App nicht als ersten Wiederherstellungsschritt: Dabei werden die App-Einstellungen entfernt."
          ]
        },
        {
          "title": "14. Fehlerbehebung",
          "body": [
            "Keine Aktualisierung oder falsche Zone: Prüfen Sie, ob das vorgesehene Subjekt aktiviert ist, der Positions-Flow tatsächlich ausgeführt wird, beide Koordinaten gültig und aktuell sind und die Zone gespeichert und aktiv ist. Verwenden Sie vorübergehend einen Kreis ohne Filter, Verzögerungen, Hysterese oder Bewegungsschwelle. Stellen Sie anschließend jede Option einzeln wieder her.",
            "Fehlende Karte: Kartenkacheln benötigen Internetzugriff auf OpenStreetMap; fehlende Kacheln stoppen jedoch die Zonenberechnung nicht. Die vorhandene Form bleibt über numerische Felder verfügbar. Eine ungültige Änderung verhindert das Speichern und Exportieren, bis sie korrigiert ist. Neu laden verwirft ungespeicherte Änderungen. Kopieren Sie daher unfertige Werte, die Sie behalten möchten, zuvor an eine separate Stelle.",
            "Verwenden Sie die detaillierte Protokollierung unter Allgemein nur beim Nachstellen eines Problems und schalten Sie sie anschließend aus. Geben Sie in einem Bericht App-Version, Homey-Modell und Firmware, die genaue Karte, die Quelle sowie bereinigte Schritte mit erwartetem und tatsächlichem Ergebnis an. Teilen Sie ein kleines Beispiel mit fiktiven Daten statt Ihres privaten Bewegungsverlaufs."
          ]
        },
        {
          "title": "15. Sprache und Datenschutz",
          "body": [
            "Diese Hilfe und die Einstellungen verwenden die Sprache, die Homey beim Öffnen der Seite meldet: Englisch, Französisch, Niederländisch oder Deutsch. Bei anderen Homey-Sprachen wird Englisch verwendet. Öffnen Sie die Einstellungen nach einer Sprachänderung in Homey erneut. Ihre eigenen Zonennamen, Tags, Subjekttypen und gespeicherten technischen Werte werden nicht übersetzt.",
            "Kartenkacheln stammen von OpenStreetMap. Die Anfragen übermitteln den betrachteten Kartenausschnitt und Ihre Netzwerkadresse an diesen Dienst. Die Zonenauswertung läuft in der App auf Homey. Ihre externe Standortquelle hat ihren eigenen Netzwerkverkehr und ihre eigenen Datenschutzregeln.",
            "Exporte, Migrationssicherungen und Protokolle können Namen, Koordinaten und Standortverläufe enthalten. Bewahren Sie diese privat auf und entfernen Sie sensible Daten, bevor Sie einen Bericht teilen. Diese Hilfe ist in der App verfügbar, ohne das Repository zu öffnen. Die Kartenbilder benötigen weiterhin ihren Kacheldienst."
          ]
        }
      ]
    },
    messages: {
      saved: 'Gespeichert',
      loaded: 'Geladen',
      invalidJson: 'Ungültige JSON-Datei.',
      invalidImport: 'Importieren Sie ein exportiertes Konfigurationsobjekt. Ersetzen erfordert Zonen oder alte Subjektdaten; ein leerer oder fremder JSON-Wert ist keine Konfiguration.',
      confirmReplace: 'Die aktuelle Konfiguration durch diesen Import ersetzen? Seine Zonen ersetzen alle aktuellen Zonen. Ein leeres zones-Array löscht alle Zonen.',
      confirmMergeZones: 'Die importierten Zonen ersetzen alle aktuellen Zonen. Ein leeres zones-Array löscht alle Zonen. Fortfahren?',
      downloadFailed: 'Die Exportdatei konnte nicht heruntergeladen werden.',
      exportReady: 'Exportdatei erstellt.',
      importApplied: 'Import angewendet.'
      ,invalidPolygonJson: 'Verwenden Sie ein JSON-Array mit mindestens drei gültigen {lat, lng}-Punkten.',
      invalidZoneNumber: 'Geben Sie gültige Zahlen innerhalb der zulässigen Koordinaten- und Entfernungsgrenzen ein.',
      zoneNameRequired: 'Ein Zonenname ist erforderlich.',
      configUnavailable: 'Die Konfiguration konnte nicht geladen werden. Laden Sie die Einstellungen vor dem Export erneut.',
      mapUnavailable: 'Die Karte konnte nicht geladen werden. Bestehende Zonen und die anderen Einstellungen bleiben verfügbar. Öffnen Sie die Einstellungen erneut, um es noch einmal zu versuchen.',
    },
  },
};

function lookupPath(source, path) {
  return String(path || '').split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), source);
}

function t(path) {
  const source = UI[currentLang] || UI.en;
  return lookupPath(source, path) ?? lookupPath(UI.en, path) ?? path;
}

function helpSections() {
  return clone(t('help.sections') || []);
}

function createEl(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null && text !== '') node.textContent = text;
  return node;
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function ensureConfigDefaults() {
  if (!config || typeof config !== 'object') config = {};
  if (!Array.isArray(config.zones)) config.zones = [];
  if (!config.general || typeof config.general !== 'object') config.general = {};
  if (!config.ui || typeof config.ui !== 'object') config.ui = {};
  if (!config.ui.mapCenter || !Number.isFinite(Number(config.ui.mapCenter.lat)) || !Number.isFinite(Number(config.ui.mapCenter.lng))) config.ui.mapCenter = { lat: 48.8566, lng: 2.3522 };
  if (!Number.isFinite(Number(config.ui.mapZoom))) config.ui.mapZoom = 6;
  if (!cleanText(config.ui.activeTab)) config.ui.activeTab = 'zones';
  if (!Number.isFinite(Number(config.general.historyRetentionDays))) config.general.historyRetentionDays = 30;
  if (config.general.heavyDebug !== true) config.general.heavyDebug = false;
}

function chooseDefaultColor(index) {
  return PALETTE[index % PALETTE.length];
}

function currentZone() {
  return (config?.zones || []).find(zone => zone.id === selectedZoneId) || null;
}

function typeLabel(type) {
  return type === 'polygon' ? t('zones.polygon') : t('zones.circle');
}

function zoneLabel(zone) {
  return `${typeLabel(zone.type)} · ${Number(zone.priority || 0)}`;
}

function setStatus(text) {
  const node = qs('#status');
  if (node) node.textContent = text || '';
}

function notify(message, isError = false) {
  setStatus(isError ? `⚠ ${message}` : message);
  if (isError && HomeyApp?.alert) HomeyApp.alert(message);
}

function applyTranslations() {
  qsa('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  qsa('[data-i18n-placeholder]').forEach(node => { node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder)); });
  document.documentElement.lang = currentLang;
}

function updateAppMeta(meta = {}) {
  const appName = cleanText(meta.name && (meta.name[currentLang] || meta.name.en || meta.name)) || 'GeoZones';
  const version = cleanText(meta.version || '');
  const fullTitle = version ? `${appName} v${version}` : appName;
  document.title = fullTitle;
  const titleNode = qs('#appTitle');
  if (titleNode) titleNode.textContent = fullTitle;
}

function showHelp(messageKey) {
  if (!HomeyApp?.alert) return;
  HomeyApp.alert(t(messageKey));
}

function renderZoneTagsEditor(zone) {
  const container = qs('#zoneTagsList');
  if (!container) return;
  clearNode(container);
  for (const tag of zone.tags || []) {
    const chip = createEl('span', 'tag-chip');
    chip.appendChild(createEl('span', '', tag));
    const button = createEl('button', '', '×');
    button.type = 'button';
    button.dataset.removeZoneTag = tag;
    chip.appendChild(button);
    container.appendChild(chip);
  }
}

function addZoneTag() {
  const zone = currentZone();
  if (!zone) return;
  const input = qs('#zoneTagInput');
  const value = cleanText(input?.value);
  if (!value) return;
  const seen = new Set((zone.tags || []).map(tag => tag.toLowerCase()));
  if (!seen.has(value.toLowerCase())) zone.tags = [...(zone.tags || []), value];
  if (input) input.value = '';
  renderZoneTagsEditor(zone);
  updateExportBox();
  renderZoneList();
}

function removeZoneTag(tag) {
  const zone = currentZone();
  if (!zone) return;
  const target = cleanText(tag).toLowerCase();
  zone.tags = (zone.tags || []).filter(value => cleanText(value).toLowerCase() !== target);
  renderZoneTagsEditor(zone);
  updateExportBox();
  renderZoneList();
}

function renderHelpContent() {
  const container = qs('#helpContent');
  if (!container) return;
  clearNode(container);
  helpSections().forEach((section, index) => {
    const details = document.createElement('details');
    if (index === 0) details.open = true;
    const summary = createEl('summary', '', cleanText(section.title));
    details.appendChild(summary);
    for (const line of Array.isArray(section.body) ? section.body : []) {
      details.appendChild(createEl('p', '', cleanText(line)));
    }
    container.appendChild(details);
  });
}

function switchTab(tab) {
  currentTab = tab;
  qsa('.tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  qsa('.panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
  if (config?.ui) config.ui.activeTab = tab;
  if (tab === 'zones' && map) setTimeout(() => map?.invalidateSize?.(), 0);
}

function syncMapViewport() {
  if (!map || !config?.ui?.mapCenter) return;
  const center = config.ui.mapCenter;
  const zoom = Number(config.ui.mapZoom || 6);
  map.setView([center.lat, center.lng], zoom, { animate: false });
}

function ensureMap() {
  if (map) return true;
  if (typeof L === 'undefined' || !L.map || !L.Draw?.Circle || !L.Draw?.Polygon) {
    const warning = qs('#mapWarning');
    if (warning) {
      warning.textContent = t('messages.mapUnavailable');
      warning.classList.remove('hidden');
    }
    ['#btnAddCircle', '#btnAddPolygon', '#btnFitAll'].forEach(selector => { qs(selector).disabled = true; });
    return false;
  }
  applyMapTranslations();
  map = L.map('map', { zoomControl: false }).setView([config.ui.mapCenter.lat, config.ui.mapCenter.lng], config.ui.mapZoom || 6);
  L.control?.zoom?.({ zoomInTitle: t('map.zoomIn'), zoomOutTitle: t('map.zoomOut') }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  drawHandlers.circle = new L.Draw.Circle(map, { shapeOptions: { color: chooseDefaultColor((config.zones || []).length) } });
  drawHandlers.polygon = new L.Draw.Polygon(map, { allowIntersection: false, showArea: true, shapeOptions: { color: chooseDefaultColor((config.zones || []).length) } });
  map.on(L.Draw.Event.CREATED, event => {
    if (isSaving) return;
    const isCircle = event.layerType === 'circle';
    const zoneIndex = (config.zones || []).length;
    const zone = {
      id: `${isCircle ? 'circle' : 'polygon'}_${Date.now()}_${zoneIndex + 1}`,
      name: `${typeLabel(isCircle ? 'circle' : 'polygon')} ${zoneIndex + 1}`,
      type: isCircle ? 'circle' : 'polygon',
      active: true,
      color: chooseDefaultColor(zoneIndex),
      priority: 0,
      tags: [],
      center: isCircle ? { lat: event.layer.getLatLng().lat, lng: event.layer.getLatLng().lng } : null,
      radius: isCircle ? event.layer.getRadius() : 100,
      hysteresis: 0,
      paths: isCircle ? [] : (event.layer.getLatLngs()[0] || []).map(point => ({ lat: point.lat, lng: point.lng })),
      options: {
        entryDelayS: 0,
        exitDelayS: 0,
        appliesWithoutSubject: true,
        subjectFilter: { mode: 'all', subjects: [] },
        subjectTypeFilter: { mode: 'all', subjectTypes: [] },
      },
    };
    config.zones.push(zone);
    selectedZoneId = zone.id;
    renderAll();
  });
  map.on('moveend', () => {
    if (isSaving) return;
    if (!config?.ui) return;
    const center = map.getCenter();
    config.ui.mapCenter = { lat: center.lat, lng: center.lng };
    config.ui.mapZoom = map.getZoom();
  });
  return true;
}

function applyMapTranslations() {
  const handlers = L.drawLocal?.draw?.handlers;
  if (!handlers) return;
  handlers.circle.tooltip.start = t('map.circleStart');
  handlers.circle.radius = t('map.radius');
  handlers.simpleshape.tooltip.end = t('map.circleEnd');
  handlers.polygon.tooltip.start = t('map.polygonStart');
  handlers.polygon.tooltip.cont = t('map.polygonContinue');
  handlers.polygon.tooltip.end = t('map.polygonEnd');
  handlers.polyline.error = t('map.intersectionError');
}

function layerForZone(zone) {
  if (zone.type === 'circle') return L.circle([zone.center.lat, zone.center.lng], { radius: zone.radius, color: zone.color });
  return L.polygon((zone.paths || []).map(point => [point.lat, point.lng]), { color: zone.color });
}

function updateExportBox() {
  const box = qs('#exportBox');
  if (box) box.value = JSON.stringify(config, null, 2);
}

function renderZoneList() {
  const list = qs('#zoneList');
  if (!list) return;
  clearNode(list);
  if (!(config.zones || []).length) {
    list.appendChild(createEl('div', 'list-item empty-state', t('zones.selectZone')));
    return;
  }
  for (const zone of config.zones) {
    const item = createEl('div', `list-item ${zone.id === selectedZoneId ? 'active' : ''}`.trim());
    const row = createEl('div', 'zone-row');
    const left = createEl('div');
    left.appendChild(createEl('h3', '', zone.name));
    left.appendChild(createEl('div', '', (zone.tags || []).join(', ') || t('common.empty')));
    const metaText = zone.active === false ? `${zoneLabel(zone)} · ${t('common.inactive')}` : zoneLabel(zone);
    left.appendChild(createEl('div', 'subject-meta', metaText));
    if (editorErrors[zone.id]) left.appendChild(createEl('div', 'hint warning', editorErrors[zone.id]));
    row.appendChild(left);
    const pill = createEl('span', 'pill', typeLabel(zone.type));
    pill.style.background = `${zone.color}22`;
    pill.style.color = zone.color;
    pill.style.border = `1px solid ${zone.color}55`;
    row.appendChild(pill);
    item.appendChild(row);
    item.onclick = () => {
      if (isSaving) return;
      selectedZoneId = zone.id;
      renderZoneList();
      renderZoneEditor();
    };
    list.appendChild(item);
  }
}

function renderZones() {
  if (ensureMap()) {
    drawnItems.clearLayers();
    zoneLayers = new Map();
    for (const zone of config.zones || []) {
      const layer = layerForZone(zone);
      layer.addTo(drawnItems);
      layer.on('click', () => {
        if (isSaving) return;
        selectedZoneId = zone.id;
        renderZoneList();
        renderZoneEditor();
      });
      zoneLayers.set(zone.id, layer);
    }
  }
  renderZoneList();
  updateExportBox();
}

function renderZoneEditor() {
  const zone = currentZone();
  qs('#zoneEmpty').classList.toggle('hidden', !!zone);
  qs('#zoneEditor').classList.toggle('hidden', !zone);
  if (!zone) {
    renderEditorError();
    return;
  }
  qs('#zoneName').value = zone.name || '';
  qs('#zoneColor').value = zone.color || chooseDefaultColor(0);
  qs('#zoneActive').checked = zone.active !== false;
  qs('#zonePriority').value = Number(zone.priority || 0);
  renderZoneTagsEditor(zone);
  qs('#zoneEntryDelay').value = Number(zone.options?.entryDelayS || 0);
  qs('#zoneExitDelay').value = Number(zone.options?.exitDelayS || 0);
  qs('#zoneWithoutSubject').checked = zone.options?.appliesWithoutSubject !== false;
  qs('#zoneSubjectFilterMode').value = zone.options?.subjectFilter?.mode || 'all';
  qs('#zoneSubjectFilterValues').value = (zone.options?.subjectFilter?.subjects || []).join(', ');
  qs('#zoneSubjectTypeMode').value = zone.options?.subjectTypeFilter?.mode || 'all';
  qs('#zoneSubjectTypeValues').value = (zone.options?.subjectTypeFilter?.subjectTypes || []).join(', ');
  const isCircle = zone.type === 'circle';
  qs('#circleFields').classList.toggle('hidden', !isCircle);
  qs('#polygonFields').classList.toggle('hidden', isCircle);
  qs('#zoneHysteresisRow').classList.toggle('hidden', !isCircle);
  if (isCircle) {
    qs('#zoneCenterLat').value = zone.center?.lat ?? '';
    qs('#zoneCenterLng').value = zone.center?.lng ?? '';
    qs('#zoneRadius').value = zone.radius ?? 100;
    qs('#zoneHysteresis').value = zone.hysteresis || 0;
  } else {
    qs('#zonePaths').value = JSON.stringify(zone.paths || [], null, 2);
  }
  const draft = zoneDrafts.get(zone.id);
  if (draft) {
    for (const [selector, value] of Object.entries(draft)) {
      const field = qs(selector);
      if (typeof value === 'boolean') field.checked = value;
      else field.value = value;
    }
  }
  renderEditorError();
  updateSaveButtonState();
}

const ZONE_VALUE_FIELDS = ['#zoneName', '#zoneColor', '#zonePriority', '#zoneEntryDelay', '#zoneExitDelay', '#zoneHysteresis', '#zoneSubjectFilterMode', '#zoneSubjectFilterValues', '#zoneSubjectTypeMode', '#zoneSubjectTypeValues', '#zoneCenterLat', '#zoneCenterLng', '#zoneRadius', '#zonePaths'];
const ZONE_CHECK_FIELDS = ['#zoneActive', '#zoneWithoutSubject'];

function captureZoneDraft() {
  return Object.fromEntries([
    ...ZONE_VALUE_FIELDS.map(selector => [selector, qs(selector).value]),
    ...ZONE_CHECK_FIELDS.map(selector => [selector, qs(selector).checked]),
  ]);
}

function readDraftNumber(draft, selector, minimum = -Infinity, maximum = Infinity) {
  const value = cleanText(draft[selector]);
  const number = Number(value);
  if (!value || !Number.isFinite(number) || number < minimum || number > maximum) throw new Error(t('messages.invalidZoneNumber'));
  return number;
}

function zoneFromDraft(zone, draft) {
  const next = clone(zone);
  next.name = cleanText(draft['#zoneName']);
  if (!next.name) throw new Error(t('messages.zoneNameRequired'));
  next.color = draft['#zoneColor'];
  next.active = draft['#zoneActive'];
  next.priority = readDraftNumber(draft, '#zonePriority');
  next.options = {
    ...(next.options || {}),
    entryDelayS: readDraftNumber(draft, '#zoneEntryDelay', 0),
    exitDelayS: readDraftNumber(draft, '#zoneExitDelay', 0),
    appliesWithoutSubject: draft['#zoneWithoutSubject'],
    subjectFilter: { mode: draft['#zoneSubjectFilterMode'], subjects: parseCsvKeepCase(draft['#zoneSubjectFilterValues']) },
    subjectTypeFilter: { mode: draft['#zoneSubjectTypeMode'], subjectTypes: parseCsvKeepCase(draft['#zoneSubjectTypeValues']) },
  };
  if (next.type === 'circle') {
    next.center = { lat: readDraftNumber(draft, '#zoneCenterLat', -90, 90), lng: readDraftNumber(draft, '#zoneCenterLng', -180, 180) };
    next.radius = readDraftNumber(draft, '#zoneRadius', Number.MIN_VALUE);
    next.hysteresis = readDraftNumber(draft, '#zoneHysteresis', 0);
  } else {
    let paths;
    try {
      paths = JSON.parse(draft['#zonePaths']);
      if (!Array.isArray(paths) || paths.length < 3 || !paths.every(point =>
        point && typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
        typeof point.lng === 'number' && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180)) throw new Error('invalid');
    } catch (error) {
      throw new Error(t('messages.invalidPolygonJson'));
    }
    next.paths = paths;
    next.hysteresis = 0;
  }
  return next;
}

function syncZoneFromEditor() {
  if (isSaving) return;
  const zone = currentZone();
  if (!zone) return;
  const draft = captureZoneDraft();
  zoneDrafts.set(zone.id, draft);
  try {
    const next = zoneFromDraft(zone, draft);
    Object.assign(zone, next);
    delete editorErrors[zone.id];
    renderZones();
  } catch (error) {
    editorErrors[zone.id] = error.message;
  }
  renderEditorError();
  updateSaveButtonState();
}

function renderEditorError() {
  const error = editorErrors[selectedZoneId] || '';
  const node = qs('#zoneEditorError');
  if (node) {
    node.textContent = error;
    node.classList.toggle('hidden', !error);
  }
  // All validation feedback is shown together, including invalid numeric fields.
  qs('#zonePathsError')?.classList.add('hidden');
}

function updateSaveButtonState() {
  const invalid = isSaving || !config || Object.values(editorErrors).some(Boolean);
  ['#btnSave', '#btnCopyExport', '#btnDownloadExport'].forEach(selector => {
    const button = qs(selector);
    if (button) button.disabled = invalid;
  });
}

function renderGeneral() {
  qs('#generalHistoryRetentionDays').value = Number(config.general.historyRetentionDays || 30);
  qs('#generalHeavyDebug').checked = config.general.heavyDebug === true;
}

function renderMigration() {
  const panel = qs('#migrationPanel');
  if (!panel) return;
  const visible = migrationStatus && migrationStatus.status !== 'none';
  panel.classList.toggle('hidden', !visible);
  if (!visible) return;
  const statusNode = qs('#migrationStatus');
  if (migrationStatus.status === 'error') {
    statusNode.textContent = `${t('migration.error')} ${migrationStatus.lastError || ''}`;
  } else {
    const key = migrationStatus.status === 'complete' ? 'migration.complete' : 'migration.pending';
    statusNode.textContent = t(key).replace('__count__', String(migrationStatus.pendingSubjects?.length || 0))
      .replace('__recovered__', String(migrationStatus.recoveredSubjects || 0));
  }
  qs('#btnMigrationBackup').disabled = migrationStatus.backupVerified !== true;
}

function renderHistory() {
  const container = qs('#historyList');
  if (!container) return;
  clearNode(container);
  if (!history.length) {
    container.appendChild(createEl('div', 'list-item empty-state', t('common.empty')));
    return;
  }
  for (const entry of history) {
    const item = createEl('div', 'list-item');
    const row = createEl('div', 'history-row');
    const left = createEl('div');
    left.appendChild(createEl('strong', '', new Date(entry.createdAt).toLocaleString()));
    left.appendChild(createEl('div', 'subject-meta', entry.id));
    const toolbar = createEl('div', 'toolbar');
    const restoreButton = createEl('button', '', t('io.restore'));
    restoreButton.dataset.restoreHistory = entry.id;
    const deleteButton = createEl('button', 'danger', t('io.remove'));
    deleteButton.dataset.deleteHistory = entry.id;
    toolbar.appendChild(restoreButton);
    toolbar.appendChild(deleteButton);
    row.appendChild(left);
    row.appendChild(toolbar);
    item.appendChild(row);
    container.appendChild(item);
  }
}

function renderAll() {
  renderZones();
  renderZoneEditor();
  renderGeneral();
  renderMigration();
  renderHistory();
  renderHelpContent();
  updateSaveButtonState();
}

async function loadAll(preferredTab = currentTab) {
  try {
    migrationStatus = await HomeyApp.api('GET', '/migration/status');
  } catch (error) {
    migrationStatus = { status: 'error', backupVerified: false, lastError: error.message || String(error) };
  }
  renderMigration();
  try {
    config = await HomeyApp.api('GET', '/config');
    ensureConfigDefaults();
    zoneDrafts.clear();
    editorErrors = {};
    selectedZoneId = config.ui?.selectedZoneId || config.zones?.[0]?.id || null;
    try {
      history = await HomeyApp.api('GET', '/history');
    } catch (error) {
      console.error('Unable to load history', error);
      history = [];
    }
    renderAll();
    syncMapViewport();
    switchTab(preferredTab || config.ui?.activeTab || 'zones');
    notify(t('messages.loaded'));
  } catch (error) {
    if (migrationStatus?.status === 'error') switchTab('general');
    updateSaveButtonState();
    notify(error.message || String(error), true);
  }
}

async function saveConfig() {
  if (isSaving) return;
  try {
    syncZoneFromEditor();
    if (Object.values(editorErrors).some(Boolean)) throw new Error(Object.values(editorErrors).filter(Boolean)[0]);
    config.ui.selectedZoneId = selectedZoneId;
    setSavingState(true);
    await HomeyApp.api('PUT', '/config', config);
    await loadAll(currentTab);
    notify(t('messages.saved'));
  } catch (error) {
    notify(error.message || String(error), true);
  } finally {
    setSavingState(false);
  }
}

function setSavingState(saving) {
  if (saving) {
    isSaving = true;
    saveDisabledStates = new Map(qsa('input, select, textarea, button').map(node => [node, node.disabled]));
    for (const node of saveDisabledStates.keys()) node.disabled = true;
  } else {
    for (const [node, disabled] of saveDisabledStates) node.disabled = disabled;
    saveDisabledStates.clear();
    isSaving = false;
    updateSaveButtonState();
  }
}

async function downloadTextFile() {
  try {
    downloadJson(serializeCurrentConfig(), `geozones-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    notify(t('messages.exportReady'));
  } catch (error) {
    notify((error && error.message) || t('messages.downloadFailed'), true);
  }
}

function serializeCurrentConfig() {
  if (!config) throw new Error(t('messages.configUnavailable'));
  syncZoneFromEditor();
  const errors = Object.values(editorErrors).filter(Boolean);
  if (errors.length) throw new Error(errors[0]);
  return JSON.stringify(config, null, 2);
}

function downloadJson(text, filename) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function copyTextToClipboard(value) {
  const text = String(value || '');
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch (error) {
    // fallback below
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', 'readonly');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  helper.style.pointerEvents = 'none';
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(helper);
  }
}

async function handleImport(mode) {
  if (isSaving) return;
  try {
    const text = cleanText(qs('#importBox').value);
    if (!text) throw new Error(t('messages.invalidImport'));
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { throw new Error(t('messages.invalidJson')); }
    const imported = inspectImportPayload(parsed, mode);
    if (mode === 'replace' || Object.prototype.hasOwnProperty.call(imported, 'zones')) {
      const confirmed = await HomeyApp.confirm(t(mode === 'replace' ? 'messages.confirmReplace' : 'messages.confirmMergeZones'));
      if (!confirmed) return;
    }
    await HomeyApp.api(mode === 'replace' ? 'PUT' : 'POST', mode === 'replace' ? '/config' : '/config/merge', parsed);
    await loadAll(currentTab);
    notify(t('messages.importApplied'));
  } catch (error) {
    notify(error.message || t('messages.invalidJson'), true);
  }
}

function inspectImportPayload(body, mode) {
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const invalid = () => { throw new Error(t('messages.invalidImport')); };
  if (!isObject(body)) invalid();
  let settings = body;
  if (owns(body, 'payload')) {
    if (!isObject(body.payload) || !isObject(body.payload.settings)) invalid();
    settings = body.payload.settings;
  }
  if (owns(settings, 'config') && !isObject(settings.config)) invalid();
  const imported = owns(settings, 'config') ? settings.config : settings;
  if (!['zones', 'general', 'ui', 'subjects', 'sources'].some(key => owns(imported, key)) && !owns(settings, 'subjects_state')) invalid();
  for (const key of ['zones', 'sources']) if (owns(imported, key) && !Array.isArray(imported[key])) invalid();
  for (const key of ['general', 'ui', 'subjects']) if (owns(imported, key) && !isObject(imported[key])) invalid();
  if (owns(settings, 'subjects_state') && !isObject(settings.subjects_state)) invalid();
  if (mode === 'replace' && !['zones', 'subjects', 'sources'].some(key => owns(imported, key)) && !owns(settings, 'subjects_state')) invalid();
  return imported;
}

function attachEvents() {
  qsa('.tabs button').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  qsa('.info').forEach(button => button.addEventListener('click', () => showHelp(button.dataset.help)));
  qs('#btnSave').onclick = saveConfig;
  qs('#btnReload').onclick = () => loadAll(currentTab);
  qs('#btnMigrationBackup').onclick = async () => {
    const button = qs('#btnMigrationBackup');
    button.disabled = true;
    try {
      const backup = await HomeyApp.api('GET', '/migration/backup');
      if (!backup) throw new Error(t('migration.noBackup'));
      downloadJson(JSON.stringify(backup, null, 2), 'geozones-legacy-backup.json');
    } catch (error) {
      notify(error.message || String(error), true);
    } finally {
      button.disabled = migrationStatus?.backupVerified !== true;
    }
  };
  qs('#btnAddCircle').onclick = () => drawHandlers.circle?.enable();
  qs('#btnAddPolygon').onclick = () => drawHandlers.polygon?.enable();
  qs('#btnFitAll').onclick = () => {
    const layers = [...zoneLayers.values()];
    if (layers.length) {
      map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [20, 20] });
    } else {
      syncMapViewport();
    }
  };
  ['#zoneName', '#zoneColor', '#zonePriority', '#zoneEntryDelay', '#zoneExitDelay', '#zoneHysteresis', '#zoneSubjectFilterValues', '#zoneSubjectTypeValues', '#zoneCenterLat', '#zoneCenterLng', '#zoneRadius', '#zonePaths'].forEach(selector => {
    qs(selector).addEventListener('input', syncZoneFromEditor);
  });
  ['#zoneActive', '#zoneWithoutSubject', '#zoneSubjectFilterMode', '#zoneSubjectTypeMode'].forEach(selector => {
    qs(selector).addEventListener('change', syncZoneFromEditor);
  });
  qs('#btnAddZoneTag').onclick = addZoneTag;
  qs('#zoneTagInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addZoneTag();
    }
  });
  qs('#zoneTagsList').addEventListener('click', event => {
    const tag = event.target.dataset.removeZoneTag;
    if (tag) removeZoneTag(tag);
  });
  qs('#btnDeleteZone').onclick = () => {
    if (!selectedZoneId) return;
    zoneDrafts.delete(selectedZoneId);
    delete editorErrors[selectedZoneId];
    config.zones = config.zones.filter(zone => zone.id !== selectedZoneId);
    selectedZoneId = config.zones[0]?.id || null;
    renderAll();
  };
  qs('#generalHeavyDebug').addEventListener('change', () => {
    if (!config) return;
    config.general.heavyDebug = qs('#generalHeavyDebug').checked;
    updateExportBox();
  });
  qs('#generalHistoryRetentionDays').addEventListener('change', () => {
    if (!config) return;
    config.general.historyRetentionDays = Number(qs('#generalHistoryRetentionDays').value || 30);
    updateExportBox();
  });
  qs('#btnCopyExport').onclick = async () => {
    try {
      await copyTextToClipboard(serializeCurrentConfig());
    } catch (error) {
      notify((error && error.message) || t('messages.downloadFailed'), true);
    }
  };
  qs('#btnDownloadExport').onclick = () => downloadTextFile();
  qs('#btnCopyCurrent').onclick = () => {
    try { qs('#importBox').value = serializeCurrentConfig(); }
    catch (error) { notify(error.message || String(error), true); }
  };
  qs('#btnLoadFile').onclick = () => qs('#importFile').click();
  qs('#importFile').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      qs('#importBox').value = text;
    } catch (error) {
      notify(t('messages.invalidJson'), true);
    }
    event.target.value = '';
  });
  qs('#btnImportReplace').onclick = async () => handleImport('replace');
  qs('#btnImportMerge').onclick = async () => handleImport('merge');
  qs('#historyList').addEventListener('click', async event => {
    try {
      const restoreId = event.target.dataset.restoreHistory;
      const deleteId = event.target.dataset.deleteHistory;
      if (restoreId) await HomeyApp.api('POST', `/history/${encodeURIComponent(restoreId)}/restore`, {});
      if (deleteId) await HomeyApp.api('DELETE', `/history/${encodeURIComponent(deleteId)}`);
      await loadAll('io');
    } catch (error) {
      notify(error.message || String(error), true);
    }
  });
}

function normalizeLanguageCode(value) {
  if (typeof value !== 'string') return '';
  const match = value.trim().toLowerCase().match(/^([a-z]{2})(?:[-_][a-z0-9]+)*$/);
  return match ? match[1] : '';
}

function resolveUiLanguage(meta, homey) {
  const readLanguage = owner => {
    try {
      return typeof owner?.getLanguage === 'function' ? normalizeLanguageCode(owner.getLanguage()) : '';
    } catch (error) {
      return '';
    }
  };
  const homeyLanguage = normalizeLanguageCode(meta?.language) || readLanguage(homey) || readLanguage(homey?.i18n);
  const language = homeyLanguage || normalizeLanguageCode(typeof navigator !== 'undefined' ? navigator.language : '') || 'en';
  return Object.prototype.hasOwnProperty.call(UI, language) ? language : 'en';
}

async function onHomeyReady(HomeyInstance) {
  HomeyApp = HomeyInstance;
  let meta = {};
  try {
    meta = await HomeyApp.api('GET', '/meta');
  } catch (error) {
    // Older app versions or a temporary API failure can still show readable settings.
  }
  currentLang = resolveUiLanguage(meta, HomeyApp);
  applyTranslations();
  updateAppMeta(meta || {});
  attachEvents();
  await loadAll(null);
  HomeyApp.ready();
}

window.onHomeyReady = onHomeyReady;
