# Interactive 10-pull forecast and Leanny icon mapping

This change makes the ten predicted capsules inside `app.html` and `dist/app-standalone.html` tappable. A tap **only changes the selected preview**: it never records a pull, advances the RNG, changes localStorage, or mutates an engine state. Real-world results are still entered via the separate `지금 뽑으면`/manual controls.

Each button contains the predicted capsule color and ordinal number (1–10). The selected result presents a capsule icon, reward category, and a representative image when available. Mobile uses a 10-column grid without page-level horizontal overflow.

## Source asset mapping

Images are linked directly (not bundled or redistributed) from `Leanny/splat3` under https://github.com/Leanny/splat3/tree/main/images.

| Engine reward | Source art path | Notes |
|---|---|---|
| `MiniGameCardPack` | `catalog/IconCardPack_00.png` | Actual card-pack type icon |
| `FoodTicket|FoodParty` | `food/IconShopParty_00.png` | **Representative only**: money party type; exact money/EXP version not known |
| `FoodTicket|Food100` | `food/IconShopFoodL.png` | **Representative only**: money 100% type; exact boost not known |
| `FoodTicket|Food50` | `food/IconShopFood.png` | **Representative only**: money 50% type; exact boost not known |
| `DrinkTicket` | `food/GearPowerTicketBase.png` | Generic gear drink ticket base |
| `NamePlateBg` | `catalog/IconNameplate_02.png` | Random/representative banner art, not a specific earned banner |
| `Byname` | `catalog/IconNameplate_03.png` | Representative title art |
| `GearSkillChip` / `AllGearSkillChip` | `misc/SkillIconPiece_00^s.png` | Generic gear ability chunk, with amount in text |
| `Emote` | `emote/BigJump00.png` | **Example** emote; exact emote is unknown |
| `LockerFigure` | `zakka/Fig_Arcadegame.png` | **Example** figure; exact figure is unknown |
| `LockerSticker` | no sprite | No unique ID from the engine; preserve capsule + category text rather than display a misleading specific sticker |

Leanny's `js/Utility.js` confirms `IconCardPack_00`, the ticket icon families, `IconNameplate_02`/`03`, and `GearPowerTicketBase` as category graphics. Other item assets were checked for existence in the repository. Data from `engine/shellout.mjs` only predicts type/subtype; it **does not identify** an exact random locker sticker, figure, emote, banner, or specific ticket subtype. Do not present representative imagery as an exact reward.

## Rights, availability and fallbacks

The artwork and game marks remain the property of Nintendo and the respective rights holders. A public GitHub file or source link does not necessarily convey redistribution or reuse permission. Images are requested from GitHub's raw CDN; no Nintendo artwork or proprietary font bytes are stored in this repository. A missing/blocked image hides gracefully, while the capsule and Korean item name remain.

## Tests

- `tests/interactive-forecast.test.mjs` checks preview interaction source, non-mutating handler, category assets, mobile grid, and reproducible single-file generation.
- Use `node --test tests/*.test.mjs` for automated checks.
- Real-game validation remains separate and requires sufficient held-out records; three owner-observed matches are a smoke test, not full engine certification.
- Physical iPhone Safari should still be used to visually confirm the 10-column grid, reward examples, and separate one-tap record action.
