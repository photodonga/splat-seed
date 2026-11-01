# SPLAT SEED — unified game-inspired UI

This app uses **original locally committed SVG graphics** with bold dark purple UI, lime accents, six capsule grades, and separate normal/Splatfest sets. Source art is in `assets/`. No Nintendo asset bytes are copied, and no remote image URLs are used.

`app.html` relies on relative local art and modular engine files; `dist/app-standalone.html` embeds SVG art, the engine, and the optional personal font loader. No network request is needed for its artwork.

The tracker, gold-target hero, location finder, prediction strip, and 10-tap preview share the same graphics. A preview selection never records a pull. `node tools/bundle.mjs app.html dist/app-standalone.html engine/murmur3.mjs engine/xorshift128.mjs engine/shellout.mjs engine/npln-id.mjs engine/candidates.mjs engine/tracker.mjs engine/plan.mjs` rebuilds the distribution. Keep its committed output in sync.

Personal-use iPhone checks and three actual matches to Leanny have been reported, but formal held-out real-game validation is not yet complete.
