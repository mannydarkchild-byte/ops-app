import { ISSUE_AREA_GROUPS } from "./constants.js";

/** Default stop owners are ROLES, not companies. Each machine resolves the role
 * to its own supplier/wear-owner name; site settings are the fallback. */

export const DEFAULT_STOP_OWNERS = {
  DARKCHILD: "Machine supplier",
  BERLINGTON: "Wear owner",
  SITE: "Site / operations",
};

/** Stable ownership roles behind the display names. */
export const OWNER_ROLES = {
  CONTRACTOR: "contractor",
  WEAR: "wear",
  SITE: "site",
};

/** The six report categories. Operators pick one, then explain further. */
export const STOP_CATEGORIES = {
  MECHANICAL: "Mechanical",
  HYDRAULIC: "Hydraulic",
  ENGINE: "Engine",
  ELECTRICAL: "Electrical",
  CONSUMABLES: "Consumables",
  SITE: "Site / operational",
};

/**
 * Darkchild / contractor owns mechanical, hydraulic, engine, electrical.
 * Wear owner owns consumables (diesel, oil, grease, meshes, wear).
 * Site owns standing time (weather, strike, no material, blockages).
 */
export const STOP_CATEGORY_META = [
  {
    reason: STOP_CATEGORIES.MECHANICAL,
    owner: DEFAULT_STOP_OWNERS.DARKCHILD,
    role: OWNER_ROLES.CONTRACTOR,
    hint: "Bearings, drives, tracks, structure",
    examples: "Screenbox, conveyor drive, tracks, seized rollers",
  },
  {
    reason: STOP_CATEGORIES.HYDRAULIC,
    owner: DEFAULT_STOP_OWNERS.DARKCHILD,
    role: OWNER_ROLES.CONTRACTOR,
    hint: "Pumps, hoses, cylinders, leaks",
    examples: "Hose burst, slow functions, hot oil, pump fail",
  },
  {
    reason: STOP_CATEGORIES.ENGINE,
    owner: DEFAULT_STOP_OWNERS.DARKCHILD,
    role: OWNER_ROLES.CONTRACTOR,
    hint: "Power unit and cooling",
    examples: "Overheat, no power, oil pressure, radiator",
  },
  {
    reason: STOP_CATEGORIES.ELECTRICAL,
    owner: DEFAULT_STOP_OWNERS.DARKCHILD,
    role: OWNER_ROLES.CONTRACTOR,
    hint: "Battery, wiring, controls",
    examples: "Dead battery, sensor, alarm, remote, loom",
  },
  {
    reason: STOP_CATEGORIES.CONSUMABLES,
    owner: DEFAULT_STOP_OWNERS.BERLINGTON,
    role: OWNER_ROLES.WEAR,
    hint: "Wear, diesel, oil, grease, meshes",
    examples: "No diesel, torn mesh, worn belt, grease, oil",
  },
  {
    reason: STOP_CATEGORIES.SITE,
    owner: DEFAULT_STOP_OWNERS.SITE,
    role: OWNER_ROLES.SITE,
    hint: "Weather, feed, strike, blockages",
    examples: "Rain, no material, waiting loader, blast, blockage",
  },
];

/**
 * Second-step options after a main category. Stored as event.reason so Pulse
 * and reports can show makeup under each category.
 */
export const STOP_SUBREASONS = {
  [STOP_CATEGORIES.MECHANICAL]: [
    { label: "Screenbox bearings or drive", words: ["screenbox", "bearing"], warriorOnly: true },
    { label: "Conveyor or feeder drive", words: ["conveyor", "feeder drive", "overload"], warriorOnly: true },
    { label: "Tracks or final drive", words: ["track", "final drive", "undercarriage"] },
    { label: "Structure / frame", words: ["structure", "frame", "cracked"] },
    { label: "Seized rollers", words: ["seized", "roller"] },
    { label: "Other mechanical", words: [], isOther: true },
  ],
  [STOP_CATEGORIES.HYDRAULIC]: [
    { label: "Hose burst / leak", words: ["hose", "leak", "burst"] },
    { label: "Cylinder", words: ["cylinder"] },
    { label: "Pump", words: ["pump"] },
    { label: "Slow functions / hot oil", words: ["slow", "hot oil"] },
    { label: "Other hydraulic", words: [], isOther: true },
  ],
  [STOP_CATEGORIES.ENGINE]: [
    { label: "Overheat", words: ["overheat", "hot"] },
    { label: "No power", words: ["no power", "won't start", "will not start", "not start"] },
    { label: "Oil pressure", words: ["oil pressure"] },
    { label: "Radiator / cooling", words: ["radiator", "cooling"] },
    { label: "Other engine", words: [], isOther: true },
  ],
  [STOP_CATEGORIES.ELECTRICAL]: [
    { label: "Emergency stop / remote", words: ["emergency", "e stop", "estop", "remote"] },
    { label: "Dead battery", words: ["battery"] },
    { label: "Sensor / alarm", words: ["sensor", "alarm"] },
    { label: "Wiring / loom", words: ["wiring", "loom", "cable"] },
    { label: "Controls", words: ["control", "panel"] },
    { label: "Other electrical", words: [], isOther: true },
  ],
  [STOP_CATEGORIES.CONSUMABLES]: [
    { label: "No diesel", words: ["diesel", "fuel", "no diesel"] },
    { label: "Screen media / mesh", words: ["mesh", "media", "screen"], warriorOnly: true },
    { label: "Worn belts, skirting, or scrapers", words: ["belt", "skirting", "scraper"] },
    { label: "Worn rollers or impact bars", words: ["impact bar"] },
    { label: "Worn tracks or undercarriage", words: ["worn track"] },
    { label: "Hopper, chute, or wear plate", words: ["hopper", "chute", "wear plate"], warriorOnly: true },
    { label: "Oil / grease", words: ["grease", "no oil", "engine oil", "hydraulic oil"] },
    { label: "Other consumables", words: [], isOther: true },
  ],
  [STOP_CATEGORIES.SITE]: [
    { label: "Waiting for material", words: ["waiting for material", "no material", "no feed", "still mining", "excavator is still", "preparing the material", "mining"] },
    { label: "Waiting for loader", words: ["waiting for loader", "waiting loader"] },
    { label: "Weather / rain", words: ["weather", "rain"] },
    { label: "Safety stop", words: ["safety"] },
    { label: "Break", words: ["break", "bathroom", "resting"] },
    { label: "Cleaning", words: ["clean"] },
    { label: "Blockage / build-up", words: ["blockage", "build-up", "build up", "sticky", "wet material"] },
    { label: "Blast / site delay", words: ["blast", "site delay"] },
    { label: "Strike", words: ["strike"] },
    { label: "End of operating period", words: ["end of operating", "end of period", "send home"] },
    { label: "Planned maintenance", words: ["planned maintenance"] },
    { label: "Feed rate or overflow", words: ["overflow", "feed rate"], warriorOnly: true },
    { label: "Product not to size", words: ["not to size"], warriorOnly: true },
    { label: "Dust", words: ["dust"] },
    { label: "Other site / operational", words: [], isOther: true },
  ],
};

export const DEFAULT_STOP_REASONS = STOP_CATEGORY_META.map((row) => ({
  reason: row.reason,
  owner: row.owner,
}));

/** Reasons already stored on old shifts. Owners follow the same split. */
const LEGACY_STOP_OWNERS = {
  Mechanical: DEFAULT_STOP_OWNERS.DARKCHILD,
  Hydraulic: DEFAULT_STOP_OWNERS.DARKCHILD,
  Engine: DEFAULT_STOP_OWNERS.DARKCHILD,
  Electrical: DEFAULT_STOP_OWNERS.DARKCHILD,
  Consumables: DEFAULT_STOP_OWNERS.BERLINGTON,
  "Site / operational": DEFAULT_STOP_OWNERS.SITE,
  "Engine Problem": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Electrical Breakdown": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Mechanical Breakdown": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Track Problem": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Hydraulic Breakdown": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Screenbox bearings or drive": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Conveyor or feeder drive": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Hydraulic system": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Engine or cooling": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Electrical or controls": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Tracks or final drive": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Screen Problem": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Conveyor/Belt Problem": DEFAULT_STOP_OWNERS.BERLINGTON,
  "No Diesel": DEFAULT_STOP_OWNERS.BERLINGTON,
  "No diesel": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Worn or torn screen media": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Worn belts, skirting, or scrapers": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Worn rollers or impact bars": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Worn tracks or undercarriage": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Hopper, chute, or wear plate": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Waiting for Material": DEFAULT_STOP_OWNERS.SITE,
  "Waiting for Loader": DEFAULT_STOP_OWNERS.SITE,
  Weather: DEFAULT_STOP_OWNERS.SITE,
  "Planned Maintenance": DEFAULT_STOP_OWNERS.SITE,
  "Safety Stop": DEFAULT_STOP_OWNERS.SITE,
  Cleaning: DEFAULT_STOP_OWNERS.SITE,
  "End of Operating Period": DEFAULT_STOP_OWNERS.SITE,
  Strike: DEFAULT_STOP_OWNERS.SITE,
  Other: DEFAULT_STOP_OWNERS.SITE,
  "Feed rate or screen overflow": DEFAULT_STOP_OWNERS.SITE,
  "Product not to size": DEFAULT_STOP_OWNERS.SITE,
  "Build-up, wet, or sticky material": DEFAULT_STOP_OWNERS.SITE,
  "Belt off-centre": DEFAULT_STOP_OWNERS.SITE,
  Dust: DEFAULT_STOP_OWNERS.SITE,
  "Waiting for material": DEFAULT_STOP_OWNERS.SITE,
  "Waiting for loader": DEFAULT_STOP_OWNERS.SITE,
  "Safety stop": DEFAULT_STOP_OWNERS.SITE,
  "Planned maintenance": DEFAULT_STOP_OWNERS.SITE,
  "End of operating period": DEFAULT_STOP_OWNERS.SITE,
};

const OWNER_HINT = {
  [DEFAULT_STOP_OWNERS.DARKCHILD]: "Machine supplier — breakdowns, deducted from billable",
  [DEFAULT_STOP_OWNERS.BERLINGTON]: "Wear owner — wear and consumables, no deduction",
  [DEFAULT_STOP_OWNERS.SITE]: "Site — standing time, payable in full",
  Darkchild: "Machine supplier — breakdowns, deducted from billable",
  Berlington: "Wear owner — wear and consumables, no deduction",
};

/** Fold stored labels so "No Diesel", "no diesel", and "diesel" chart as Consumables. */
export function reasonKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LEGACY_REASON_CANONICAL = {
  Mechanical: STOP_CATEGORIES.MECHANICAL,
  Hydraulic: STOP_CATEGORIES.HYDRAULIC,
  Engine: STOP_CATEGORIES.ENGINE,
  Electrical: STOP_CATEGORIES.ELECTRICAL,
  Consumables: STOP_CATEGORIES.CONSUMABLES,
  "Site / operational": STOP_CATEGORIES.SITE,
  "Site / operations": STOP_CATEGORIES.SITE,
  "Engine Problem": STOP_CATEGORIES.ENGINE,
  "Electrical Breakdown": STOP_CATEGORIES.ELECTRICAL,
  "Mechanical Breakdown": STOP_CATEGORIES.MECHANICAL,
  "Track Problem": STOP_CATEGORIES.MECHANICAL,
  "Hydraulic Breakdown": STOP_CATEGORIES.HYDRAULIC,
  "Screenbox bearings or drive": STOP_CATEGORIES.MECHANICAL,
  "Conveyor or feeder drive": STOP_CATEGORIES.MECHANICAL,
  "Hydraulic system": STOP_CATEGORIES.HYDRAULIC,
  "Engine or cooling": STOP_CATEGORIES.ENGINE,
  "Electrical or controls": STOP_CATEGORIES.ELECTRICAL,
  "Tracks or final drive": STOP_CATEGORIES.MECHANICAL,
  "Screen Problem": STOP_CATEGORIES.CONSUMABLES,
  "Conveyor/Belt Problem": STOP_CATEGORIES.CONSUMABLES,
  "No Diesel": STOP_CATEGORIES.CONSUMABLES,
  "No diesel": STOP_CATEGORIES.CONSUMABLES,
  diesel: STOP_CATEGORIES.CONSUMABLES,
  "No diesel / fuel": STOP_CATEGORIES.CONSUMABLES,
  "no diesel fuel": STOP_CATEGORIES.CONSUMABLES,
  "Worn or torn screen media": STOP_CATEGORIES.CONSUMABLES,
  "Worn belts, skirting, or scrapers": STOP_CATEGORIES.CONSUMABLES,
  "Worn rollers or impact bars": STOP_CATEGORIES.CONSUMABLES,
  "Worn tracks or undercarriage": STOP_CATEGORIES.CONSUMABLES,
  "Hopper, chute, or wear plate": STOP_CATEGORIES.CONSUMABLES,
  "Screen media wear": STOP_CATEGORIES.CONSUMABLES,
  "Waiting for Material": STOP_CATEGORIES.SITE,
  "Waiting for Loader": STOP_CATEGORIES.SITE,
  Weather: STOP_CATEGORIES.SITE,
  "Planned Maintenance": STOP_CATEGORIES.SITE,
  "Safety Stop": STOP_CATEGORIES.SITE,
  Cleaning: STOP_CATEGORIES.SITE,
  "End of Operating Period": STOP_CATEGORIES.SITE,
  Strike: STOP_CATEGORIES.SITE,
  Other: STOP_CATEGORIES.SITE,
  "Feed rate or screen overflow": STOP_CATEGORIES.SITE,
  "Feed rate or overflow": STOP_CATEGORIES.SITE,
  "Product not to size": STOP_CATEGORIES.SITE,
  "Build-up, wet, or sticky material": STOP_CATEGORIES.SITE,
  "Belt off-centre": STOP_CATEGORIES.SITE,
  Dust: STOP_CATEGORIES.SITE,
  "Waiting for material": STOP_CATEGORIES.SITE,
  "Waiting for loader": STOP_CATEGORIES.SITE,
  "Safety stop": STOP_CATEGORIES.SITE,
  "Planned maintenance": STOP_CATEGORIES.SITE,
  "End of operating period": STOP_CATEGORIES.SITE,
};

const CATEGORY_KEYWORDS = [
  { category: STOP_CATEGORIES.HYDRAULIC, words: ["hydraulic", "hose burst", "cylinder", "hyd pump", "valve block"] },
  { category: STOP_CATEGORIES.ENGINE, words: ["engine", "cooling", "overheat", "radiator", "turbo"] },
  { category: STOP_CATEGORIES.ELECTRICAL, words: ["electrical", "battery", "wiring", "sensor", "alarm", "control panel", "loom"] },
  { category: STOP_CATEGORIES.CONSUMABLES, words: ["diesel", "fuel", "grease", "mesh", "media", "wear", "consumable", "skirting", "scraper", "liner", "no oil", "engine oil", "hydraulic oil"] },
  { category: STOP_CATEGORIES.SITE, words: ["weather", "rain", "strike", "waiting", "material", "blockage", "blast", "loader", "dust", "cleaning", "safety", "planned", "overflow", "sticky", "no feed", "no material"] },
  { category: STOP_CATEGORIES.MECHANICAL, words: ["mechanical", "bearing", "track", "conveyor", "screenbox", "feeder", "final drive", "undercarriage"] },
];

function categoryFromKeywords(key) {
  if (!key) return null;
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.words.some((word) => key.includes(word))) return rule.category;
  }
  return null;
}

function categoryMeta(reason) {
  const key = reasonKey(reason);
  return STOP_CATEGORY_META.find((row) => reasonKey(row.reason) === key) || null;
}

for (const [category, subs] of Object.entries(STOP_SUBREASONS)) {
  for (const sub of subs) {
    if (!LEGACY_REASON_CANONICAL[sub.label]) LEGACY_REASON_CANONICAL[sub.label] = category;
    if (!LEGACY_STOP_OWNERS[sub.label]) {
      LEGACY_STOP_OWNERS[sub.label] = categoryMeta(category)?.owner || DEFAULT_STOP_OWNERS.SITE;
    }
  }
}

/** Map any stored wording to one of the six categories. */
export function categoryForStopReason(reason) {
  const raw = String(reason || "").trim();
  if (!raw) return STOP_CATEGORIES.SITE;
  const key = reasonKey(raw);
  const exact = STOP_CATEGORY_META.find((row) => reasonKey(row.reason) === key);
  if (exact) return exact.reason;
  const alias = Object.entries(LEGACY_REASON_CANONICAL).find(([from]) => reasonKey(from) === key);
  if (alias) return alias[1];
  return categoryFromKeywords(key) || STOP_CATEGORIES.SITE;
}

/** One display label for a stored stop reason, including old wording and casing. */
export function canonicalStopReason(reason) {
  return categoryForStopReason(reason);
}

/** Category plus leftover original wording / operator note for feed and reports. */
export function stopReasonDetail(reason, note) {
  const category = canonicalStopReason(reason);
  const raw = String(reason || "").trim();
  const extra = [];
  if (raw && reasonKey(raw) !== reasonKey(category)) extra.push(raw);
  if (String(note || "").trim()) extra.push(String(note).trim());
  return { category, detail: extra.join(" — ") };
}

export function isStopCategory(reason) {
  return STOP_CATEGORY_META.some((row) => reasonKey(row.reason) === reasonKey(reason));
}

export function subReasonsForCategory(category, machine) {
  const line = machineLine(machine);
  const key = categoryForStopReason(category);
  return (STOP_SUBREASONS[key] || []).filter((sub) => !sub.warriorOnly || line === "screener" || !line);
}

export function isOtherStopReason(reason) {
  return reasonKey(reason).startsWith("other");
}

/** A saved stop is complete once a second-step option is chosen. */
export function isCompleteStopSelection(reason) {
  return Boolean(reason) && !isStopCategory(reason);
}

function bestSub(subs, blob) {
  if (!blob) return null;
  let best = null;
  let bestLen = 0;
  for (const sub of subs) {
    if (sub.isOther) continue;
    for (const word of (sub.words?.length ? sub.words : [sub.label])) {
      const needle = reasonKey(word);
      if (!needle || !blob.includes(needle) || needle.length < bestLen) continue;
      best = sub;
      bestLen = needle.length;
    }
  }
  return best;
}

/** Known sub-reason, or the operator note, for Pulse makeup. */
export function detailForStop(reason, note) {
  const category = categoryForStopReason(reason);
  const subs = STOP_SUBREASONS[category] || [];
  const exact = subs.find((sub) => reasonKey(sub.label) === reasonKey(reason));
  if (exact && !exact.isOther) return exact.label;
  const noteHead = String(note || "").split(/\s*\|\s*|Action:/i)[0];
  const noteHit = bestSub(subs, reasonKey(noteHead));
  if (noteHit) return noteHit.label;
  const blobHit = bestSub(subs, reasonKey([reason, note].filter(Boolean).join(" ")));
  if (blobHit) return blobHit.label;
  const leftover = String(noteHead || "").trim();
  if (leftover) return leftover;
  if (reason && !isStopCategory(reason)) return String(reason).trim();
  return subs.find((sub) => sub.isOther)?.label || "Other";
}

function copyDefaults() {
  return DEFAULT_STOP_REASONS.map((r) => ({ ...r }));
}

export function normalizeStopReasons(list) {
  if (!Array.isArray(list) || !list.length) return copyDefaults();
  const byCategory = new Map();
  for (const row of list) {
    const raw = String(row?.reason || row?.label || "").trim();
    if (!raw) continue;
    const category = categoryForStopReason(raw);
    if (byCategory.has(reasonKey(category))) continue;
    const owner = String(row?.owner || "").trim()
      || categoryMeta(category)?.owner
      || DEFAULT_STOP_OWNERS.SITE;
    byCategory.set(reasonKey(category), { reason: category, owner });
  }
  return DEFAULT_STOP_REASONS.map((def) => (
    byCategory.get(reasonKey(def.reason)) || { ...def }
  ));
}

export function resolveStopReasons(siteSettings) {
  return normalizeStopReasons(siteSettings?.stop_reasons);
}

export function getStopOwnerLabels(siteSettings) {
  return {
    contractor: siteSettings?.contractor_name || DEFAULT_STOP_OWNERS.DARKCHILD,
    owner: siteSettings?.equipment_owner_name || DEFAULT_STOP_OWNERS.BERLINGTON,
    site: siteSettings?.client_site_name || DEFAULT_STOP_OWNERS.SITE,
  };
}

export function isContractorStop(reason, siteSettings) {
  const owner = ownerForStopReason(reason, siteSettings);
  const labels = getStopOwnerLabels(siteSettings);
  return (
    owner === labels.contractor ||
    owner === DEFAULT_STOP_OWNERS.DARKCHILD ||
    (typeof owner === "string" && (
      owner.toLowerCase().includes("darkchild") ||
      owner.toLowerCase().includes("contractor") ||
      owner.toLowerCase().includes("mechanical") ||
      owner.toLowerCase().includes("machine supplier")
    ))
  );
}

export function ownerForStopReason(reason, siteSettings) {
  const list = resolveStopReasons(siteSettings);
  const canon = canonicalStopReason(reason);
  const hit = list.find((r) => r.reason === canon)
    || list.find((r) => reasonKey(r.reason) === reasonKey(reason));
  if (hit) return hit.owner;
  const legacy = Object.entries(LEGACY_STOP_OWNERS).find(([label]) => (
    reasonKey(label) === reasonKey(reason) || reasonKey(label) === reasonKey(canon)
  ));
  if (legacy) return legacy[1];
  const meta = categoryMeta(canon);
  return meta?.owner || DEFAULT_STOP_OWNERS.SITE;
}

/** Grouped for operator <select> optgroups. */
export function stopReasonGroups(siteSettings) {
  const list = resolveStopReasons(siteSettings);
  const order = [];
  const byOwner = {};
  for (const row of list) {
    if (!byOwner[row.owner]) {
      byOwner[row.owner] = [];
      order.push(row.owner);
    }
    byOwner[row.owner].push(row.reason);
  }
  return order.map((owner) => ({
    owner,
    hint: OWNER_HINT[owner] || owner,
    reasons: byOwner[owner],
  }));
}

export function stopReasonLabels(siteSettings) {
  return resolveStopReasons(siteSettings).map((r) => r.reason);
}

/** Serialize for admin textarea: one "Reason | Owner" per line. */
export function serializeStopReasons(list) {
  return normalizeStopReasons(list).map((r) => `${r.reason} | ${r.owner}`).join("\n");
}

export function parseStopReasonsText(text) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return normalizeStopReasons(lines.map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    return { reason: parts[0] || "", owner: parts[1] || DEFAULT_STOP_OWNERS.SITE };
  }));
}

/** Stable role behind a stored owner name. Contractor first (deducted), then wear. */
export function stopOwnerRole(reason, siteSettings) {
  const meta = categoryMeta(canonicalStopReason(reason));
  if (meta) return meta.role;
  if (isContractorStop(reason, siteSettings)) return OWNER_ROLES.CONTRACTOR;
  if (isWearStop(reason, siteSettings)) return OWNER_ROLES.WEAR;
  return OWNER_ROLES.SITE;
}

export function isWearStop(reason, siteSettings) {
  const owner = ownerForStopReason(reason, siteSettings);
  const labels = getStopOwnerLabels(siteSettings);
  return (
    owner === labels.owner ||
    owner === DEFAULT_STOP_OWNERS.BERLINGTON ||
    (typeof owner === "string" && (
      owner.toLowerCase().includes("berlington") ||
      owner.toLowerCase().includes("wear") ||
      owner.toLowerCase().includes("consumable")
    ))
  );
}

function machineLine(machine) {
  const text = `${machine?.name || ""} ${machine?.code || ""} ${machine?.type || ""}`.toLowerCase();
  if (/\bexcavator\b/.test(text)) return "excavator";
  if (/\bfel\b/.test(text) || /front[\s-]*end/.test(text) || /\bloader\b/.test(text)) return "fel";
  if (/screen|warrior|crusher/.test(text)) return "screener";
  return null;
}

function looksLikeDarkchild(name) {
  return String(name || "").toLowerCase().includes("darkchild");
}

/**
 * Display name for an ownership role on one machine.
 * Darkchild is Warrior only. FEL → Mamarc. Excavator → Berlington.
 */
export function machineOwnerName(machine, role, siteSettings) {
  const labels = getStopOwnerLabels(siteSettings);
  const line = machineLine(machine);
  if (role === OWNER_ROLES.CONTRACTOR) {
    const stored = machine?.supplier_name?.trim();
    if (line === "screener") return stored || labels.contractor || "Darkchild";
    if (line === "fel") return stored && !looksLikeDarkchild(stored) ? stored : "Mamarc";
    if (line === "excavator") return stored && !looksLikeDarkchild(stored) ? stored : "Berlington";
    if (stored && !looksLikeDarkchild(stored)) return stored;
    return DEFAULT_STOP_OWNERS.DARKCHILD;
  }
  if (role === OWNER_ROLES.WEAR) {
    const stored = machine?.wear_owner_name?.trim();
    if (stored && !looksLikeDarkchild(stored)) return stored;
    return labels.owner || DEFAULT_STOP_OWNERS.BERLINGTON;
  }
  return labels.site || DEFAULT_STOP_OWNERS.SITE;
}

/** Owner display for one stop on one machine. Billing still keys off the role. */
export function ownerForStopReasonMachine(reason, machine, siteSettings) {
  return machineOwnerName(machine, stopOwnerRole(reason, siteSettings), siteSettings);
}

const ROLE_HINT = {
  [OWNER_ROLES.CONTRACTOR]: "breakdowns — deducted from billable",
  [OWNER_ROLES.WEAR]: "wear and consumables — no deduction",
  [OWNER_ROLES.SITE]: "standing time — payable in full",
};

const WARRIOR_ONLY_REASONS = new Set([
  "Screenbox bearings or drive",
  "Conveyor or feeder drive",
  "Worn or torn screen media",
  "Screen media wear",
  "Screen media / mesh",
  "Feed rate or screen overflow",
  "Feed rate or overflow",
  "Product not to size",
  "Hopper, chute, or wear plate",
]);

export function isWarriorOnlyReason(reason) {
  return WARRIOR_ONLY_REASONS.has(reason);
}

export function stopReasonOptionsForMachine(machine, siteSettings) {
  return STOP_CATEGORY_META.map((row) => {
    const owner = machineOwnerName(machine, row.role, siteSettings);
    return {
      reason: row.reason,
      role: row.role,
      owner,
      hint: row.hint,
      examples: row.examples,
      ownerHint: `${owner} — ${ROLE_HINT[row.role] || row.role}`,
    };
  });
}

/** Stop picker groups for one machine: the six categories headed by that machine's owner names. */
export function stopReasonGroupsForMachine(machine, siteSettings) {
  const options = stopReasonOptionsForMachine(machine, siteSettings);
  const order = [];
  const byRole = {};
  for (const row of options) {
    if (!byRole[row.role]) {
      byRole[row.role] = [];
      order.push(row.role);
    }
    byRole[row.role].push(row.reason);
  }
  return order.map((role) => {
    const owner = machineOwnerName(machine, role, siteSettings);
    return {
      owner,
      role,
      hint: `${owner} — ${ROLE_HINT[role] || role}`,
      reasons: byRole[role],
    };
  });
}

/** Problem-type groups, labelled with this machine's owners. */
export function issueAreaGroupsForMachine(machine, siteSettings) {
  const line = machineLine(machine);
  const contractor = machineOwnerName(machine, OWNER_ROLES.CONTRACTOR, siteSettings);
  const wear = machineOwnerName(machine, OWNER_ROLES.WEAR, siteSettings);
  return ISSUE_AREA_GROUPS.map((group) => {
    let label = group.label;
    if (group.label.startsWith("Darkchild") || group.id === "contractor") {
      label = `${contractor} — mechanical, hydraulic, engine, electrical`;
    } else if (group.label.startsWith("Berlington") || group.id === "wear") {
      label = `${wear} — wear and consumables`;
    }
    const areas = (line === "screener" || !line)
      ? group.areas
      : group.areas.filter((area) => !isWarriorOnlyReason(area));
    return { ...group, label, areas };
  }).filter((group) => group.areas.length);
}
