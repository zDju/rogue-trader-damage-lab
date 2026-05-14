export const defaultGameRoot =
  "/run/media/zdju/D8BEC4B8BEC49104/Program Files (x86)/Steam/steamapps/common/Warhammer 40,000 Rogue Trader";

export const defaultSaveDir =
  "/run/media/zdju/D8BEC4B8BEC49104/Users/zDju/AppData/LocalLow/Owlcat Games/Warhammer 40000 Rogue Trader/Saved Games";

export const relevantBlueprintTypes = new Set([
  "BlueprintAbility",
  "BlueprintAttributeAdvancement",
  "BlueprintArmorType",
  "BlueprintBuff",
  "BlueprintCareerPath",
  "BlueprintFeature",
  "BlueprintFeatureSelection_Obsolete",
  "BlueprintItem",
  "BlueprintItemArmor",
  "BlueprintItemEquipmentFeet",
  "BlueprintItemEquipmentGloves",
  "BlueprintItemEquipmentHead",
  "BlueprintItemEquipmentNeck",
  "BlueprintItemEquipmentRing",
  "BlueprintItemEquipmentShoulders",
  "BlueprintItemEquipmentUsable",
  "BlueprintItemWeapon",
  "BlueprintOriginPath",
  "BlueprintSelectionFeature",
  "BlueprintShipPostExpertise",
  "BlueprintSkillAdvancement",
  "BlueprintUnit",
  "BlueprintUnitFact",
  "BlueprintUnitType",
  "BlueprintWeaponType"
]);

export function shortType(typeName) {
  return String(typeName || "").split(",")[0].split(".").pop();
}

export function normalizeBlueprint(entry, source = "cheatdata.json") {
  return {
    guid: entry.Guid,
    name: entry.Name || entry.Guid,
    type: shortType(entry.TypeFullName),
    typeFullName: entry.TypeFullName,
    source
  };
}

export function isRelevantBlueprint(entry) {
  return relevantBlueprintTypes.has(shortType(entry.TypeFullName));
}

export function groupByType(entries) {
  const grouped = {};
  for (const entry of entries) {
    grouped[entry.type] ??= [];
    grouped[entry.type].push(entry.guid);
  }
  return grouped;
}
