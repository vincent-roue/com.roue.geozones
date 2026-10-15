# GeoZones 2.0.4 — language review / contrôle des langues

Reviewed on 15 October 2026: English, French, Dutch and German. This review covers the current app and Store text; it does not claim a native-speaker review or complete visual testing on a physical Homey and iPhone.

## Coverage per language

| Area | Text entries reviewed |
| --- | ---: |
| Backend messages and display labels | 72 |
| Settings interface, help and map controls | 122 |
| Manual-subject pairing and legacy recovery | 16 |
| Manifest, capabilities, driver and Flow text fields | 311 |

The four Store descriptions, manifest descriptions and current 2.0.4 release notes were also reviewed. Historical release notes that were originally English-only retain their original text. Repository guides remain available in their documented languages; this audit does not claim four-language translations of every guide.

## Corrections and checks

- Translate distance labels, the movement-state argument, map zoom/drawing instructions and user-facing migration/import errors that previously appeared in English.
- Correct transition and coordinate-condition grammar, subject/device terminology and filter explanations.
- Explain in all four languages that the last-update field records reception by GeoZones, not the age of the upstream location measurement; stored positions do not expire automatically.
- Check matching language keys, nonempty text, valid text encoding and preserved `__parameters__` / `[[Flow arguments]]`.
- Exercise translated configuration-import, migration-backup, duplicate-zone and coordinate errors, plus localized movement choices and their search behavior.
- Keep technical identifiers, state values, Flow card and argument IDs, the zone engine and permissions unchanged. Display names are translated without changing stored values such as `unknown`, `stable` and `moving`.

The eight automated suites pass after these corrections. They supplement the text review; they do not establish that every translated screen has been inspected on hardware. See [validation evidence](VALIDATION.json) for the latest uploaded draft and package checks.

## Résultat en français

Les textes actuels ont été relus dans les quatre langues : 72 messages et libellés serveur, 122 entrées de réglages, 16 entrées d’association/récupération et 311 champs de manifeste par langue, ainsi que les descriptions du Store et les notes de version actuelles. Les oublis de traduction et formulations incorrectes trouvés ont été corrigés. Les huit suites de tests passent, avec des contrôles de complétude, de paramètres et de véritables chemins d’erreur traduits.

Les anciennes notes de version uniquement en anglais sont conservées comme historique. Les identifiants techniques, le moteur de zones et les permissions restent inchangés. Cette vérification ne constitue pas une relecture certifiée par des locuteurs natifs ni une validation visuelle exhaustive sur Homey et iPhone.
