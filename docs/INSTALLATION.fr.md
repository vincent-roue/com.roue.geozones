# Installation et premier Flow

Cette app cible **Homey Pro (Early 2023), avec un firmware 12.5.0 ou supérieur**. Elle ne fonctionne pas sur Homey Cloud. Pour une installation existante, lisez d'abord le [guide de migration](MIGRATION.md) : les anciennes cartes et liaisons de sources ne sont pas rétablies automatiquement.

## 1. Préparer une source de coordonnées

Il vous faut une source qui fournit déjà une **latitude et une longitude numériques à un Flow Homey**. Configurez séparément cette source et ses autorisations de localisation sur l'iPhone. GeoZones ne localise pas les téléphones, ne lit pas le GPS des utilisateurs Homey et n'intègre pas nativement Find My ou Home Assistant. Home Assistant peut faire partie d'un pont configuré séparément.

Le déclencheur dépend de votre source. Vérifiez qu'il fournit une paire de coordonnées récente et cohérente avant de la transmettre. Le simple statut présent/absent d'un utilisateur Homey ne suffit pas.

## 2. Installer et créer une zone

1. Ouvrez la [fiche de l'app](https://homey.app/a/com.roue.geozones/) et vérifiez la version proposée. Le [lien de test](https://homey.app/a/com.roue.geozones/test/) correspond au canal Test.
2. Installez GeoZones, puis ouvrez ses **Paramètres > Zones**.
3. Ajoutez un cercle ou un polygone, donnez-lui un nom unique, renseignez sa géométrie et gardez-le actif. Enregistrez.
4. Pour le premier essai, laissez les délais, l'hystérésis et les filtres à leurs valeurs par défaut.

## 3. Ajouter un sujet manuel

Dans Homey : **Appareils > Ajouter un appareil > GeoZones > Sujet manuel**. Donnez-lui un nom unique, par exemple `Sujet démo`, un type facultatif comme `person`, et gardez-le activé. Commencez avec une **Distance minimale de mouvement** de `0 m`.

« Manuel » signifie que les coordonnées sont fournies par une carte Flow ; leur envoi peut être automatisé par votre source. Le nouvel appareil n'a pas de position tant qu'il n'a pas reçu de coordonnées valides.

## 4. Alimenter le sujet

Créez un Flow :

| Partie | Choix |
| --- | --- |
| Quand | Déclencheur de mise à jour des coordonnées de votre source |
| Alors | Appareil sujet GeoZones → **Mettre la position à [latitude], [longitude] et évaluer** |
| Latitude / Longitude | Tags numériques d'une même position |

Ne permutez pas les coordonnées : latitude entre `-90` et `90`, longitude entre `-180` et `180`. La valeur `0` est valide, une valeur vide ne l'est pas. Si les coordonnées arrivent séparément, obtenez une paire complète avant de lancer la carte.

La carte renvoie notamment **Zone**, **Zone précédente**, **Tags de zone**, **État de mouvement** et **Vitesse (km/h)**. Dans Advanced Flow, reliez les actions qui utilisent ces résultats **après la fin de cette carte**.

## 5. Réagir au changement de zone

Créez un autre Flow avec le déclencheur de l'appareil sujet **A changé de zone**, puis une notification utilisant **Zone précédente** et **Zone** provenant de ce déclencheur. Cela comprend les passages vers ou depuis `not_defined`, lorsqu'aucune zone ne correspond.

Pour cibler une entrée ou une sortie précise, utilisez **Transition de zone — [entrée/sortie] : [zone] / [zones] / [tag] / [tags]** et renseignez le filtre utile. Les tags de cette carte décrivent la zone concernée par l'entrée ou la sortie ; en sortie, il s'agit donc de la zone quittée.

Pour un journal d'événements, utilisez les tags du déclencheur. Si vous les copiez dans des variables, attendez la fin de ces écritures avant de lire les variables dans une autre action. Des branches parallèles peuvent lire leur ancienne valeur.

## 6. Vérifier le résultat et la fraîcheur

Pour un essai synthétique, créez une zone `Zone démo`, cercle actif centré sur `0, 0`, rayon `100 m`, sans délai ni hystérésis. Envoyez `0, 0` au sujet : il doit entrer dans cette zone. Envoyez `0.01, 0` : il doit en sortir. Des zones superposées ou des filtres peuvent modifier le résultat. Supprimez ensuite cette zone et ce sujet de démonstration.

Reconnectez votre source et vérifiez une arrivée et un départ réels, puis ajustez les délais et filtres. Les délais utilisent les dernières coordonnées stockées ; ils ne demandent pas une nouvelle position GPS.

**Dernière mise à jour** indique la réception d'une position par GeoZones, pas la date du relevé GPS. Une source qui renvoie des coordonnées en cache peut donc rafraîchir cet indicateur. Vérifiez aussi l'horodatage fourni par la source. Les positions n'expirent pas automatiquement ; la carte **Récupérer l'état du sujet [sujet]** fournit la dernière mise à jour pour ajouter votre propre contrôle d'âge dans les Flows.

L’onglet **Aide** des réglages contient 15 rubriques pratiques en anglais, français, néerlandais et allemand. Il utilise la langue de Homey à l’ouverture ; rouvrez les réglages après un changement de langue.

Voir aussi le [dépannage](TROUBLESHOOTING.md) et les informations de [confidentialité](PRIVACY.md).
