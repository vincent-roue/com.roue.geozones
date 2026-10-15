# GeoZones 2.0.4 — language review / contrôle des langues

Reviewed on 15 October 2026: English, French, Dutch and German. This review covers the current app and Store text; it does not claim a native-speaker review or complete visual testing on a physical Homey and iPhone.

## Coverage per language

| Area | Text entries reviewed |
| --- | ---: |
| Backend messages and display labels | 72 |
| Settings interface, help and map controls | 158 |
| Manual-subject pairing and legacy recovery | 16 |
| Manifest, capabilities, driver and Flow text fields | 311 |

The four Store descriptions, manifest descriptions and current 2.0.4 release notes were also reviewed. Historical release notes that were originally English-only retain their original text. Repository guides remain available in their documented languages; this audit does not claim four-language translations of every guide.

## Corrections and checks

- Translate distance labels, the movement-state argument, map zoom/drawing instructions and user-facing migration/import errors that previously appeared in English.
- Correct transition and coordinate-condition grammar, subject/device terminology and filter explanations.
- Expand in-app Help to 15 sections and 45 short paragraphs in each language. Check the instructions against installation, migration and troubleshooting guides and the implemented zone, filter, delay, movement, event-token and backup behavior.
- Explain in all four languages that the last-update field records reception by GeoZones, not the age of the upstream location measurement; stored positions do not expire automatically.
- Obtain Homey's language from the backend `/meta` response before rendering settings or help. Normalize regional language codes, use compatibility helpers only when that language is unavailable, and use the browser language only when Homey's language cannot be determined. A known unsupported Homey language falls back to English. Reopen the settings after changing Homey's language.
- Check matching language keys, nonempty text, valid text encoding and preserved `__parameters__` / `[[Flow arguments]]`.
- Exercise translated configuration-import, migration-backup, duplicate-zone and coordinate errors, plus localized movement choices and their search behavior.
- Keep technical identifiers, state values, Flow card and argument IDs, the zone engine and permissions unchanged. Display names are translated without changing stored values such as `unknown`, `stable` and `moving`.

The nine automated suites include actual settings startup in all four languages, regional codes, a different browser language, unsupported-language fallback, missing metadata and delayed metadata responses. Help waits for Homey's language instead of briefly rendering in the browser language. They supplement the text review; they do not establish that every translated screen has been inspected on hardware. See [validation evidence](VALIDATION.json) for the latest uploaded draft and package checks.

A separate browser check with synthetic demonstration data rendered all 15 sections and 45 paragraphs in each of the four languages. No horizontal overflow was detected at the desktop viewport tested. This check does not replace the remaining physical Homey/iPhone acceptance.

The language fix follows the documented distinction between the [settings-view API](https://apps.developer.homey.app/advanced/custom-views/app-settings) and the backend [ManagerI18n](https://apps-sdk-v3.developer.homey.app/ManagerI18n.html). The frontend is not assumed to expose the backend manager. The settings page requests the backend language through the app's API and waits before calling `Homey.ready()`.

## Résultat en français

Les textes actuels ont été relus dans les quatre langues : 72 messages et libellés serveur, 158 entrées de réglages, 16 entrées d’association/récupération et 311 champs de manifeste par langue, ainsi que les descriptions du Store et les notes de version actuelles. L’aide intégrée comporte 15 rubriques et 45 paragraphes par langue, confrontés au fonctionnement réel et aux guides. Les neuf suites de tests couvrent la complétude, les paramètres, les erreurs traduites et le démarrage réel de l’aide dans chaque langue.

La langue de Homey est obtenue côté serveur avant l’affichage. Les tests vérifient aussi les variantes régionales, un navigateur dans une autre langue, le repli anglais pour une langue Homey non prise en charge et une réponse serveur absente ou retardée. Il faut rouvrir les réglages après un changement de langue Homey.

Les anciennes notes de version uniquement en anglais sont conservées comme historique. Les identifiants techniques, le moteur de zones et les permissions restent inchangés. Cette vérification ne constitue pas une relecture certifiée par des locuteurs natifs ni une validation visuelle exhaustive sur Homey et iPhone.
