/* global Homey, L */
let HomeyApp;
let config = null;
let devices = [];
let history = [];
let selectedZoneId = null;
let map;
let zoneLayers = new Map();
let drawnItems;
let drawHandlers = {};
let currentLang = 'en';
let currentTab = 'zones';
let sourceAttempts = [];

const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];
const cleanText = v => String(v ?? '').trim();
const parseCsvKeepCase = value => {
  const seen = new Set();
  const out = [];
  for (const item of String(value || '').split(',').map(v => v.trim()).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};


function normalizeSourceDevices(list) {
  const currentSources = Array.isArray(config?.sources) ? config.sources : [];
  return (Array.isArray(list) ? list : [])
    .map(device => {
      const capsObj = device.capabilitiesObj || {};
      const capabilities = Array.isArray(device.capabilities)
        ? device.capabilities
        : Object.keys(capsObj || {});
      if (!capabilities.includes('measure_latitude') || !capabilities.includes('measure_longitude')) return null;
      const existing = currentSources.find(source => source.deviceId === device.id);
      return {
        id: device.id,
        name: device.name,
        capabilities,
        alreadyAdded: Boolean(existing) || Boolean(device.alreadyAdded),
        subjectId: existing?.subjectId || device.subjectId || null,
        latitude: device.latitude ?? capsObj.measure_latitude?.value ?? null,
        longitude: device.longitude ?? capsObj.measure_longitude?.value ?? null,
        latitudeUpdated: device.latitudeUpdated ?? capsObj.measure_latitude?.lastUpdated ?? null,
        longitudeUpdated: device.longitudeUpdated ?? capsObj.measure_longitude?.lastUpdated ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

async function fetchLocationDevices() {
  sourceAttempts = [];

  const fromAppApi = await HomeyApp.api('GET', '/sources/devices');
  const apiDevices = Array.isArray(fromAppApi) ? fromAppApi : (fromAppApi?.devices || []);
  const normalized = normalizeSourceDevices(apiDevices);
  sourceAttempts = Array.isArray(fromAppApi?.attempts) ? fromAppApi.attempts : [];

  return normalized.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

const PALETTE = ['#2F6FED','#E05263','#2F9E44','#7A42F4','#F08C00','#0B7285','#C2255C','#5F3DC4','#A61E4D','#1D4ED8'];
const UI = {
  en: {
    tabs:{zones:'Zones',subjects:'Subjects',sources:'Sources',general:'General',io:'Import / Export',help:'Help'},
    actions:{save:'Save',reload:'Reload',addCircle:'Add circle',addPolygon:'Add polygon',fitAll:'Fit all',deleteZone:'Delete zone'},
    common:{name:'Name',color:'Color',active:'Active',priority:'Priority',tags:'Tags'},
    zones:{editor:'Zone',selectZone:'Select a zone',circle:'Circle',polygon:'Polygon',centerLat:'Center latitude',centerLng:'Center longitude',radius:'Radius (m)',points:'Polygon points (JSON)',advanced:'Advanced options',entryDelay:'Entry delay (s)',entryDelayHelp:'Time the subject must stay in the zone before it is considered present.',exitDelay:'Exit delay (s)',exitDelayHelp:'Time the subject must stay outside the zone before it is considered absent.',hysteresis:'Hysteresis (m)',hysteresisHelp:'For circles only. Enlarges the circle radius to stabilize exits.',appliesWithoutSubject:'Apply to coordinates without subject',appliesWithoutSubjectHelp:'Used by cards that evaluate raw coordinates without a subject.',subjectFilterMode:'Subject filter',subjectFilterHelp:'Choose whether all subjects are allowed, or only / except the listed subjects. Subject filters have priority over subject type filters.',subjectFilterValues:'Subjects (comma-separated IDs)',subjectTypeMode:'Subject type filter',subjectTypeFilterHelp:'Choose whether all subject types are allowed, or only / except the listed types.',subjectTypeValues:'Subject types (comma-separated)',filterAll:'All',filterInclude:'Include only',filterExclude:'Exclude',filterPriority:'Subject filters are more specific than subject type filters.'},
    subjects:{title:'Subjects',none:'No subjects yet',type:'Type of subject',threshold:'Minimum movement threshold (m)',source:'Source',currentZone:'Current zone',currentTags:'Current tags',movement:'Movement',updated:'Updated',coordinates:'Coordinates',advanced:'Advanced options',reset:'Reset',delete:'Delete',noneValue:'None'},
    sources:{title:'Location sources',intro:'Devices exposing measure_latitude and measure_longitude can be added as subjects.',none:'No compatible device found.',add:'Add as subject',added:'Already added'},
    general:{subjectPurgeTitle:'Subject purge',subjectPurgeHelp:'Automatically remove inactive subjects after the configured number of days.',subjectPurgeEnabled:'Enable subject auto-purge',subjectPurgeDays:'Inactive for at least (days)',historyTitle:'Config history',historyHelp:'Keep previous JSON versions for a limited number of days.',historyDays:'Retention (days)',debugTitle:'Debug',heavyDebug:'Enable heavy debug logging',heavyDebugHelp:'Only enable heavy debug on request from the developer to troubleshoot an issue. Keeping it enabled for a long time can slow down the app and may lead to instability or crashes.'},
    io:{exportTitle:'Export',copy:'Copy',download:'Download',importTitle:'Import',copyCurrent:'Copy from current',loadFile:'Load file',importReplace:'Import and replace',importMerge:'Import and merge',history:'History',restore:'Restore',remove:'Delete'},
    help:{title:'Help',intro:'GeoZones stores reusable geographic zones in app settings and exposes them in Homey Flows.',item1:'Use the map to create circles and polygons, then refine them in the editor.',item2:'Tags describe the meaning of a zone. Subject types describe what a subject is.',item3:'The minimum movement threshold is stored on each subject, not on the zone.',item4:'Hysteresis only applies to circles and only enlarges the circle.',item5:'Subject filters are more specific than subject type filters.'},
    messages:{saved:'Saved',loaded:'Loaded',invalidJson:'Invalid JSON file.',downloadFailed:'Unable to download the export file.',loadFailed:'Unable to load the selected file.'}
  },
  fr: {
    tabs:{zones:'Zones',subjects:'Sujets',sources:'Sources',general:'Général',io:'Import / Export',help:'Aide'},
    actions:{save:'Enregistrer',reload:'Recharger',addCircle:'Ajouter un cercle',addPolygon:'Ajouter un polygone',fitAll:'Ajuster à toutes les zones',deleteZone:'Supprimer la zone'},
    common:{name:'Nom',color:'Couleur',active:'Active',priority:'Priorité',tags:'Tags'},
    zones:{editor:'Zone',selectZone:'Sélectionnez une zone',circle:'Cercle',polygon:'Polygone',centerLat:'Latitude du centre',centerLng:'Longitude du centre',radius:'Rayon (m)',points:'Points du polygone (JSON)',advanced:'Options avancées',entryDelay:'Délai avant entrée (s)',entryDelayHelp:'Temps pendant lequel le sujet doit rester dans la zone avant d’être considéré présent.',exitDelay:'Délai avant sortie (s)',exitDelayHelp:'Temps pendant lequel le sujet doit rester hors de la zone avant d’être considéré absent.',hysteresis:'Hystérésis (m)',hysteresisHelp:'Pour les cercles uniquement. Agrandit le rayon du cercle pour stabiliser les sorties.',appliesWithoutSubject:'Appliquer aux coordonnées sans sujet',appliesWithoutSubjectHelp:'Utilisé par les cartes qui évaluent des coordonnées brutes sans sujet.',subjectFilterMode:'Filtre des sujets',subjectFilterHelp:'Choisissez si tous les sujets sont autorisés, ou seulement / sauf les sujets listés. Les filtres de sujets sont prioritaires sur les filtres de type.',subjectFilterValues:'Sujets (IDs séparés par des virgules)',subjectTypeMode:'Filtre des types de sujet',subjectTypeFilterHelp:'Choisissez si tous les types sont autorisés, ou seulement / sauf les types listés.',subjectTypeValues:'Types de sujet (séparés par des virgules)',filterAll:'Tous',filterInclude:'Inclure seulement',filterExclude:'Exclure',filterPriority:'Les filtres par sujet sont plus spécifiques que les filtres par type de sujet.'},
    subjects:{title:'Sujets',none:'Aucun sujet pour le moment',type:'Type de sujet',threshold:'Seuil minimal de déplacement (m)',source:'Source',currentZone:'Zone courante',currentTags:'Tags courants',movement:'Mouvement',updated:'Mis à jour',coordinates:'Coordonnées',advanced:'Options avancées',reset:'Réinitialiser',delete:'Supprimer',noneValue:'Aucun'},
    sources:{title:'Sources de localisation',intro:'Les appareils exposant measure_latitude et measure_longitude peuvent être ajoutés comme sujets.',none:'Aucun appareil compatible trouvé.',add:'Ajouter comme sujet',added:'Déjà ajouté'},
    general:{subjectPurgeTitle:'Purge des sujets',subjectPurgeHelp:'Supprime automatiquement les sujets inactifs après le nombre de jours configuré.',subjectPurgeEnabled:'Activer la purge automatique des sujets',subjectPurgeDays:'Inactif depuis au moins (jours)',historyTitle:'Historique de configuration',historyHelp:'Conserve les versions JSON précédentes pendant un nombre de jours limité.',historyDays:'Rétention (jours)',debugTitle:'Debug',heavyDebug:'Activer le heavy debug',heavyDebugHelp:'Activez le heavy debug uniquement à la demande du développeur pour diagnostiquer un problème. Le laisser activé longtemps peut ralentir l’app et provoquer de l’instabilité ou des crashs.'},
    io:{exportTitle:'Export',copy:'Copier',download:'Télécharger',importTitle:'Import',copyCurrent:'Copier depuis l’actuel',loadFile:'Charger un fichier',importReplace:'Importer et remplacer',importMerge:'Importer et fusionner',history:'Historique',restore:'Restaurer',remove:'Supprimer'},
    help:{title:'Aide',intro:'GeoZones stocke des zones géographiques réutilisables dans les paramètres de l’application et les expose dans les Flows Homey.',item1:'Utilisez la carte pour créer des cercles et des polygones, puis affinez-les dans l’éditeur.',item2:'Les tags décrivent la signification d’une zone. Les types de sujet décrivent ce qu’est un sujet.',item3:'Le seuil minimal de déplacement est stocké sur chaque sujet, pas sur la zone.',item4:'L’hystérésis ne s’applique qu’aux cercles et n’agrandit que le cercle.',item5:'Les filtres de sujets sont prioritaires sur les filtres de type de sujet.'},
    messages:{saved:'Enregistré',loaded:'Chargé',invalidJson:'Fichier JSON invalide.',downloadFailed:'Impossible de télécharger le fichier d’export.',loadFailed:'Impossible de charger le fichier sélectionné.'}
  },
  nl: {tabs:{zones:'Zones',subjects:'Onderwerpen',sources:'Bronnen',general:'Algemeen',io:'Import / Export',help:'Help'},actions:{save:'Opslaan',reload:'Herladen',addCircle:'Cirkel toevoegen',addPolygon:'Polygoon toevoegen',fitAll:'Alles tonen',deleteZone:'Zone verwijderen'},common:{name:'Naam',color:'Kleur',active:'Actief',priority:'Prioriteit',tags:'Tags'},zones:{editor:'Zone',selectZone:'Selecteer een zone',circle:'Cirkel',polygon:'Polygoon',centerLat:'Midden breedtegraad',centerLng:'Midden lengtegraad',radius:'Straal (m)',points:'Polygoonpunten (JSON)',advanced:'Geavanceerde opties',entryDelay:'Vertraging bij binnenkomst (s)',entryDelayHelp:'Tijd dat het onderwerp in de zone moet blijven voordat het als aanwezig geldt.',exitDelay:'Vertraging bij vertrek (s)',exitDelayHelp:'Tijd dat het onderwerp buiten de zone moet blijven voordat het als vertrokken geldt.',hysteresis:'Hysterese (m)',hysteresisHelp:'Alleen voor cirkels. Vergroot de straal om uitstappen te stabiliseren.',appliesWithoutSubject:'Toepassen op coördinaten zonder onderwerp',appliesWithoutSubjectHelp:'Gebruikt door kaarten die ruwe coördinaten zonder onderwerp evalueren.',subjectFilterMode:'Onderwerpfilter',subjectFilterHelp:'Kies of alle onderwerpen zijn toegestaan, of alleen / behalve de opgegeven onderwerpen. Onderwerpfilters hebben voorrang op typefilters.',subjectFilterValues:'Onderwerpen (kommagescheiden IDs)',subjectTypeMode:'Typefilter',subjectTypeFilterHelp:'Kies of alle types zijn toegestaan, of alleen / behalve de opgegeven types.',subjectTypeValues:'Onderwerpstypen (kommagescheiden)',filterAll:'Alles',filterInclude:'Alleen opnemen',filterExclude:'Uitsluiten',filterPriority:'Onderwerpfilters zijn specifieker dan filters op onderwerpstype.'},subjects:{title:'Onderwerpen',none:'Nog geen onderwerpen',type:'Type onderwerp',threshold:'Minimale verplaatsingsdrempel (m)',source:'Bron',currentZone:'Huidige zone',currentTags:'Huidige tags',movement:'Beweging',updated:'Bijgewerkt',coordinates:'Coördinaten',advanced:'Geavanceerde opties',reset:'Reset',delete:'Verwijderen',noneValue:'Geen'},sources:{title:'Locatiebronnen',intro:'Apparaten met measure_latitude en measure_longitude kunnen als onderwerp worden toegevoegd.',none:'Geen compatibel apparaat gevonden.',add:'Als onderwerp toevoegen',added:'Al toegevoegd'},general:{subjectPurgeTitle:'Onderwerp-opruiming',subjectPurgeHelp:'Verwijder automatisch inactieve onderwerpen na het ingestelde aantal dagen.',subjectPurgeEnabled:'Automatisch inactieve onderwerpen opruimen',subjectPurgeDays:'Minstens inactief gedurende (dagen)',historyTitle:'Configuratiegeschiedenis',historyHelp:'Bewaar vorige JSON-versies gedurende een beperkt aantal dagen.',historyDays:'Bewaartermijn (dagen)',debugTitle:'Debug',heavyDebug:'Heavy debug logging inschakelen',heavyDebugHelp:'Schakel heavy debug alleen in op verzoek van de ontwikkelaar om een probleem te onderzoeken. Lang ingeschakeld laten kan de app vertragen en instabiliteit of crashes veroorzaken.'},io:{exportTitle:'Export',copy:'Kopiëren',download:'Downloaden',importTitle:'Import',copyCurrent:'Kopieer van huidig',loadFile:'Bestand laden',importReplace:'Importeren en vervangen',importMerge:'Importeren en samenvoegen',history:'Geschiedenis',restore:'Herstellen',remove:'Verwijderen'},help:{title:'Help',intro:'GeoZones slaat herbruikbare geografische zones op in de app-instellingen en maakt ze beschikbaar in Homey Flows.',item1:'Gebruik de kaart om cirkels en polygonen te maken en verfijn ze daarna in de editor.',item2:'Tags beschrijven de betekenis van een zone. Onderwerpstypen beschrijven wat een onderwerp is.',item3:'De minimale verplaatsingsdrempel wordt per onderwerp opgeslagen, niet per zone.',item4:'Hysterese geldt alleen voor cirkels en vergroot alleen de cirkel.',item5:'Onderwerpfilters hebben voorrang op filters op onderwerpstype.'},messages:{saved:'Opgeslagen',loaded:'Geladen',invalidJson:'Ongeldig JSON-bestand.',downloadFailed:'Exportbestand kan niet worden gedownload.',loadFailed:'Geselecteerd bestand kan niet worden geladen.'}},
  de: {tabs:{zones:'Zonen',subjects:'Subjekte',sources:'Quellen',general:'Allgemein',io:'Import / Export',help:'Hilfe'},actions:{save:'Speichern',reload:'Neu laden',addCircle:'Kreis hinzufügen',addPolygon:'Polygon hinzufügen',fitAll:'Alles anzeigen',deleteZone:'Zone löschen'},common:{name:'Name',color:'Farbe',active:'Aktiv',priority:'Priorität',tags:'Tags'},zones:{editor:'Zone',selectZone:'Zone auswählen',circle:'Kreis',polygon:'Polygon',centerLat:'Breitengrad des Mittelpunkts',centerLng:'Längengrad des Mittelpunkts',radius:'Radius (m)',points:'Polygonpunkte (JSON)',advanced:'Erweiterte Optionen',entryDelay:'Eintrittsverzögerung (s)',entryDelayHelp:'Zeit, die das Subjekt in der Zone bleiben muss, bevor es als anwesend gilt.',exitDelay:'Austrittsverzögerung (s)',exitDelayHelp:'Zeit, die das Subjekt außerhalb der Zone bleiben muss, bevor es als abwesend gilt.',hysteresis:'Hysterese (m)',hysteresisHelp:'Nur für Kreise. Vergrößert den Radius, um Austritte zu stabilisieren.',appliesWithoutSubject:'Auf Koordinaten ohne Subjekt anwenden',appliesWithoutSubjectHelp:'Wird von Karten verwendet, die rohe Koordinaten ohne Subjekt auswerten.',subjectFilterMode:'Subjektfilter',subjectFilterHelp:'Wählen Sie, ob alle Subjekte erlaubt sind oder nur / außer den aufgelisteten. Subjektfilter haben Vorrang vor Typfiltern.',subjectFilterValues:'Subjekte (kommagetrennte IDs)',subjectTypeMode:'Subjekttypfilter',subjectTypeFilterHelp:'Wählen Sie, ob alle Typen erlaubt sind oder nur / außer den aufgelisteten Typen.',subjectTypeValues:'Subjekttypen (kommagetrennt)',filterAll:'Alle',filterInclude:'Nur einschließen',filterExclude:'Ausschließen',filterPriority:'Subjektfilter sind spezifischer als Subjekttypfilter.'},subjects:{title:'Subjekte',none:'Noch keine Subjekte',type:'Subjekttyp',threshold:'Minimale Bewegungsgrenze (m)',source:'Quelle',currentZone:'Aktuelle Zone',currentTags:'Aktive Tags',movement:'Bewegung',updated:'Aktualisiert',coordinates:'Koordinaten',advanced:'Erweiterte Optionen',reset:'Zurücksetzen',delete:'Löschen',noneValue:'Keine'},sources:{title:'Standortquellen',intro:'Geräte mit measure_latitude und measure_longitude können als Subjekte hinzugefügt werden.',none:'Kein kompatibles Gerät gefunden.',add:'Als Subjekt hinzufügen',added:'Bereits hinzugefügt'},general:{subjectPurgeTitle:'Subjekt-Bereinigung',subjectPurgeHelp:'Inaktive Subjekte nach der eingestellten Anzahl von Tagen automatisch entfernen.',subjectPurgeEnabled:'Automatische Bereinigung inaktiver Subjekte aktivieren',subjectPurgeDays:'Mindestens inaktiv seit (Tagen)',historyTitle:'Konfigurationsverlauf',historyHelp:'Vorherige JSON-Versionen für eine begrenzte Anzahl von Tagen aufbewahren.',historyDays:'Aufbewahrung (Tage)',debugTitle:'Debug',heavyDebug:'Heavy-Debug-Logging aktivieren',heavyDebugHelp:'Heavy Debug nur auf Anforderung des Entwicklers aktivieren, um ein Problem zu analysieren. Eine dauerhafte Aktivierung kann die App verlangsamen und zu Instabilität oder Abstürzen führen.'},io:{exportTitle:'Export',copy:'Kopieren',download:'Herunterladen',importTitle:'Import',copyCurrent:'Von aktueller Version kopieren',loadFile:'Datei laden',importReplace:'Importieren und ersetzen',importMerge:'Importieren und zusammenführen',history:'Verlauf',restore:'Wiederherstellen',remove:'Löschen'},help:{title:'Hilfe',intro:'GeoZones speichert wiederverwendbare geografische Zonen in den App-Einstellungen und stellt sie in Homey Flows bereit.',item1:'Verwenden Sie die Karte, um Kreise und Polygone zu erstellen, und verfeinern Sie sie anschließend im Editor.',item2:'Tags beschreiben die Bedeutung einer Zone. Subjekttypen beschreiben, was ein Subjekt ist.',item3:'Die minimale Bewegungsgrenze wird pro Subjekt gespeichert, nicht pro Zone.',item4:'Hysterese gilt nur für Kreise und vergrößert nur den Kreis.',item5:'Subjektfilter haben Vorrang vor Subjekttypfiltern.'},messages:{saved:'Gespeichert',loaded:'Geladen',invalidJson:'Ungültige JSON-Datei.',downloadFailed:'Exportdatei konnte nicht heruntergeladen werden.',loadFailed:'Die ausgewählte Datei konnte nicht geladen werden.'}}
};

const EXTRA = {
  en: {
    common: { remove: 'Remove' },
    zones: {
      addTag: 'Add tag',
      tagPlaceholder: 'Enter a tag',
      tagsHelp: 'Tags describe the meaning of a zone, for example home, work, school, charging or family. A coordinate can match a tag through any zone carrying that tag.'
    },
    sources: {
      refresh: 'Refresh sources',
      remove: 'Remove source',
      capabilities: 'Capabilities',
      coords: 'Coordinates',
      updated: 'Updated',
      linked: 'Linked subject',
      diagnosticsTitle: 'Source diagnostics',
      diagnosticsNone: 'No diagnostics available.',
      diagnosticsOk: 'OK',
      diagnosticsFail: 'Failed'
    },
    messages: {
      sourceRefreshFailed: 'Unable to refresh possible sources.',
      exportReady: 'Export file generated.'
    },
    helpSections: [
      {
        title: '1. What GeoZones does',
        body: [
          'GeoZones stores reusable geographic zones and evaluates coordinates or subjects against those zones.',
          'A subject is GeoZones runtime state: last known coordinates, current zone, current tags, movement state, delays and update time.',
          'A source is an existing Homey device exposing measure_latitude and measure_longitude. Adding a source creates or links a subject.'
        ]
      },
      {
        title: '2. Zones, priority, tags and filters',
        body: [
          'Use circles when a center point and radius are enough. Use polygons when the real shape matters.',
          'If several zones match, the highest priority wins. If priorities are equal, the smallest area wins.',
          'Tags describe the meaning of a zone. Subject filters target specific subject IDs. Subject type filters target broader groups such as person or vehicle. Subject filters have priority over subject type filters.'
        ]
      },
      {
        title: '3. Advanced zone options',
        body: [
          'Entry delay means the subject must stay inside long enough before it is considered present. Exit delay works the same way for leaving.',
          'Hysteresis applies to circles only and enlarges the exit threshold to reduce bouncing at the border.',
          'Apply to coordinates without subject controls whether cards evaluating raw latitude/longitude can use this zone.'
        ]
      },
      {
        title: '4. Simple versus multi Flow cards',
        body: [
          'Simple cards use autocomplete and are intended for one dynamic subject, one zone, one tag or one subject type.',
          'Multi cards use a plain text field with comma-separated values because Homey Flow does not support dynamic multiselect for these runtime values.',
          'For multi cards you can enter IDs, exact names, or tags separated by commas, for example: home, work, charging.'
        ]
      },
      {
        title: '5. Trigger cards',
        body: [
          'subject_entered_zone / subject_left_zone: use these when you want one selected subject and one selected zone through autocomplete.',
          'subject_entered_zones / subject_left_zones: same idea, but for several dynamic zones entered as comma-separated zone names. Use exact zone names as shown in GeoZones settings. The trigger fires when at least one listed zone matches the event.',
          'subject_position_changed fires when GeoZones stores a new position. subject_recalculated fires when GeoZones recalculates a subject without necessarily writing new coordinates.'
        ]
      },
      {
        title: '6. Condition cards: existence and matching',
        body: [
          'subject_exists, zone_exists, tag_exists and subject_type_exists check one value through autocomplete. Their plural variants subjects_exist, zones_exist, tags_exist and subject_types_exist check comma-separated lists and return true only when all listed values exist.',
          'coordinates_match_zone / coordinates_match_tag check one dynamic zone or tag for raw coordinates. coordinates_match_zones / coordinates_match_tags do the same for comma-separated lists and return true when at least one listed value matches.',
          'All AND cards are invertible, so they can be used in both positive and negative logic.'
        ]
      },
      {
        title: '7. Condition cards: subject state and zone contents',
        body: [
          'subject_is_in_zone and subject_is_of_type are the simple cards. subject_is_in_zones and subject_is_of_types are their multi CSV variants and return true when at least one listed value matches.',
          'subject_is_movement_state uses a real multiselect because the values are static: unknown, stable and moving.',
          'zone_contains_subject and zone_contains_subject_type check one subject or one subject type. zone_contains_subjects and zone_contains_subject_types check lists. Leaving subjects empty in zone_contains_subjects means: the zone contains at least one subject.',
          'zone_contains_only_subject_type and zone_contains_only_subject_types verify that all subjects currently inside the zone belong to the allowed type or type set.'
        ]
      },
      {
        title: '8. Action cards',
        body: [
          'evaluate_coordinates returns the winning zone for raw coordinates. update_and_evaluate_subject_position stores new coordinates for a subject and then evaluates the result.',
          'evaluate_subject_position re-evaluates stored coordinates. force_recalculate_subject is useful after changing zones, filters, delays or subject type.',
          'distance_* cards return distances in meters. For zone distance cards, 0 means inside the zone.',
          'set_subject_type changes the subject type, rename_subject changes the display name, reset_subject clears runtime state, and purge_subjects removes old inactive subjects while returning remaining_subjects_count.'
        ]
      },
      {
        title: '9. Subjects, movement threshold and debugging',
        body: [
          'The minimum movement threshold is stored on each subject. Small moves under the threshold are ignored to reduce GPS noise.',
          'If a result is unexpected, check: zone active state, coordinates truly inside the zone, priority, subject filter, subject type filter, delays and hysteresis.',
          'Use export before risky changes. Use history to restore an earlier configuration. Enable heavy debug only temporarily for troubleshooting.'
        ]
      }
    ]
  },
  fr: {
    common: { remove: 'Supprimer' },
    zones: {
      addTag: 'Ajouter un tag',
      tagPlaceholder: 'Saisir un tag',
      tagsHelp: 'Les tags décrivent la signification d’une zone, par exemple home, work, school, charging ou family. Une coordonnée peut correspondre à un tag via n’importe quelle zone qui porte ce tag.'
    },
    sources: {
      refresh: 'Rafraîchir les sources',
      remove: 'Supprimer la source',
      capabilities: 'Capacités',
      coords: 'Coordonnées',
      updated: 'Mis à jour',
      linked: 'Sujet lié',
      diagnosticsTitle: 'Diagnostic des sources',
      diagnosticsNone: 'Aucune information de diagnostic disponible.',
      diagnosticsOk: 'OK',
      diagnosticsFail: 'Échec'
    },
    messages: {
      sourceRefreshFailed: 'Impossible de rafraîchir les sources potentielles.',
      exportReady: 'Fichier d’export généré.'
    },
    helpSections: [
      {
        title: '1. Ce que fait GeoZones',
        body: [
          'GeoZones stocke des zones géographiques réutilisables et évalue des coordonnées ou des sujets par rapport à ces zones.',
          'Un sujet représente l’état runtime conservé par GeoZones : dernières coordonnées connues, zone courante, tags courants, état de mouvement, délais et date de mise à jour.',
          'Une source est un appareil Homey existant exposant measure_latitude et measure_longitude. Ajouter une source crée ou lie un sujet.'
        ]
      },
      {
        title: '2. Zones, priorité, tags et filtres',
        body: [
          'Utilisez un cercle lorsqu’un centre et un rayon suffisent. Utilisez un polygone lorsque la forme réelle est importante.',
          'Si plusieurs zones correspondent, la priorité la plus élevée gagne. À priorité égale, la surface la plus petite gagne.',
          'Les tags décrivent la signification d’une zone. Les filtres de sujet ciblent des IDs précis. Les filtres de type ciblent des catégories plus larges comme person ou vehicle. Les filtres de sujet sont prioritaires sur les filtres de type.'
        ]
      },
      {
        title: '3. Options avancées des zones',
        body: [
          'Le délai d’entrée signifie que le sujet doit rester assez longtemps dans la zone avant d’être considéré présent. Le délai de sortie fonctionne de la même manière pour le départ.',
          'L’hystérésis s’applique uniquement aux cercles et agrandit le seuil de sortie pour réduire les basculements au bord.',
          'Appliquer aux coordonnées sans sujet contrôle si les cartes qui évaluent une latitude/longitude brute peuvent utiliser cette zone.'
        ]
      },
      {
        title: '4. Cartes Flow simples et cartes multi',
        body: [
          'Les cartes simples utilisent l’autocomplete et servent à sélectionner un sujet dynamique, une zone, un tag ou un type de sujet.',
          'Les cartes multi utilisent un champ texte avec valeurs séparées par des virgules, car Homey Flow ne propose pas de multisélection dynamique pour ces valeurs runtime.',
          'Pour les cartes multi, vous pouvez saisir des IDs, des noms exacts ou des tags séparés par des virgules, par exemple : home, work, charging.'
        ]
      },
      {
        title: '5. Cartes déclencheur',
        body: [
          'subject_entered_zone / subject_left_zone : utilisez ces cartes pour un sujet sélectionné et une zone sélectionnée via autocomplete.',
          'subject_entered_zones / subject_left_zones : même logique, mais pour plusieurs zones dynamiques saisies sous forme d’IDs ou de noms séparés par des virgules. Le déclencheur se produit si au moins une zone listée correspond à l’événement.',
          'subject_position_changed se déclenche lorsque GeoZones enregistre une nouvelle position. subject_recalculated se déclenche lorsque GeoZones recalcule un sujet sans forcément écrire de nouvelles coordonnées.'
        ]
      },
      {
        title: '6. Cartes condition : existence et correspondance',
        body: [
          'subject_exists, zone_exists, tag_exists et subject_type_exists vérifient une seule valeur via autocomplete. Leurs variantes plurielles subjects_exist, zones_exist, tags_exist et subject_types_exist vérifient des listes CSV et renvoient vrai uniquement si toutes les valeurs listées existent.',
          'coordinates_match_zone / coordinates_match_tag vérifient une zone ou un tag dynamique pour des coordonnées brutes. coordinates_match_zones / coordinates_match_tags font la même chose pour des listes CSV et renvoient vrai si au moins une valeur listée correspond.',
          'Toutes les cartes ET sont inversibles et peuvent donc être utilisées en logique positive ou négative.'
        ]
      },
      {
        title: '7. Cartes condition : état des sujets et contenu des zones',
        body: [
          'subject_is_in_zone et subject_is_of_type sont les cartes simples. subject_is_in_zones et subject_is_of_types sont leurs variantes multi CSV et renvoient vrai si au moins une valeur listée correspond.',
          'subject_is_movement_state utilise un vrai multiselect car les valeurs sont statiques : unknown, stable et moving.',
          'zone_contains_subject et zone_contains_subject_type vérifient un sujet ou un type unique. zone_contains_subjects et zone_contains_subject_types vérifient des listes. Laisser subjects vide dans zone_contains_subjects signifie : la zone contient au moins un sujet.',
          'zone_contains_only_subject_type et zone_contains_only_subject_types vérifient que tous les sujets actuellement présents dans la zone appartiennent au type ou à l’ensemble de types autorisé.'
        ]
      },
      {
        title: '8. Cartes action',
        body: [
          'evaluate_coordinates renvoie la zone gagnante pour des coordonnées brutes. update_and_evaluate_subject_position enregistre de nouvelles coordonnées pour un sujet puis évalue le résultat.',
          'evaluate_subject_position réévalue des coordonnées déjà stockées. force_recalculate_subject est utile après modification des zones, des filtres, des délais ou du type de sujet.',
          'Les cartes distance_* renvoient des distances en mètres. Pour les cartes de distance à une zone, 0 signifie que la position est dans la zone.',
          'set_subject_type change le type du sujet, rename_subject change le nom affiché, reset_subject efface l’état runtime, et purge_subjects supprime les anciens sujets inactifs tout en renvoyant remaining_subjects_count.'
        ]
      },
      {
        title: '9. Sujets, seuil de mouvement et diagnostic',
        body: [
          'Le seuil minimal de déplacement est stocké sur chaque sujet. Les petits déplacements sous ce seuil sont ignorés pour réduire le bruit GPS.',
          'Si un résultat semble inattendu, vérifiez : zone active, coordonnées réellement dans la zone, priorité, filtre de sujet, filtre de type de sujet, délais et hystérésis.',
          'Utilisez l’export avant une modification risquée. Utilisez l’historique pour restaurer une configuration précédente. Activez le heavy debug uniquement de manière temporaire pour le diagnostic.'
        ]
      }
    ]
  },
  nl: {
    common: { remove: 'Verwijderen' },
    zones: {
      addTag: 'Tag toevoegen',
      tagPlaceholder: 'Voer een tag in',
      tagsHelp: 'Tags beschrijven de betekenis van een zone, bijvoorbeeld home, work, school, charging of family. Een coördinaat kan via elke zone met die tag aan een tag gekoppeld worden.'
    },
    sources: {
      refresh: 'Bronnen verversen',
      remove: 'Bron verwijderen',
      capabilities: 'Mogelijkheden',
      coords: 'Coördinaten',
      updated: 'Bijgewerkt',
      linked: 'Gekoppeld onderwerp',
      diagnosticsTitle: 'Brondiagnose',
      diagnosticsNone: 'Geen diagnostische informatie beschikbaar.',
      diagnosticsOk: 'OK',
      diagnosticsFail: 'Mislukt'
    },
    messages: {
      sourceRefreshFailed: 'Potentiële bronnen konden niet worden vernieuwd.',
      exportReady: 'Exportbestand gegenereerd.'
    },
    helpSections: [
      {
        title: '1. Wat GeoZones doet',
        body: [
          'GeoZones bewaart herbruikbare geografische zones en evalueert coördinaten of onderwerpen tegen die zones.',
          'Een onderwerp is de runtime-status die GeoZones bewaart: laatst bekende coördinaten, huidige zone, huidige tags, bewegingsstatus, vertragingen en update-tijd.',
          'Een bron is een bestaand Homey-apparaat dat measure_latitude en measure_longitude aanbiedt. Een bron toevoegen maakt of koppelt een onderwerp.'
        ]
      },
      {
        title: '2. Zones, prioriteit, tags en filters',
        body: [
          'Gebruik een cirkel wanneer een middelpunt en straal voldoende zijn. Gebruik een polygoon wanneer de echte vorm belangrijk is.',
          'Als meerdere zones overeenkomen, wint de hoogste prioriteit. Bij gelijke prioriteit wint het kleinste oppervlak.',
          'Tags beschrijven de betekenis van een zone. Onderwerpfilters werken op specifieke onderwerp-ID\'s. Typefilters werken op bredere groepen zoals person of vehicle. Onderwerpfilters hebben voorrang op typefilters.'
        ]
      },
      {
        title: '3. Geavanceerde zone-opties',
        body: [
          'Vertraging bij binnenkomst betekent dat het onderwerp lang genoeg binnen moet blijven voordat het echt als aanwezig telt. Vertraging bij vertrek werkt hetzelfde voor verlaten.',
          'Hysterese geldt alleen voor cirkels en vergroot de uitgangsdrempel om schommelen aan de rand te verminderen.',
          'Toepassen op coördinaten zonder onderwerp bepaalt of kaarten die ruwe breedte- en lengtegraad evalueren deze zone mogen gebruiken.'
        ]
      },
      {
        title: '4. Eenvoudige kaarten versus multi-kaarten',
        body: [
          'Eenvoudige kaarten gebruiken autocomplete en zijn bedoeld voor één dynamisch onderwerp, één zone, één tag of één onderwerpstype.',
          'Multi-kaarten gebruiken een tekstveld met door komma\'s gescheiden waarden, omdat Homey Flow geen dynamische multiselect ondersteunt voor deze runtime-waarden.',
          'Voor multi-kaarten kun je ID\'s, exacte namen of tags invoeren, gescheiden door komma\'s, bijvoorbeeld: home, work, charging.'
        ]
      },
      {
        title: '5. Triggerkaarten',
        body: [
          'subject_entered_zone / subject_left_zone: gebruik deze kaarten wanneer je één geselecteerd onderwerp en één geselecteerde zone via autocomplete wilt.',
          'subject_entered_zones / subject_left_zones: dezelfde logica, maar voor meerdere dynamische zones ingevoerd als door komma\'s gescheiden ID\'s of namen. De trigger vuurt wanneer minstens één vermelde zone overeenkomt met de gebeurtenis.',
          'subject_position_changed vuurt wanneer GeoZones een nieuwe positie opslaat. subject_recalculated vuurt wanneer GeoZones een onderwerp opnieuw berekent zonder noodzakelijk nieuwe coördinaten te schrijven.'
        ]
      },
      {
        title: '6. Voorwaardekaarten: bestaan en matchen',
        body: [
          'subject_exists, zone_exists, tag_exists en subject_type_exists controleren één waarde via autocomplete. Hun meervoudige varianten subjects_exist, zones_exist, tags_exist en subject_types_exist controleren CSV-lijsten en geven alleen waar terug wanneer alle vermelde waarden bestaan.',
          'coordinates_match_zone / coordinates_match_tag controleren één dynamische zone of tag voor ruwe coördinaten. coordinates_match_zones / coordinates_match_tags doen hetzelfde voor CSV-lijsten en geven waar terug wanneer minstens één vermelde waarde overeenkomt.',
          'Alle EN-kaarten zijn omkeerbaar en kunnen dus in positieve of negatieve logica gebruikt worden.'
        ]
      },
      {
        title: '7. Voorwaardekaarten: onderwerpstatus en inhoud van zones',
        body: [
          'subject_is_in_zone en subject_is_of_type zijn de eenvoudige kaarten. subject_is_in_zones en subject_is_of_types zijn de multi CSV-varianten en geven waar terug wanneer minstens één vermelde waarde overeenkomt.',
          'subject_is_movement_state gebruikt een echte multiselect omdat de waarden statisch zijn: unknown, stable en moving.',
          'zone_contains_subject en zone_contains_subject_type controleren één onderwerp of één onderwerpstype. zone_contains_subjects en zone_contains_subject_types controleren lijsten. Subjects leeg laten in zone_contains_subjects betekent: de zone bevat minstens één onderwerp.',
          'zone_contains_only_subject_type en zone_contains_only_subject_types controleren of alle onderwerpen die zich momenteel in de zone bevinden tot het toegestane type of de toegestane typeverzameling behoren.'
        ]
      },
      {
        title: '8. Actiekaarten',
        body: [
          'evaluate_coordinates geeft de winnende zone voor ruwe coördinaten terug. update_and_evaluate_subject_position slaat nieuwe coördinaten voor een onderwerp op en evalueert daarna het resultaat.',
          'evaluate_subject_position evalueert reeds opgeslagen coördinaten opnieuw. force_recalculate_subject is nuttig na wijzigingen aan zones, filters, vertragingen of onderwerpstype.',
          'distance_* kaarten geven afstanden in meters terug. Voor zone-afstandskaarten betekent 0 dat de positie zich in de zone bevindt.',
          'set_subject_type wijzigt het onderwerpstype, rename_subject wijzigt de zichtbare naam, reset_subject wist de runtime-status, en purge_subjects verwijdert oude inactieve onderwerpen en retourneert remaining_subjects_count.'
        ]
      },
      {
        title: '9. Onderwerpen, bewegingsdrempel en diagnose',
        body: [
          'De minimale bewegingsdrempel wordt per onderwerp opgeslagen. Kleine verplaatsingen onder deze drempel worden genegeerd om GPS-ruis te verminderen.',
          'Als een resultaat onverwacht lijkt, controleer dan: zone actief, coördinaten echt binnen de zone, prioriteit, onderwerpfilter, typefilter, vertragingen en hysterese.',
          'Gebruik export vóór een risicovolle wijziging. Gebruik geschiedenis om een eerdere configuratie te herstellen. Schakel heavy debug alleen tijdelijk in voor diagnose.'
        ]
      }
    ]
  },
  de: {
    common: { remove: 'Entfernen' },
    zones: {
      addTag: 'Tag hinzufügen',
      tagPlaceholder: 'Tag eingeben',
      tagsHelp: 'Tags beschreiben die Bedeutung einer Zone, zum Beispiel home, work, school, charging oder family. Eine Koordinate kann über jede Zone mit diesem Tag einem Tag zugeordnet werden.'
    },
    sources: {
      refresh: 'Quellen aktualisieren',
      remove: 'Quelle entfernen',
      capabilities: 'Fähigkeiten',
      coords: 'Koordinaten',
      updated: 'Aktualisiert',
      linked: 'Verknüpftes Subjekt',
      diagnosticsTitle: 'Quellendiagnose',
      diagnosticsNone: 'Keine Diagnosedaten verfügbar.',
      diagnosticsOk: 'OK',
      diagnosticsFail: 'Fehlgeschlagen'
    },
    messages: {
      sourceRefreshFailed: 'Potenzielle Quellen konnten nicht aktualisiert werden.',
      exportReady: 'Exportdatei erzeugt.'
    },
    helpSections: [
      {
        title: '1. Was GeoZones macht',
        body: [
          'GeoZones speichert wiederverwendbare geografische Zonen und wertet Koordinaten oder Subjekte gegen diese Zonen aus.',
          'Ein Subjekt ist der von GeoZones gespeicherte Laufzeitzustand: zuletzt bekannte Koordinaten, aktuelle Zone, aktuelle Tags, Bewegungszustand, Verzögerungen und Aktualisierungszeit.',
          'Eine Quelle ist ein vorhandenes Homey-Gerät mit measure_latitude und measure_longitude. Beim Hinzufügen einer Quelle wird ein Subjekt erstellt oder verknüpft.'
        ]
      },
      {
        title: '2. Zonen, Priorität, Tags und Filter',
        body: [
          'Verwenden Sie Kreise, wenn Mittelpunkt und Radius genügen. Verwenden Sie Polygone, wenn die echte Form wichtig ist.',
          'Wenn mehrere Zonen passen, gewinnt die höchste Priorität. Bei gleicher Priorität gewinnt die kleinste Fläche.',
          'Tags beschreiben die Bedeutung einer Zone. Subjektfilter arbeiten mit konkreten Subjekt-IDs. Typfilter arbeiten mit breiteren Gruppen wie person oder vehicle. Subjektfilter haben Vorrang vor Typfiltern.'
        ]
      },
      {
        title: '3. Erweiterte Zonenoptionen',
        body: [
          'Eintrittsverzögerung bedeutet, dass das Subjekt lange genug in der Zone bleiben muss, bevor es wirklich als anwesend gilt. Austrittsverzögerung funktioniert genauso beim Verlassen.',
          'Hysterese gilt nur für Kreise und vergrößert die Austrittsschwelle, um Grenzschwanken zu reduzieren.',
          'Auf Koordinaten ohne Subjekt anwenden steuert, ob Karten für rohe Breiten- und Längengrade diese Zone verwenden dürfen.'
        ]
      },
      {
        title: '4. Einfache Karten versus Mehrfachkarten',
        body: [
          'Einfache Karten verwenden Autocomplete und sind für ein dynamisches Subjekt, eine Zone, einen Tag oder einen Subjekttyp gedacht.',
          'Mehrfachkarten verwenden ein Textfeld mit durch Kommas getrennten Werten, weil Homey Flow für diese Laufzeitwerte keine dynamische Mehrfachauswahl unterstützt.',
          'Für Mehrfachkarten können Sie IDs, exakte Namen oder Tags durch Kommas getrennt eingeben, zum Beispiel: home, work, charging.'
        ]
      },
      {
        title: '5. Trigger-Karten',
        body: [
          'subject_entered_zone / subject_left_zone: Verwenden Sie diese Karten für ein ausgewähltes Subjekt und eine ausgewählte Zone per Autocomplete.',
          'subject_entered_zones / subject_left_zones: gleiche Logik, aber für mehrere dynamische Zonen als durch Kommas getrennte IDs oder Namen. Der Trigger wird ausgelöst, wenn mindestens eine aufgeführte Zone zum Ereignis passt.',
          'subject_position_changed wird ausgelöst, wenn GeoZones eine neue Position speichert. subject_recalculated wird ausgelöst, wenn GeoZones ein Subjekt neu berechnet, ohne zwingend neue Koordinaten zu schreiben.'
        ]
      },
      {
        title: '6. Bedingungskarten: Existenz und Zuordnung',
        body: [
          'subject_exists, zone_exists, tag_exists und subject_type_exists prüfen einen Wert per Autocomplete. Die Pluralvarianten subjects_exist, zones_exist, tags_exist und subject_types_exist prüfen CSV-Listen und geben nur dann wahr zurück, wenn alle aufgeführten Werte existieren.',
          'coordinates_match_zone / coordinates_match_tag prüfen eine dynamische Zone oder einen Tag für rohe Koordinaten. coordinates_match_zones / coordinates_match_tags machen dasselbe für CSV-Listen und geben wahr zurück, wenn mindestens ein aufgeführter Wert passt.',
          'Alle UND-Karten sind invertierbar und können daher in positiver oder negativer Logik verwendet werden.'
        ]
      },
      {
        title: '7. Bedingungskarten: Subjektstatus und Zoneninhalt',
        body: [
          'subject_is_in_zone und subject_is_of_type sind die einfachen Karten. subject_is_in_zones und subject_is_of_types sind die Mehrfachvarianten per CSV und geben wahr zurück, wenn mindestens ein aufgeführter Wert passt.',
          'subject_is_movement_state verwendet eine echte Mehrfachauswahl, weil die Werte statisch sind: unknown, stable und moving.',
          'zone_contains_subject und zone_contains_subject_type prüfen ein Subjekt oder einen Subjekttyp. zone_contains_subjects und zone_contains_subject_types prüfen Listen. Wenn subjects in zone_contains_subjects leer bleibt, bedeutet das: Die Zone enthält mindestens ein Subjekt.',
          'zone_contains_only_subject_type und zone_contains_only_subject_types prüfen, ob alle aktuell in der Zone befindlichen Subjekte zum erlaubten Typ oder Typ-Set gehören.'
        ]
      },
      {
        title: '8. Aktionskarten',
        body: [
          'evaluate_coordinates gibt die Gewinnerzone für rohe Koordinaten zurück. update_and_evaluate_subject_position speichert neue Koordinaten für ein Subjekt und wertet danach das Ergebnis aus.',
          'evaluate_subject_position wertet bereits gespeicherte Koordinaten erneut aus. force_recalculate_subject ist nach Änderungen an Zonen, Filtern, Verzögerungen oder dem Subjekttyp nützlich.',
          'distance_* Karten geben Entfernungen in Metern zurück. Bei Distanz-zu-Zone-Karten bedeutet 0, dass sich die Position in der Zone befindet.',
          'set_subject_type ändert den Subjekttyp, rename_subject ändert den Anzeigenamen, reset_subject löscht den Laufzeitzustand, und purge_subjects entfernt alte inaktive Subjekte und liefert remaining_subjects_count zurück.'
        ]
      },
      {
        title: '9. Subjekte, Bewegungsgrenze und Diagnose',
        body: [
          'Die minimale Bewegungsgrenze wird pro Subjekt gespeichert. Kleine Bewegungen unterhalb dieser Grenze werden ignoriert, um GPS-Rauschen zu reduzieren.',
          'Wenn ein Ergebnis unerwartet wirkt, prüfen Sie: Zone aktiv, Koordinaten wirklich innerhalb, Priorität, Subjektfilter, Typfilter, Verzögerungen und Hysterese.',
          'Verwenden Sie Export vor riskanten Änderungen. Nutzen Sie den Verlauf, um eine frühere Konfiguration wiederherzustellen. Aktivieren Sie Heavy Debug nur vorübergehend zur Fehlersuche.'
        ]
      }
    ]
  }
};

function lookupPath(source, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), source);
}

function t(path) {
  const uiSource = UI[currentLang] || UI.en;
  const extraSource = EXTRA[currentLang] || EXTRA.en;
  return lookupPath(uiSource, path) ?? lookupPath(extraSource, path) ?? path;
}

function applyTranslations() {
  qsa('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  qsa('[data-i18n-placeholder]').forEach(node => { node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder)); });
  document.documentElement.lang = currentLang;
}

function showHelp(messageKey) {
  HomeyApp.alert(t(messageKey));
}

function setStatus(text) { qs('#status').textContent = text || ''; }
function notify(message, isError = false) { setStatus(isError ? `⚠ ${message}` : message); if (isError) HomeyApp.alert(message); }
function currentZone() { return (config.zones || []).find(z => z.id === selectedZoneId) || null; }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function zoneLabel(zone){ return `${zone.name} · ${zone.type} · ${zone.priority}`; }
function chooseDefaultColor(index){ return PALETTE[index % PALETTE.length]; }

function renderZoneTagsEditor(zone) {
  const container = qs('#zoneTagsList');
  if (!container) return;
  container.innerHTML = '';
  (zone.tags || []).forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `<span>${tag}</span><button type="button" data-remove-zone-tag="${tag}">×</button>`;
    container.appendChild(chip);
  });
}

function addZoneTag() {
  const zone = currentZone();
  if (!zone) return;
  const input = qs('#zoneTagInput');
  const value = cleanText(input.value);
  if (!value) return;
  const existing = new Set((zone.tags || []).map(tag => tag.toLowerCase()));
  if (!existing.has(value.toLowerCase())) zone.tags = [...(zone.tags || []), value];
  input.value = '';
  renderZoneTagsEditor(zone);
  renderZones();
}

function removeZoneTag(tag) {
  const zone = currentZone();
  if (!zone) return;
  zone.tags = (zone.tags || []).filter(item => item.toLowerCase() !== String(tag).toLowerCase());
  renderZoneTagsEditor(zone);
  renderZones();
}

function renderHelpContent() {
  const container = qs('#helpContent');
  if (!container) return;
  container.innerHTML = '';
  const sections = (EXTRA[currentLang] || EXTRA.en).helpSections || [];
  sections.forEach((section, index) => {
    const details = document.createElement('details');
    details.open = index === 0;
    details.innerHTML = `<summary>${section.title}</summary>${(section.body || []).map(item => `<p>${item}</p>`).join('')}`;
    container.appendChild(details);
  });
}

function renderSourceDiagnostics() {
  const node = qs('#sourceDiagnostics');
  if (!node) return;
  if (!sourceAttempts.length) {
    node.textContent = t('sources.diagnosticsNone');
    return;
  }
  const lines = [t('sources.diagnosticsTitle') + ':'];
  sourceAttempts.forEach(item => {
    lines.push(`• ${item.path}: ${item.ok ? t('sources.diagnosticsOk') : t('sources.diagnosticsFail')}${item.count !== undefined ? ` (${item.count})` : ''}${item.error ? ` — ${item.error}` : ''}`);
  });
  node.textContent = lines.join('\n');
}

function switchTab(tab) {
  currentTab = tab;
  qsa('.tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  qsa('.panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
  if (config?.ui) config.ui.activeTab = tab;
}

function ensureMap() {
  if (map) return;
  map = L.map('map').setView([config.ui.mapCenter.lat, config.ui.mapCenter.lng], config.ui.mapZoom || 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  drawHandlers.circle = new L.Draw.Circle(map, { shapeOptions: { color: chooseDefaultColor((config.zones || []).length) } });
  drawHandlers.polygon = new L.Draw.Polygon(map, { allowIntersection: false, showArea: true, shapeOptions: { color: chooseDefaultColor((config.zones || []).length) } });
  map.on(L.Draw.Event.CREATED, event => {
    const isCircle = event.layerType === 'circle';
    const zoneIndex = (config.zones || []).length;
    const name = `${isCircle ? 'Circle' : 'Polygon'} ${zoneIndex + 1}`;
    const zone = {
      id: `${isCircle ? 'circle' : 'polygon'}_${zoneIndex + 1}`,
      name,
      type: isCircle ? 'circle' : 'polygon',
      active: true,
      color: chooseDefaultColor(zoneIndex),
      priority: 0,
      tags: [],
      center: isCircle ? { lat: event.layer.getLatLng().lat, lng: event.layer.getLatLng().lng } : null,
      radius: isCircle ? event.layer.getRadius() : 100,
      hysteresis: 0,
      paths: isCircle ? [] : event.layer.getLatLngs()[0].map(p => ({ lat: p.lat, lng: p.lng })),
      options: { entryDelayS: 0, exitDelayS: 0, appliesWithoutSubject: true, subjectFilter: { mode: 'all', subjects: [] }, subjectTypeFilter: { mode: 'all', subjectTypes: [] } }
    };
    config.zones.push(zone);
    selectedZoneId = zone.id;
    renderAll();
  });
  map.on('moveend', () => {
    const center = map.getCenter();
    config.ui.mapCenter = { lat: center.lat, lng: center.lng };
    config.ui.mapZoom = map.getZoom();
  });
}

function layerForZone(zone) {
  if (zone.type === 'circle') return L.circle([zone.center.lat, zone.center.lng], { radius: zone.radius, color: zone.color });
  return L.polygon((zone.paths || []).map(p => [p.lat, p.lng]), { color: zone.color });
}

function renderZones() {
  ensureMap();
  drawnItems.clearLayers();
  zoneLayers = new Map();
  (config.zones || []).forEach(zone => {
    const layer = layerForZone(zone);
    layer.addTo(drawnItems);
    zoneLayers.set(zone.id, layer);
    layer.on('click', () => { selectedZoneId = zone.id; renderZoneList(); renderZoneEditor(); });
  });
  renderZoneList();
  qs('#exportBox').value = JSON.stringify(config, null, 2);
}

function renderZoneList() {
  const list = qs('#zoneList');
  list.innerHTML = '';
  if (!(config.zones || []).length) {
    list.innerHTML = `<div class="list-item empty-state">${t('zones.selectZone')}</div>`;
    return;
  }
  (config.zones || []).forEach(zone => {
    const item = document.createElement('div');
    item.className = `list-item ${zone.id === selectedZoneId ? 'active' : ''}`;
    item.innerHTML = `<div class="zone-row"><div><h3>${zone.name}</h3><div>${zone.tags.join(', ') || '—'}</div><div class="subject-meta">${zoneLabel(zone)}${zone.active === false ? ' · inactive' : ''}</div></div><span class="pill" style="background:${zone.color}22;color:${zone.color};border:1px solid ${zone.color}55">${zone.type}</span></div>`;
    item.onclick = () => { selectedZoneId = zone.id; renderZoneList(); renderZoneEditor(); };
    list.appendChild(item);
  });
}

function renderZoneEditor() {
  const zone = currentZone();
  qs('#zoneEmpty').classList.toggle('hidden', !!zone);
  qs('#zoneEditor').classList.toggle('hidden', !zone);
  if (!zone) return;
  qs('#zoneName').value = zone.name || '';
  qs('#zoneColor').value = zone.color || chooseDefaultColor(0);
  qs('#zoneActive').checked = zone.active !== false;
  qs('#zonePriority').value = zone.priority || 0;
  renderZoneTagsEditor(zone);
  qs('#zoneEntryDelay').value = zone.options?.entryDelayS || 0;
  qs('#zoneExitDelay').value = zone.options?.exitDelayS || 0;
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
}

function syncZoneFromEditor() {
  const zone = currentZone();
  if (!zone) return;
  zone.name = cleanText(qs('#zoneName').value) || zone.name;
  zone.color = qs('#zoneColor').value || zone.color;
  zone.active = qs('#zoneActive').checked;
  zone.priority = Number(qs('#zonePriority').value || 0);
  zone.options = zone.options || {};
  zone.options.entryDelayS = Math.max(0, Number(qs('#zoneEntryDelay').value || 0));
  zone.options.exitDelayS = Math.max(0, Number(qs('#zoneExitDelay').value || 0));
  zone.options.appliesWithoutSubject = qs('#zoneWithoutSubject').checked;
  zone.options.subjectFilter = { mode: qs('#zoneSubjectFilterMode').value, subjects: parseCsvKeepCase(qs('#zoneSubjectFilterValues').value) };
  zone.options.subjectTypeFilter = { mode: qs('#zoneSubjectTypeMode').value, subjectTypes: parseCsvKeepCase(qs('#zoneSubjectTypeValues').value) };
  if (zone.type === 'circle') {
    zone.center = { lat: Number(qs('#zoneCenterLat').value), lng: Number(qs('#zoneCenterLng').value) };
    zone.radius = Math.max(1, Number(qs('#zoneRadius').value || 100));
    zone.hysteresis = Math.max(0, Number(qs('#zoneHysteresis').value || 0));
  } else {
    zone.hysteresis = 0;
    try { zone.paths = JSON.parse(qs('#zonePaths').value || '[]'); } catch (error) { /* ignore until save */ }
  }
  renderZones();
  renderZoneEditor();
}

function renderSubjects() {
  const container = qs('#subjectList');
  container.innerHTML = '';
  const entries = Object.values(config.subjects || {}).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  if (!entries.length) {
    container.innerHTML = `<div class="list-item empty-state">${t('subjects.none')}</div>`;
    return;
  }
  for (const subject of entries) {
    const details = document.createElement('details');
    details.className = 'list-item';
    details.innerHTML = `
      <summary class="subject-summary">
        <span><strong>${subject.name || subject.id}</strong></span>
        <span class="subject-meta">${subject.subjectType || t('subjects.noneValue')}</span>
        <button data-delete-subject="${subject.id}" class="danger">${t('subjects.delete')}</button>
      </summary>
      <div class="subject-fields">
        <label>${t('common.name')}<input data-subject-name="${subject.id}" type="text" value="${subject.name || ''}"></label>
        <label>${t('subjects.type')}<input data-subject-type="${subject.id}" type="text" value="${subject.subjectType || ''}" list="subjectTypeList"></label>
        <label>${t('subjects.threshold')}<input data-subject-threshold="${subject.id}" type="number" min="0" step="1" value="${subject.minMoveDistanceM || 0}"></label>
        <div>${t('subjects.source')}: ${subject.source ? (subject.source.deviceName || subject.source.deviceId || subject.source.kind) : '—'}</div>
        <div>${t('subjects.currentZone')}: ${subject.currentZoneName || '—'}</div>
        <div>${t('subjects.currentTags')}: ${(subject.currentTags || []).join(', ') || '—'}</div>
        <div>${t('subjects.movement')}: ${subject.movementState || 'unknown'}</div>
        <div>${t('subjects.updated')}: ${subject.updatedAt || subject.lastTimestamp || '—'}</div>
        <div>${t('subjects.coordinates')}: ${subject.lastLat ?? '—'}, ${subject.lastLng ?? '—'}</div>
        <div class="toolbar"><button data-reset-subject="${subject.id}">${t('subjects.reset')}</button></div>
      </div>`;
    container.appendChild(details);
  }
  let dataList = document.querySelector('#subjectTypeList');
  if (!dataList) {
    dataList = document.createElement('datalist');
    dataList.id = 'subjectTypeList';
    document.body.appendChild(dataList);
  }
  dataList.innerHTML = (config.derivedSubjectTypes || []).map(type => `<option value="${type}"></option>`).join('');
}

function renderSources() {
  const container = qs('#sourceList');
  container.innerHTML = '';
  renderSourceDiagnostics();
  if (!devices.length) {
    container.innerHTML = `<div class="list-item empty-state">${t('sources.none')}</div>`;
    return;
  }
  devices.forEach(device => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const coords = Number.isFinite(Number(device.latitude)) && Number.isFinite(Number(device.longitude))
      ? `${Number(device.latitude).toFixed(5)}, ${Number(device.longitude).toFixed(5)}`
      : '—';
    const updated = device.latitudeUpdated || device.longitudeUpdated
      ? new Date(device.latitudeUpdated || device.longitudeUpdated).toLocaleString()
      : '—';
    const sourceLabel = device.subjectId ? `<div class="subject-meta">${t('sources.linked')}: ${device.subjectId}</div>` : '';
    const diagnostics = device.diagnostics?.source ? `<div class="subject-meta source-debug">${device.diagnostics.source}</div>` : '';
    item.innerHTML = `<div class="source-row"><div><h3>${device.name}</h3><div class="subject-meta">${t('sources.capabilities')}: ${(device.capabilities || []).join(', ')}</div><div class="subject-meta">${t('sources.coords')}: ${coords}</div><div class="subject-meta">${t('sources.updated')}: ${updated}</div>${sourceLabel}${diagnostics}</div><div class="source-actions"><button ${device.alreadyAdded ? 'disabled' : ''} data-add-device="${device.id}">${device.alreadyAdded ? t('sources.added') : t('sources.add')}</button>${device.alreadyAdded ? `<button class="danger" data-remove-device="${device.id}">${t('sources.remove')}</button>` : ''}</div></div>`;
    container.appendChild(item);
  });
}

function renderGeneral() {
  qs('#generalAutopurgeEnabled').checked = config.general.autopurgeEnabled !== false;
  qs('#generalAutopurgeDays').value = config.general.autopurgeDays || 0;
  qs('#generalHistoryRetentionDays').value = config.general.historyRetentionDays || 30;
  qs('#generalHeavyDebug').checked = config.general.heavyDebug === true;
}

function renderHistory() {
  const container = qs('#historyList');
  container.innerHTML = '';
  if (!history.length) {
    container.innerHTML = '<div class="list-item empty-state">—</div>';
    return;
  }
  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<div class="history-row"><div><strong>${new Date(entry.createdAt).toLocaleString()}</strong><div class="subject-meta">${entry.id}</div></div><div class="toolbar"><button data-restore-history="${entry.id}">${t('io.restore')}</button><button data-delete-history="${entry.id}" class="danger">${t('io.remove')}</button></div></div>`;
    container.appendChild(item);
  });
}

function renderAll() {
  renderZones();
  renderZoneEditor();
  renderSubjects();
  renderSources();
  renderGeneral();
  renderHistory();
  renderHelpContent();
}

async function loadAll(preferredTab = currentTab) {
  try {
    const payload = await HomeyApp.api('GET', '/config');
    config = payload;
    selectedZoneId = config.ui?.selectedZoneId || config.zones?.[0]?.id || null;

    try {
      devices = await fetchLocationDevices();
    } catch (error) {
      console.error('Unable to load devices', error);
      devices = [];
    }

    try {
      history = await HomeyApp.api('GET', '/history');
    } catch (error) {
      console.error('Unable to load history', error);
      history = [];
    }

    renderAll();
    switchTab(preferredTab || config.ui?.activeTab || 'zones');
    notify(t('messages.loaded'));
  } catch (error) {
    notify(error.message || String(error), true);
  }
}

async function saveConfig() {
  try {
    syncZoneFromEditor();
    config.ui.selectedZoneId = selectedZoneId;
    await HomeyApp.api('PUT', '/config', config);
    await loadAll(currentTab);
    notify(t('messages.saved'));
  } catch (error) {
    notify(error.message || String(error), true);
  }
}

async function downloadTextFile() {
  try {
    syncZoneFromEditor();

    const result = await HomeyApp.api('POST', '/export/file', {});
    if (!result?.url) throw new Error('Missing export URL');

    HomeyApp.openURL(result.url);
    notify(t('messages.exportReady'));
  } catch (error) {
    notify((error && error.message) || t('messages.downloadFailed'), true);
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
    /* fallback below */
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
  try {
    const parsed = JSON.parse(qs('#importBox').value || '{}');
    await HomeyApp.api(mode === 'replace' ? 'PUT' : 'POST', mode === 'replace' ? '/config' : '/config/merge', parsed);
    await loadAll(currentTab);
  } catch (error) {
    notify(error.message || t('messages.invalidJson'), true);
  }
}

function attachEvents() {
  qsa('.tabs button').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  qsa('.info').forEach(button => button.addEventListener('click', () => showHelp(button.dataset.help)));
  qs('#btnSave').onclick = saveConfig;
  qs('#btnReload').onclick = () => loadAll(currentTab);
  qs('#btnAddCircle').onclick = () => drawHandlers.circle.enable();
  qs('#btnAddPolygon').onclick = () => drawHandlers.polygon.enable();
  qs('#btnFitAll').onclick = () => { const layers = [...zoneLayers.values()]; if (layers.length) map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [20, 20] }); };
  ['#zoneName','#zoneColor','#zonePriority','#zoneEntryDelay','#zoneExitDelay','#zoneHysteresis','#zoneSubjectFilterValues','#zoneSubjectTypeValues','#zoneCenterLat','#zoneCenterLng','#zoneRadius','#zonePaths'].forEach(sel => qs(sel).addEventListener('change', syncZoneFromEditor));
  ['#zoneActive','#zoneWithoutSubject','#zoneSubjectFilterMode','#zoneSubjectTypeMode'].forEach(sel => qs(sel).addEventListener('change', syncZoneFromEditor));
  qs('#btnAddZoneTag').onclick = addZoneTag;
  qs('#zoneTagInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addZoneTag(); } });
  qs('#zoneTagsList').addEventListener('click', event => { const tag = event.target.dataset.removeZoneTag; if (tag) removeZoneTag(tag); });
  qs('#btnDeleteZone').onclick = () => {
    if (!selectedZoneId) return;
    config.zones = config.zones.filter(z => z.id !== selectedZoneId);
    selectedZoneId = config.zones[0]?.id || null;
    renderAll();
  };
  qs('#subjectList').addEventListener('click', async event => {
    const deleteId = event.target.dataset.deleteSubject;
    const resetId = event.target.dataset.resetSubject;
    if (deleteId) {
      await HomeyApp.api('DELETE', `/subjects/${encodeURIComponent(deleteId)}`);
      await loadAll(currentTab);
    }
    if (resetId) {
      await HomeyApp.api('POST', `/subjects/${encodeURIComponent(resetId)}/reset`, {});
      await loadAll(currentTab);
    }
  });
  qs('#subjectList').addEventListener('change', event => {
    const { dataset, value } = event.target;
    if (dataset.subjectName && config.subjects[dataset.subjectName]) config.subjects[dataset.subjectName].name = value;
    if (dataset.subjectType && config.subjects[dataset.subjectType]) config.subjects[dataset.subjectType].subjectType = value.trim();
    if (dataset.subjectThreshold && config.subjects[dataset.subjectThreshold]) config.subjects[dataset.subjectThreshold].minMoveDistanceM = Number(value || 0);
    qs('#exportBox').value = JSON.stringify(config, null, 2);
  });
  qs('#btnRefreshSources').onclick = async () => {
    try {
      devices = await fetchLocationDevices();
      renderSources();
    } catch (error) {
      notify(t('messages.sourceRefreshFailed'), true);
    }
  };
  qs('#sourceList').addEventListener('click', async event => {
    const addId = event.target.dataset.addDevice;
    const removeId = event.target.dataset.removeDevice;
    if (addId) {
      await HomeyApp.api('POST', `/sources/devices/${encodeURIComponent(addId)}`, {});
      await loadAll('sources');
      return;
    }
    if (removeId) {
      await HomeyApp.api('DELETE', `/sources/devices/${encodeURIComponent(removeId)}`);
      await loadAll('sources');
    }
  });
  ['#generalAutopurgeEnabled','#generalHeavyDebug'].forEach(sel => qs(sel).addEventListener('change', () => {
    config.general.autopurgeEnabled = qs('#generalAutopurgeEnabled').checked;
    config.general.heavyDebug = qs('#generalHeavyDebug').checked;
    qs('#exportBox').value = JSON.stringify(config, null, 2);
  }));
  ['#generalAutopurgeDays','#generalHistoryRetentionDays'].forEach(sel => qs(sel).addEventListener('change', () => {
    config.general.autopurgeDays = Number(qs('#generalAutopurgeDays').value || 0);
    config.general.historyRetentionDays = Number(qs('#generalHistoryRetentionDays').value || 30);
    qs('#exportBox').value = JSON.stringify(config, null, 2);
  }));
  qs('#btnCopyExport').onclick = async () => {
    try {
      await copyTextToClipboard(qs('#exportBox').value || '');
    } catch (error) {
      notify((error && error.message) || t('messages.downloadFailed'), true);
    }
  };
  qs('#btnDownloadExport').onclick = () => downloadTextFile();
  qs('#btnCopyCurrent').onclick = () => { qs('#importBox').value = qs('#exportBox').value; };
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
    const restoreId = event.target.dataset.restoreHistory;
    const deleteId = event.target.dataset.deleteHistory;
    if (restoreId) await HomeyApp.api('POST', `/history/${encodeURIComponent(restoreId)}/restore`, {});
    if (deleteId) await HomeyApp.api('DELETE', `/history/${encodeURIComponent(deleteId)}`);
    await loadAll('io');
  });
}

async function onHomeyReady(HomeyInstance) {
  HomeyApp = HomeyInstance;
  currentLang = (navigator.language || 'en').slice(0,2).toLowerCase();
  if (!UI[currentLang]) currentLang = 'en';
  applyTranslations();
  attachEvents();
  await loadAll(currentTab);
  Homey.ready();
}

window.onHomeyReady = onHomeyReady;
