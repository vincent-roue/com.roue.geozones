window.SETTINGS_I18N = {
  "en": {
    "app": {
      "title": "GeoZones"
    },
    "settings": {
      "tabs": {
        "zones": "Zones",
        "groups": "Groups",
        "categories": "Categories",
        "test": "Test",
        "import_export": "Import / Export",
        "help": "Help",
        "subjects": "Subjects"
      },
      "status": {
        "loading": "Loading…",
        "ready": "Ready",
        "saved": "Saved",
        "error": "Error",
        "unsaved": "Unsaved changes"
      },
      "actions": {
        "add_circle": "Add circle",
        "add_polygon": "Add polygon",
        "save": "Save",
        "delete": "Delete",
        "duplicate": "Duplicate",
        "fit_all": "Fit all zones",
        "use_map_center": "Use map center",
        "run_test": "Run test",
        "export_json": "Export config",
        "import_replace": "Import and replace",
        "import_merge": "Import and merge",
        "add_field": "Add",
        "apply": "Apply changes",
        "cancel": "Cancel",
        "purge_subjects": "Purge inactive subjects now"
      },
      "labels": {
        "search": "Search zones",
        "map": "Map",
        "properties": "Zone properties",
        "name": "Name",
        "type": "Type",
        "color": "Color",
        "active": "Active",
        "groups": "Groups",
        "categories": "Categories",
        "center_lat": "Center latitude",
        "center_lng": "Center longitude",
        "radius": "Radius (m)",
        "hysteresis": "Hysteresis (m)",
        "polygon_points": "Polygon points",
        "latitude": "Latitude",
        "longitude": "Longitude",
        "subject_id": "Subject ID (optional)",
        "json": "JSON",
        "test_summary": "Result",
        "zone_list": "Zones",
        "group_list": "Groups",
        "category_list": "Categories",
        "standard_zone": "zone",
        "new_group": "New group — press Enter",
        "new_category": "New category — press Enter",
        "inactive": "inactive",
        "zone": "Zone",
        "subjects": "Subjects",
        "diagnostics": "Diagnostics",
        "autopurge_enabled": "Autopurge inactive subjects",
        "autopurge_days": "Autopurge days (0 = disabled)",
        "heavy_debug": "Enable heavy debug logging"
      },
      "placeholders": {
        "search_zone": "Search by zone name",
        "zone_name": "Home",
        "group": "Family",
        "category": "Home",
        "subject_id": "subject_1",
        "new_group": "Type a group and press Enter",
        "new_category": "Type a category and press Enter"
      },
      "help": {
        "title": "How GeoZones works",
        "intro": "GeoZones stores reusable geographic areas in Homey Pro settings. You create zones once in the Settings page, then you reuse those same zones in Flow cards without creating any virtual device.",
        "rules_title": "Rules",
        "tips_title": "Tips",
        "create_title": "Create zones on the map",
        "create_circle_title": "Create a circle",
        "create_polygon_title": "Create a polygon",
        "rules": [
          "Only active zones are evaluated in Flows and in the Test tab.",
          "A point on the border counts as inside the zone.",
          "Zone names must stay unique. The reserved values not_defined, unknown and error cannot be used as zone, group or category names.",
          "Groups and categories can contain several values per zone. Empty values and invisible characters are ignored automatically.",
          "If several zones match at the same time, GeoZones first keeps the highest priority, then the smallest areaM2, then the zone name for a stable tie-break.",
          "A self-intersecting polygon is rejected to avoid ambiguous geometry."
        ],
        "tips": [
          "Use the map first: draw the shape, then refine the properties in the zone panel.",
          "Use groups and categories as reusable labels so one zone can participate in many automations.",
          "Use the Test tab before building a Flow to verify the winning zone, previous values and subject memory transitions.",
          "Use subject IDs only when you want GeoZones to remember state and fire subject triggers.",
          "Save after important edits so the configuration stored on Homey Pro stays in sync with the map."
        ],
        "create_circle_steps": [
          "Open the Zones tab.",
          "Click Add circle.",
          "Click on the map and drag to define the circle radius.",
          "Select the new zone in the list if it is not already selected.",
          "Rename it, choose a color, add groups or categories, and set hysteresis if needed.",
          "Click Save to persist the result in Homey Pro."
        ],
        "create_polygon_steps": [
          "Open the Zones tab.",
          "Click Add polygon.",
          "Click on the map for each point of the shape.",
          "Double-click to finish the polygon.",
          "Select the zone, then edit its name, color, groups and categories.",
          "Use the map edit tools later to move points, then save the configuration."
        ],
        "example_circle_title": "Circle example: Eiffel Tower",
        "example_circle_body": "Teaching example of a circle around the Eiffel Tower. This is ideal for a quick zone around one central point.",
        "example_circle_meta": "Center: 48.85837, 2.294481 · Radius: 250 m · Hysteresis: 35 m",
        "example_polygon_title": "Polygon example: Paris",
        "example_polygon_body": "Teaching example of a simplified polygon around Paris. It shows why a free-form shape can be more relevant than a circle for a city or district.",
        "example_polygon_meta": "Simplified polygon around Paris to illustrate a free-form zone.",
        "load_example_circle": "Add this example to the map",
        "load_example_polygon": "Add this example to the map",
        "store_pitch": "GeoZones fills a real gap on Homey Pro by providing reusable geographic zones, groups and categories without creating devices.",
        "how_it_works_more_a": "In the Zones tab, each zone is a circle or a polygon. A circle is ideal around one known point such as home, work, a parking area or a shop. A polygon is better when the real shape matters, for example a city, campus, industrial site, neighbourhood or irregular property. Each zone also has a color, an active flag, optional groups, optional categories, a priority and a precomputed areaM2 value used for tie-breaks.",
        "how_it_works_more_b": "When GeoZones evaluates coordinates, the app checks only active zones. It tests whether the point is inside each circle or polygon. If several zones match at the same time, GeoZones first keeps the highest priority, then the smallest areaM2 so a precise small zone wins over a larger one. For circles, hysteresis enlarges the exit radius for the last known subject so Homey does not switch too quickly when coordinates move near the border.",
        "create_intro": "The Zones tab is the main workspace. The large map is where you draw and edit geometry. The Zones card below the map helps you search, review and select existing zones. The Zone properties card lets you rename a zone, change its color, enable or disable it, attach groups and categories, and edit circle-specific values such as center, radius and hysteresis.",
        "create_more": "To create a new circle, click Add circle and draw directly on the map. To create a polygon, click Add polygon and place the points one after another. Once the zone exists, click it in the list or directly on the map to edit its details. You can also use the built-in Leaflet edit tools to resize circles, move them, adjust polygon points or delete shapes from the map.",
        "flow_title": "Use GeoZones in Flow cards",
        "flow_intro": "GeoZones is designed for Homey Flows. The settings page defines the reusable data, and the Flow cards consume that data later with live coordinates coming from another app, a phone, a webhook or your own logic.",
        "flow_more": "Typical usage is: another Flow provides latitude and longitude, an AND card checks whether those coordinates match a zone, group or category, and the THEN card determines the winning zone and exposes tags such as zone, groups, categories, type and previous values for the rest of the automation. The AND card can optionally update the stored subject state too.",
        "flow_and_title": "AND cards",
        "flow_then_title": "THEN card",
        "flow_and_cards": [
          "Coordinates are in a zone: true when the point matches the selected zone.",
          "Coordinates are in a group: true when the winning zone belongs to the selected group.",
          "Coordinates are in a category: true when the winning zone belongs to the selected category.",
          "Coordinates are in any zone: useful when you only need to know whether at least one zone matches.",
          "Coordinates are in no zone: useful for “outside of all defined areas” automations."
        ],
        "flow_then_cards": [
          "Evaluate geographic position: resolves the best matching zone using the same rules as the condition cards.",
          "The action returns tags such as zone, groups, categories, previous values, zone type and movement metrics.",
          "Use a Subject ID when you want state memory, hysteresis continuity and subject triggers to stay separate for each person or device."
        ],
        "flow_when_title": "Triggers",
        "flow_when_cards": [
          "Stored subject value changed: triggers when the stored zone, groups or categories change, including transitions from or to unknown, not_defined or error.",
          "Stored subject entered a value: triggers when a subject enters a zone, group or category.",
          "Stored subject left a value: triggers when a subject leaves a zone, group or category."
        ],
        "subjects_title": "Subjects and memory",
        "subjects_body": "GeoZones can keep one stored state per subject. A subject stores its current zone, groups, categories, last coordinates and timestamp.",
        "subjects_rules": [
          "Use a Subject ID in the evaluation action or in the coordinate-matching condition with state update enabled to write the stored state.",
          "unknown means the subject has no stored state yet. not_defined means the subject was evaluated successfully but no zone matched. error means a persistent evaluation failed.",
          "The Subjects tab lists stored subjects and lets you delete them manually.",
          "Automatic purge can remove inactive subjects after a configurable number of days."
        ],
        "debug_title": "Debug logging",
        "debug_body": "Minimal logs are always written. Heavy debug logging adds detailed internal traces and should only be enabled when troubleshooting.",
        "debug_rules": [
          "Heavy debug logging increases CPU and memory usage.",
          "Disable it again after debugging to keep normal overhead low."
        ],
        "debug_warning": "Heavy debug logging increases CPU and memory usage and should only be enabled for debugging.",
        "json_title": "Add a zone from JSON",
        "json_body": "The JSON action accepts one strict zone object for a circle or a polygon. Unknown fields are ignored, but invalid useful fields cause an explicit error.",
        "json_rules": [
          "The name must be unique and cannot be not_defined, unknown or error.",
          "Circle fields: name, type=circle, center.lat, center.lng, radius, optional hysteresis, active, priority, color, groups and categories.",
          "Polygon fields: name, type=polygon, paths, optional active, priority, color, groups and categories.",
          "areaM2 is recalculated by GeoZones and should not be relied on as import input."
        ]
      },
      "messages": {
        "confirm_delete_zone": "Delete this zone?",
        "confirm_delete_item": "Delete this item?",
        "invalid_json": "Invalid JSON",
        "zone_name_required": "Zone name is required",
        "zone_name_duplicate": "Zone names must be unique",
        "polygon_self_intersection": "This polygon intersects itself and cannot be saved",
        "zone_saved": "Zone saved",
        "config_saved": "Configuration saved",
        "group_removed": "Group removed from all zones",
        "category_removed": "Category removed from all zones",
        "import_done": "Import completed",
        "test_empty": "No test run yet",
        "no_zone_selected": "Select a zone on the map or in the list",
        "map_note": "Draw directly on the map, then save your changes.",
        "zone_deleted": "Zone deleted",
        "changes_cancelled": "Unsaved changes cancelled",
        "import_loaded": "JSON applied locally. Click Save to keep the changes.",
        "invalid_root_object": "The JSON root must be an object.",
        "zones_must_be_array": "zones must be an array.",
        "groups_must_be_array": "groups must be an array.",
        "categories_must_be_array": "categories must be an array.",
        "invalid_circle_center": "Invalid circle center",
        "invalid_radius": "Invalid radius",
        "invalid_hysteresis": "Invalid hysteresis",
        "invalid_polygon_points": "A polygon must contain at least 3 points",
        "invalid_polygon_coordinates": "Invalid polygon coordinates",
        "zone_groups_must_be_array": "Zone groups must be an array",
        "zone_categories_must_be_array": "Zone categories must be an array",
        "invalid_color": "Invalid color",
        "test_no_match": "No zone matched",
        "no_subjects": "No subjects stored yet",
        "subjects_purged": "Subjects purged",
        "reserved_name": "This name is reserved",
        "reserved_group_or_category": "Reserved values cannot be used for groups or categories"
      },
      "defaults": {
        "circle_name": "Circle",
        "polygon_name": "Polygon"
      },
      "import": {
        "note_title": "How this tab works",
        "note_body": "The JSON shown here is a live preview of the current draft. Editing it does not update the other tabs until you click Import and replace or Import and merge. Save stores the current draft in Homey. Cancel reloads the last saved configuration."
      }
    }
  },
  "fr": {
    "app": {
      "title": "GeoZones"
    },
    "settings": {
      "tabs": {
        "zones": "Zones",
        "groups": "Groupes",
        "categories": "Catégories",
        "test": "Test",
        "import_export": "Import / Export",
        "help": "Aide",
        "subjects": "Sujets"
      },
      "status": {
        "loading": "Chargement…",
        "ready": "Prêt",
        "saved": "Enregistré",
        "error": "Erreur",
        "unsaved": "Modifications non enregistrées"
      },
      "actions": {
        "add_circle": "Ajouter un cercle",
        "add_polygon": "Ajouter un polygone",
        "save": "Enregistrer",
        "delete": "Supprimer",
        "duplicate": "Dupliquer",
        "fit_all": "Afficher toutes les zones",
        "use_map_center": "Utiliser le centre de la carte",
        "run_test": "Tester",
        "export_json": "Exporter la config",
        "import_replace": "Importer et remplacer",
        "import_merge": "Importer et fusionner",
        "add_field": "Ajouter",
        "apply": "Appliquer les changements",
        "cancel": "Annuler",
        "purge_subjects": "Purger maintenant les sujets inactifs"
      },
      "labels": {
        "search": "Rechercher des zones",
        "map": "Map",
        "properties": "Propriétés de la zone",
        "name": "Nom",
        "type": "Type",
        "color": "Couleur",
        "active": "Active",
        "groups": "Groupes",
        "categories": "Catégories",
        "center_lat": "Latitude du centre",
        "center_lng": "Longitude du centre",
        "radius": "Rayon (m)",
        "hysteresis": "Hystérésis (m)",
        "polygon_points": "Points du polygone",
        "latitude": "Latitude",
        "longitude": "Longitude",
        "subject_id": "Subject ID (optionnel)",
        "json": "JSON",
        "test_summary": "Résultat",
        "zone_list": "Zones",
        "group_list": "Groupes",
        "category_list": "Catégories",
        "standard_zone": "zone",
        "new_group": "Nouveau groupe — Entrée pour ajouter",
        "new_category": "Nouvelle catégorie — Entrée pour ajouter",
        "inactive": "inactive",
        "zone": "Zone",
        "subjects": "Sujets",
        "diagnostics": "Diagnostics",
        "autopurge_enabled": "Purge automatique des sujets inactifs",
        "autopurge_days": "Jours avant purge auto (0 = désactivé)",
        "heavy_debug": "Activer les logs debug lourds"
      },
      "placeholders": {
        "search_zone": "Rechercher par nom de zone",
        "zone_name": "Maison",
        "group": "Famille",
        "category": "Maison",
        "subject_id": "subject_1",
        "new_group": "Saisis un groupe puis Entrée",
        "new_category": "Saisis une catégorie puis Entrée"
      },
      "help": {
        "title": "Fonctionnement de GeoZones",
        "intro": "GeoZones stocke des zones géographiques réutilisables dans les settings de Homey Pro. Vous créez vos zones une seule fois dans la page de configuration, puis vous les réutilisez dans les cartes Flow sans créer de device virtuel.",
        "rules_title": "Règles métier",
        "tips_title": "Bonnes pratiques",
        "create_title": "Créer et modifier des zones sur la carte",
        "create_circle_title": "Créer un cercle",
        "create_polygon_title": "Créer un polygone",
        "rules": [
          "Seules les zones actives sont évaluées dans les Flows et dans l’onglet Test.",
          "Un point situé sur le bord est considéré comme à l’intérieur de la zone.",
          "Les noms de zone doivent rester uniques. Les valeurs réservées not_defined, unknown et error ne peuvent pas être utilisées comme noms de zone, groupe ou catégorie.",
          "Une zone peut avoir plusieurs groupes et plusieurs catégories. Les valeurs vides et les caractères invisibles sont ignorés automatiquement.",
          "Si plusieurs zones correspondent en même temps, GeoZones garde d’abord la priorité la plus élevée, puis la plus petite areaM2, puis le nom de zone pour un arbitrage stable.",
          "Un polygone auto-intersecté est refusé pour éviter une géométrie ambiguë."
        ],
        "tips": [
          "Commencez par la carte : dessinez la forme, puis affinez les propriétés dans le panneau de zone.",
          "Utilisez groupes et catégories comme libellés réutilisables pour qu’une zone participe à plusieurs automatisations.",
          "Utilisez l’onglet Test avant de construire un Flow pour vérifier la zone gagnante, les valeurs précédentes et les transitions d’état sujet.",
          "N’utilisez un ID de sujet que si vous voulez que GeoZones mémorise l’état et déclenche les événements sujet.",
          "Enregistrez après les modifications importantes pour garder la configuration Homey Pro synchronisée avec la carte."
        ],
        "create_circle_steps": [
          "Ouvrez l’onglet Zones puis cliquez sur « Ajouter un cercle ».",
          "Cliquez sur la carte à l’endroit voulu, puis faites glisser pour définir le rayon du cercle.",
          "Sélectionnez ensuite la zone dans la liste sous la carte pour modifier son nom, sa couleur, ses groupes, ses catégories et son hystérésis.",
          "Vous pouvez déplacer ou redimensionner le cercle directement sur la carte avec les outils d’édition Leaflet.",
          "Cliquez sur Enregistrer pour conserver le résultat dans Homey Pro."
        ],
        "create_polygon_steps": [
          "Ouvrez l’onglet Zones puis cliquez sur « Ajouter un polygone ».",
          "Cliquez sur la carte pour poser chaque sommet. Ajoutez autant de points que nécessaire pour suivre la forme voulue.",
          "Double-cliquez pour terminer le tracé.",
          "Sélectionnez ensuite la zone dans la liste pour modifier son nom, sa couleur, ses groupes et ses catégories.",
          "Vous pouvez éditer les sommets plus tard directement sur la carte. Si le polygone s’auto-intersecte, GeoZones le refuse pour éviter des résultats ambigus."
        ],
        "example_circle_title": "Exemple cercle : Tour Eiffel",
        "example_circle_body": "Exemple pédagogique : un cercle centré sur la Tour Eiffel avec un rayon de 250 m. C’est idéal pour comprendre un cas simple où un seul point central suffit.",
        "example_circle_meta": "Centre : 48.85837, 2.294481 · Rayon : 250 m · Hystérésis : 35 m",
        "example_polygon_title": "Exemple polygone : Paris",
        "example_polygon_body": "Exemple pédagogique : un polygone simplifié autour de Paris. Il montre quand un polygone est plus pertinent qu’un cercle, par exemple pour suivre les limites approximatives d’une ville ou d’un quartier.",
        "example_polygon_meta": "Polygone simplifié autour de Paris pour illustrer une zone de forme libre.",
        "load_example_circle": "Ajouter cet exemple sur la carte",
        "load_example_polygon": "Ajouter cet exemple sur la carte",
        "store_pitch": "GeoZones répond à un besoin peu couvert sur Homey Pro : créer de vraies zones géographiques réutilisables dans les Flows, sans device supplémentaire.",
        "how_it_works_more_a": "Dans l’onglet Zones, chaque zone est un cercle ou un polygone. Un cercle est idéal autour d’un point connu comme la maison, le bureau, un parking ou un magasin. Un polygone convient mieux quand la forme réelle compte, par exemple une ville, un campus, un site industriel, un quartier ou une propriété irrégulière. Chaque zone possède aussi une couleur, un état actif, des groupes, des catégories, une priorité et une valeur areaM2 pré-calculée utilisée pour départager les zones.",
        "how_it_works_more_b": "Quand GeoZones évalue des coordonnées, l’app vérifie uniquement les zones actives. Elle teste si le point est à l’intérieur de chaque cercle ou polygone. Si plusieurs zones correspondent en même temps, GeoZones garde d’abord la priorité la plus élevée, puis la plus petite areaM2 afin qu’une petite zone précise gagne face à une zone plus large. Pour les cercles, l’hystérésis augmente le rayon de sortie pour le dernier sujet connu afin d’éviter des bascules trop rapides près du bord.",
        "create_intro": "L’onglet Zones est l’espace de travail principal. La grande carte sert à dessiner et modifier la géométrie. L’encart Zones sous la carte permet de rechercher, parcourir et sélectionner les zones existantes. L’encart Propriétés de la zone permet de renommer une zone, changer sa couleur, l’activer ou la désactiver, lui associer des groupes et des catégories, et modifier les valeurs spécifiques aux cercles comme le centre, le rayon et l’hystérésis.",
        "create_more": "Pour créer un cercle, cliquez sur Ajouter un cercle puis dessinez directement sur la carte. Pour créer un polygone, cliquez sur Ajouter un polygone et placez les points les uns après les autres. Une fois la zone créée, cliquez dessus dans la liste ou directement sur la carte pour éditer ses détails. Vous pouvez aussi utiliser les outils Leaflet intégrés pour redimensionner les cercles, les déplacer, ajuster les sommets des polygones ou supprimer une forme sur la carte.",
        "flow_title": "Utiliser GeoZones dans les cartes Flow",
        "flow_intro": "GeoZones est conçu pour les Flows Homey. La page Settings définit les données réutilisables, puis les cartes Flow consomment ces données avec des coordonnées en direct venant d’une autre app, d’un téléphone, d’un webhook ou de votre propre logique.",
        "flow_more": "Le scénario typique est le suivant : un autre Flow fournit une latitude et une longitude, une carte ET vérifie si ces coordonnées correspondent à une zone, un groupe ou une catégorie, puis la carte ALORS détermine la zone gagnante et expose des tags comme la zone, les groupes, les catégories, le type et les valeurs précédentes pour la suite de l’automatisation. La carte ET peut aussi mettre à jour l’état mémorisé du sujet.",
        "flow_and_title": "Cartes ET",
        "flow_then_title": "Carte ALORS",
        "flow_and_cards": [
          "Coordonnées dans une zone : vrai si le point correspond à la zone sélectionnée.",
          "Coordonnées dans un groupe : vrai si la zone gagnante appartient au groupe sélectionné.",
          "Coordonnées dans une catégorie : vrai si la zone gagnante appartient à la catégorie sélectionnée.",
          "Coordonnées dans n’importe quelle zone : utile pour savoir si au moins une zone correspond.",
          "Coordonnées dans aucune zone : utile pour les automatisations “hors de toutes les zones définies”."
        ],
        "flow_then_cards": [
          "Évaluer la position géographique : résout la meilleure zone avec les mêmes règles que les cartes condition.",
          "L’action renvoie des tags comme la zone, les groupes, les catégories, les valeurs précédentes, le type de zone et les métriques de déplacement.",
          "Utilisez un ID de sujet si vous voulez que la mémoire d’état, la continuité de l’hystérésis et les triggers sujet restent séparés pour chaque personne ou appareil."
        ],
        "flow_when_title": "Déclencheurs",
        "flow_when_cards": [
          "Valeur mémorisée du sujet changée : se déclenche quand la zone, les groupes ou les catégories mémorisés changent, y compris lors des transitions depuis ou vers unknown, not_defined ou error.",
          "Sujet mémorisé entré dans une valeur : se déclenche lorsqu’un sujet entre dans une zone, un groupe ou une catégorie.",
          "Sujet mémorisé a quitté une valeur : se déclenche lorsqu’un sujet quitte une zone, un groupe ou une catégorie."
        ],
        "subjects_title": "Sujets et mémoire",
        "subjects_body": "GeoZones peut conserver un état mémorisé par sujet. Un sujet stocke sa zone actuelle, ses groupes, ses catégories, ses dernières coordonnées et son horodatage.",
        "subjects_rules": [
          "Utilisez un ID de sujet dans l’action d’évaluation ou dans la condition de correspondance des coordonnées avec l’option de mise à jour activée pour écrire l’état mémorisé.",
          "unknown signifie que le sujet n’a pas encore d’état mémorisé. not_defined signifie qu’une évaluation a réussi mais qu’aucune zone ne correspond. error signifie qu’une évaluation persistante a échoué.",
          "L’onglet Sujets liste les sujets mémorisés et permet de les supprimer manuellement.",
          "La purge automatique peut supprimer les sujets inactifs après un nombre de jours configurable."
        ],
        "debug_title": "Journalisation debug",
        "debug_body": "Des logs minimaux sont toujours écrits. Le debug lourd ajoute des traces internes détaillées et ne doit être activé que pour le dépannage.",
        "debug_rules": [
          "Le debug lourd augmente l’utilisation CPU et mémoire.",
          "Désactivez-le après le dépannage pour garder une charge normale faible."
        ],
        "debug_warning": "Le debug lourd augmente la charge CPU et mémoire et doit être activé uniquement pour le débogage.",
        "json_title": "Ajouter une zone depuis JSON",
        "json_body": "L’action JSON accepte un objet de zone strict pour un cercle ou un polygone. Les champs inconnus sont ignorés, mais les champs utiles invalides provoquent une erreur explicite.",
        "json_rules": [
          "Le nom doit être unique et ne peut pas être not_defined, unknown ou error.",
          "Champs cercle : name, type=circle, center.lat, center.lng, radius, hysteresis optionnel, active, priority, color, groups et categories.",
          "Champs polygone : name, type=polygon, paths, active optionnel, priority, color, groups et categories.",
          "areaM2 est recalculée par GeoZones et ne doit pas être utilisée comme donnée d’import de référence."
        ]
      },
      "messages": {
        "confirm_delete_zone": "Supprimer cette zone ?",
        "confirm_delete_item": "Supprimer cet élément ?",
        "invalid_json": "JSON invalide",
        "zone_name_required": "Le nom de zone est obligatoire",
        "zone_name_duplicate": "Les noms de zone doivent être uniques",
        "polygon_self_intersection": "Ce polygone s’auto-intersecte et ne peut pas être enregistré",
        "zone_saved": "Zone enregistrée",
        "config_saved": "Configuration enregistrée",
        "group_removed": "Groupe retiré de toutes les zones",
        "category_removed": "Catégorie retirée de toutes les zones",
        "import_done": "Import terminé",
        "test_empty": "Aucun test pour le moment",
        "no_zone_selected": "Sélectionne une zone sur la carte ou dans la liste",
        "map_note": "Dessine directement sur la carte, puis enregistre tes changements.",
        "zone_deleted": "Zone supprimée",
        "changes_cancelled": "Modifications non enregistrées annulées",
        "import_loaded": "JSON appliqué localement. Cliquez sur Enregistrer pour conserver les changements.",
        "invalid_root_object": "La racine du JSON doit être un objet.",
        "zones_must_be_array": "zones doit être un tableau.",
        "groups_must_be_array": "groups doit être un tableau.",
        "categories_must_be_array": "categories doit être un tableau.",
        "invalid_circle_center": "Centre du cercle invalide",
        "invalid_radius": "Rayon invalide",
        "invalid_hysteresis": "Hystérésis invalide",
        "invalid_polygon_points": "Un polygone doit contenir au moins 3 points",
        "invalid_polygon_coordinates": "Coordonnées de polygone invalides",
        "zone_groups_must_be_array": "Les groupes de zone doivent être un tableau",
        "zone_categories_must_be_array": "Les catégories de zone doivent être un tableau",
        "invalid_color": "Couleur invalide",
        "test_no_match": "Aucune zone correspondante",
        "no_subjects": "Aucun sujet mémorisé pour le moment",
        "subjects_purged": "Sujets purgés",
        "reserved_name": "Ce nom est réservé",
        "reserved_group_or_category": "Les valeurs réservées ne peuvent pas être utilisées pour les groupes ou les catégories"
      },
      "defaults": {
        "circle_name": "Cercle",
        "polygon_name": "Polygone"
      },
      "import": {
        "note_title": "Fonctionnement de cet onglet",
        "note_body": "Le JSON affiché ici est un aperçu en direct du brouillon courant. Le modifier ne met pas à jour les autres onglets tant que vous n’avez pas cliqué sur Importer et remplacer ou Importer et fusionner. Enregistrer stocke le brouillon courant dans Homey. Annuler recharge la dernière configuration enregistrée."
      }
    }
  },
  "nl": {
    "app": {
      "title": "GeoZones"
    },
    "settings": {
      "tabs": {
        "zones": "Zones",
        "groups": "Groepen",
        "categories": "Categorieën",
        "test": "Test",
        "import_export": "Import / Export",
        "help": "Help",
        "subjects": "Subjects"
      },
      "status": {
        "loading": "Laden…",
        "ready": "Klaar",
        "saved": "Opgeslagen",
        "error": "Fout",
        "unsaved": "Niet-opgeslagen wijzigingen"
      },
      "actions": {
        "add_circle": "Cirkel toevoegen",
        "add_polygon": "Polygoon toevoegen",
        "save": "Opslaan",
        "delete": "Verwijderen",
        "duplicate": "Dupliceren",
        "fit_all": "Alle zones tonen",
        "use_map_center": "Kaartmiddelpunt gebruiken",
        "run_test": "Test uitvoeren",
        "export_json": "Config exporteren",
        "import_replace": "Importeren en vervangen",
        "import_merge": "Importeren en samenvoegen",
        "add_field": "Toevoegen",
        "apply": "Wijzigingen toepassen",
        "cancel": "Annuleren",
        "purge_subjects": "Purge inactive subjects now"
      },
      "labels": {
        "search": "Zones zoeken",
        "map": "Map",
        "properties": "Zone-eigenschappen",
        "name": "Naam",
        "type": "Type",
        "color": "Kleur",
        "active": "Actief",
        "groups": "Groepen",
        "categories": "Categorieën",
        "center_lat": "Breedtegraad middelpunt",
        "center_lng": "Lengtegraad middelpunt",
        "radius": "Straal (m)",
        "hysteresis": "Hysterese (m)",
        "polygon_points": "Polygoonpunten",
        "latitude": "Breedtegraad",
        "longitude": "Lengtegraad",
        "subject_id": "Subject ID (optioneel)",
        "json": "JSON",
        "test_summary": "Resultaat",
        "zone_list": "Zones",
        "group_list": "Groepen",
        "category_list": "Categorieën",
        "standard_zone": "zone",
        "new_group": "Nieuwe groep — druk op Enter",
        "new_category": "Nieuwe categorie — druk op Enter",
        "inactive": "inactief",
        "zone": "Zone",
        "subjects": "Subjects",
        "diagnostics": "Diagnostics",
        "autopurge_enabled": "Autopurge inactive subjects",
        "autopurge_days": "Autopurge days (0 = disabled)",
        "heavy_debug": "Enable heavy debug logging"
      },
      "placeholders": {
        "search_zone": "Zoeken op zonenaam",
        "zone_name": "Thuis",
        "group": "Familie",
        "category": "Thuis",
        "subject_id": "subject_1",
        "new_group": "Typ een groep en druk op Enter",
        "new_category": "Typ een categorie en druk op Enter"
      },
      "help": {
        "title": "GeoZones-hulp",
        "intro": "GeoZones laat Homey Pro coördinaten evalueren tegen cirkel- en polygoonzones zonder apparaten aan te maken. Gebruik het tabblad Zones om direct op de kaart te tekenen en gebruik die zones daarna in Flows.",
        "rules_title": "Regels",
        "tips_title": "Aanbevolen gebruik",
        "create_title": "Zones op de kaart maken en bewerken",
        "create_circle_title": "Een cirkel maken",
        "create_polygon_title": "Een polygoon maken",
        "rules": [
          "Alleen actieve zones worden geëvalueerd in Flows en op het tabblad Test.",
          "Een punt op de grens telt als binnen de zone.",
          "Zonenamen moeten uniek blijven. De gereserveerde waarden not_defined, unknown en error mogen niet worden gebruikt als naam voor een zone, groep of categorie.",
          "Een zone kan meerdere groepen en categorieën hebben. Lege waarden en onzichtbare tekens worden automatisch genegeerd.",
          "Als meerdere zones tegelijk overeenkomen, kiest GeoZones eerst de hoogste prioriteit, daarna de kleinste areaM2 en daarna de zonenaam voor een stabiele tie-break.",
          "Een zichzelf kruisende polygoon wordt geweigerd om dubbelzinnige geometrie te voorkomen."
        ],
        "tips": [
          "Begin met de kaart: teken de vorm en verfijn daarna de eigenschappen in het zonepaneel.",
          "Gebruik groepen en categorieën als herbruikbare labels zodat één zone in meerdere automatiseringen kan worden gebruikt.",
          "Gebruik het tabblad Test voordat je een Flow bouwt om de winnende zone, vorige waarden en overgang van onderwerpstatus te controleren.",
          "Gebruik alleen een onderwerp-ID als GeoZones de status moet onthouden en onderwerptriggers moet activeren.",
          "Sla belangrijke wijzigingen op zodat de configuratie op Homey Pro synchroon blijft met de kaart."
        ],
        "create_circle_steps": [
          "Open het tabblad Zones en klik op “Cirkel toevoegen”.",
          "Klik op de kaart om het middelpunt te plaatsen en sleep daarna om de straal te bepalen.",
          "Selecteer daarna de zone in de lijst om naam, kleur, groepen, categorieën en hysterese aan te passen.",
          "Sla de configuratie op wanneer alles goed staat."
        ],
        "create_polygon_steps": [
          "Open het tabblad Zones en klik op “Polygoon toevoegen”.",
          "Klik op de kaart om elk hoekpunt te plaatsen.",
          "Dubbelklik om de vorm te voltooien.",
          "Als de polygoon zichzelf kruist, weigert GeoZones die vorm om dubbelzinnige resultaten te voorkomen."
        ],
        "example_circle_title": "Cirkelvoorbeeld: Eiffeltoren",
        "example_circle_body": "Een eenvoudig voorbeeld van een cirkel rond de Eiffeltoren. Dit is de juiste keuze voor een snelle zone rond één centraal punt.",
        "example_circle_meta": "Middelpunt: 48.85837, 2.294481 · Straal: 250 m · Hysterese: 35 m",
        "example_polygon_title": "Polygoonvoorbeeld: Parijs",
        "example_polygon_body": "Een eenvoudig voorbeeld van een polygoon rond Parijs. Het laat het verschil zien tussen een cirkel en een vrije vorm wanneer de echte vorm telt.",
        "example_polygon_meta": "Vereenvoudigde polygoon rond Parijs om een vrije vorm te tonen.",
        "load_example_circle": "Voeg dit voorbeeld toe op de kaart",
        "load_example_polygon": "Voeg dit voorbeeld toe op de kaart",
        "store_pitch": "GeoZones vult een gat op Homey Pro met herbruikbare geografische zones, groepen en categorieën, zonder apparaten te maken.",
        "how_it_works_more_a": "Op het tabblad Zones is elke zone een cirkel of een polygoon. Een cirkel is ideaal rond één bekend punt zoals thuis, werk, een parkeerplaats of een winkel. Een polygoon is beter wanneer de echte vorm belangrijk is, bijvoorbeeld een stad, campus, industrieterrein, wijk of onregelmatig perceel. Elke zone heeft ook een kleur, een actieve status, optionele groepen, optionele categorieën, een prioriteit en een vooraf berekende areaM2-waarde die wordt gebruikt voor tie-breaks.",
        "how_it_works_more_b": "Wanneer GeoZones coördinaten evalueert, controleert de app alleen actieve zones. Ze test of het punt binnen elke cirkel of polygoon ligt. Als meerdere zones tegelijk overeenkomen, kiest GeoZones eerst de hoogste prioriteit en daarna de kleinste areaM2, zodat een kleine nauwkeurige zone wint van een grotere zone. Voor cirkels vergroot hysterese de uittrekradius voor het laatst bekende onderwerp, zodat Homey niet te snel wisselt wanneer coördinaten dicht bij de grens bewegen.",
        "create_intro": "Het tabblad Zones is de hoofdwerkplek. De grote kaart is waar je geometrie tekent en bewerkt. In de kaart Zones onder de kaart kun je bestaande zones zoeken, bekijken en selecteren. In Zone-eigenschappen kun je de naam wijzigen, de kleur aanpassen, de zone activeren of deactiveren, groepen en categorieën koppelen en voor cirkels het middelpunt, de straal en hysterese bewerken.",
        "create_more": "Klik op Cirkel toevoegen om een nieuwe cirkel direct op de kaart te tekenen. Klik op Polygoon toevoegen om punt voor punt een vrije vorm te maken. Zodra de zone bestaat kun je haar in de lijst of op de kaart selecteren om de details te bewerken. Met de ingebouwde Leaflet-bewerking kun je cirkels verplaatsen of vergroten, polygonen aanpassen en vormen verwijderen.",
        "flow_title": "GeoZones in Flow-kaarten gebruiken",
        "flow_intro": "GeoZones is bedoeld voor Homey Flows. De instellingenpagina definieert herbruikbare gegevens en de Flow-kaarten gebruiken die later met live coördinaten van een andere app, een telefoon, een webhook of je eigen logica.",
        "flow_more": "Typisch gebruik: een andere Flow levert breedtegraad en lengtegraad, een EN-kaart controleert of die coördinaten overeenkomen met een zone, groep of categorie, en de DAN-kaart bepaalt daarna de winnende zone en geeft tags terug zoals zone, groepen, categorieën, type en vorige waarden voor de rest van de automatisering. De EN-kaart kan ook de opgeslagen onderwerpstatus bijwerken.",
        "flow_and_title": "EN-kaarten",
        "flow_then_title": "DAN-kaart",
        "flow_and_cards": [
          "Coördinaten zijn in een zone: waar als het punt overeenkomt met de gekozen zone.",
          "Coördinaten zijn in een groep: waar als de winnende zone tot de gekozen groep behoort.",
          "Coördinaten zijn in een categorie: waar als de winnende zone tot de gekozen categorie behoort.",
          "Coördinaten zijn in een willekeurige zone: handig wanneer minstens één match voldoende is.",
          "Coördinaten zijn in geen enkele zone: handig voor automatiseringen buiten alle gedefinieerde gebieden."
        ],
        "flow_then_cards": [
          "Evalueer geografische positie: bepaalt de beste overeenkomende zone met dezelfde regels als de voorwaardekaarten.",
          "De actie geeft tags terug zoals zone, groepen, categorieën, vorige waarden, zonetype en bewegingsstatistieken.",
          "Gebruik een onderwerp-ID als statusgeheugen, hysterese-continuïteit en onderwerptriggers per persoon of apparaat gescheiden moeten blijven."
        ],
        "flow_when_title": "Triggers",
        "flow_when_cards": [
          "Opgeslagen onderwerpwaarde gewijzigd: wordt geactiveerd wanneer de opgeslagen zone, groepen of categorieën veranderen, inclusief overgangen van of naar unknown, not_defined of error.",
          "Opgeslagen onderwerp is een waarde binnengekomen: wordt geactiveerd wanneer een onderwerp een zone, groep of categorie binnenkomt.",
          "Opgeslagen onderwerp heeft een waarde verlaten: wordt geactiveerd wanneer een onderwerp een zone, groep of categorie verlaat."
        ],
        "subjects_title": "Subjects and memory",
        "subjects_body": "GeoZones kan één opgeslagen status per onderwerp bewaren. Een onderwerp bevat de huidige zone, groepen, categorieën, laatste coördinaten en tijdstempel.",
        "subjects_rules": [
          "Gebruik een onderwerp-ID in de evaluatie-actie of in de coördinatenvoorwaarde met statusupdate ingeschakeld om de opgeslagen status te schrijven.",
          "unknown betekent dat het onderwerp nog geen opgeslagen status heeft. not_defined betekent dat een evaluatie gelukt is maar geen zone overeenkwam. error betekent dat een persistente evaluatie is mislukt.",
          "Het tabblad Onderwerpen toont opgeslagen onderwerpen en laat je ze handmatig verwijderen.",
          "Automatische opschoning kan inactieve onderwerpen verwijderen na een instelbaar aantal dagen."
        ],
        "debug_title": "Debug logging",
        "debug_body": "Minimal logs are always written. Heavy debug logging adds detailed internal traces and should only be enabled when troubleshooting.",
        "debug_rules": [
          "Heavy debug logging increases CPU and memory usage.",
          "Disable it again after debugging to keep normal overhead low."
        ],
        "debug_warning": "Heavy debug logging increases CPU and memory usage and should only be enabled for debugging.",
        "json_title": "Add a zone from JSON",
        "json_body": "De JSON-actie accepteert één strikt zone-object voor een cirkel of een polygoon. Onbekende velden worden genegeerd, maar ongeldige bruikbare velden veroorzaken een expliciete fout.",
        "json_rules": [
          "De naam moet uniek zijn en mag niet not_defined, unknown of error zijn.",
          "Cirkelvelden: name, type=circle, center.lat, center.lng, radius, optionele hysteresis, active, priority, color, groups en categories.",
          "Polygoonvelden: name, type=polygon, paths, optionele active, priority, color, groups en categories.",
          "areaM2 wordt door GeoZones opnieuw berekend en mag niet als betrouwbare importinvoer worden gebruikt."
        ]
      },
      "messages": {
        "confirm_delete_zone": "Deze zone verwijderen?",
        "confirm_delete_item": "Dit item verwijderen?",
        "invalid_json": "Ongeldige JSON",
        "zone_name_required": "Zonenaam is verplicht",
        "zone_name_duplicate": "Zonenamen moeten uniek zijn",
        "polygon_self_intersection": "Deze polygoon kruist zichzelf en kan niet worden opgeslagen",
        "zone_saved": "Zone opgeslagen",
        "config_saved": "Configuratie opgeslagen",
        "group_removed": "Groep uit alle zones verwijderd",
        "category_removed": "Categorie uit alle zones verwijderd",
        "import_done": "Import voltooid",
        "test_empty": "Nog geen test uitgevoerd",
        "no_zone_selected": "Selecteer een zone op de kaart of in de lijst",
        "map_note": "Teken direct op de kaart en sla daarna je wijzigingen op.",
        "zone_deleted": "Zone verwijderd",
        "changes_cancelled": "Niet-opgeslagen wijzigingen geannuleerd",
        "import_loaded": "JSON lokaal toegepast. Klik op Opslaan om de wijzigingen te bewaren.",
        "invalid_root_object": "De JSON-root moet een object zijn.",
        "zones_must_be_array": "zones moet een array zijn.",
        "groups_must_be_array": "groups moet een array zijn.",
        "categories_must_be_array": "categories moet een array zijn.",
        "invalid_circle_center": "Ongeldig middelpunt voor cirkel",
        "invalid_radius": "Ongeldige straal",
        "invalid_hysteresis": "Ongeldige hysterese",
        "invalid_polygon_points": "Een polygoon moet minstens 3 punten hebben",
        "invalid_polygon_coordinates": "Ongeldige polygooncoördinaten",
        "zone_groups_must_be_array": "Zonegroepen moeten een array zijn",
        "zone_categories_must_be_array": "Zonecategorieën moeten een array zijn",
        "invalid_color": "Ongeldige kleur",
        "test_no_match": "Geen overeenkomende zone",
        "no_subjects": "No subjects stored yet",
        "subjects_purged": "Subjects purged",
        "reserved_name": "Deze naam is gereserveerd",
        "reserved_group_or_category": "Gereserveerde waarden mogen niet worden gebruikt voor groepen of categorieën"
      },
      "defaults": {
        "circle_name": "Cirkel",
        "polygon_name": "Polygoon"
      },
      "import": {
        "note_title": "Hoe dit tabblad werkt",
        "note_body": "De JSON die hier wordt getoond is een live voorbeeld van het huidige concept. Het bewerken ervan werkt de andere tabbladen niet bij totdat je op Importeren en vervangen of Importeren en samenvoegen klikt. Opslaan bewaart het huidige concept in Homey. Annuleren laadt de laatst opgeslagen configuratie opnieuw."
      }
    }
  },
  "de": {
    "app": {
      "title": "GeoZones"
    },
    "settings": {
      "tabs": {
        "zones": "Zonen",
        "groups": "Gruppen",
        "categories": "Kategorien",
        "test": "Test",
        "import_export": "Import / Export",
        "help": "Hilfe",
        "subjects": "Subjects"
      },
      "status": {
        "loading": "Wird geladen…",
        "ready": "Bereit",
        "saved": "Gespeichert",
        "error": "Fehler",
        "unsaved": "Nicht gespeicherte Änderungen"
      },
      "actions": {
        "add_circle": "Kreis hinzufügen",
        "add_polygon": "Polygon hinzufügen",
        "save": "Speichern",
        "delete": "Löschen",
        "duplicate": "Duplizieren",
        "fit_all": "Alle Zonen anzeigen",
        "use_map_center": "Kartenzentrum verwenden",
        "run_test": "Test ausführen",
        "export_json": "Konfiguration exportieren",
        "import_replace": "Importieren und ersetzen",
        "import_merge": "Importieren und zusammenführen",
        "add_field": "Hinzufügen",
        "apply": "Änderungen anwenden",
        "cancel": "Abbrechen",
        "purge_subjects": "Purge inactive subjects now"
      },
      "labels": {
        "search": "Zonen suchen",
        "map": "Map",
        "properties": "Zoneneigenschaften",
        "name": "Name",
        "type": "Type",
        "color": "Farbe",
        "active": "Aktiv",
        "groups": "Gruppen",
        "categories": "Kategorien",
        "center_lat": "Breitengrad Mittelpunkt",
        "center_lng": "Längengrad Mittelpunkt",
        "radius": "Radius (m)",
        "hysteresis": "Hysterese (m)",
        "polygon_points": "Polygonpunkte",
        "latitude": "Breitengrad",
        "longitude": "Längengrad",
        "subject_id": "Subject-ID (optional)",
        "json": "JSON",
        "test_summary": "Ergebnis",
        "zone_list": "Zonen",
        "group_list": "Gruppen",
        "category_list": "Kategorien",
        "standard_zone": "Zone",
        "new_group": "Neue Gruppe — Enter zum Hinzufügen",
        "new_category": "Neue Kategorie — Enter zum Hinzufügen",
        "inactive": "inaktiv",
        "zone": "Zone",
        "subjects": "Subjects",
        "diagnostics": "Diagnostics",
        "autopurge_enabled": "Autopurge inactive subjects",
        "autopurge_days": "Autopurge days (0 = disabled)",
        "heavy_debug": "Enable heavy debug logging"
      },
      "placeholders": {
        "search_zone": "Nach Zonenname suchen",
        "zone_name": "Zuhause",
        "group": "Familie",
        "category": "Zuhause",
        "subject_id": "subject_1",
        "new_group": "Gruppe eingeben und Enter drücken",
        "new_category": "Kategorie eingeben und Enter drücken"
      },
      "help": {
        "title": "GeoZones-Hilfe",
        "intro": "GeoZones lässt Homey Pro Koordinaten gegen Kreis- und Polygonzonen prüfen, ohne Geräte anzulegen. Nutze den Reiter Zonen, um direkt auf der Karte zu zeichnen, und verwende diese Zonen danach in Flows.",
        "rules_title": "Regeln",
        "tips_title": "Empfehlungen",
        "create_title": "Zonen auf der Karte erstellen und bearbeiten",
        "create_circle_title": "Einen Kreis erstellen",
        "create_polygon_title": "Ein Polygon erstellen",
        "rules": [
          "Nur aktive Zonen werden in Flows und im Test-Tab ausgewertet.",
          "Ein Punkt auf dem Rand zählt als innerhalb der Zone.",
          "Zonennamen müssen eindeutig bleiben. Die reservierten Werte not_defined, unknown und error dürfen nicht als Name für Zone, Gruppe oder Kategorie verwendet werden.",
          "Eine Zone kann mehrere Gruppen und Kategorien haben. Leere Werte und unsichtbare Zeichen werden automatisch ignoriert.",
          "Wenn mehrere Zonen gleichzeitig passen, wählt GeoZones zuerst die höchste Priorität, dann die kleinste areaM2 und danach den Zonennamen für einen stabilen Tie-Break.",
          "Ein sich selbst schneidendes Polygon wird abgelehnt, um mehrdeutige Geometrie zu vermeiden."
        ],
        "tips": [
          "Beginne mit der Karte: Zeichne die Form und verfeinere dann die Eigenschaften im Zonenbereich.",
          "Verwende Gruppen und Kategorien als wiederverwendbare Labels, damit eine Zone in mehreren Automationen genutzt werden kann.",
          "Nutze den Test-Tab vor dem Erstellen eines Flows, um die Gewinnerzone, vorherige Werte und Zustandsübergänge des Subjekts zu prüfen.",
          "Verwende eine Subjekt-ID nur dann, wenn GeoZones den Zustand speichern und Subjekt-Trigger auslösen soll.",
          "Speichere wichtige Änderungen, damit die Konfiguration auf Homey Pro mit der Karte synchron bleibt."
        ],
        "create_circle_steps": [
          "Öffne den Reiter Zonen und klicke auf „Kreis hinzufügen“.",
          "Klicke auf die Karte, um den Mittelpunkt zu setzen, und ziehe dann, um den Radius festzulegen.",
          "Wähle die Zone in der Liste aus, um Name, Farbe, Gruppen, Kategorien und Hysterese anzupassen.",
          "Speichere die Konfiguration, wenn alles passt."
        ],
        "create_polygon_steps": [
          "Öffne den Reiter Zonen und klicke auf „Polygon hinzufügen“.",
          "Klicke auf die Karte, um jeden Punkt des Polygons zu setzen.",
          "Beende die Form mit einem Doppelklick.",
          "Wenn sich das Polygon selbst schneidet, lehnt GeoZones es ab, um uneindeutige Ergebnisse zu vermeiden."
        ],
        "example_circle_title": "Kreisbeispiel: Eiffelturm",
        "example_circle_body": "Ein einfaches Beispiel für einen Kreis um den Eiffelturm. Das ist die richtige Wahl für eine schnelle Zone um einen zentralen Punkt.",
        "example_circle_meta": "Mittelpunkt: 48.85837, 2.294481 · Radius: 250 m · Hysterese: 35 m",
        "example_polygon_title": "Polygonbeispiel: Paris",
        "example_polygon_body": "Ein einfaches Beispiel für ein Polygon um Paris. Es zeigt den Unterschied zwischen einem Kreis und einer freien Form, wenn die echte Form zählt.",
        "example_polygon_meta": "Vereinfachtes Polygon um Paris zur Darstellung einer freien Form.",
        "load_example_circle": "Dieses Beispiel auf der Karte hinzufügen",
        "load_example_polygon": "Dieses Beispiel auf der Karte hinzufügen",
        "store_pitch": "GeoZones schließt auf Homey Pro eine Lücke mit wiederverwendbaren geografischen Zonen, Gruppen und Kategorien, ohne Geräte anzulegen.",
        "how_it_works_more_a": "Im Tab Zonen ist jede Zone entweder ein Kreis oder ein Polygon. Ein Kreis eignet sich ideal um einen bekannten Punkt wie Zuhause, Arbeit, einen Parkplatz oder ein Geschäft. Ein Polygon ist besser, wenn die echte Form wichtig ist, zum Beispiel für eine Stadt, einen Campus, ein Industriegelände, ein Viertel oder ein unregelmäßiges Grundstück. Jede Zone hat außerdem eine Farbe, einen Aktiv-Status, optionale Gruppen, optionale Kategorien, eine Priorität und einen vorab berechneten areaM2-Wert für Tie-Breaks.",
        "how_it_works_more_b": "Wenn GeoZones Koordinaten auswertet, prüft die App nur aktive Zonen. Sie testet, ob der Punkt innerhalb jedes Kreises oder Polygons liegt. Wenn mehrere Zonen gleichzeitig passen, behält GeoZones zuerst die höchste Priorität und danach die kleinste areaM2, damit eine kleine präzise Zone gegenüber einer größeren gewinnt. Bei Kreisen vergrößert die Hysterese den Austrittsradius für das zuletzt bekannte Subjekt, damit Homey an der Grenze nicht zu schnell umschaltet.",
        "create_intro": "Der Tab Zonen ist der zentrale Arbeitsbereich. Auf der großen Karte zeichnest und bearbeitest du die Geometrie. Die Zonenkarte unter der Karte hilft dir beim Suchen, Prüfen und Auswählen vorhandener Zonen. Im Bereich Zoneneigenschaften kannst du eine Zone umbenennen, die Farbe ändern, sie aktivieren oder deaktivieren, Gruppen und Kategorien zuweisen und bei Kreisen Mittelpunkt, Radius und Hysterese bearbeiten.",
        "create_more": "Klicke auf Kreis hinzufügen, um einen neuen Kreis direkt auf der Karte zu zeichnen. Klicke auf Polygon hinzufügen, um eine freie Form Punkt für Punkt zu erstellen. Sobald die Zone existiert, kannst du sie in der Liste oder direkt auf der Karte auswählen und ihre Details bearbeiten. Mit den integrierten Leaflet-Bearbeitungswerkzeugen kannst du Kreise verschieben oder vergrößern, Polygonpunkte anpassen und Formen löschen.",
        "flow_title": "GeoZones in Flow-Karten verwenden",
        "flow_intro": "GeoZones ist für Homey Flows gedacht. Die Einstellungsseite definiert wiederverwendbare Daten, und die Flow-Karten nutzen diese später mit Live-Koordinaten aus einer anderen App, einem Telefon, einem Webhook oder deiner eigenen Logik.",
        "flow_more": "Ein typischer Ablauf ist: Ein anderer Flow liefert Breiten- und Längengrad, eine UND-Karte prüft, ob diese Koordinaten zu einer Zone, Gruppe oder Kategorie passen, und die DANN-Karte bestimmt anschließend die Gewinnerzone und stellt Tags wie Zone, Gruppen, Kategorien, Typ und vorherige Werte für die restliche Automation bereit. Die UND-Karte kann außerdem den gespeicherten Subjektzustand aktualisieren.",
        "flow_and_title": "UND-Karten",
        "flow_then_title": "DANN-Karte",
        "flow_and_cards": [
          "Koordinaten sind in einer Zone: wahr, wenn der Punkt zur gewählten Zone passt.",
          "Koordinaten sind in einer Gruppe: wahr, wenn die beste Zone zur gewählten Gruppe gehört.",
          "Koordinaten sind in einer Kategorie: wahr, wenn die beste Zone zur gewählten Kategorie gehört.",
          "Koordinaten sind in irgendeiner Zone: nützlich, wenn mindestens eine Übereinstimmung reicht.",
          "Koordinaten sind in keiner Zone: nützlich für Automationen außerhalb aller definierten Bereiche."
        ],
        "flow_then_cards": [
          "Geografische Position auswerten: ermittelt die beste passende Zone mit denselben Regeln wie die Bedingungskarten.",
          "Die Aktion liefert Tags wie Zone, Gruppen, Kategorien, vorherige Werte, Zonentyp und Bewegungskennzahlen zurück.",
          "Verwende eine Subjekt-ID, wenn Zustandsspeicher, Hysterese-Kontinuität und Subjekt-Trigger pro Person oder Gerät getrennt bleiben sollen."
        ],
        "flow_when_title": "Triggers",
        "flow_when_cards": [
          "Gespeicherter Subjektwert geändert: wird ausgelöst, wenn sich die gespeicherte Zone, Gruppen oder Kategorien ändern, einschließlich Übergängen von oder zu unknown, not_defined oder error.",
          "Gespeichertes Subjekt ist in einen Wert eingetreten: wird ausgelöst, wenn ein Subjekt eine Zone, Gruppe oder Kategorie betritt.",
          "Gespeichertes Subjekt hat einen Wert verlassen: wird ausgelöst, wenn ein Subjekt eine Zone, Gruppe oder Kategorie verlässt."
        ],
        "subjects_title": "Subjects and memory",
        "subjects_body": "GeoZones kann einen gespeicherten Zustand pro Subjekt behalten. Ein Subjekt speichert seine aktuelle Zone, Gruppen, Kategorien, die letzten Koordinaten und den Zeitstempel.",
        "subjects_rules": [
          "Verwende eine Subjekt-ID in der Auswertungsaktion oder in der Koordinatenbedingung mit aktivierter Zustandsaktualisierung, um den gespeicherten Zustand zu schreiben.",
          "unknown bedeutet, dass für das Subjekt noch kein gespeicherter Zustand existiert. not_defined bedeutet, dass die Auswertung erfolgreich war, aber keine Zone gepasst hat. error bedeutet, dass eine persistente Auswertung fehlgeschlagen ist.",
          "Der Tab Subjekte listet gespeicherte Subjekte auf und ermöglicht das manuelle Löschen.",
          "Die automatische Bereinigung kann inaktive Subjekte nach einer konfigurierbaren Anzahl von Tagen entfernen."
        ],
        "debug_title": "Debug logging",
        "debug_body": "Minimal logs are always written. Heavy debug logging adds detailed internal traces and should only be enabled when troubleshooting.",
        "debug_rules": [
          "Heavy debug logging increases CPU and memory usage.",
          "Disable it again after debugging to keep normal overhead low."
        ],
        "debug_warning": "Heavy debug logging increases CPU and memory usage and should only be enabled for debugging.",
        "json_title": "Add a zone from JSON",
        "json_body": "Die JSON-Aktion akzeptiert genau ein striktes Zonenobjekt für einen Kreis oder ein Polygon. Unbekannte Felder werden ignoriert, aber ungültige relevante Felder verursachen einen expliziten Fehler.",
        "json_rules": [
          "Der Name muss eindeutig sein und darf nicht not_defined, unknown oder error sein.",
          "Kreisfelder: name, type=circle, center.lat, center.lng, radius, optionale hysteresis, active, priority, color, groups und categories.",
          "Polygonfelder: name, type=polygon, paths, optionale active, priority, color, groups und categories.",
          "areaM2 wird von GeoZones neu berechnet und sollte nicht als vertrauenswürdiger Importwert verwendet werden."
        ]
      },
      "messages": {
        "confirm_delete_zone": "Diese Zone löschen?",
        "confirm_delete_item": "Diesen Eintrag löschen?",
        "invalid_json": "Ungültiges JSON",
        "zone_name_required": "Zonenname ist erforderlich",
        "zone_name_duplicate": "Zonennamen müssen eindeutig sein",
        "polygon_self_intersection": "Dieses Polygon schneidet sich selbst und kann nicht gespeichert werden",
        "zone_saved": "Zone gespeichert",
        "config_saved": "Konfiguration gespeichert",
        "group_removed": "Gruppe aus allen Zonen entfernt",
        "category_removed": "Kategorie aus allen Zonen entfernt",
        "import_done": "Import abgeschlossen",
        "test_empty": "Noch kein Test ausgeführt",
        "no_zone_selected": "Wähle eine Zone auf der Karte oder in der Liste aus",
        "map_note": "Direkt auf der Karte zeichnen und danach die Änderungen speichern.",
        "zone_deleted": "Zone gelöscht",
        "changes_cancelled": "Nicht gespeicherte Änderungen verworfen",
        "import_loaded": "JSON lokal übernommen. Klicke auf Speichern, um die Änderungen zu behalten.",
        "invalid_root_object": "Die JSON-Wurzel muss ein Objekt sein.",
        "zones_must_be_array": "zones muss ein Array sein.",
        "groups_must_be_array": "groups muss ein Array sein.",
        "categories_must_be_array": "categories muss ein Array sein.",
        "invalid_circle_center": "Ungültiger Kreismittelpunkt",
        "invalid_radius": "Ungültiger Radius",
        "invalid_hysteresis": "Ungültige Hysterese",
        "invalid_polygon_points": "Ein Polygon muss mindestens 3 Punkte enthalten",
        "invalid_polygon_coordinates": "Ungültige Polygonkoordinaten",
        "zone_groups_must_be_array": "Zonengruppen müssen ein Array sein",
        "zone_categories_must_be_array": "Zonenkategorien müssen ein Array sein",
        "invalid_color": "Ungültige Farbe",
        "test_no_match": "Keine passende Zone",
        "no_subjects": "No subjects stored yet",
        "subjects_purged": "Subjects purged",
        "reserved_name": "Dieser Name ist reserviert",
        "reserved_group_or_category": "Reservierte Werte dürfen nicht für Gruppen oder Kategorien verwendet werden"
      },
      "defaults": {
        "circle_name": "Kreis",
        "polygon_name": "Polygon"
      },
      "import": {
        "note_title": "So funktioniert dieser Tab",
        "note_body": "Das hier angezeigte JSON ist eine Live-Vorschau des aktuellen Entwurfs. Das Bearbeiten aktualisiert die anderen Tabs erst, wenn du auf Importieren und ersetzen oder Importieren und zusammenführen klickst. Speichern sichert den aktuellen Entwurf in Homey. Abbrechen lädt die zuletzt gespeicherte Konfiguration neu."
      }
    }
  }
};
