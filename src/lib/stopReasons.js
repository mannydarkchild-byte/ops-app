/** Default stop reasons + owners. Admin/Manager can override per site in site_settings.stop_reasons. */

export const DEFAULT_STOP_OWNERS = {
  DARKCHILD: "Darkchild",
  BERLINGTON: "Berlington",
  SITE: "Site / operations",
};

export const DEFAULT_STOP_REASONS = [
  { reason: "Engine Problem", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Electrical Breakdown", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Mechanical Breakdown", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Track Problem", owner: DEFAULT_STOP_OWNERS.DARKCHILD },
  { reason: "Hydraulic Breakdown", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Screen Problem", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Conveyor/Belt Problem", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "No Diesel", owner: DEFAULT_STOP_OWNERS.BERLINGTON },
  { reason: "Waiting for Material", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Waiting for Loader", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Weather", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Planned Maintenance", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Safety Stop", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Cleaning", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "End of Operating Period", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Strike", owner: DEFAULT_STOP_OWNERS.SITE },
  { reason: "Other", owner: DEFAULT_STOP_OWNERS.SITE },
];

export function normalizeStopReasons(list) {
  if (!Array.isArray(list) || !list.length) return DEFAULT_STOP_REASONS.map((r) => ({ ...r }));
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const reason = String(row?.reason || row?.label || "").trim();
    const owner = String(row?.owner || DEFAULT_STOP_OWNERS.SITE).trim() || DEFAULT_STOP_OWNERS.SITE;
    if (!reason || seen.has(reason)) continue;
    seen.add(reason);
    out.push({ reason, owner });
  }
  return out.length ? out : DEFAULT_STOP_REASONS.map((r) => ({ ...r }));
}

export function resolveStopReasons(siteSettings) {
  return normalizeStopReasons(siteSettings?.stop_reasons);
}

export function ownerForStopReason(reason, siteSettings) {
  const list = resolveStopReasons(siteSettings);
  const hit = list.find((r) => r.reason === reason);
  return hit?.owner || DEFAULT_STOP_OWNERS.SITE;
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
    hint: owner,
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
