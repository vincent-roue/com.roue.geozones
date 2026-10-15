# GeoZones 2.0.5 — Test release and certification review

**GeoZones 2.0.5 build 17 is available in Test.** Official Athom certification has been requested and the app is under review. Automatic publication after approval is enabled; Live publication has not yet been confirmed.

Version 2.0.5 completes English, French, Dutch and German text in settings, pairing, Flow cards and server messages. In-app Help now has 15 practical sections and 45 paragraphs per language. Settings use Homey's language from the start, even when the browser uses another language. Store information and installation, migration, troubleshooting and privacy guides are also updated. The zone engine, Flow identifiers and permission scope are unchanged from the **2.0.3 test release**.

The version 2 setup is now explained more clearly:

- Add a manual subject device and supply its latitude and longitude through a Flow.
- Use your chosen location source; GeoZones does not obtain phone coordinates itself.
- Recover legacy subjects through Add device, then rebuild affected Flows with the current cards. Automatic linked subjects and obsolete cards remain removed.
- Check the age of the source's position. GeoZones retains the last supplied coordinates, and a recent update received by the app does not prove that the original GPS reading is recent.

GeoZones 2.0.5 passes **nine automated suites**, including complete translations, preserved parameters, translated error paths and actual help startup in all four languages. Homey publication validation passes and all 76 uploaded package files match the prepared sources and official SDK shim. Results are recorded in the publication evidence. The 2.0.3 baseline has also been observed on Homey Pro 2023 with real source-driven zone updates. The hardware acceptance work remains partial, particularly recovery from an old installation and the full range of iPhone source scenarios. These limits are recorded with the review preparation.

Install through the [Homey Test channel](https://homey.app/a/com.roue.geozones/test/). Version 2.0.5 is a Test release awaiting certification approval and confirmed Live publication.

Documentation prepared for this candidate:

- [Installation](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/INSTALLATION.md)
- [Migration](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/MIGRATION.md)
- [Troubleshooting](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/TROUBLESHOOTING.md)
- [Privacy](https://github.com/vincent-roue/com.roue.geozones/blob/main/docs/PRIVACY.md)

Feedback on setup clarity and migration instructions is welcome during review. Please remove private location and account information from anything you share.

---

Preparation note for the maintainer: this draft has not been posted. The source is merged and documentation links use `main`; verify those links and recheck the Homey Test version and certification state before posting. Announce Live availability only after it is confirmed.
