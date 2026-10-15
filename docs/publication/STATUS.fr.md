# Préparation de la publication GeoZones 2.0.4

Les préparatifs techniques et éditoriaux sont prêts. Le candidat est téléversé en brouillon dans Homey Developer Tools ; la certification et la publication stable restent à lancer après la recette matérielle finale.

## Accès aux éléments prêts

- [Pull request en brouillon](https://github.com/vincent-roue/com.roue.geozones/pull/1) : sources synchronisées avec la version testée, dépôt nettoyé, documentation et visuels.
- [Brouillon Homey 2.0.4 build 15](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/15) : interface, messages, description et notes de version en anglais, français, néerlandais et allemand.
- [Installation en français](../INSTALLATION.fr.md), [migration](../MIGRATION.md), [dépannage](../TROUBLESHOOTING.md) et [confidentialité](../PRIVACY.md).
- [Premier message du forum à remplacer](FORUM-OPENING-POST.md), [point sur le candidat](FORUM-UPDATE.md) et [annonce à utiliser après publication Live](FORUM-RELEASE-ANNOUNCEMENT.md).
- [Notes pour Athom](REVIEWER-NOTES.md), [notes de version](RELEASE-NOTES.md), [contrôle des langues](LANGUAGE-AUDIT.md) et [preuves de validation](VALIDATION.json).

## Vérifications réalisées

Les huit suites de tests passent, avec des contrôles renforcés sur les quatre langues : couverture des clés, textes non vides, paramètres conservés et erreurs réellement affichées. Les cartes Flow, les aides de dessin, l’association et les messages serveur ont été relus et corrigés. Le moteur de zones, les identifiants techniques et les permissions restent identiques à la base 2.0.3. La validation Homey au niveau publication réussit ; les résultats GitHub sont consultables dans la pull request. Les 76 fichiers du paquet téléversé sont comparés aux sources préparées et aux deux fichiers de liaison SDK fournis par les outils officiels.

Les visuels de Store utilisent une capture de la carte avec des zones de démonstration sur des lieux publics, sans localisation privée. Les trois résolutions sont présentes et les icônes d’application et de sujet sont distinctes.

## Étapes restantes avant publication stable

La [checklist de publication](../RELEASE_CHECKLIST.md) conserve les essais matériels encore à confirmer : installation neuve, récupération d’anciens sujets, reprise après redémarrage, import/export et parcours iPhone. La mise à jour réelle de 2.0.2 vers 2.0.3 a été observée sur Homey Pro 2023, mais cette installation utilisait déjà des sujets manuels.

Ensuite : relire et fusionner la pull request, mettre le candidat à disposition en Test, demander la certification avec publication automatique désactivée, puis publier après approbation. Les textes du forum restent des brouillons ; leurs notes de préparation indiquent quand les utiliser et quels liens adapter après fusion.

Le build 15 reste en Draft, la version Test installable reste la 2.0.3, et aucun message n’a été publié sur le forum pendant ces préparatifs.
