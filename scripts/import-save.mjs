#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { defaultSaveDir, shortType } from "./game-data.mjs";
import { readZipEntry } from "./zip.mjs";

const savePath = process.argv[2] || path.join(defaultSaveDir, "Manual_31_Cranach__New_Save__23_32_43.zks");
const indexPath = process.argv[3] || "data/rogue-trader-index.json";
const outFile = process.argv[4] || "data/last-save-party.json";

const [saveBuffer, indexRaw] = await Promise.all([
  readFile(savePath),
  readFile(indexPath, "utf8")
]);

const index = JSON.parse(indexRaw);
const party = JSON.parse(readZipEntry(saveBuffer, "party.json").toString("utf8"));
const itemById = buildItemMap(party);
const units = (party.m_EntityData || []).filter((entity) =>
  String(entity.$type || "").includes("UnitEntity")
);

const characters = units
  .map((unit) => summarizeUnit(unit, index.byGuid || {}, itemById))
  .filter((unit) => unit.blueprint || unit.name || unit.factCount > 0)
  .sort((a, b) => Number(b.isInParty) - Number(a.isInParty) || b.factCount - a.factCount);

const result = {
  schemaVersion: 1,
  importedAt: new Date().toISOString(),
  savePath,
  indexPath,
  unitCount: units.length,
  characters
};

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Read ${units.length} unit entities from ${path.basename(savePath)}`);
console.log(`Wrote ${characters.length} unit summaries to ${outFile}`);
console.log("");
for (const character of characters.slice(0, 12)) {
  const label = character.name || character.blueprintName || character.entityId || "Unnamed unit";
  const flags = [character.isInParty ? "party" : "", character.isPlayerFaction ? "player-faction" : ""]
    .filter(Boolean)
    .join(", ");
  const bs = character.estimatedStats.BallisticSkill;
  const ws = character.estimatedStats.WeaponSkill;
  console.log(`${label} | lvl ${character.level ?? "?"} | BS ${bs ?? "?"} | WS ${ws ?? "?"} | facts: ${character.factCount} | ${flags || "unknown"}`);
}

function summarizeUnit(unit, byGuid, itemById) {
  const facts = collectFacts(unit, byGuid);
  const blueprint = unit.Blueprint || unit.m_Blueprint || unit.BlueprintRef || unit.m_BlueprintRef;
  const blueprintEntry = byGuid[blueprint];
  const stats = extractStats(unit);
  const inventory = extractInventory(unit, byGuid, itemById);

  return {
    entityId: unit.UniqueId || unit.m_UniqueId || unit.Id || unit.EntityId,
    name: extractName(unit, blueprintEntry),
    blueprint,
    blueprintName: blueprintEntry?.name,
    isInParty: Boolean(unit.IsInGameParty || unit.m_IsInGameParty || unit.IsInParty),
    isPlayerFaction: JSON.stringify(unit).includes("Player") || JSON.stringify(unit).includes("Party"),
    level: extractLevel(unit, facts),
    stats,
    estimatedStats: estimateStats(stats, facts),
    inventory,
    factCount: facts.length,
    factsByType: countFactsByType(facts),
    facts: facts.slice(0, 400)
  };
}

function collectFacts(unit, byGuid) {
  const rawFacts = unit.Facts?.m_Facts || unit.m_Facts?.m_Facts || [];
  return rawFacts
    .map((fact) => {
      const guid = fact.Blueprint || fact.m_Blueprint || fact.m_Context?.AssociatedBlueprint;
      const entry = byGuid[guid];
      return {
        guid,
        name: entry?.name || guid,
        type: entry?.type || shortType(fact.$type),
        rank: fact.Rank,
        active: fact.IsActive,
        temporary: fact.IsTemporary
      };
    })
    .filter((fact) => fact.guid);
}

function countFactsByType(facts) {
  const counts = {};
  for (const fact of facts) {
    counts[fact.type] = (counts[fact.type] || 0) + 1;
  }
  return counts;
}

function extractName(unit, blueprintEntry) {
  const candidates = [
    unit.CharacterName,
    unit.m_CharacterName,
    unit.CustomName,
    unit.m_CustomName,
    unit.View?.CharacterName,
    unit.Descriptor?.CustomName,
    unit.Descriptor?.m_CustomName,
    unit.Progression?.CharacterName,
    blueprintEntry?.name
  ];

  for (const candidate of candidates) {
    const text = valueToText(candidate);
    if (text) return text;
  }

  return "";
}

function valueToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      value.Text ||
      value.text ||
      value.Value ||
      value.value ||
      value.m_text ||
      value.m_Key ||
      value.Shared?.stringkey ||
      ""
    );
  }
  return "";
}

function extractLevel(unit, facts) {
  const progression = unit.Progression || unit.Descriptor?.Progression || {};
  const candidates = [
    progression.ExperienceLevel,
    progression.CharacterLevel,
    progression.Level,
    unit.ExperienceLevel,
    unit.CharacterLevel,
    unit.Level
  ];

  for (const candidate of candidates) {
    if (Number.isFinite(candidate)) return candidate;
  }

  const careerFacts = facts.filter((fact) => /Career|Archetype|Origin|Homeworld/i.test(fact.name));
  return careerFacts.reduce((sum, fact) => sum + Number(fact.rank || 0), 0) || null;
}

function extractStats(unit) {
  const result = {};
  const statContainer = (unit.Parts?.Container || []).find((part) =>
    String(part.$type || "").includes("PartStatsContainer")
  );
  const entries = statContainer?.Container?.ContainerConverter || [];
  const statNames = [
    "HitPoints",
    "Speed",
    "WarhammerBallisticSkill",
    "WarhammerWeaponSkill",
    "WarhammerStrength",
    "WarhammerToughness",
    "WarhammerAgility",
    "WarhammerIntelligence",
    "WarhammerPerception",
    "WarhammerWillpower",
    "WarhammerFellowship",
    "WarhammerDeflection",
    "WarhammerArmor",
    "WarhammerDodge"
  ];

  for (const stat of statNames) {
    const entry = entries.find((item) => item.Key === stat);
    if (entry?.Value?.m_BaseValue !== undefined) {
      result[stat.replace("Warhammer", "")] = Number(entry.Value.m_BaseValue);
    }
  }

  return result;
}

function estimateStats(baseStats, facts) {
  const estimated = { ...baseStats };
  const statNames = [
    "BallisticSkill",
    "WeaponSkill",
    "Strength",
    "Toughness",
    "Agility",
    "Intelligence",
    "Perception",
    "Willpower",
    "Fellowship"
  ];

  for (const stat of statNames) {
    estimated[stat] ??= 30;
  }

  for (const fact of facts) {
    for (const stat of statNames) {
      if (!fact.name.includes(stat)) continue;

      if (/AttributeAdvancement/i.test(fact.name)) {
        estimated[stat] += 5 * Number(fact.rank || 1);
      }

      const explicitBonus = fact.name.match(new RegExp(`${stat}(5|10|15)_Feature`, "i"));
      if (explicitBonus) {
        estimated[stat] += Number(explicitBonus[1]) * Number(fact.rank || 1);
      }
    }

    const innate = fact.name.match(/Innate_([A-Za-z]+)$/);
    if (innate && estimated[innate[1]] !== undefined) {
      estimated[innate[1]] += 5 * Number(fact.rank || 1);
    }
  }

  return estimated;
}

function buildItemMap(root) {
  const items = new Map();
  walk(root);
  return items;

  function walk(value) {
    if (!value || typeof value !== "object") return;
    if (value.UniqueId && value.Blueprint && String(value.$type || "").includes("ItemEntity")) {
      items.set(value.UniqueId, value);
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else {
      for (const item of Object.values(value)) walk(item);
    }
  }
}

function extractInventory(unit, byGuid, itemById) {
  const body = (unit.Parts?.Container || []).find((part) =>
    String(part.$type || "").includes("PartUnitBody")
  );
  if (!body) return [];

  const currentSet = Number(body.m_CurrentHandsEquipmentSetIndex || 0);
  const refs = [];

  for (const [index, set] of (body.m_HandsEquipmentSets || []).entries()) {
    pushRef(refs, `Weapon Set ${index + 1} Primary`, set.PrimaryHand, "weapon", index === currentSet);
    pushRef(refs, `Weapon Set ${index + 1} Secondary`, set.SecondaryHand, "weapon", index === currentSet);
  }

  for (const [index, slot] of (body.m_QuickSlots || []).entries()) {
    pushRef(refs, `Quick Slot ${index + 1}`, slot, "quick", Boolean(slot?.m_Active));
  }

  for (const slot of ["Armor", "Shirt", "Belt", "Head", "Glasses", "Feet", "Gloves", "Neck", "Ring1", "Ring2", "Wrist", "Shoulders", "PetProtocol"]) {
    pushRef(refs, slot, body[slot], slot === "Armor" ? "armor" : "equipment", Boolean(body[slot]?.m_Active));
  }

  const chosenWeapon = (unit.Parts?.Container || []).find((part) =>
    String(part.$type || "").includes("WarhammerUnitPartChooseWeapon")
  )?.m_WeaponRef;

  return refs
    .map((ref) => resolveItemRef(ref, byGuid, itemById, chosenWeapon))
    .filter(Boolean);
}

function pushRef(refs, slot, value, category, active) {
  if (value?.m_ItemRef) {
    refs.push({ slot, itemId: value.m_ItemRef, category, active });
  }
}

function resolveItemRef(ref, byGuid, itemById, chosenWeapon) {
  const item = itemById.get(ref.itemId);
  if (!item?.Blueprint) return null;
  const entry = byGuid[item.Blueprint];
  return {
    itemId: ref.itemId,
    guid: item.Blueprint,
    name: entry?.name || item.Blueprint,
    type: entry?.type || "Item",
    weaponStats: entry?.weaponStats,
    weaponAbilities: entry?.weaponAbilities,
    slot: ref.slot,
    category: ref.category,
    active: ref.active,
    chosen: ref.itemId === chosenWeapon,
    ammo: item.CurrentAmmo,
    charges: item.Charges,
    abilities: (item.Abilities || [])
      .map((ability) => ability?.Blueprint || ability?.Data?.Blueprint)
      .filter(Boolean)
      .map((guid) => ({
        guid,
        name: byGuid[guid]?.name || guid,
        type: byGuid[guid]?.type || "Ability"
      }))
  };
}
