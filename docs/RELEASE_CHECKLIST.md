# GeoZones publication checklist

Version 2.0.5 build 17 is available in Test and under Athom review. Automatic Live publication after approval is enabled, as authorized by the user on 15 October 2026. Live publication is not yet confirmed. The additional correction from 2.0.4 removes prohibited parentheses from eight Flow card titles; detailed help, translations, zone calculations, Flow identifiers and permissions retain their reviewed behavior.

## Package and repository

- [x] Run all nine automated suites on the 2.0.5 checkout.
- [x] Run `homey app validate --level publish` on the 2.0.5 package.
- [x] Confirm package, compose manifest, generated manifest and changelog versions agree.
- [x] Confirm the zone engine, Flow identifiers and permissions are unchanged from 2.0.3; retired Flow cards and broad `homey:manager:api` access remain removed.
- [x] Review staged files; exclude credentials, private coordinates, exports, runtime snapshots, dependencies and generated build directories.
- [x] Verify PNG dimensions, SVG icons, bundled map libraries and third-party notices.
- [x] Merge [pull request 1](https://github.com/vincent-roue/com.roue.geozones/pull/1) and archive the exact candidate `d8f68ae85c3fb01edbf6c913dc6099566e7ccd42` as tag `v2.0.5`.
- [x] Upload 2.0.4 build 16 and record its archive SHA256 in [validation evidence](publication/VALIDATION.json).
- [x] Verify 2.0.4 build 16 files match its publication checkout and its GitHub tests on Node 20/24 plus publication validation pass.
- [x] Re-run the nine suites and publication validation after the eight Flow-title corrections and version change; upload 2.0.5 build 17 and verify all 76 package files match the prepared sources and official SDK shim.

## Documentation and communication

- [x] Store text is plain text in English, French, Dutch and German; explains external location sources.
- [x] Review all four languages and check settings, pairing, manifest text, server messages and current release notes; record scope and limits in the [language audit](publication/LANGUAGE-AUDIT.md).
- [x] Review the 15 help sections and 45 paragraphs in each language against app behavior; check initial rendering follows Homey's language, including regional and fallback cases.
- [x] Installation guide demonstrates adding a manual subject and feeding both coordinates in one action.
- [x] Migration guide covers legacy recovery and rebuilding incompatible Flows.
- [x] Source freshness and reception timestamps are explained without promising automatic expiry.
- [x] Forum opening-post replacement and update announcement are ready as drafts.
- [x] Certification notes explain the sole geolocation permission and distinguish automated checks from hardware checks.

## Hardware acceptance

Already observed with 2.0.3 on Homey Pro 2023: App Store test installation over 2.0.2; two existing manual subjects; configuration retained; live coordinate updates and zone changes. This does not establish a physical migration from a legacy subject installation.

The following acceptance checks remain open. Review notes disclose these limits; no unperformed check is treated as passed. The user has authorized the platform publication steps with this partial hardware coverage. Record further results on a dedicated test setup or with an available tester:

- [ ] Fresh installation, first manual subject and first coordinate update.
- [ ] Legacy schema installation, recovery through pairing, source rewiring and restart; no duplicate subjects or loss of the original backup.
- [ ] Restart while a delayed transition is pending; disable and re-enable a subject.
- [ ] Import replace/merge, history restoration, browser export and recovery of an invalid edit on iPhone.
- [ ] Real source behavior with the phone locked and the source offline; verify source timestamps independently.

## Authorized platform publication steps

- [x] Record the user's authorization for Test, certification and automatic Live publication after approval on 15 October 2026.
- [x] Release 2.0.4 build 16 to Test.
- [x] Make 2.0.5 build 17 available in Test.
- [x] Submit the official Athom certification request with automatic Live publication after approval enabled; the portal confirms the app is under review.
- [x] Keep the hardware-test limits explicit in the reviewer notes and submission material.
- [x] Finish repository synchronization; record candidate `d8f68ae85c3fb01edbf6c913dc6099566e7ccd42` and merge commit `b2402979035d8cabaf411d50292af5f44f650717` in the completion evidence.
- [x] Create tag `v2.0.5` on the exact candidate and the [GitHub Test pre-release](https://github.com/vincent-roue/com.roue.geozones/releases/tag/v2.0.5) while Athom review is pending.
- [ ] Record Live publication only after portal confirmation and update publication documentation. The forum texts remain prepared drafts.

Official references: [Store guidelines](https://apps.developer.homey.app/app-store/guidelines), [publication](https://apps.developer.homey.app/app-store/publishing), [permissions](https://apps.developer.homey.app/the-basics/app/permissions).
