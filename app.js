const STORAGE_KEY = "rt-damage-lab-state-v1";
const STATIC_INDEX_PATH = "data/rogue-trader-index.json";
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

let gameIndex = {
  entries: [],
  byGuid: {}
};

const demoState = {
  selectedCharacterId: "argenta",
  selectedEnemyId: "rebel",
  selectedModifierId: "expose-weakness",
  characters: [
    {
      id: "argenta",
      name: "Argenta",
      archetype: "Soldier",
      skill: 55,
      perception: 40,
      hitChance: 75,
      critChance: 10,
      critMultiplier: 1.5,
      armorPen: 10,
      talents: "Rapid fire build placeholder\nAdd exact talent effects as modifiers"
    }
  ],
  enemies: [
    {
      id: "rebel",
      name: "Armored Rebel",
      health: 42,
      armor: 35,
      deflection: 3,
      dodge: 20,
      parry: 0,
      resistance: 0,
      notes: "Example target"
    }
  ],
  attack: {
    name: "Burst shot",
    damageType: "Kinetic",
    minDamage: 8,
    maxDamage: 12,
    hits: 3,
    flatBonus: 0,
    damageBonus: 0,
    extraArmorPen: 0
  },
  settings: {
    difficultyDamage: 100,
    dodgeMode: "flat",
    mitigationOrder: "deflectionThenArmor",
    minimumDamage: 1,
    includeParry: false,
    directIgnoresArmor: true
  },
  modifiers: [
    {
      id: "expose-weakness",
      name: "Expose Weakness",
      target: "enemy",
      active: true,
      hitBonus: 0,
      critBonus: 0,
      damageBonus: 0,
      flatDamage: 0,
      armorPenBonus: 0,
      enemyArmorBonus: -15,
      enemyDodgeBonus: -10,
      enemyDeflectionBonus: 0
    },
    {
      id: "controlled-shot",
      name: "Controlled Shot",
      target: "attacker",
      active: false,
      hitBonus: 10,
      critBonus: 0,
      damageBonus: 0,
      flatDamage: 0,
      armorPenBonus: 0,
      enemyArmorBonus: 0,
      enemyDodgeBonus: 0,
      enemyDeflectionBonus: 0
    }
  ],
  catalog: []
};

let state = loadState();

const characterForm = document.querySelector("#characterForm");
const enemyForm = document.querySelector("#enemyForm");
const attackForm = document.querySelector("#attackForm");
const settingsForm = document.querySelector("#settingsForm");
const modifierForm = document.querySelector("#modifierForm");
const importedWeaponSelect = document.querySelector("#importedWeaponSelect");

const characterList = document.querySelector("#characterList");
const enemyList = document.querySelector("#enemyList");
const modifierList = document.querySelector("#modifierList");
const catalogList = document.querySelector("#catalogList");
const saveCharacterDetails = document.querySelector("#saveCharacterDetails");

const numberFields = new Set([
  "skill",
  "perception",
  "hitChance",
  "critChance",
  "critMultiplier",
  "armorPen",
  "health",
  "armor",
  "deflection",
  "dodge",
  "parry",
  "resistance",
  "minDamage",
  "maxDamage",
  "hits",
  "flatBonus",
  "damageBonus",
  "extraArmorPen",
  "difficultyDamage",
  "minimumDamage",
  "hitBonus",
  "critBonus",
  "flatDamage",
  "armorPenBonus",
  "enemyArmorBonus",
  "enemyDodgeBonus",
  "enemyDeflectionBonus"
]);

const relevantBlueprintTypes = new Set([
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return clone(demoState);

  try {
    const loaded = { ...clone(demoState), ...JSON.parse(raw) };
    loaded.catalog = [];
    return loaded;
  } catch {
    return clone(demoState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, catalog: [] }));
}

function formToObject(form, base = {}) {
  const data = { ...base };
  for (const element of form.elements) {
    if (!element.name) continue;
    if (element.type === "checkbox") {
      data[element.name] = element.checked;
    } else if (numberFields.has(element.name)) {
      data[element.name] = Number(element.value || 0);
    } else {
      data[element.name] = element.value;
    }
  }
  return data;
}

function objectToForm(form, data) {
  for (const element of form.elements) {
    if (!element.name || data[element.name] === undefined) continue;
    if (element.type === "checkbox") {
      element.checked = Boolean(data[element.name]);
    } else {
      element.value = data[element.name];
    }
  }
}

function selectedCharacter() {
  return state.characters.find((item) => item.id === state.selectedCharacterId) || state.characters[0];
}

function selectedEnemy() {
  return state.enemies.find((item) => item.id === state.selectedEnemyId) || state.enemies[0];
}

function selectedModifier() {
  return state.modifiers.find((item) => item.id === state.selectedModifierId) || state.modifiers[0];
}

function modifierSummary(modifier) {
  const parts = [];
  if (modifier.hitBonus) parts.push(`${modifier.hitBonus > 0 ? "+" : ""}${modifier.hitBonus}% hit`);
  if (modifier.critBonus) parts.push(`${modifier.critBonus > 0 ? "+" : ""}${modifier.critBonus}% crit`);
  if (modifier.damageBonus) parts.push(`${modifier.damageBonus > 0 ? "+" : ""}${modifier.damageBonus}% damage`);
  if (modifier.flatDamage) parts.push(`${modifier.flatDamage > 0 ? "+" : ""}${modifier.flatDamage} damage`);
  if (modifier.armorPenBonus) parts.push(`${modifier.armorPenBonus > 0 ? "+" : ""}${modifier.armorPenBonus}% pen`);
  if (modifier.enemyArmorBonus) parts.push(`${modifier.enemyArmorBonus > 0 ? "+" : ""}${modifier.enemyArmorBonus}% armor`);
  if (modifier.enemyDodgeBonus) parts.push(`${modifier.enemyDodgeBonus > 0 ? "+" : ""}${modifier.enemyDodgeBonus}% dodge`);
  if (modifier.enemyDeflectionBonus) parts.push(`${modifier.enemyDeflectionBonus > 0 ? "+" : ""}${modifier.enemyDeflectionBonus} deflection`);
  return parts.join(", ") || "No numeric effect yet";
}

function renderPresetList(container, items, selectedId, onSelect) {
  container.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preset-item${item.id === selectedId ? " active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(presetSubtitle(item))}</span>`;
    button.addEventListener("click", () => onSelect(item.id));
    container.append(button);
  }
}

function presetSubtitle(item) {
  if (item.saveData) {
    const stats = item.saveData.estimatedStats || {};
    const level = item.saveData.level ? `Lv ${item.saveData.level}` : "Save import";
    const skills = `BS ${stats.BallisticSkill ?? "?"} / WS ${stats.WeaponSkill ?? "?"}`;
    return [level, item.archetype, skills].filter(Boolean).join(" - ");
  }

  return item.archetype || item.notes || `${item.health || 0} HP`;
}

function renderModifiers() {
  modifierList.innerHTML = "";
  for (const modifier of state.modifiers) {
    const row = document.createElement("label");
    row.className = `modifier-item${modifier.id === state.selectedModifierId ? " active" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(modifier.active);
    checkbox.addEventListener("change", () => {
      modifier.active = checkbox.checked;
      saveState();
      render();
    });

    const body = document.createElement("div");
    body.innerHTML = `<strong>${escapeHtml(modifier.name)}</strong><span>${escapeHtml(modifierSummary(modifier))}</span>`;
    body.addEventListener("click", () => {
      state.selectedModifierId = modifier.id;
      render();
    });

    row.append(checkbox, body);
    modifierList.append(row);
  }
}

function renderCatalog() {
  const query = document.querySelector("#catalogSearch").value.trim().toLowerCase();
  const entries = gameIndex.entries
    .filter((entry) => !query || `${entry.name} ${entry.type}`.toLowerCase().includes(query))
    .slice(0, 80);

  document.querySelector("#catalogCount").textContent = `${gameIndex.entries.length.toLocaleString()} entries`;
  catalogList.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "catalog-item";
    empty.innerHTML = "<span>Bundled data is not loaded yet.</span>";
    catalogList.append(empty);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "catalog-item";
    item.innerHTML = `<strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.type || "Unknown type")}</span><span>${escapeHtml(entry.guid || "")}</span>`;
    catalogList.append(item);
  }
}

function render() {
  if (!selectedCharacter()) {
    state.characters.push(clone(demoState.characters[0]));
    state.selectedCharacterId = state.characters[0].id;
  }
  if (!selectedEnemy()) {
    state.enemies.push(clone(demoState.enemies[0]));
    state.selectedEnemyId = state.enemies[0].id;
  }
  if (!selectedModifier()) {
    state.modifiers.push(clone(demoState.modifiers[0]));
    state.selectedModifierId = state.modifiers[0].id;
  }

  renderPresetList(characterList, state.characters, state.selectedCharacterId, (id) => {
    state.selectedCharacterId = id;
    saveState();
    render();
  });
  renderPresetList(enemyList, state.enemies, state.selectedEnemyId, (id) => {
    state.selectedEnemyId = id;
    saveState();
    render();
  });
  renderModifiers();
  renderCatalog();

  objectToForm(characterForm, selectedCharacter());
  objectToForm(enemyForm, selectedEnemy());
  objectToForm(attackForm, state.attack);
  objectToForm(settingsForm, state.settings);
  objectToForm(modifierForm, selectedModifier());
  renderImportedWeaponSelect();
  renderSaveCharacterDetails();
  updateCalculation();
}

function renderImportedWeaponSelect() {
  const weapons = selectedCharacter()?.saveData?.inventory?.filter((item) => item.category === "weapon") || [];
  importedWeaponSelect.innerHTML = "";

  if (!weapons.length) {
    importedWeaponSelect.disabled = true;
    importedWeaponSelect.append(new Option("No imported save weapon selected", ""));
    return;
  }

  importedWeaponSelect.disabled = false;
  importedWeaponSelect.append(new Option("Choose imported weapon or ability", ""));

  for (const weapon of weapons) {
    const weaponLabel = `${weapon.slot}: ${cleanBlueprintName(weapon.name)}${weapon.chosen ? " (chosen)" : ""}`;
    importedWeaponSelect.append(new Option(weaponLabel, `${weapon.itemId}::`));
    for (const ability of combinedWeaponAbilities(weapon)) {
      importedWeaponSelect.append(new Option(`  ${cleanBlueprintName(ability.name)}`, `${weapon.itemId}::${ability.guid}`));
    }
  }
}

function applyImportedWeaponSelection() {
  const [itemId, abilityGuid] = importedWeaponSelect.value.split("::");
  if (!itemId) return;

  const weapon = selectedCharacter()?.saveData?.inventory?.find((item) => item.itemId === itemId);
  if (!weapon) return;

  const ability = combinedWeaponAbilities(weapon).find((item) => item.guid === abilityGuid);
  const label = ability?.name || weapon.name;
  const stats = weapon.weaponStats || {};
  state.attack.name = cleanBlueprintName(label);
  state.attack.damageType = inferImportedDamageType(stats, label);
  if (Number.isFinite(stats.damageMin)) state.attack.minDamage = stats.damageMin;
  if (Number.isFinite(stats.damageMax)) state.attack.maxDamage = stats.damageMax;
  if (Number.isFinite(stats.penetration)) state.attack.extraArmorPen = stats.penetration;
  state.attack.hits = estimateImportedHits(stats, ability, weapon);
  saveState();
  objectToForm(attackForm, state.attack);
  updateCalculation();
}

function inferImportedDamageType(stats, label) {
  const nameType = inferDamageType(label);
  if (nameType !== "Kinetic") return nameType;
  return stats.damageType || nameType;
}

function estimateImportedHits(stats, ability, weapon) {
  const label = `${ability?.name || ""} ${weapon?.name || ""}`;
  if (/burst|fullauto|full_auto|rapid/i.test(label)) return Math.max(1, Number(stats.rateOfFire || 1));
  return 1;
}

function combinedWeaponAbilities(weapon) {
  const abilities = new Map();
  for (const ability of [...(weapon.abilities || []), ...(weapon.weaponAbilities || [])]) {
    if (ability?.guid) abilities.set(ability.guid, ability);
  }
  return [...abilities.values()];
}

function inferDamageType(label) {
  const text = String(label).toLowerCase();
  if (/flame|fire|melta|inferno/.test(text)) return "Fire";
  if (/plasma|las|lance|shock|voltaic|electric|arc/.test(text)) return "Energy";
  if (/warp|psy|force|sanctic|telepathy|biomancer|divination/.test(text)) return "Warp";
  if (/toxic|poison|needle|splinter/.test(text)) return "Toxic";
  return "Kinetic";
}

function renderSaveCharacterDetails() {
  const character = selectedCharacter();
  if (!character?.saveData) {
    saveCharacterDetails.innerHTML = "";
    return;
  }

  const saveData = character.saveData;
  const stats = saveData.estimatedStats || saveData.stats || {};
  const groups = groupDisplayFacts(saveData.facts || []);
  const inventory = saveData.inventory || [];
  const weapons = inventory.filter((item) => item.category === "weapon");
  const equipment = inventory.filter((item) => item.category !== "weapon");

  saveCharacterDetails.innerHTML = [
    `<div class="save-title"><strong>Imported Save Data</strong><span>${escapeHtml(saveData.saveName || "Current save")}</span></div>`,
    renderStatGrid(stats),
    `<div class="fact-groups">${[
      renderFactGroup("Careers", groups.careers),
      renderEquipmentGroup("Weapons", weapons),
      renderEquipmentGroup("Equipment", equipment),
      renderFactGroup("Talents & Features", groups.talents),
      renderFactGroup("Abilities", groups.abilities),
      renderFactGroup("Buffs", groups.buffs)
    ].join("")}</div>`
  ].join("");
}

function renderStatGrid(stats) {
  const statRows = [
    ["BS", stats.BallisticSkill],
    ["WS", stats.WeaponSkill],
    ["STR", stats.Strength],
    ["TGH", stats.Toughness],
    ["AGI", stats.Agility],
    ["INT", stats.Intelligence],
    ["PER", stats.Perception],
    ["WIL", stats.Willpower],
    ["FEL", stats.Fellowship],
    ["SPD", stats.Speed]
  ];

  return `<div class="stat-grid">${statRows
    .map(([label, value]) => `<div class="stat-chip"><span>${label}</span><strong>${escapeHtml(value ?? "-")}</strong></div>`)
    .join("")}</div>`;
}

function renderFactGroup(title, items) {
  const visible = [...new Set(items.filter(Boolean))].slice(0, 32);
  if (!visible.length) return "";
  return `<section class="fact-group"><h4>${escapeHtml(title)}</h4><div class="tag-list">${visible
    .map((item) => `<span class="tag">${escapeHtml(cleanBlueprintName(item))}</span>`)
    .join("")}</div></section>`;
}

function renderEquipmentGroup(title, items) {
  if (!items.length) return "";
  return `<section class="fact-group"><h4>${escapeHtml(title)}</h4><div class="tag-list">${items
    .slice(0, 40)
    .map((item) => {
      const suffix = [
        item.chosen ? "chosen" : "",
        item.ammo !== undefined && item.ammo >= 0 ? `${item.ammo} ammo` : "",
        formatWeaponStats(item.weaponStats)
      ].filter(Boolean).join(", ");
      const label = `${item.slot}: ${cleanBlueprintName(item.name || item.guid)}${suffix ? ` (${suffix})` : ""}`;
      return `<span class="tag">${escapeHtml(label)}</span>`;
    })
    .join("")}</div></section>`;
}

function formatWeaponStats(stats) {
  if (!stats?.damageMin || !stats?.damageMax) return "";
  const parts = [`${stats.damageMin}-${stats.damageMax} ${stats.damageType || "damage"}`];
  if (Number.isFinite(stats.penetration)) parts.push(`${stats.penetration}% pen`);
  if (stats.rateOfFire) parts.push(`RoF ${stats.rateOfFire}`);
  return parts.join(", ");
}

function groupDisplayFacts(facts) {
  const groups = {
    careers: [],
    talents: [],
    abilities: [],
    buffs: []
  };

  for (const fact of facts) {
    if (/CareerPath|OriginPath/.test(fact.type)) groups.careers.push(formatFactName(fact));
    else if (/Ability/.test(fact.type)) groups.abilities.push(formatFactName(fact));
    else if (/Buff/.test(fact.type)) groups.buffs.push(formatFactName(fact));
    else if (/Feature|Advancement/.test(fact.type)) groups.talents.push(formatFactName(fact));
  }

  return groups;
}

function formatFactName(fact) {
  return `${fact.name}${fact.rank ? ` x${fact.rank}` : ""}`;
}

function activeTotals() {
  const totals = {
    hitBonus: 0,
    critBonus: 0,
    damageBonus: 0,
    flatDamage: 0,
    armorPenBonus: 0,
    enemyArmorBonus: 0,
    enemyDodgeBonus: 0,
    enemyDeflectionBonus: 0
  };

  for (const modifier of state.modifiers.filter((item) => item.active)) {
    for (const key of Object.keys(totals)) {
      totals[key] += Number(modifier[key] || 0);
    }
  }
  return totals;
}

function damageAfterMitigation(rawDamage, enemy, armorPen, settings) {
  if (state.attack.damageType === "Direct" && settings.directIgnoresArmor) {
    return Math.max(settings.minimumDamage, rawDamage);
  }

  const effectiveArmor = clamp(enemy.armor * (1 - armorPen / 100), 0, 100);
  const resistance = clamp(enemy.resistance, 0, 100);
  let damage = rawDamage * (1 - resistance / 100);

  if (settings.mitigationOrder === "armorThenDeflection") {
    damage *= 1 - effectiveArmor / 100;
    damage -= enemy.deflection;
  } else {
    damage -= enemy.deflection;
    damage *= 1 - effectiveArmor / 100;
  }

  return Math.max(settings.minimumDamage, damage);
}

function calculate() {
  const character = selectedCharacter();
  const enemyBase = selectedEnemy();
  const attack = state.attack;
  const settings = state.settings;
  const mods = activeTotals();

  const enemy = {
    ...enemyBase,
    armor: clamp(enemyBase.armor + mods.enemyArmorBonus, 0, 100),
    dodge: clamp(enemyBase.dodge + mods.enemyDodgeBonus, 0, 100),
    deflection: Math.max(0, enemyBase.deflection + mods.enemyDeflectionBonus)
  };

  const perceptionDodgeReduction = settings.dodgeMode === "perception" ? Math.floor((character.perception || 0) / 10) : 0;
  const dodgeChance = clamp(enemy.dodge - perceptionDodgeReduction, 0, 95);
  const parryChance = settings.includeParry ? clamp(enemy.parry, 0, 95) : 0;
  const hitChance = clamp((character.hitChance || 0) + mods.hitBonus, 0, 100);
  const avoidChance = 1 - (1 - dodgeChance / 100) * (1 - parryChance / 100);
  const effectiveHitChance = clamp(hitChance / 100 * (1 - avoidChance), 0, 1);
  const critChance = clamp((character.critChance || 0) + mods.critBonus, 0, 100) / 100;
  const armorPen = clamp((character.armorPen || 0) + (attack.extraArmorPen || 0) + mods.armorPenBonus, 0, 200);
  const difficulty = clamp(settings.difficultyDamage || 100, 1, 500) / 100;
  const damageBonus = 1 + ((attack.damageBonus || 0) + mods.damageBonus) / 100;
  const flatDamage = (attack.flatBonus || 0) + mods.flatDamage;

  const minRaw = Math.max(0, (attack.minDamage + flatDamage) * damageBonus * difficulty);
  const maxRaw = Math.max(0, (attack.maxDamage + flatDamage) * damageBonus * difficulty);
  const minNormal = damageAfterMitigation(minRaw, enemy, armorPen, settings);
  const maxNormal = damageAfterMitigation(maxRaw, enemy, armorPen, settings);
  const avgNormal = (minNormal + maxNormal) / 2;
  const avgCrit = avgNormal * (character.critMultiplier || 1);
  const expectedPerHit = effectiveHitChance * (avgNormal * (1 - critChance) + avgCrit * critChance);
  const expectedTotal = expectedPerHit * attack.hits;
  const minTotal = minNormal * attack.hits;
  const maxTotal = maxNormal * (character.critMultiplier || 1) * attack.hits;
  const killChance = estimateKillChance(enemy.health, minNormal, maxNormal, attack.hits, effectiveHitChance, critChance, character.critMultiplier || 1);

  return {
    expectedTotal,
    minTotal,
    maxTotal,
    effectiveHitChance,
    killChance,
    enemy,
    dodgeChance,
    parryChance,
    hitChance,
    critChance,
    armorPen,
    effectiveArmor: clamp(enemy.armor * (1 - armorPen / 100), 0, 100),
    minNormal,
    maxNormal
  };
}

function estimateKillChance(health, minDamage, maxDamage, hits, hitChance, critChance, critMultiplier) {
  if (health <= 0) return 1;
  const samples = 1200;
  let kills = 0;
  for (let i = 0; i < samples; i += 1) {
    let total = 0;
    for (let hit = 0; hit < hits; hit += 1) {
      if (Math.random() > hitChance) continue;
      const roll = minDamage + Math.random() * (maxDamage - minDamage);
      total += Math.random() < critChance ? roll * critMultiplier : roll;
    }
    if (total >= health) kills += 1;
  }
  return kills / samples;
}

function updateCalculation() {
  const result = calculate();
  document.querySelector("#expectedDamage").textContent = round(result.expectedTotal, 1);
  document.querySelector("#damageRange").textContent = `${round(result.minTotal, 1)}-${round(result.maxTotal, 1)}`;
  document.querySelector("#effectiveHit").textContent = `${round(result.effectiveHitChance * 100, 1)}%`;
  document.querySelector("#killChance").textContent = `${round(result.killChance * 100, 1)}%`;
  document.querySelector("#breakdownText").textContent = [
    `Hit chance: ${round(result.hitChance, 1)}%`,
    `Dodge after modifiers: ${round(result.dodgeChance, 1)}%`,
    `Parry included: ${round(result.parryChance, 1)}%`,
    `Effective hit: ${round(result.effectiveHitChance * 100, 1)}%`,
    `Crit chance: ${round(result.critChance * 100, 1)}%`,
    `Armor penetration: ${round(result.armorPen, 1)}%`,
    `Enemy armor after debuffs: ${round(result.enemy.armor, 1)}%`,
    `Effective armor after pen: ${round(result.effectiveArmor, 1)}%`,
    `Enemy deflection: ${round(result.enemy.deflection, 1)}`,
    `Normal hit range after mitigation: ${round(result.minNormal, 1)}-${round(result.maxNormal, 1)}`,
    "",
    "Formula note: this is configurable because Rogue Trader combat order still needs calibration against logs/screenshots."
  ].join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveSelectedCharacter() {
  Object.assign(selectedCharacter(), formToObject(characterForm, selectedCharacter()));
  saveState();
  render();
}

function saveSelectedEnemy() {
  Object.assign(selectedEnemy(), formToObject(enemyForm, selectedEnemy()));
  saveState();
  render();
}

function saveSelectedModifier() {
  Object.assign(selectedModifier(), formToObject(modifierForm, selectedModifier()));
  saveState();
  render();
}

function saveAttackAndSettings() {
  state.attack = formToObject(attackForm, state.attack);
  state.settings = formToObject(settingsForm, state.settings);
  saveState();
  updateCalculation();
}

function addCharacter() {
  const character = {
    ...clone(demoState.characters[0]),
    id: uid("character"),
    name: "New Character",
    archetype: "",
    talents: ""
  };
  state.characters.push(character);
  state.selectedCharacterId = character.id;
  saveState();
  render();
}

function addEnemy() {
  const enemy = {
    ...clone(demoState.enemies[0]),
    id: uid("enemy"),
    name: "New Enemy",
    notes: ""
  };
  state.enemies.push(enemy);
  state.selectedEnemyId = enemy.id;
  saveState();
  render();
}

function addModifier() {
  const modifier = {
    id: uid("modifier"),
    name: "New Modifier",
    target: "attacker",
    active: true,
    hitBonus: 0,
    critBonus: 0,
    damageBonus: 0,
    flatDamage: 0,
    armorPenBonus: 0,
    enemyArmorBonus: 0,
    enemyDodgeBonus: 0,
    enemyDeflectionBonus: 0
  };
  state.modifiers.push(modifier);
  state.selectedModifierId = modifier.id;
  saveState();
  render();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rogue-trader-damage-lab.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadStaticIndex() {
  const status = document.querySelector("#dataStatus");
  try {
    const response = await fetch(STATIC_INDEX_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    gameIndex = await response.json();
    gameIndex.entries ||= [];
    gameIndex.byGuid ||= Object.fromEntries(gameIndex.entries.map((entry) => [entry.guid, entry]));
    if (enrichImportedInventory()) saveState();
    status.textContent = `Bundled game data loaded: ${gameIndex.entries.length.toLocaleString()} blueprints`;
  } catch (error) {
    status.textContent = "Bundled game data failed to load. Run the local server and refresh.";
    document.querySelector("#breakdownText").textContent = [
      "Static data load failed.",
      "",
      `Path: ${STATIC_INDEX_PATH}`,
      `Error: ${error.message}`,
      "",
      "Open the app through the local dev server instead of file:// so the browser can load bundled JSON."
    ].join("\n");
  }
  render();
}

function enrichImportedInventory() {
  let changed = false;
  for (const character of state.characters) {
    for (const item of character.saveData?.inventory || []) {
      if (!item.guid) continue;
      const entry = gameIndex.byGuid[item.guid];
      if (!entry) continue;
      if (entry.weaponStats && JSON.stringify(item.weaponStats) !== JSON.stringify(entry.weaponStats)) {
        item.weaponStats = entry.weaponStats;
        changed = true;
      }
      if (entry.weaponAbilities && JSON.stringify(item.weaponAbilities) !== JSON.stringify(entry.weaponAbilities)) {
        item.weaponAbilities = entry.weaponAbilities;
        changed = true;
      }
    }
  }
  return changed;
}

async function importSaveFile(file) {
  if (!file) return;
  const status = document.querySelector("#dataStatus");
  if (!gameIndex.entries.length) {
    await loadStaticIndex();
  }

  try {
    status.textContent = `Importing save: ${file.name}`;
    const summary = await parseSaveFile(file);
    importPartySummary(summary);
    status.textContent = `Imported ${summary.characters.length} save characters from ${file.name}`;
  } catch (error) {
    status.textContent = `Save import failed: ${error.message}`;
    document.querySelector("#breakdownText").textContent = [
      "Save import failed.",
      "",
      `File: ${file.name}`,
      `Error: ${error.message}`
    ].join("\n");
  }
}

function importPartySummary(summary) {
  const importedCharacters = summary.characters.map((character) => {
    const stats = character.estimatedStats || character.stats || {};
    const career = character.facts?.find((fact) => /CareerPath$/.test(fact.type));
    const combatSkill = Math.max(stats.BallisticSkill || 0, stats.WeaponSkill || 0);
    const facts = (character.facts || [])
      .filter((fact) => /Feature|Ability|Buff|Advancement|CareerPath|OriginPath/.test(fact.type))
      .map((fact) => `${fact.type}: ${fact.name}${fact.rank ? ` x${fact.rank}` : ""}`)
      .slice(0, 120);

    return {
      id: `save-${character.entityId || uid("character")}`,
      name: readableCharacterName(character.name || character.blueprintName || "Imported Character"),
      archetype: career?.name || character.blueprintName || "",
      skill: combatSkill || 30,
      perception: stats.Perception || 30,
      hitChance: clamp(combatSkill || 60, 5, 95),
      critChance: 10,
      critMultiplier: 1.5,
      armorPen: 0,
      talents: facts.join("\n"),
      saveData: {
        ...character,
        saveName: summary.saveName
      }
    };
  });

  state.characters = importedCharacters.length ? importedCharacters : state.characters;
  state.selectedCharacterId = state.characters[0]?.id || state.selectedCharacterId;
  saveState();
  render();
}

async function parseSaveFile(file) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const partyText = new TextDecoder().decode(await readZipEntry(buffer, "party.json"));
  const party = JSON.parse(partyText);
  const itemById = buildSaveItemMap(party);
  const units = (party.m_EntityData || []).filter((entity) =>
    String(entity.$type || "").includes("UnitEntity")
  );
  const characters = units
    .map((unit) => summarizeSaveUnit(unit, itemById))
    .filter((unit) => unit.blueprint || unit.name || unit.factCount > 0)
    .sort((a, b) => Number(b.isInParty) - Number(a.isInParty) || b.factCount - a.factCount);

  return {
    schemaVersion: 1,
    importedAt: new Date().toISOString(),
    saveName: file.name,
    unitCount: units.length,
    characters
  };
}

function summarizeSaveUnit(unit, itemById) {
  const facts = collectSaveFacts(unit);
  const blueprint = unit.Blueprint || unit.m_Blueprint || unit.BlueprintRef || unit.m_BlueprintRef;
  const blueprintEntry = gameIndex.byGuid[blueprint];
  const stats = extractSaveStats(unit);

  return {
    entityId: unit.UniqueId || unit.m_UniqueId || unit.Id || unit.EntityId,
    name: extractSaveName(unit, blueprintEntry),
    blueprint,
    blueprintName: blueprintEntry?.name,
    isInParty: Boolean(unit.IsInGameParty || unit.m_IsInGameParty || unit.IsInParty),
    isPlayerFaction: JSON.stringify(unit).includes("Player") || JSON.stringify(unit).includes("Party"),
    level: extractSaveLevel(unit, facts),
    stats,
    estimatedStats: estimateSaveStats(stats, facts),
    inventory: extractSaveInventory(unit, itemById),
    factCount: facts.length,
    factsByType: countFactsByType(facts),
    facts: facts.slice(0, 400)
  };
}

function collectSaveFacts(unit) {
  const rawFacts = unit.Facts?.m_Facts || unit.m_Facts?.m_Facts || [];
  return rawFacts
    .map((fact) => {
      const guid = fact.Blueprint || fact.m_Blueprint || fact.m_Context?.AssociatedBlueprint;
      const entry = gameIndex.byGuid[guid];
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

function extractSaveName(unit, blueprintEntry) {
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

function extractSaveLevel(unit, facts) {
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

function extractSaveStats(unit) {
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

function estimateSaveStats(baseStats, facts) {
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

function buildSaveItemMap(root) {
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

function extractSaveInventory(unit, itemById) {
  const body = (unit.Parts?.Container || []).find((part) =>
    String(part.$type || "").includes("PartUnitBody")
  );
  if (!body) return [];

  const currentSet = Number(body.m_CurrentHandsEquipmentSetIndex || 0);
  const refs = [];

  for (const [index, set] of (body.m_HandsEquipmentSets || []).entries()) {
    pushSaveItemRef(refs, `Weapon Set ${index + 1} Primary`, set.PrimaryHand, "weapon", index === currentSet);
    pushSaveItemRef(refs, `Weapon Set ${index + 1} Secondary`, set.SecondaryHand, "weapon", index === currentSet);
  }

  for (const [index, slot] of (body.m_QuickSlots || []).entries()) {
    pushSaveItemRef(refs, `Quick Slot ${index + 1}`, slot, "quick", Boolean(slot?.m_Active));
  }

  for (const slot of ["Armor", "Shirt", "Belt", "Head", "Glasses", "Feet", "Gloves", "Neck", "Ring1", "Ring2", "Wrist", "Shoulders", "PetProtocol"]) {
    pushSaveItemRef(refs, slot, body[slot], slot === "Armor" ? "armor" : "equipment", Boolean(body[slot]?.m_Active));
  }

  const chosenWeapon = (unit.Parts?.Container || []).find((part) =>
    String(part.$type || "").includes("WarhammerUnitPartChooseWeapon")
  )?.m_WeaponRef;

  return refs
    .map((ref) => resolveSaveItemRef(ref, itemById, chosenWeapon))
    .filter(Boolean);
}

function pushSaveItemRef(refs, slot, value, category, active) {
  if (value?.m_ItemRef) {
    refs.push({ slot, itemId: value.m_ItemRef, category, active });
  }
}

function resolveSaveItemRef(ref, itemById, chosenWeapon) {
  const item = itemById.get(ref.itemId);
  if (!item?.Blueprint) return null;
  const entry = gameIndex.byGuid[item.Blueprint];
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
        name: gameIndex.byGuid[guid]?.name || guid,
        type: gameIndex.byGuid[guid]?.type || "Ability"
      }))
  };
}

function readableCharacterName(name) {
  return String(name)
    .replace(/_?Companion(?:_\d+lvl)?$/i, "")
    .replace(/^StartGame_Player_Unit$/i, "Player Character")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function cleanBlueprintName(name) {
  return String(name)
    .replace(/_/g, " ")
    .replace(/\bFeature\b/gi, "")
    .replace(/\bAbility\b/gi, "")
    .replace(/\bTalent\b/gi, "")
    .replace(/\s+x(\d+)$/i, " x$1")
    .replace(/\s+/g, " ")
    .trim();
}

function shortType(typeName) {
  return String(typeName).split(",")[0].split(".").pop();
}

async function readZipEntry(buffer, entryName) {
  const entry = listZipEntries(buffer).find((item) => item.name === entryName);
  if (!entry) throw new Error(`ZIP entry not found: ${entryName}`);

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid ZIP local file signature for ${entryName}`);
  }

  const fileNameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize);

  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRaw(compressed);

  throw new Error(`Unsupported ZIP compression method ${entry.method}`);
}

function listZipEntries(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid ZIP central directory at ${offset}`);
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = buffer.slice(offset + 46, offset + 46 + fileNameLength);
    const name = new TextDecoder().decode(nameBytes);

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("ZIP end of central directory not found");
}

async function inflateRaw(compressed) {
  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot decompress ZIP saves. Try Chromium/Chrome.");
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

document.querySelector("#saveCharacterButton").addEventListener("click", saveSelectedCharacter);
document.querySelector("#saveEnemyButton").addEventListener("click", saveSelectedEnemy);
document.querySelector("#saveModifierButton").addEventListener("click", saveSelectedModifier);
document.querySelector("#saveSettingsButton").addEventListener("click", saveAttackAndSettings);
document.querySelector("#calculateButton").addEventListener("click", saveAttackAndSettings);
document.querySelector("#addCharacterButton").addEventListener("click", addCharacter);
document.querySelector("#addEnemyButton").addEventListener("click", addEnemy);
document.querySelector("#addModifierButton").addEventListener("click", addModifier);
document.querySelector("#exportButton").addEventListener("click", exportState);
document.querySelector("#resetDemoButton").addEventListener("click", () => {
  state = clone(demoState);
  saveState();
  render();
});
document.querySelector("#saveFile").addEventListener("change", (event) => importSaveFile(event.target.files[0]));
document.querySelector("#catalogSearch").addEventListener("input", renderCatalog);
importedWeaponSelect.addEventListener("change", applyImportedWeaponSelection);

for (const form of [characterForm, enemyForm, attackForm, settingsForm, modifierForm]) {
  form.addEventListener("input", () => {
    if (form === characterForm) Object.assign(selectedCharacter(), formToObject(characterForm, selectedCharacter()));
    if (form === enemyForm) Object.assign(selectedEnemy(), formToObject(enemyForm, selectedEnemy()));
    if (form === attackForm) state.attack = formToObject(attackForm, state.attack);
    if (form === settingsForm) state.settings = formToObject(settingsForm, state.settings);
    if (form === modifierForm) Object.assign(selectedModifier(), formToObject(modifierForm, selectedModifier()));
    saveState();
    updateCalculation();
  });
}

render();
loadStaticIndex();
