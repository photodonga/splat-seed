# SPLAT SEED — local artwork and prediction preview

The game-inspired graphics are **original SVG illustrations made for SPLAT SEED**, not copies of Nintendo/Leanny icons. There are 42 committed assets under `assets/`: six regular capsules, six Splatfest capsules, 14 reward-category icons, 15 decorative sticker sketches, and one logo.

The modular app (`app.html`) loads these SVGs exclusively from relative `./assets/` paths. The single-file distribution (`dist/app-standalone.html`) embeds the same SVG source as data URLs at bundle time, so the images need no CDN or image-server connection. The app also no longer requests Google Fonts.

The 15 decorative sticker designs are **not** actual Splatoon locker sticker art, a catalog, or exact winnings. The engine only identifies reward category (e.g. `LockerSticker`); it does not identify individual stickers, figurines, titles, or ticket subtype IDs. A forecast selection only changes the read-only detail panel, never advances or saves the game RNG.

Icon slots and responsive text columns are kept separate to prevent overlapping labels on small mobile screens. `node --test tests/*.test.mjs` checks local assets, CSS mode parity, standalone bundle equality, and core engine behavior.

No Nintendo game art or third-party image binaries are copied in this repo. SPLAT SEED is unofficial. Real-game verification still requires independent held-out observations; user-reported three matches are a smoke test, not full engine validation.
