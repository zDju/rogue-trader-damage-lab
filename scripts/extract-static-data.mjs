#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractWeaponBlueprint, loadBlueprintPack } from "./blueprint-pack.mjs";
import {
  defaultGameRoot,
  groupByType,
  isRelevantBlueprint,
  normalizeBlueprint
} from "./game-data.mjs";

const gameRoot = process.argv[2] || defaultGameRoot;
const outFile = process.argv[3] || "data/rogue-trader-index.json";
const cheatDataPath = path.join(gameRoot, "Bundles", "cheatdata.json");
const blueprintPackPath = path.join(gameRoot, "Bundles", "blueprints-pack.bbp");

const raw = await readFile(cheatDataPath, "utf8");
const cheatData = JSON.parse(raw);
let entries = cheatData.Entries
  .filter(isRelevantBlueprint)
  .map((entry) => normalizeBlueprint(entry))
  .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

const byGuid = Object.fromEntries(entries.map((entry) => [entry.guid, entry]));
const pack = await loadBlueprintPack(blueprintPackPath);
let enrichedWeapons = 0;

entries = entries.map((entry) => {
  if (entry.type !== "BlueprintItemWeapon") return entry;
  const weapon = extractWeaponBlueprint(pack, entry.guid, byGuid, entry.name);
  if (!weapon?.stats?.damageMin) return entry;
  enrichedWeapons += 1;
  return {
    ...entry,
    weaponStats: weapon.stats,
    weaponAbilities: weapon.abilities,
    blueprintRecord: {
      offset: weapon.recordOffset,
      length: weapon.recordLength
    }
  };
});

const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: cheatDataPath,
  blueprintPack: blueprintPackPath,
  totalSourceEntries: cheatData.Entries.length,
  enrichedWeapons,
  entries,
  byGuid: Object.fromEntries(entries.map((entry) => [entry.guid, entry])),
  byType: groupByType(entries)
};

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(index, null, 2)}\n`);

console.log(`Wrote ${entries.length} relevant blueprints to ${outFile}`);
console.log(`Source entries: ${cheatData.Entries.length}`);
console.log(`Enriched weapons: ${enrichedWeapons}`);
