# GeoZones 2.0.4 — candidate prepared for review

I have prepared **GeoZones 2.0.4 as a publication candidate**. This is a preparation update: certification has not been requested and a stable release has not been published.

Version 2.0.4 completes English, French, Dutch and German text in settings, pairing, Flow cards and server messages. In-app Help now has 15 practical sections and 45 paragraphs per language. Settings use Homey's language from the start, even when the browser uses another language. Store information and installation, migration, troubleshooting and privacy guides are also updated. The zone engine, Flow identifiers and permission scope are unchanged from the **2.0.3 test release**.

The version 2 setup is now explained more clearly:

- Add a manual subject device and supply its latitude and longitude through a Flow.
- Use your chosen location source; GeoZones does not obtain phone coordinates itself.
- Recover legacy subjects through Add device, then rebuild affected Flows with the current cards. Automatic linked subjects and obsolete cards remain removed.
- Check the age of the source's position. GeoZones retains the last supplied coordinates, and a recent update received by the app does not prove that the original GPS reading is recent.

The localized 2.0.4 candidate has **nine automated suites**, including checks for complete translations, preserved parameters, translated error paths and actual help startup in all four languages. The latest results, draft and package validation are recorded in the publication evidence. The 2.0.3 baseline has also been observed on Homey Pro 2023 with real source-driven zone updates. The hardware acceptance work remains partial, particularly recovery from an old installation and the full range of iPhone source scenarios. These limits are recorded with the review preparation.

The [test channel](https://homey.app/a/com.roue.geozones/test/) remains the installation route for testing. This message does not announce 2.0.4 as a test or stable release. The version shown on the store page is the available version.

Documentation prepared for this candidate:

- [Installation](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/INSTALLATION.md)
- [Migration](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/MIGRATION.md)
- [Troubleshooting](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/TROUBLESHOOTING.md)
- [Privacy](https://github.com/vincent-roue/com.roue.geozones/blob/prepare-publication-2.0.4/docs/PRIVACY.md)

Feedback on setup clarity and migration instructions would be useful before the next review step. Please remove private location and account information from anything you share.

---

Preparation note for the maintainer: this draft has not been posted. Keep it accurate to the actual certification and store state. The guide links use the preparation branch; confirm they resolve after pushing, then replace the branch with `main` only after merge. Do not present an uploaded draft as an installable release.
