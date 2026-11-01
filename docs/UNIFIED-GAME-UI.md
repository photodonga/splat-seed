# SPLAT SEED — unified game-style UI asset notes

This change applies game-inspired styling to the experimental **app.html** and its **dist/app-standalone.html** build, based on the unified flow in PR #6. It does not modify the random-number engine, predictions, search limits, or persistent data format.

## Linked imagery

The interface links six ordinary Shell-Out and six Splatfest Shell-Out capsule images by explicit color name from Inkipedia's image CDN:

- Gold, Silver, Bronze, Red, Purple, Blue
- Source: https://splatoonwiki.org/wiki/Category:Splatoon_3_icons
- Illustration/reference: https://github.com/Leanny/splat3/tree/main/images/capsules
- A header decoration refers to Leanny's `CapsuleIcon_00.png` via GitHub's raw URL.

This branch **does not copy or distribute Nintendo image bytes or fonts** in the Git repository. If any remote icon fails, the app displays its original solid-color CSS capsule. The stylesheet is duplicated in the single-file experimental build so it can operate without local CSS/JS dependencies; remote images and webfonts require a connection.

Game art, marks, and logos belong to Nintendo and their owners. Availability in a public GitHub repository or on a fan wiki does not automatically grant reuse rights, and attribution alone does not establish a license. Verify applicable rights and remote-image policies before public deployment. This is an unofficial, noncommercial fan-made interface; no Nintendo affiliation or endorsement is implied.

Fonts are loaded as webfonts (Google Fonts Jua and Lilita One) with system-font fallback, not extracted proprietary game fonts.

## Integration and review

- `app.html`: original modular app, requires locally served `engine/*.mjs`.
- `dist/app-standalone.html`: inline JS engine and CSS for single-file use, no local runtime dependencies.
- Both have 12 explicit icon CDN references (6 normal + 6 Splatfest).
- Body `data-splat-mode` follows the real active mode, so switching between modes changes icon variants.
- The prediction strip, six-color picker, recent history, and current-pull button reuse the same icon mapping.
- Existing hero, navigation, and controls are visually restyled but retain their original IDs and event handlers.

## Tests / limits

The new static test checks image mapping, mode switching hooks, stylesheet parity and backup logic in both pages. Existing tests are still the source of truth for calculation behavior. The expected-failing `game-validation` workflow requires fresh real-game fixtures before the prediction engine can be called verified.

A physical iPhone Safari visual/interaction test and confirmation that all external image URLs work on the desired network remain outstanding. Do not interpret green unit tests as real-game RNG validation.

**Do not merge this branch or PR #6 to production without that review.**
