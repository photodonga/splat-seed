# SPLAT SEED — original game sprites embedded locally

This update replaces the substitute hand-drawn SVGs introduced in PR #11 with the actual original game sprite PNGs used in earlier versions of SPLAT SEED.

## Assets

- **12 capsule images**: Gold/Silver/Bronze/Red/Purple/Blue for normal and Splatfest, sourced from Inkipedia's direct PNG asset URLs.
- **1 header capsule icon**, **11 unique reward item sprites**, and **15 sample locker stickers**: sourced from Leanny/splat3's PNGs.
- **38 unique PNG files total**, kept without edits at `assets/game/`.
- The complete source URL list is maintained in `assets/game-manifest.json`.
- The previous 42 substitute original-designed SVG files have been removed.

## Runtime behavior

The modular `app.html` requests all art from `./assets/game/` (this same repository, not Leanny/Inkipedia web servers).

`tools/bundle.mjs` packages the same unmodified original PNG bytes as base64 data URLs into `dist/app-standalone.html`. The standalone page no longer requires an external image network for graphics.

Colors and rewards are still controlled by the original engine's grade and reward type; the game art is only a presentation change. In particular, the locker sticker examples are not the exact sticker being awarded. The 10-tap prediction strip remains preview-only, and the fixed-size icon/text layout remains in place to avoid overlap.

## Important rights note

These are third-party copyrighted PNG files sourced from the public Inkipedia and Leanny repositories. Nintendo and other respective rights holders retain their rights. Public accessibility does not imply redistribution permission. The repository and GitHub Pages are public. Obtain appropriate authorization or limit distribution if required. This is an unofficial fan app.

## Verification

`node --test tests/*.test.mjs` checks the PNG signature and local file presence for all manifest entries, the absence of remote game art links, reproducible single-file generation, the original tracker calculation, and layout hooks. Full real-game engine verification remains a separate gate that needs held-out observations.
