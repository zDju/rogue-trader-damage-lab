# Rogue Trader Damage Lab

A local web calculator for Warhammer 40,000: Rogue Trader damage experiments.

Run a local server and open the app through HTTP so the browser can load bundled static data:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

Presets are stored in browser `localStorage`. The app loads `data/rogue-trader-index.json` automatically. Use **Import Save** for `.zks` save files; users should not import the static game database manually.

## Direction

The app now separates two kinds of data:

- Static game data: generated once from the installed base game and stored in `data/rogue-trader-index.json`.
- Personal save data: imported from a `.zks` save in the browser, or with the helper script into `data/last-save-party.json`.

This means users should not have to import the full game database every time. The full static index can be regenerated when the game updates, DLC changes data, or mods are added.

## Data Commands

Generate the bundled static blueprint index:

```bash
npm run extract:static
```

Import the latest discovered save into a readable party summary:

```bash
npm run import:save
```

Import a specific save:

```bash
node scripts/import-save.mjs "/path/to/save.zks"
```

Run syntax checks:

```bash
npm run check
```

## Current Scope

- Character presets with archetype, hit, crit, armor penetration, and talent notes.
- Enemy presets with health, armor, deflection, dodge, parry, and resistance.
- Attack setup with damage range, hit count, damage bonuses, flat bonuses, armor penetration, and damage type.
- Buff/debuff presets that can alter hit, crit, damage, armor penetration, enemy armor, enemy dodge, and enemy deflection.
- Configurable formula settings for mitigation order, minimum damage, difficulty damage multiplier, dodge behavior, parry, and direct damage.
- Static blueprint extraction from `Bundles/cheatdata.json`.
- Save parsing from `.zks` archives.
- Party summary generation with resolved feature/talent/buff names and estimated combat attributes.

## Local Rogue Trader Paths Found

On this machine, the Windows Steam install is readable from Manjaro:

```text
/run/media/zdju/D8BEC4B8BEC49104/Program Files (x86)/Steam/steamapps/common/Warhammer 40,000 Rogue Trader
```

Useful files and folders:

```text
Bundles/cheatdata.json
Bundles/blueprints-pack.bbp
Bundles/blueprint.assets
/run/media/zdju/D8BEC4B8BEC49104/Users/zDju/AppData/LocalLow/Owlcat Games/Warhammer 40000 Rogue Trader/Saved Games
/run/media/zdju/D8BEC4B8BEC49104/Users/zDju/AppData/LocalLow/Owlcat Games/Warhammer 40000 Rogue Trader/GameLogFull.txt
```

The static extractor imports `cheatdata.json`. It keeps combat-relevant blueprint categories such as buffs, features, abilities, weapons, armor, units, career paths, origin paths, and attribute/skill advancements.

Generated local files:

```text
data/rogue-trader-index.json
data/last-save-party.json
```

## Accuracy Notes

This is a calibration-first tool. Owlcat's public modding template states that Rogue Trader static game data is represented by JSON blueprint files (`.jbp`) and that built-in blueprint metadata can be read from game data such as `Bundles/cheatdata.json`.

That means we should avoid manually entering hundreds of talents long-term. The practical path is:

1. Use the generated static index to resolve save GUIDs into readable names.
2. Import `.zks` saves to list real party members, levels, facts, talents, abilities, and equipment references.
3. Convert known blueprint effects into structured buff/debuff presets.
4. Collect a few in-game combat log examples.
5. Tune formula settings until the calculator matches those examples.

Do not share Steam credentials or account tokens. Local save files, combat logs, and extracted blueprint data are enough.
