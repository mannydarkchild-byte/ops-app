/** Default stop reasons + owners. Admin/Manager can override per site in site_settings.stop_reasons. */

export const DEFAULT_STOP_OWNERS = {
  DARKCHILD: "Darkchild",
  BERLINGTON: "Berlington",
  SITE: "Site / operations",
};

/**
 * Warrior 2100 downtime.
 * Darkchild: mechanical, engine, hydraulic, electrical.
 * Berlington: wear and consumables.
 * Site: operations, production, and weather.
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
  [DEFAULT_STOP_OWNERS.DARKCHILD]: "Darkchild — mechanical, engine, hydraulic, electrical",
  [DEFAULT_STOP_OWNERS.BERLINGTON]: "Berlington — wear and consumables",
  [DEFAULT_STOP_OWNERS.SITE]: "Site — operations, production, weather",
};

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
    if (!reason || seen.has(reason)) continue;
    seen.add(reason);
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
  const hit = list.find((r) => r.reason === reason);
  if (hit) return hit.owner;
  return LEGACY_STOP_OWNERS[reason] || DEFAULT_STOP_OWNERS.SITE;
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
