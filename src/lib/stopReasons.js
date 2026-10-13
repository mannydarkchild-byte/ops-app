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

/**
 * Downtime roles, resolved per machine.
 * Machine supplier: mechanical, engine, hydraulic, electrical — deducted.
 * Wear owner: wear and consumables — no deduction.
 * Site: operations, production, and weather — standing time, payable in full.
 */
export const DEFAULT_STOP_REASONS = [
  { reason: "Screenbox bearings or drive", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Conveyor or feeder drive", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Hydraulic system", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Engine or cooling", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Electrical or controls", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Tracks or final drive", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Worn or torn screen media", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Worn belts, skirting, or scrapers", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Worn rollers or impact bars", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Worn tracks or undercarriage", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Hopper, chute, or wear plate", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "No diesel", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Feed rate or screen overflow", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Product not to size", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Build-up, wet, or sticky material", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Belt off-centre", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Dust", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Waiting for material", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Waiting for loader", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Weather", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Cleaning", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Safety stop", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Planned maintenance", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "End of operating period", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Strike", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Other", owner: DEFAULT_STOP_OWNERS.SITE },
];

/** Reasons already stored on old shifts. Owners follow the same split, so history does not fall through to Site. */
const LEGACY_STOP_OWNERS = {
  "Engine Problem": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Electrical Breakdown": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Mechanical Breakdown": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Track Problem": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Hydraulic Breakdown": DEFAULT_STOP_OWNERS.DARKCHILD,
  "Screen Problem": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Conveyor/Belt Problem": DEFAULT_STOP_OWNERS.BERLINGTON,
  "No Diesel": DEFAULT_STOP_OWNERS.BERLINGTON,
  "Waiting for Material": DEFAULT_STOP_OWNERS.SITE,
  "Waiting for Loader": DEFAULT_STOP_OWNERS.SITE,
  Weather: DEFAULT_STOP_OWNERS.SITE,
  "Planned Maintenance": DEFAULT_STOP_OWNERS.SITE,
  "Safety Stop": DEFAULT_STOP_OWNERS.SITE,
  Cleaning: DEFAULT_STOP_OWNERS.SITE,
  "End of Operating Period": DEFAULT_STOP_OWNERS.SITE,
  Strike: DEFAULT_STOP_OWNERS.SITE,
  Other: DEFAULT_STOP_OWNERS.SITE,
};

const PREVIOUS_DEFAULT_SIGNATURE = [
  "Engine Problem|Darkchild",
  "Electrical Breakdown|Darkchild",
  "Mechanical Breakdown|Darkchild",
  "Track Problem|Darkchild",
  "Hydraulic Breakdown|Berlington",
  "Screen Problem|Berlington",
  "Conveyor/Belt Problem|Berlington",
  "No Diesel|Berlington",
  "Waiting for Material|Site / operations",
  "Waiting for Loader|Site / operations",
  "Weather|Site / operations",
  "Planned Maintenance|Site / operations",
  "Safety Stop|Site / operations",
  "Cleaning|Site / operations",
  "End of Operating Period|Site / operations",
  "Strike|Site / operations",
  "Other|Site / operations",
].sort().join("\n");

const OWNER_HINT = {
  [DEFAULT_STOP_OWNERS.DARKCHILD]: "Machine supplier — breakdowns, deducted from billable",
  [DEFAULT_STOP_OWNERS.BERLINGTON]: "Wear owner — wear and consumables, no deduction",
  [DEFAULT_STOP_OWNERS.SITE]: "Site — standing time, payable in full",
  // Legacy stored names resolve to the same hints.
  Darkchild: "Machine supplier — breakdowns, deducted from billable",
  Berlington: "Wear owner — wear and consumables, no deduction",
};

/** Fold stored labels so "No Diesel", "no diesel", and "diesel" chart as one reason. */
function reasonKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LEGACY_REASON_CANONICAL = {
  "Engine Problem": "Engine or cooling",
  "Electrical Breakdown": "Electrical or controls",
  "Mechanical Breakdown": "Hydraulic system",
  "Track Problem": "Tracks or final drive",
  "Hydraulic Breakdown": "Hydraulic system",
  "Screen Problem": "Worn or torn screen media",
  "Conveyor/Belt Problem": "Worn belts, skirting, or scrapers",
  "No Diesel": "No diesel",
  diesel: "No diesel",
  "No diesel / fuel": "No diesel",
  "no diesel fuel": "No diesel",
  "Waiting for Material": "Waiting for material",
  "Waiting for Loader": "Waiting for loader",
  Weather: "Weather",
  "Planned Maintenance": "Planned maintenance",
  "Safety Stop": "Safety stop",
  Cleaning: "Cleaning",
  "End of Operating Period": "End of operating period",
  Strike: "Strike",
  Other: "Other",
  "Screen media wear": "Worn or torn screen media",
  "Feed rate or overflow": "Feed rate or screen overflow",
};

/** One display label for a stored stop reason, including old wording and casing. */
export function canonicalStopReason(reason, siteSettings) {
  const raw = String(reason || "").trim();
  if (!raw) return "Stop";
  const key = reasonKey(raw);
  const list = resolveStopReasons(siteSettings);

  const listed = list.find((row) => reasonKey(row.reason) === key);
  if (listed) return listed.reason;

  const alias = Object.entries(LEGACY_REASON_CANONICAL).find(([from]) => reasonKey(from) === key);
  if (alias) {
    const mapped = list.find((row) => reasonKey(row.reason) === reasonKey(alias[1]));
    return mapped?.reason || alias[1];
  }

  if (key.length >= 4) {
    const hits = list.filter((row) => {
      const rk = reasonKey(row.reason);
      return rk.includes(key) || key.includes(rk);
    });
    if (hits.length === 1) return hits[0].reason;
  }

  return raw;
}

function copyDefaults() {
  return DEFAULT_STOP_REASONS.map((r) => ({ ...r }));
}

function signature(list) {
  return list.map((r) => `${r.reason}|${r.owner}`).sort().join("\n");
}

export function normalizeStopReasons(list) {
  if (!Array.isArray(list) || !list.length) return copyDefaults();
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const reason = String(row?.reason || row?.label || "").trim();
    const owner = String(row?.owner || DEFAULT_STOP_OWNERS.SITE).trim() || DEFAULT_STOP_OWNERS.SITE;
    const seenKey = reasonKey(reason);
    if (!reason || seen.has(seenKey)) continue;
    seen.add(seenKey);
    out.push({ reason, owner });
  }
  if (!out.length || signature(out) === PREVIOUS_DEFAULT_SIGNATURE) return copyDefaults();
  return out;
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
      owner.toLowerCase().includes("mechanical")
    ))
  );
}

export function ownerForStopReason(reason, siteSettings) {
  const list = resolveStopReasons(siteSettings);
  const canon = canonicalStopReason(reason, siteSettings);
  const hit = list.find((r) => r.reason === canon)
    || list.find((r) => reasonKey(r.reason) === reasonKey(reason));
  if (hit) return hit.owner;
  const legacy = Object.entries(LEGACY_STOP_OWNERS).find(([label]) => (
    reasonKey(label) === reasonKey(reason) || reasonKey(label) === reasonKey(canon)
  ));
  if (legacy) return legacy[1];
  return DEFAULT_STOP_OWNERS.SITE;
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
  "Feed rate or screen overflow",
  "Feed rate or overflow",
  "Product not to size",
  "Hopper, chute, or wear plate",
]);

export function isWarriorOnlyReason(reason) {
  return WARRIOR_ONLY_REASONS.has(reason);
}

/** Stop picker groups for one machine: reasons grouped by role, headed by that machine's owner names. */
export function stopReasonGroupsForMachine(machine, siteSettings) {
  const line = machineLine(machine);
  const list = resolveStopReasons(siteSettings).filter((row) => (
    line === "screener" || line == null || !isWarriorOnlyReason(row.reason)
  ));
  const order = [];
  const byRole = {};
  for (const row of list) {
    const role = stopOwnerRole(row.reason, siteSettings);
    if (!byRole[role]) {
      byRole[role] = [];
      order.push(role);
    }
    byRole[role].push(row.reason);
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

/** Problem-type groups, labelled with this machine's owners. Warrior faults stay on the screen. */
export function issueAreaGroupsForMachine(machine, siteSettings) {
  const line = machineLine(machine);
  const contractor = machineOwnerName(machine, OWNER_ROLES.CONTRACTOR, siteSettings);
  const wear = machineOwnerName(machine, OWNER_ROLES.WEAR, siteSettings);
  return ISSUE_AREA_GROUPS.map((group) => {
    let label = group.label;
    if (group.label.startsWith("Darkchild")) {
      label = `${contractor} — mechanical, engine, hydraulic, electrical`;
    } else if (group.label.startsWith("Berlington")) {
      label = `${wear} — wear and consumables`;
    }
    const areas = (line === "screener" || !line)
      ? group.areas
      : group.areas.filter((area) => !isWarriorOnlyReason(area));
    return { ...group, label, areas };
  }).filter((group) => group.areas.length);
}
