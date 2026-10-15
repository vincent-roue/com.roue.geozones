# GeoZones publication checklist

Version 2.0.4 prepares the tested 2.0.3 runtime for publication. Uploading a draft, requesting certification and publishing to Live are separate actions. This preparation does not request certification or enable Live publication.

## Package and repository

- [x] Run `npm test` on the final checkout.
- [x] Run `homey app validate --level publish` after the final metadata edits.
- [x] Confirm package, compose manifest, generated manifest and changelog versions agree.
- [x] Confirm the runtime matches 2.0.3 and no retired Flow cards or broad `homey:manager:api` permission returned.
- [x] Review staged files; exclude credentials, private coordinates, exports, runtime snapshots, dependencies and generated build directories.
- [x] Verify PNG dimensions, SVG icons, bundled map libraries and third-party notices.
- [ ] Push the preparation branch and open a draft pull request with validation results.
- [x] Upload the Homey draft and record build ID 14 and archive SHA256 in [validation evidence](publication/VALIDATION.json).

## Documentation and communication

- [x] Store text is plain text in English, French, Dutch and German; explains external location sources.
- [x] Installation guide demonstrates adding a manual subject and feeding both coordinates in one action.
- [x] Migration guide covers legacy recovery and rebuilding incompatible Flows.
- [x] Source freshness and reception timestamps are explained without promising automatic expiry.
- [x] Forum opening-post replacement and update announcement are ready as drafts.
- [x] Certification notes explain the sole geolocation permission and distinguish automated checks from hardware checks.

## Hardware acceptance

Already observed with 2.0.3 on Homey Pro 2023: App Store test installation over 2.0.2; two existing manual subjects; configuration retained; live coordinate updates and zone changes. This does not establish a physical migration from a legacy subject installation.

Before certification, record the remaining checks on a dedicated test setup or with an available tester:

- [ ] Fresh installation, first manual subject and first coordinate update.
- [ ] Legacy schema installation, recovery through pairing, source rewiring and restart; no duplicate subjects or loss of the original backup.
- [ ] Restart while a delayed transition is pending; disable and re-enable a subject.
- [ ] Import replace/merge, history restoration, browser export and recovery of an invalid edit on iPhone.
- [ ] Real source behavior with the phone locked and the source offline; verify source timestamps independently.

## Final publication sequence

1. Complete and record the remaining hardware acceptance checks.
2. Review and merge the prepared pull request; confirm the intended source commit and uploaded archive match.
3. Request Athom certification with automatic Live publication disabled.
4. After approval and an explicit release decision, publish to Live, create the matching Git tag/release and publish the prepared forum update.

Official references: [Store guidelines](https://apps.developer.homey.app/app-store/guidelines), [publication](https://apps.developer.homey.app/app-store/publishing), [permissions](https://apps.developer.homey.app/the-basics/app/permissions).
