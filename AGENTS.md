# Rogue Trader Damage Lab Handoff

## What We Built

- Created a local static web app for Warhammer 40,000: Rogue Trader damage experiments.
- Added character, enemy, attack, settings, and buff/debuff preset editing.
- Added import/export for app presets through JSON.
- Added automatic loading of local static game data from `data/rogue-trader-index.json`.
- Added `.zks` save import in the browser using the save archive's `party.json`.
- Added a CLI save importer that writes a readable local party summary to `data/last-save-party.json`.
- Added extraction scripts for static Rogue Trader data from the local Steam install.
- Parsed `Bundles/blueprints-pack.bbp` enough to enrich weapon blueprints with damage range, penetration, damage type, ammo, range, and rate of fire.
- Wired imported save weapons into the attack form, so selecting a character weapon fills damage, damage type, penetration, and burst hit count where known.

## Current Local Setup

- App URL when the dev server is running: `http://127.0.0.1:4173`
- Dev command: `npm run dev`
- Syntax check: `npm run check`
- Static extraction: `npm run extract:static`
- Static extraction with explicit install path: `npm run extract:static -- "/path/to/Warhammer 40,000 Rogue Trader"`
- Save import CLI: `node scripts/import-save.mjs "/path/to/save.zks"`

## Resuming On Another Computer

Clone the private playground repo, regenerate static data from that computer's local Rogue Trader install, then run the dev server:

```bash
git clone https://github.com/zDju/rogue-trader-damage-lab.git
cd rogue-trader-damage-lab
npm run extract:static -- "/path/to/Warhammer 40,000 Rogue Trader"
npm run dev
```

Then import that machine's `.zks` save through the app. The generated files below are intentionally not in GitHub, so this regeneration/import step is expected.

## Local Git Notes

This environment has a read-only empty `.git` placeholder, so the local repository metadata was initialized in `.git-local` instead.

Use this form for local Git commands:

```bash
git --git-dir=.git-local --work-tree=. status
git --git-dir=.git-local --work-tree=. log --oneline
```

Current local branch:

```text
main
```

Initial commit:

```text
29b926a Initial Rogue Trader damage lab
```

Known local Rogue Trader install path:

```text
/run/media/zdju/D8BEC4B8BEC49104/Program Files (x86)/Steam/steamapps/common/Warhammer 40,000 Rogue Trader
```

Known local save path:

```text
/run/media/zdju/D8BEC4B8BEC49104/Users/zDju/AppData/LocalLow/Owlcat Games/Warhammer 40000 Rogue Trader/Saved Games
```

Copied test save:

```text
/home/zdju/Downloads/Manual_31_Cranach__New_Save__23_32_43.zks
```

## Generated Local Data

These files are generated locally and should normally stay out of GitHub:

```text
data/rogue-trader-index.json
data/last-save-party.json
```

Reason:

- `rogue-trader-index.json` is derived from installed game files.
- `last-save-party.json` contains personal save/party data.

## Verification Done

- `npm run check` passes.
- Static extraction generated 15,551 relevant blueprints from 156,964 source entries.
- Weapon enrichment currently covers 633 weapon blueprints.
- Save import read 9 unit entities from the copied `.zks` save.
- Sample enriched weapons verified:
  - `HeavyBolter_Item`: 10-25 Kinetic, 0% penetration, RoF 8.
  - `MarksmanRifle_Item`: 21-25 Kinetic, 15% penetration.
  - `FlamerPistolCH2Unique_Item`: 13-19 Fire, 5% penetration, RoF 6.

## Next Planned Work

1. Improve weapon action handling.
   - Separate single shot, burst, melee, area, flamer/template, and psychic actions more accurately.
   - Use selected weapon ability data instead of only name heuristics where possible.

2. Extract structured effect data from talents, buffs, abilities, and features.
   - Start with common player-visible buffs/debuffs.
   - Convert reliable effects into modifier presets.
   - Keep unknown effects visible as names only.

3. Improve damage formula accuracy.
   - Add combat log calibration inputs.
   - Compare predicted vs observed hit/damage examples.
   - Tune mitigation order, deflection, armor, dodge, parry, crits, difficulty, and minimum damage behavior.

4. Improve imported character presets.
   - Derive hit/crit/armor penetration from actual stats, equipment, talents, and active buffs when possible.
   - Show equipped weapon sets and chosen weapon more clearly.

5. UI pass.
   - Make the imported character panel easier to scan.
   - Add clearer weapon stat display.
   - Improve mobile layout and dense controls.

6. Repository cleanup.
   - Keep generated proprietary/personal JSON out of public commits.
   - Document the regenerate-data workflow for local use.
   - Decide later whether a private repo should include generated static data for personal convenience.
