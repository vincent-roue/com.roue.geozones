# Publication de GeoZones 2.0.7

GeoZones **2.0.7 build 19 est publié en Live** : la version a été proposée en Test, soumise à certification, puis le portail a confirmé son statut Live. L’épingle blanche est visible sur les fiches Store Test et Live et sur la page récapitulative de l’application dans [Homey Developer Tools](https://tools.developer.homey.app/apps/app/com.roue.geozones). Après chaque visite du Store Test puis Live, un retour et un rechargement du récapitulatif conservent l’épingle.

Le SVG minimal de 248 octets ne contient aucun attribut explicite de remplissage, couleur, style, transformation ou règle de remplissage ; l’orientation des contours forme l’évidement de l’épingle. Les neuf suites de tests et la validation Homey au niveau publication réussissent ; les 76 fichiers du paquet correspondent au candidat et aux fichiers de liaison SDK officiels.

La même page affiche l’épingle de 2.0.7 à côté des icônes vides de 2.0.5/2.0.6 et des épingles visibles de 2.0.4. Les SVG archivés de 2.0.4 et 2.0.5 sont pourtant identiques et utilisent currentColor : cette variation ne permet pas d’attribuer toute la cause à un simple attribut de couleur ou d’affirmer une correction du cache/CDN. Voir les [observations 2.0.7 et contrôles restants](ICON-REPAIR-2.0.7.md).

Les contrôles API Homey confirment 2.0.7 installé sur Homey Pro 2023, la somme de contrôle de la configuration inchangée, les deux identités de sujets conservées et les deux sujets disponibles après redémarrage. L’apparence de l’icône dans l’interface web Homey et sur iPhone n’est pas encore vérifiée pour 2.0.7. Le premier chargement navigateur de la nouvelle ressource avait été effectué par le masque CSS du récapitulatif en Draft, avant les visites Test puis Live et leurs rechargements de contrôle ; cela ne garantit pas l’absence universelle d’un défaut de cache. [Installation Live](https://homey.app/a/com.roue.geozones/).

## Historique de la version 2.0.6

GeoZones **2.0.6 build 18 avait été publié en Live et installé sur Homey Pro 2023**. Le portail avait confirmé son statut Live après la soumission. Cette version, d’abord publiée en Test après 2.0.5 build 17, est désormais remplacée par 2.0.7 sur le Homey et sur le canal Live.

La version 2.0.6 avait simplifié le SVG de l’icône sans changer sa forme, les fonctions ou les permissions. Le SVG de 322 octets était présent dans la page Homey et l’épingle blanche s’y affichait correctement. Après installation et redémarrage, la sauvegarde des réglages, la configuration et les deux identités de sujets avaient été conservées ; les deux sujets étaient disponibles. Lors de ce contrôle, les Stores Test et Live consultés dans Chrome affichaient le cercle bleu sans épingle. Ces constats ne démontraient pas que l’ancien SVG était défectueux.

## Suivi de la version 2.0.6

- [Homey 2.0.6 build 18](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/18) : ancien statut Live confirmé.
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

La [checklist de publication](../RELEASE_CHECKLIST.md) conserve les essais matériels encore à confirmer : installation neuve, récupération d’anciens sujets, redémarrage pendant une transition différée, import/export et parcours iPhone. La mise à jour réelle de 2.0.2 vers 2.0.3 avait été observée sur Homey Pro 2023 ; 2.0.6 puis 2.0.7 ont été installés et redémarrés avec la configuration et les deux identités de sujets conservées. Cela ne constitue pas une migration matérielle complète depuis les anciens sujets. Les autres limites restent ouvertes.

La version 2.0.5 reste archivée par son tag et sa préversion GitHub. Les dossiers 2.0.6 et 2.0.7 distinguent les observations de chaque version. La note de suivi préparée pour Athom concernant 2.0.6 reste un brouillon non envoyé : le contrôle de messagerie était désactivé après la publication Live. Les textes du forum restent des brouillons.

À ce stade, 2.0.7 est en Live ; son épingle est confirmée sur les Stores Test et Live et dans le récapitulatif Developer Tools après les retours et rechargements. Les autres interfaces restent à vérifier séparément. Aucun message n’a été publié sur le forum pendant ces préparatifs.
