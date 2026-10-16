# GeoZones 2.0.7 — minimal icon SVG

On 16 October 2026, **2.0.7 build 19 was released to Test, submitted for certification and confirmed Live by the developer portal**. The white pin is visible on both Test and Live Store pages and in the app overview at [Homey Developer Tools](https://tools.developer.homey.app/apps/app/com.roue.geozones).

## Asset and checks

The app icon is a minimal **248-byte SVG** on a 960 × 960 canvas. It has no explicit `fill`, color, style, transform or fill-rule attributes; contour winding provides the pin's inner opening. Application logic, zone calculations, Flow cards, identifiers and permissions are unchanged.

- All nine automated suites and Homey publication-level validation pass.
- All 76 uploaded package files match the prepared candidate and official SDK shim.
- The Developer Tools overview visibly shows the new pin alongside blank 2.0.5/2.0.6 icons and correctly displayed 2.0.4 icons.
- After opening the Test Store, returning to and reloading the Developer Tools overview still shows the 2.0.7 pin. The 2.0.5/2.0.6 icons remain blank there while 2.0.4 remains visible.
- After opening the Live Store, the pin is visible there and remains visible when the Developer Tools overview is reloaded again.
- Homey API checks confirm 2.0.7 is installed on Homey Pro 2023, the configuration checksum is unchanged, and both existing subject identities are preserved. Both subjects report available after restart.

The archived 2.0.4 and 2.0.5 app SVGs are byte-identical and use `currentColor`, yet their overview rendering differs. The successful 2.0.7 observations do not establish a single color attribute as the cause of the full history, or a cache/CDN repair. No claim is made that Homey documentation bans `fill` attributes.

## Scope of the visual verification

The recorded order was the new icon's first browser load through the overview CSS mask while the build was Draft, then Test Store, overview reload, Live Store and another overview reload. The pin was visible at each of those checks. This sequence does not prove the absence of every cache bug.

Confirmed visual surfaces are the Test Store, Live Store and Developer Tools overview. The Homey web interface and iPhone have not yet been visually checked for 2.0.7. Homey API installation checks establish version and state preservation, not the icon's appearance in those clients. Remaining legacy-migration, import and delayed-transition scenarios also remain open.

[Live installation](https://homey.app/a/com.roue.geozones/) · [Build 19](https://tools.developer.homey.app/apps/app/com.roue.geozones/build/19) · [2.0.6 observations](ICON-REPAIR-2.0.6.md) · [Publication status](STATUS.fr.md)
