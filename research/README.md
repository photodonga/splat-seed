# SPLAT SEED — independent seed research

**NOT A SHELL-OUT MACHINE PREDICTOR.** This research branch contains a clean-room implementation of a publicly documented xorshift32 *gear RNG primitive* and a toy search against complete synthetic outputs. It does not establish Splatoon 3 capsule RNG or predict gold capsules.

### Current evidence

- Splatoon 3 **gear** xorshift32 recurrence: left 13, right 17, left 5. Independent forward/reverse implementation and tests.
- Splatoon 3 Shell-Out Machine has distinct regular/Splatfest streams, documented grades, and special seasonal jackpot ownership handling.
- **UNVERIFIED:** Shell-Out recurrence, exact number of RNG advances per reward, grade selection thresholds, potential rejection loops, treatment of seasonal replacements, whether a saved seed points before or after a roll, and real-game fixture matching.

### Required gates before shipping an actual prediction feature

1. Reconstruct the **Shell-Out-specific** step function from authorized publicly observable evidence; do not paste third-party compiled JS/WASM that has no redistribution license.
2. Get test fixtures with known seed / normal and fest mode / 20+ subsequent real capsule outputs, including duplicate jackpot states. Test exact agreement.
3. Implement fast 32-bit candidate search in a worker or WebAssembly; display remaining candidates and stop/cancel controls, and prove the search is exhaustive before calling a seed unique.
4. Validate predicted next 10+ results against held-out observations, not merely the first few used to discover the seed.
5. Keep the production site showing “unknown” until all gates pass.

### Verification

`node --test tests/*.test.mjs` — dependency-free Node 20+.

### Sources

- https://leanny.github.io/splat3seedchecker/ (behavioral reference, not code dependency)
- https://note.com/gamewagashi/n/n3388c6e4f7c9?hl=en (gear xorshift32 explanation)
- https://splatoonwiki.org/wiki/Shell-Out_Machine (capsule grade probabilities, owner substitutions)
- https://github.com/ToeMunchEnja/splat3seedchecker (third-party distribution of *gear-specific* WASM and worker, no redistributable license established)

### License and attribution boundary

Leanny web app and one public mirror inspected here do not advertise a license granting us permission to redistribute their bundled application code. This branch uses no code or copyrighted game graphics taken from either. Reverse engineering observable behavior is distinct from copying a third-party implementation.
