import { readFile } from "node:fs/promises";

export async function loadBlueprintPack(filePath) {
  const buffer = await readFile(filePath);
  const count = buffer.readUInt32LE(0);
  const records = new Map();

  for (let index = 0; index < count; index += 1) {
    const offset = 4 + index * 20;
    const guid = formatPackedGuid(buffer.subarray(offset, offset + 16));
    const dataOffset = buffer.readUInt32LE(offset + 16);
    const nextOffset = index + 1 < count ? buffer.readUInt32LE(offset + 36) : buffer.length;
    records.set(guid, {
      guid,
      index,
      offset: dataOffset,
      nextOffset,
      length: nextOffset - dataOffset
    });
  }

  return { buffer, records };
}

export function extractWeaponBlueprint(pack, guid, byGuid = {}, blueprintName = "") {
  const recordInfo = pack.records.get(guid);
  if (!recordInfo) return null;

  const record = pack.buffer.subarray(recordInfo.offset, recordInfo.nextOffset);
  const fields = extractFieldNames(record);
  const text = record.toString("utf8");
  const values = extractWeaponValueBlock(record, fields);
  const abilities = extractBlueprintRefs(record, byGuid, "BlueprintAbility");
  const damageType = inferBlueprintDamageType(text, blueprintName);
  const stats = mapWeaponStats(fields, values, damageType);

  return {
    recordOffset: recordInfo.offset,
    recordLength: recordInfo.length,
    fields,
    abilities,
    stats
  };
}

function formatPackedGuid(bytes) {
  return Buffer.concat([
    Buffer.from(bytes.subarray(0, 4)).reverse(),
    Buffer.from(bytes.subarray(4, 6)).reverse(),
    Buffer.from(bytes.subarray(6, 8)).reverse(),
    bytes.subarray(8, 16)
  ]).toString("hex");
}

function extractFieldNames(record) {
  try {
    let offset = 16;
    const guidString = readPackedString(record, offset);
    offset = guidString.nextOffset;
    const count = record.readUInt32LE(offset);
    offset += 4;
    if (count < 0 || count > 500) return [];

    const fields = [];
    for (let index = 0; index < count; index += 1) {
      const field = readPackedString(record, offset);
      offset = field.nextOffset;
      fields.push(field.value);
    }
    return fields;
  } catch {
    return [];
  }
}

function readPackedString(buffer, offset) {
  const lengthResult = read7BitInt(buffer, offset);
  offset = lengthResult.nextOffset;
  return {
    value: buffer.subarray(offset, offset + lengthResult.value).toString("utf8"),
    nextOffset: offset + lengthResult.value
  };
}

function read7BitInt(buffer, offset) {
  let value = 0;
  let shift = 0;
  let cursor = offset;

  while (cursor < buffer.length) {
    const byte = buffer[cursor];
    cursor += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return { value, nextOffset: cursor };
}

function extractBlueprintRefs(record, byGuid, type) {
  const text = record.toString("utf8");
  const refs = new Map();
  for (const match of text.matchAll(/\b[0-9a-f]{32}\b/g)) {
    const guid = match[0];
    const entry = byGuid[guid];
    if (entry?.type === type) {
      refs.set(guid, {
        guid,
        name: entry.name,
        type: entry.type
      });
    }
  }
  return [...refs.values()];
}

function extractWeaponValueBlock(record, fields) {
  if (!fields.includes("WarhammerDamage") || !fields.includes("WarhammerMaxDamage")) {
    return [];
  }

  const candidates = [];
  for (let offset = 0; offset <= record.length - 48; offset += 1) {
    const values = [];
    for (let index = 0; index < 12; index += 1) {
      values.push(record.readInt32LE(offset + index * 4));
    }

    const [damage, maxDamage, penetration] = values;
    if (damage < 1 || damage > 200) continue;
    if (maxDamage < damage || maxDamage > 250) continue;
    if (penetration < 0 || penetration > 150) continue;
    if (!values.slice(3, 9).every((value) => value >= -1 && value <= 300)) continue;

    let score = offset * 0.01;
    if (values[0] < values[1]) score += 100;
    if (values[2] <= 80) score += 20;
    if (fields.includes("WarhammerMaxDistance") && values[5] > 0) score += 60;
    if (fields.includes("WarhammerMaxAmmo") && values[6] > 0) score += 60;
    if (fields.includes("RateOfFire") && values[7] >= 0 && values[7] <= 20) score += 30;
    if (fields.includes("WarhammerRecoil") && values[6] > 0) score += 40;
    if (values.some((value) => value > 1 && value <= 20)) score += 10;
    candidates.push({ offset, values, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.values || [];
}

function mapWeaponStats(fields, values, damageType) {
  if (!values.length) return { damageType };

  const stats = {
    damageMin: values[0],
    damageMax: values[1],
    penetration: values[2],
    damageType
  };

  if (fields.includes("WarhammerRecoil")) {
    stats.recoil = values[3];
    stats.maxDistance = values[4];
    stats.minimalStrength = values[5];
    if (values[7] > 0 && values[7] <= 20) {
      stats.maxAmmo = values[6];
      stats.rateOfFire = values[7];
    } else {
      stats.maxAmmo = values[6] > 0 ? values[6] : values[5];
      stats.rateOfFire = values[7] > 0 ? values[7] : values[6];
    }
  } else {
    stats.additionalHitChance = values[3];
    stats.minimalStrength = values[4];
    if (values[5] === 0 && values[6] > 0 && values[7] > 0) {
      stats.maxDistance = values[6];
      stats.maxAmmo = values[7];
    } else {
      stats.maxDistance = values[5];
      stats.maxAmmo = values[6];
    }
  }

  if (fields.includes("DodgePenetration")) {
    stats.dodgePenetration = values[8] ?? 0;
  }

  return stats;
}

function inferBlueprintDamageType(text, blueprintName = "") {
  const name = String(blueprintName).toLowerCase();
  if (/flamer|flame|inferno|melta/.test(name)) return "Fire";
  if (/plasma|laser|lasgun|laspistol|voltaic|shock/.test(name)) return "Energy";
  if (/toxic|poison|needle|splinter/.test(name)) return "Toxic";

  if (text.includes("Fire.ProjectileType")) return "Fire";
  if (text.includes("Plasma.ProjectileType") || text.includes("Laser.ProjectileType")) return "Energy";
  if (text.includes("Warp.ProjectileType")) return "Warp";
  if (text.includes("Toxic.ProjectileType")) return "Toxic";
  if (text.includes("Bullet.ProjectileType")) return "Kinetic";

  const projectileMatch = text.match(/\b(Fire|Bullet|Laser|Plasma|Melta|Warp|Toxic|Power|Rending|Explosive|Drukhari|Aeldari)\b(?=\.ProjectileType|\.)/);
  const raw = projectileMatch?.[1] || "";
  if (/Fire|Melta/i.test(raw)) return "Fire";
  if (/Laser|Plasma|Power/i.test(raw)) return "Energy";
  if (/Warp/i.test(raw)) return "Warp";
  if (/Toxic|Drukhari/i.test(raw)) return "Toxic";
  return raw || "Kinetic";
}
