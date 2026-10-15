# Publication de GeoZones 2.0.5

GeoZones 2.0.5 build 17 est disponible en Test et la demande de certification est enregistrée : le portail indique que l’application est en cours de révision. La publication automatique après approbation est activée, conformément à l’autorisation de l’utilisateur du 15 octobre 2026. La publication Live n’est pas encore confirmée.

La version 2.0.5 corrige huit titres Flow comportant des parenthèses interdites ; l’aide et les traductions restent celles de 2.0.4. Le build 16 de 2.0.4 avait été publié en Test avant cette correction, ce qui imposait un nouveau numéro de version.

## Accès aux éléments prêts

- [Pull request 1](https://github.com/vincent-roue/com.roue.geozones/pull/1) : sources, documentation et visuels de publication ; la fusion et l’enregistrement du commit final restent à terminer.
- [Homey 2.0.5 build 17](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/17) : disponible en Test et en cours de révision pour certification.
- [Ancien build Test 16 de 2.0.4](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/16) ; l’archive et les contrôles du build courant sont consignés dans les [preuves de validation](VALIDATION.json).
- [Installation en français](../INSTALLATION.fr.md), [migration](../MIGRATION.md), [dépannage](../TROUBLESHOOTING.md) et [confidentialité](../PRIVACY.md).
- [Premier message du forum à remplacer](FORUM-OPENING-POST.md), [point sur le candidat](FORUM-UPDATE.md) et [annonce à utiliser après publication Live](FORUM-RELEASE-ANNOUNCEMENT.md).
- [Notes pour Athom](REVIEWER-NOTES.md), [notes de version](RELEASE-NOTES.md), [contrôle des langues](LANGUAGE-AUDIT.md) et [preuves de validation](VALIDATION.json).

## Vérifications réalisées

La version 2.0.5 a réussi les neuf suites de tests, avec des contrôles renforcés sur les quatre langues : couverture des clés, textes non vides, paramètres conservés et erreurs réellement affichées. L’aide contient 15 rubriques et 45 paragraphes par langue, avec un premier Flow pas à pas et les réglages, filtres, délais, imports, migration et dépannage. Elle attend la langue communiquée par Homey avant l’affichage ; un navigateur dans une autre langue ne la remplace pas. Les variantes régionales et le repli anglais sont testés. Rouvrez les réglages après un changement de langue Homey.

Le contrôle dans le navigateur de démonstration confirme les 15 rubriques et 45 paragraphes dans chaque langue, sans débordement horizontal à la taille testée. Le moteur de zones, les identifiants techniques et les permissions restent identiques à la base 2.0.3. Le paquet 2.0.5 a réussi la validation Homey au niveau publication ; ses 76 fichiers correspondent aux sources préparées et aux deux fichiers de liaison SDK officiels.

Les visuels de Store utilisent une capture de la carte avec des zones de démonstration sur des lieux publics, sans localisation privée. Les trois résolutions sont présentes et les icônes d’application et de sujet sont distinctes.

## Recette matérielle et étapes de publication

La [checklist de publication](../RELEASE_CHECKLIST.md) conserve les essais matériels encore à confirmer : installation neuve, récupération d’anciens sujets, reprise après redémarrage, import/export et parcours iPhone. La mise à jour réelle de 2.0.2 vers 2.0.3 a été observée sur Homey Pro 2023, mais cette installation utilisait déjà des sujets manuels. Ces limites restent ouvertes et sont indiquées dans les notes préparées pour Athom ; elles ne sont pas présentées comme des essais réussis.

Les prochaines étapes sont de terminer l’archivage du commit source et la fusion de la pull request, puis de créer le tag et la préversion GitHub correspondant à la version Test. Cette archive peut être créée pendant la révision Athom. Le statut Live sera actualisé après confirmation du portail. Les textes du forum restent des brouillons.

À ce stade, 2.0.5 build 17 est en Test et en cours de révision ; la publication automatique après approbation est activée. Aucun statut Live ni nouvel essai matériel n’est revendiqué. Aucun message n’a été publié sur le forum pendant ces préparatifs.
