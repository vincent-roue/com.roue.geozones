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
      entryDelayHelp: 'Time the subject must stay in the zone before it is considered present.',
      exitDelay: 'Exit delay (s)',
      exitDelayHelp: 'Time the subject must stay outside the zone before it is considered absent.',
      hysteresis: 'Hysteresis (m)',
      hysteresisHelp: 'For circles only. Enlarges the circle exit threshold to reduce border bouncing.',
      appliesWithoutSubject: 'Apply to coordinates without subject',
      appliesWithoutSubjectHelp: 'Used by cards that evaluate raw coordinates without a subject device.',
      subjectFilterMode: 'Subject filter',
      subjectFilterHelp: 'Allow all subjects, only the listed subjects, or all except the listed subjects. Filters match subject names and take priority over subject type filters.',
      subjectFilterValues: 'Subjects (comma-separated names)',
      subjectTypeMode: 'Subject type filter',
      subjectTypeFilterHelp: 'Allow all subject types, only the listed types, or all except the listed types. Subject types are free text values such as person, car, bike or pet.',
      subjectTypeValues: 'Subject types (comma-separated)',
      filterAll: 'All',
      filterInclude: 'Include only',
      filterExclude: 'Exclude',
      filterPriority: 'Subject filters are more specific than subject type filters.',
      addTag: 'Add tag',
      tagPlaceholder: 'Enter a tag',
      tagsHelp: 'Tags are free text values that describe how a zone is used, for example home, work, school, charging or family. Keep the same spelling everywhere you reuse them.',
    },
    general: {
      historyTitle: 'Configuration history',
      historyHelp: 'Keep previous JSON versions for a limited number of days.',
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
      importWarning: 'Import can contain sensitive coordinates. Merge works section by section, not zone by zone: current settings stay in place unless a section exists in the imported JSON, and imported zones replace the whole current zones section.',
      history: 'History',
      restore: 'Restore',
      remove: 'Delete',
    },
    help: {
      title: 'Help',
      intro: 'GeoZones stores reusable geographic zones in app settings and reuses them in Homey Flows.',
      sections: [
        { title: '1. Zones', body: ['Create circles when a center and a radius are enough. Use polygons when the real shape matters.', 'If multiple zones match, the highest priority wins. If priorities are equal, the smallest area wins.'] },
        { title: '2. Tags and types', body: ['Tags are free text values that describe how a zone is used. Subject types are also free text values, for example person, car, bike or pet.', 'Subject filters are matched by subject name and override subject type filters when both are configured.'] },
        { title: '3. Delays and hysteresis', body: ['Entry and exit delays slow down transitions to avoid false presence changes.', 'Hysteresis only applies to circles and only enlarges the circle exit threshold.'] },
        { title: '4. Manual subjects', body: ['A manual subject is a GeoZones device whose coordinates are updated from a Flow card.', 'Use manual subjects when you want to evaluate a person, vehicle or asset against your saved zones.'] },
        { title: '5. Import, export and history', body: ['Use export before risky changes. Import can replace the whole configuration or merge top-level sections of it.', 'The current merge mode is not a smart zone-by-zone merge: if the imported JSON contains a zones section, it replaces the whole current zones section. The history list lets you restore earlier saved configurations.'] },
        { title: '6. Movement threshold', body: ['The minimum movement distance is stored on each subject device, not on the zone.', 'Small moves under the threshold are ignored to reduce GPS noise.'] },
        { title: '7. Getting coordinates', body: ['GeoZones calculates zones from coordinates; it does not track phones or provide a built-in location source.', 'For an iPhone, use a compatible location source to supply latitude and longitude to a Homey Flow, then use the GeoZones card to set the subject position and evaluate it. Last update (last_update) shows when GeoZones received the coordinates, not when the source measured the position. Check the position age and update frequency in your source: stored positions do not expire automatically, and an old position does not prove the person is still there.'] },
        { title: '8. Maps and privacy', body: ['Map tiles are downloaded from OpenStreetMap. Tile requests reveal the viewed map area and your network address to the map service.', 'Copy and Download export the current JSON draft directly in your browser. Complete geometry validation takes place when saving. Exports can contain sensitive coordinates; store and share them carefully.'] },
      ],
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
      entryDelayHelp: 'Temps pendant lequel le sujet doit rester dans la zone avant d’être considéré présent.',
      exitDelay: 'Délai avant sortie (s)',
      exitDelayHelp: 'Temps pendant lequel le sujet doit rester hors de la zone avant d’être considéré absent.',
      hysteresis: 'Hystérésis (m)',
      hysteresisHelp: 'Pour les cercles uniquement. Agrandit le seuil de sortie du cercle pour limiter les bascules près du bord.',
      appliesWithoutSubject: 'Appliquer aux coordonnées sans sujet',
      appliesWithoutSubjectHelp: 'Utilisé par les cartes qui évaluent des coordonnées brutes sans appareil sujet.',
      subjectFilterMode: 'Filtre des sujets',
      subjectFilterHelp: 'Autorisez tous les sujets, uniquement les sujets listés ou tous sauf les sujets listés. Les filtres utilisent les noms des sujets et sont prioritaires sur les filtres de type.',
      subjectFilterValues: 'Sujets (noms séparés par des virgules)',
      subjectTypeMode: 'Filtre des types de sujet',
      subjectTypeFilterHelp: 'Autorisez tous les types, uniquement les types listés ou tous sauf les types listés. Les types de sujet sont des valeurs libres, par exemple personne, voiture, vélo ou animal.',
      subjectTypeValues: 'Types de sujet (séparés par des virgules)',
      filterAll: 'Tous',
      filterInclude: 'Inclure seulement',
      filterExclude: 'Exclure',
      filterPriority: 'Les filtres par sujet sont plus spécifiques que les filtres par type de sujet.',
      addTag: 'Ajouter un tag',
      tagPlaceholder: 'Saisir un tag',
      tagsHelp: 'Les tags sont des valeurs libres qui décrivent l’usage d’une zone, par exemple maison, travail, école, recharge ou famille. Gardez la même orthographe partout où vous les réutilisez.',
    },
    general: {
      historyTitle: 'Historique de configuration',
      historyHelp: 'Conserve les versions JSON précédentes pendant un nombre de jours limité.',
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
      importWarning: 'L’import peut contenir des coordonnées sensibles. La fusion fonctionne section par section, pas zone par zone : les réglages actuels restent en place sauf si une section existe dans le JSON importé, et des zones importées remplacent toute la section zones actuelle.',
      history: 'Historique',
      restore: 'Restaurer',
      remove: 'Supprimer',
    },
    help: {
      title: 'Aide',
      intro: 'GeoZones stocke des zones géographiques réutilisables dans les paramètres de l’application et les réutilise dans les Flows Homey.',
      sections: [
        { title: '1. Zones', body: ['Créez des cercles quand un centre et un rayon suffisent. Utilisez des polygones quand la forme réelle compte.', 'Si plusieurs zones correspondent, la priorité la plus élevée gagne. À priorité égale, la plus petite surface gagne.'] },
        { title: '2. Tags et types', body: ['Les tags sont des valeurs libres qui décrivent l’usage d’une zone. Les types de sujet sont aussi des valeurs libres, par exemple personne, voiture, vélo ou animal.', 'Les filtres de sujet fonctionnent sur les noms de sujet et ont priorité sur les filtres de type quand les deux sont configurés.'] },
        { title: '3. Délais et hystérésis', body: ['Les délais d’entrée et de sortie ralentissent les transitions pour éviter les faux changements de présence.', 'L’hystérésis ne s’applique qu’aux cercles et n’agrandit que le seuil de sortie du cercle.'] },
        { title: '4. Sujets manuels', body: ['Un sujet manuel est un appareil GeoZones dont les coordonnées sont mises à jour depuis une carte Flow.', 'Utilisez les sujets manuels pour évaluer une personne, un véhicule ou un équipement par rapport à vos zones enregistrées.'] },
        { title: '5. Import, export et historique', body: ['Utilisez l’export avant une modification risquée. L’import peut remplacer toute la configuration ou en fusionner des sections de premier niveau.', 'Le mode de fusion actuel n’est pas une fusion intelligente zone par zone : si le JSON importé contient une section zones, elle remplace toute la section zones actuelle. La liste d’historique permet de restaurer des configurations enregistrées plus anciennes.'] },
        { title: '6. Seuil de mouvement', body: ['La distance minimale de mouvement est stockée sur chaque appareil sujet, pas sur la zone.', 'Les petits déplacements sous ce seuil sont ignorés pour réduire le bruit GPS.'] },
        { title: '7. Obtenir les coordonnées', body: ['GeoZones calcule les zones à partir de coordonnées ; il ne suit pas les téléphones et ne fournit pas de source de position intégrée.', 'Pour un iPhone, utilisez une source de position compatible qui fournit latitude et longitude à un Flow Homey, puis la carte GeoZones de mise à jour de position et d’évaluation du sujet. Dernière mise à jour (last_update) indique quand GeoZones a reçu les coordonnées, pas quand la source a mesuré la position. Vérifiez l’ancienneté de la position et la fréquence de mise à jour dans votre source : les positions enregistrées n’expirent pas automatiquement, et une ancienne position ne prouve pas que la personne est encore sur place.'] },
        { title: '8. Carte et confidentialité', body: ['Les tuiles de la carte proviennent d’OpenStreetMap. Ces requêtes communiquent la région consultée et votre adresse réseau au service cartographique.', 'Copier et Télécharger exportent le brouillon JSON actuel directement dans votre navigateur. La géométrie complète est vérifiée à l’enregistrement. Ces exports peuvent contenir des coordonnées sensibles ; conservez-les et partagez-les avec précaution.'] },
      ],
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
      entryDelayHelp: 'Tijd dat het onderwerp in de zone moet blijven voordat het als aanwezig telt.',
      exitDelay: 'Uitgangsvertraging (s)',
      exitDelayHelp: 'Tijd dat het onderwerp buiten de zone moet blijven voordat het als afwezig telt.',
      hysteresis: 'Hysterese (m)',
      hysteresisHelp: 'Alleen voor cirkels. Vergroot de cirkel-uitgangsdrempel om schommelingen aan de rand te beperken.',
      appliesWithoutSubject: 'Toepassen op coördinaten zonder onderwerp',
      appliesWithoutSubjectHelp: 'Gebruikt door kaarten die ruwe coördinaten zonder onderwerpapparaat evalueren.',
      subjectFilterMode: 'Onderwerpfilter',
      subjectFilterHelp: 'Sta alle onderwerpen toe, alleen de opgegeven onderwerpen of alle behalve de opgegeven onderwerpen. Filters vergelijken onderwerpnamen en gaan vóór filters op onderwerpstype.',
      subjectFilterValues: 'Onderwerpen (kommagescheiden namen)',
      subjectTypeMode: 'Onderwerpstypefilter',
      subjectTypeFilterHelp: 'Sta alle onderwerpstypen toe, alleen de opgegeven typen of alle behalve de opgegeven typen. Onderwerpstypen zijn vrije tekstwaarden, bijvoorbeeld persoon, auto, fiets of huisdier.',
      subjectTypeValues: 'Onderwerpstypen (kommagescheiden)',
      filterAll: 'Alle',
      filterInclude: 'Alleen opnemen',
      filterExclude: 'Uitsluiten',
      filterPriority: 'Onderwerpfilters zijn specifieker dan filters op onderwerpstype.',
      addTag: 'Tag toevoegen',
      tagPlaceholder: 'Voer een tag in',
      tagsHelp: 'Tags zijn vrije tekstwaarden die beschrijven waarvoor een zone wordt gebruikt, bijvoorbeeld thuis, werk, school, opladen of familie. Gebruik overal dezelfde schrijfwijze.',
    },
    general: {
      historyTitle: 'Configuratiegeschiedenis',
      historyHelp: 'Bewaar vorige JSON-versies gedurende een beperkt aantal dagen.',
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
      importWarning: 'Import kan gevoelige coördinaten bevatten. Samenvoegen werkt per sectie, niet per zone: huidige instellingen blijven staan tenzij een sectie aanwezig is in de geïmporteerde JSON, en geïmporteerde zones vervangen de volledige huidige zones-sectie.',
      history: 'Geschiedenis',
      restore: 'Herstellen',
      remove: 'Verwijderen',
    },
    help: {
      title: 'Help',
      intro: 'GeoZones slaat herbruikbare geografische zones op in de app-instellingen en hergebruikt ze in Homey Flows.',
      sections: [
        { title: '1. Zones', body: ['Maak cirkels wanneer een middelpunt en straal voldoende zijn. Gebruik polygonen wanneer de echte vorm belangrijk is.', 'Als meerdere zones overeenkomen, wint de hoogste prioriteit. Bij gelijke prioriteit wint het kleinste oppervlak.'] },
        { title: '2. Tags en typen', body: ['Tags zijn vrije tekstwaarden die beschrijven waarvoor een zone wordt gebruikt. Onderwerpstypen zijn ook vrije tekstwaarden, bijvoorbeeld persoon, auto, fiets of huisdier.', 'Onderwerpfilters werken op onderwerpnaam en hebben voorrang op filters op onderwerpstype wanneer beide zijn ingesteld.'] },
        { title: '3. Vertragingen en hysterese', body: ['Ingangs- en uitgangsvertraging vertragen overgangen om valse aanwezigheidswissels te voorkomen.', 'Hysterese geldt alleen voor cirkels en vergroot alleen de uitgangsdrempel van de cirkel.'] },
        { title: '4. Handmatige onderwerpen', body: ['Een handmatig onderwerp is een GeoZones-apparaat waarvan de coördinaten via een Flow-kaart worden bijgewerkt.', 'Gebruik handmatige onderwerpen om een persoon, voertuig of object tegen je opgeslagen zones te evalueren.'] },
        { title: '5. Import, export en geschiedenis', body: ['Gebruik export vóór risicovolle wijzigingen. Import kan de hele configuratie vervangen of secties op hoofdniveau samenvoegen.', 'De huidige samenvoegmodus is geen slimme zone-voor-zone merge: als de geïmporteerde JSON een zones-sectie bevat, vervangt die de volledige huidige zones-sectie. Met de geschiedenislijst kun je eerdere opgeslagen configuraties herstellen.'] },
        { title: '6. Bewegingsdrempel', body: ['De minimale bewegingsafstand wordt opgeslagen op elk onderwerpapparaat, niet op de zone.', 'Kleine bewegingen onder deze drempel worden genegeerd om GPS-ruis te verminderen.'] },
        { title: '7. Coördinaten verkrijgen', body: ['GeoZones berekent zones uit coördinaten; de app volgt geen telefoons en heeft geen ingebouwde locatiebron.', 'Gebruik voor een iPhone een compatibele locatiebron die breedte- en lengtegraad aan een Homey Flow levert en daarna de GeoZones-kaart om de positie bij te werken en te evalueren. Laatste update (last_update) toont wanneer GeoZones de coördinaten heeft ontvangen, niet wanneer de bron de positie heeft gemeten. Controleer de ouderdom van de positie en de updatefrequentie bij je bron: opgeslagen posities verlopen niet automatisch en een oude positie bewijst niet dat iemand er nog is.'] },
        { title: '8. Kaart en privacy', body: ['Kaarttegels worden bij OpenStreetMap opgevraagd. Deze aanvragen delen het bekeken kaartgebied en je netwerkadres met de kaartdienst.', 'Kopiëren en Downloaden exporteren het huidige JSON-concept rechtstreeks in je browser. De volledige geometrie wordt bij het opslaan gecontroleerd. Exports kunnen gevoelige coördinaten bevatten; bewaar en deel ze zorgvuldig.'] },
      ],
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
      entryDelayHelp: 'Zeit, die das Subjekt in der Zone bleiben muss, bevor es als anwesend gilt.',
      exitDelay: 'Austrittsverzögerung (s)',
      exitDelayHelp: 'Zeit, die das Subjekt außerhalb der Zone bleiben muss, bevor es als abwesend gilt.',
      hysteresis: 'Hysterese (m)',
      hysteresisHelp: 'Nur für Kreise. Vergrößert die Austrittsschwelle des Kreises, um Schwanken am Rand zu reduzieren.',
      appliesWithoutSubject: 'Auf Koordinaten ohne Subjekt anwenden',
      appliesWithoutSubjectHelp: 'Wird von Karten verwendet, die rohe Koordinaten ohne Subjektgerät auswerten.',
      subjectFilterMode: 'Subjektfilter',
      subjectFilterHelp: 'Wählen Sie, ob alle Subjekte, nur die angegebenen Subjekte oder alle außer den angegebenen Subjekten zugelassen sind. Die Filter gleichen Subjektnamen ab und haben Vorrang vor Subjekttypfiltern.',
      subjectFilterValues: 'Subjekte (kommagetrennte Namen)',
      subjectTypeMode: 'Subjekttypfilter',
      subjectTypeFilterHelp: 'Wählen Sie, ob alle Subjekttypen, nur die angegebenen Typen oder alle außer den angegebenen Typen zugelassen sind. Subjekttypen sind freie Textwerte, zum Beispiel Person, Auto, Fahrrad oder Haustier.',
      subjectTypeValues: 'Subjekttypen (kommagetrennt)',
      filterAll: 'Alle',
      filterInclude: 'Nur einschließen',
      filterExclude: 'Ausschließen',
      filterPriority: 'Subjektfilter sind spezifischer als Subjekttypfilter.',
      addTag: 'Tag hinzufügen',
      tagPlaceholder: 'Tag eingeben',
      tagsHelp: 'Tags sind freie Textwerte, die die Nutzung einer Zone beschreiben, zum Beispiel Zuhause, Arbeit, Schule, Laden oder Familie. Verwenden Sie überall dieselbe Schreibweise.',
    },
    general: {
      historyTitle: 'Konfigurationsverlauf',
      historyHelp: 'Vorherige JSON-Versionen für eine begrenzte Anzahl von Tagen aufbewahren.',
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
      importWarning: 'Der Import kann sensible Koordinaten enthalten. Das Zusammenführen arbeitet abschnittsweise, nicht Zone für Zone: Aktuelle Einstellungen bleiben erhalten, sofern ein Abschnitt nicht im importierten JSON vorhanden ist, und importierte Zonen ersetzen den gesamten aktuellen Abschnitt zones.',
      history: 'Verlauf',
      restore: 'Wiederherstellen',
      remove: 'Löschen',
    },
    help: {
      title: 'Hilfe',
      intro: 'GeoZones speichert wiederverwendbare geografische Zonen in den App-Einstellungen und nutzt sie in Homey Flows wieder.',
      sections: [
        { title: '1. Zonen', body: ['Erstellen Sie Kreise, wenn Mittelpunkt und Radius ausreichen. Verwenden Sie Polygone, wenn die reale Form wichtig ist.', 'Wenn mehrere Zonen passen, gewinnt die höchste Priorität. Bei gleicher Priorität gewinnt die kleinste Fläche.'] },
        { title: '2. Tags und Typen', body: ['Tags sind freie Textwerte, die die Nutzung einer Zone beschreiben. Subjekttypen sind ebenfalls freie Textwerte, zum Beispiel Person, Auto, Fahrrad oder Haustier.', 'Subjektfilter arbeiten mit dem Subjektnamen und haben Vorrang vor Subjekttypfiltern, wenn beides konfiguriert ist.'] },
        { title: '3. Verzögerungen und Hysterese', body: ['Eintritts- und Austrittsverzögerungen verlangsamen Übergänge, um falsche Präsenzwechsel zu vermeiden.', 'Hysterese gilt nur für Kreise und vergrößert nur die Austrittsschwelle des Kreises.'] },
        { title: '4. Manuelle Subjekte', body: ['Ein manuelles Subjekt ist ein GeoZones-Gerät, dessen Koordinaten über eine Flow-Karte aktualisiert werden.', 'Verwenden Sie manuelle Subjekte, um zu ermitteln, in welchen Ihrer gespeicherten Zonen sich eine Person, ein Fahrzeug oder ein Objekt befindet.'] },
        { title: '5. Import, Export und Verlauf', body: ['Verwenden Sie Export vor riskanten Änderungen. Import kann die gesamte Konfiguration ersetzen oder Abschnitte auf oberster Ebene zusammenführen.', 'Der aktuelle Zusammenführungsmodus ist keine intelligente Zone-für-Zone-Zusammenführung: Wenn das importierte JSON einen Abschnitt zones enthält, ersetzt er den gesamten aktuellen Abschnitt zones. Über die Verlaufsliste können frühere gespeicherte Konfigurationen wiederhergestellt werden.'] },
        { title: '6. Bewegungsdistanz', body: ['Die minimale Bewegungsdistanz wird pro Subjektgerät gespeichert, nicht pro Zone.', 'Kleine Bewegungen unterhalb dieser Schwelle werden ignoriert, um GPS-Rauschen zu reduzieren.'] },
        { title: '7. Koordinaten erhalten', body: ['GeoZones berechnet Zonen aus Koordinaten; die App verfolgt keine Telefone und enthält keine integrierte Standortquelle.', 'Verwenden Sie für ein iPhone eine kompatible Standortquelle, die Breiten- und Längengrad an einen Homey Flow liefert, und danach die GeoZones-Karte zur Positionsaktualisierung und Auswertung. Letzte Aktualisierung (last_update) zeigt, wann GeoZones die Koordinaten empfangen hat, nicht wann die Quelle die Position ermittelt hat. Prüfen Sie das Alter der Position und das Aktualisierungsintervall in Ihrer Quelle: Gespeicherte Positionen verfallen nicht automatisch, und eine alte Position beweist nicht, dass die Person noch dort ist.'] },
        { title: '8. Karte und Datenschutz', body: ['Kartenkacheln werden von OpenStreetMap geladen. Diese Anfragen übermitteln den betrachteten Kartenausschnitt und Ihre Netzwerkadresse an den Kartendienst.', 'Kopieren und Herunterladen exportieren den aktuellen JSON-Entwurf direkt im Browser. Die vollständige Geometrie wird beim Speichern geprüft. Exporte können sensible Koordinaten enthalten; bewahren und teilen Sie sie mit Bedacht.'] },
      ],
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

async function onHomeyReady(HomeyInstance) {
  HomeyApp = HomeyInstance;
  currentLang = ((HomeyApp?.i18n?.getLanguage?.() || navigator.language || 'en').slice(0, 2)).toLowerCase();
  if (!UI[currentLang]) currentLang = 'en';
  applyTranslations();
  try {
    updateAppMeta(await HomeyApp.api('GET', '/meta'));
  } catch (error) {
    updateAppMeta({});
  }
  attachEvents();
  await loadAll(null);
  Homey.ready();
}

window.onHomeyReady = onHomeyReady;
