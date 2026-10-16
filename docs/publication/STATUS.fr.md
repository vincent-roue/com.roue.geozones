# Publication de GeoZones 2.0.6

GeoZones **2.0.6 build 18 est officiellement publié en Live et installé sur Homey Pro 2023**. Le portail confirme le statut Live après la soumission. La version avait d’abord été publiée en Test ; 2.0.5 build 17 était la version Live précédente.

La version 2.0.6 simplifie le SVG de l’icône sans changer sa forme, les fonctions ou les permissions. Le nouveau SVG de 322 octets est présent dans la page Homey et l’épingle blanche s’y affiche correctement. Après installation et redémarrage, la sauvegarde des réglages, la configuration et les deux identités de sujets sont conservées ; les deux sujets sont disponibles. Les Stores Test et Live consultés dans Chrome affichent toujours le cercle bleu sans épingle : leur correction reste non confirmée. Ces constats ne démontrent pas que l’ancien SVG était défectueux.

## Suivi de la version 2.0.6

- [Installation Live](https://homey.app/a/com.roue.geozones/) et [Homey 2.0.6 build 18](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/18) : statut Live confirmé.
- [Contrôles de l’icône et limite du Store](ICON-REPAIR-2.0.6.md) : neuf suites réussies, validation Homey au niveau publication réussie et 76 fichiers du paquet identiques au candidat et aux fichiers de liaison SDK officiels. Les réponses du service d’icônes varient selon l’en-tête Origin ; le problème d’affichage du Store reste distinct de l’icône désormais visible dans Homey.

## Dossier de la version 2.0.5

- [Pull request 1 fusionnée](https://github.com/vincent-roue/com.roue.geozones/pull/1) : commit candidat archivé [`d8f68ae85c3fb01edbf6c913dc6099566e7ccd42`](https://github.com/vincent-roue/com.roue.geozones/commit/d8f68ae85c3fb01edbf6c913dc6099566e7ccd42), commit de fusion [`b2402979035d8cabaf411d50292af5f44f650717`](https://github.com/vincent-roue/com.roue.geozones/commit/b2402979035d8cabaf411d50292af5f44f650717).
- [Préversion GitHub v2.0.5 — Test](https://github.com/vincent-roue/com.roue.geozones/releases/tag/v2.0.5) : tag `v2.0.5` sur le commit candidat exact.
- [Homey 2.0.5 build 17](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/17) : précédente version approuvée et publiée en Live.
- [Ancien build Test 16 de 2.0.4](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/16) ; les archives et contrôles historiques du dossier suivant sont consignés dans les [preuves de validation 2.0.5](VALIDATION.json).
- [Installation en français](../INSTALLATION.fr.md), [migration](../MIGRATION.md), [dépannage](../TROUBLESHOOTING.md) et [confidentialité](../PRIVACY.md).
- [Premier message du forum à remplacer](FORUM-OPENING-POST.md), [point sur le candidat](FORUM-UPDATE.md) et [annonce à utiliser après publication Live](FORUM-RELEASE-ANNOUNCEMENT.md).
- [Notes pour Athom](REVIEWER-NOTES.md), [notes de version](RELEASE-NOTES.md), [contrôle des langues](LANGUAGE-AUDIT.md) et [preuves de validation](VALIDATION.json).

## Vérifications conservées de la version 2.0.5

La version 2.0.5 a réussi les neuf suites de tests, avec des contrôles renforcés sur les quatre langues : couverture des clés, textes non vides, paramètres conservés et erreurs réellement affichées. L’aide contient 15 rubriques et 45 paragraphes par langue, avec un premier Flow pas à pas et les réglages, filtres, délais, imports, migration et dépannage. Elle attend la langue communiquée par Homey avant l’affichage ; un navigateur dans une autre langue ne la remplace pas. Les variantes régionales et le repli anglais sont testés. Rouvrez les réglages après un changement de langue Homey.

Le contrôle dans le navigateur de démonstration confirme les 15 rubriques et 45 paragraphes dans chaque langue, sans débordement horizontal à la taille testée. Le moteur de zones, les identifiants techniques et les permissions restent identiques à la base 2.0.3. Le paquet 2.0.5 a réussi la validation Homey au niveau publication ; ses 76 fichiers correspondent aux sources préparées et aux deux fichiers de liaison SDK officiels.

Les visuels de Store utilisent une capture de la carte avec des zones de démonstration sur des lieux publics, sans localisation privée. Les trois résolutions sont présentes et les icônes d’application et de sujet sont distinctes.

## Recette matérielle et étapes de publication

La [checklist de publication](../RELEASE_CHECKLIST.md) conserve les essais matériels encore à confirmer : installation neuve, récupération d’anciens sujets, redémarrage pendant une transition différée, import/export et parcours iPhone. La mise à jour réelle de 2.0.2 vers 2.0.3 avait été observée sur Homey Pro 2023 ; 2.0.6 a maintenant été installé et redémarré avec les réglages et les deux identités de sujets conservés. Cela ne constitue pas une migration matérielle complète depuis les anciens sujets. Les autres limites restent ouvertes.

La version 2.0.5 reste archivée par son tag et sa préversion GitHub. Le dossier 2.0.6 consigne la publication Live et les contrôles de l’icône. L’affichage du Store demeure non résolu. La note de suivi pour Athom reste un brouillon non envoyé : le contrôle de messagerie était désactivé après la publication Live. Les textes du forum restent des brouillons.

À ce stade, 2.0.6 est en Live et son icône est correcte dans Homey ; la correction de l’icône du Store n’est pas confirmée. Aucun message n’a été publié sur le forum pendant ces préparatifs.
