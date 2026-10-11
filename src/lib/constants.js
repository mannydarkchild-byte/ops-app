export const MEDIA_BUCKET = "ops-media";

export const ROLES = {
  OPERATOR: "operator",
  MECHANIC: "mechanic",
  SUPERVISOR: "supervisor",
  MANAGER: "manager",
  ADMIN: "admin",
  DISPATCH: "dispatch",
  STOREROOM: "storeroom",
};

export const SHIFT = {
  RUNNING: "RUNNING",
  SUBMITTED: "SUBMITTED",
  WAITING_FOR_VERIFICATION: "WAITING_FOR_VERIFICATION",
  VERIFIED: "VERIFIED",
  CORRECTION_REQUIRED: "CORRECTION_REQUIRED",
  RESUBMITTED: "RESUBMITTED",
};

export const ISSUE = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WITH_MECHANIC: "WITH_MECHANIC",
  WAITING_FOR_PARTS: "WAITING_FOR_PARTS",
  REPAIR_DONE: "REPAIR_DONE",
  RESOLVED: "RESOLVED",
};

/** Who owns the downtime when this stop reason is chosen. */
export const STOP_OWNERS = {
  DARKCHILD: "Darkchild",
  BERLINGTON: "Berlington",
  SITE: "Site / operations",
};

/**
 * Darkchild → mechanical, engine, hydraulic, electrical.
 * Berlington → wear and consumables.
 * Site → operations, production, and weather.
 */
export const STOP_REASON_OWNER = {
  "Screenbox bearings or drive": STOP_OWNERS.DARKCHILD,
  "Conveyor or feeder drive": STOP_OWNERS.DARKCHILD,
  "Hydraulic system": STOP_OWNERS.DARKCHILD,
  "Engine or cooling": STOP_OWNERS.DARKCHILD,
  "Electrical or controls": STOP_OWNERS.DARKCHILD,
  "Tracks or final drive": STOP_OWNERS.DARKCHILD,
  "Worn or torn screen media": STOP_OWNERS.BERLINGTON,
  "Worn belts, skirting, or scrapers": STOP_OWNERS.BERLINGTON,
  "Worn rollers or impact bars": STOP_OWNERS.BERLINGTON,
  "Worn tracks or undercarriage": STOP_OWNERS.BERLINGTON,
  "Hopper, chute, or wear plate": STOP_OWNERS.BERLINGTON,
  "No diesel": STOP_OWNERS.BERLINGTON,
  "Feed rate or screen overflow": STOP_OWNERS.SITE,
  "Product not to size": STOP_OWNERS.SITE,
  "Build-up, wet, or sticky material": STOP_OWNERS.SITE,
  "Belt off-centre": STOP_OWNERS.SITE,
  Dust: STOP_OWNERS.SITE,
  "Waiting for material": STOP_OWNERS.SITE,
  "Waiting for loader": STOP_OWNERS.SITE,
  Weather: STOP_OWNERS.SITE,
  Cleaning: STOP_OWNERS.SITE,
  "Safety stop": STOP_OWNERS.SITE,
  "Planned maintenance": STOP_OWNERS.SITE,
  "End of operating period": STOP_OWNERS.SITE,
  Strike: STOP_OWNERS.SITE,
  Other: STOP_OWNERS.SITE,
};

export function stopReasonOwner(reason) {
  return STOP_REASON_OWNER[reason] || STOP_OWNERS.SITE;
}

/** Stop reasons that should prompt "Also report a problem?" */
export const MECHANICAL_STOP_REASONS = [
  "Screenbox bearings or drive", "Conveyor or feeder drive", "Hydraulic system",
  "Engine or cooling", "Electrical or controls", "Tracks or final drive",
  "Worn or torn screen media", "Worn belts, skirting, or scrapers",
  "Worn rollers or impact bars", "Worn tracks or undercarriage",
  "Hopper, chute, or wear plate",
];

/** Grouped stop reasons for the operator picker (owner first). */
export const STOP_REASON_GROUPS = [
  {
    owner: STOP_OWNERS.DARKCHILD,
    hint: "Darkchild — mechanical, engine, hydraulic, electrical",
    reasons: [
      "Screenbox bearings or drive", "Conveyor or feeder drive", "Hydraulic system",
      "Engine or cooling", "Electrical or controls", "Tracks or final drive",
    ],
  },
  {
    owner: STOP_OWNERS.BERLINGTON,
    hint: "Berlington — wear and consumables",
    reasons: [
      "Worn or torn screen media", "Worn belts, skirting, or scrapers",
      "Worn rollers or impact bars", "Worn tracks or undercarriage",
      "Hopper, chute, or wear plate", "No diesel",
    ],
  },
  {
    owner: STOP_OWNERS.SITE,
    hint: "Site — operations, production, weather",
    reasons: [
      "Feed rate or screen overflow", "Product not to size",
      "Build-up, wet, or sticky material", "Belt off-centre", "Dust",
      "Waiting for material", "Waiting for loader", "Weather", "Cleaning",
      "Safety stop", "Planned maintenance", "End of operating period", "Strike", "Other",
    ],
  },
];

/** Starter parts list for Warrior 2100 — site can add more in admin later */
export const WARRIOR_PARTS_CATALOG = [
  { sku: "SCR-MESH", name: "Screen mesh panel", category: "Screen" },
  { sku: "SCR-TENSION", name: "Screen tension springs", category: "Screen" },
  { sku: "CV-BELT", name: "Conveyor belt section", category: "Conveyor" },
  { sku: "CV-SCRAPER", name: "Belt scraper", category: "Conveyor" },
  { sku: "CV-ROLLER", name: "Conveyor roller", category: "Conveyor" },
  { sku: "HYD-HOSE", name: "Hydraulic hose", category: "Hydraulic" },
  { sku: "HYD-OIL", name: "Hydraulic oil", category: "Hydraulic" },
  { sku: "ENG-OIL", name: "Engine oil", category: "Engine" },
  { sku: "ENG-FILTER", name: "Engine oil filter", category: "Engine" },
  { sku: "AIR-FILTER", name: "Air filter", category: "Engine" },
  { sku: "FUEL-FILTER", name: "Fuel filter", category: "Engine" },
  { sku: "TRK-PAD", name: "Track pad", category: "Tracks" },
  { sku: "TRK-ROLLER", name: "Track roller", category: "Tracks" },
  { sku: "BRG-BEARING", name: "Bearing", category: "Mechanical" },
  { sku: "BLT-VBELT", name: "V-belt", category: "Mechanical" },
  { sku: "BOLT-KIT", name: "Bolts & fasteners kit", category: "Consumables" },
  { sku: "GREASE", name: "Grease cartridge", category: "Consumables" },
  { sku: "SKIRT-RUB", name: "Skirting rubber", category: "Screen" },
];

export const SYNC_STATUS = {
  SYNCED: "synced",
  PENDING: "pending",
  SYNCING: "syncing",
  FAILED: "failed",
  CONFLICT: "conflict",
};

export const STOP_REASONS = STOP_REASON_GROUPS.flatMap((g) => g.reasons);

/** Operator clocks out before pre-start or before starting the machine */
export const EARLY_CLOCK_OUT_REASONS = [
  "Sent home / stood down",
  "Wrong machine assigned",
  "Medical / personal emergency",
  "Safety concern on site",
  "Machine not ready / waiting for parts",
  "Strike / site shutdown",
  "Other",
];

export const EXPENSE_CATEGORIES = [
  "Fuel", "Parts", "Hydraulic Oil", "Engine Oil", "Belts",
  "Bolts & Nuts", "Consumables", "Labour", "Transport", "Tools", "Other",
];

/** Grouped problem types — owner first, then the Warrior 2100 fault. */
export const ISSUE_AREA_GROUPS = [
  {
    label: "Darkchild — mechanical, engine, hydraulic, electrical",
    areas: [
      "Screenbox bearings or drive", "Conveyor or feeder drive", "Hydraulic system",
      "Engine or cooling", "Electrical or controls", "Tracks or final drive",
    ],
  },
  {
    label: "Berlington — wear and consumables",
    areas: [
      "Screen media wear", "Belts, skirting, or scrapers", "Rollers or impact bars",
      "Track and undercarriage wear", "Hopper, chute, or wear plate", "No diesel / fuel",
    ],
  },
  {
    label: "Site — operations, production, weather",
    areas: [
      "Feed rate or overflow", "Product not to size", "Build-up or wet material",
      "Belt off-centre", "Dust", "Waiting for material", "Waiting for loader",
      "Cleaning", "Safety", "Planned maintenance",
      "Strike / labour action", "Weather", "Access / roads",
      "Power / utilities", "Security", "Housekeeping / site",
    ],
  },
  {
    label: "Commercial & suppliers",
    areas: [
      "Supplier not paid", "Parts not delivered", "Client / contract",
      "Billing / paperwork", "Transport / delivery",
    ],
  },
  {
    label: "People & supervision",
    areas: [
      "Staffing / absenteeism", "Training needed",
      "Supervision", "Health & safety incident",
    ],
  },
  {
    label: "Other",
    areas: ["Other"],
  },
];

export const ISSUE_AREAS = ISSUE_AREA_GROUPS.flatMap((g) => g.areas);

/** Site-wide problems — no specific machine required */
export const SITE_WIDE_ISSUE_AREAS = new Set([
  "Strike / labour action", "Weather", "Access / roads",
  "Power / utilities", "Security", "Housekeeping / site",
  "Supplier not paid", "Parts not delivered", "Client / contract",
  "Billing / paperwork", "Transport / delivery",
  "Staffing / absenteeism", "Training needed",
  "Supervision", "Health & safety incident", "Other",
]);

export function issueAreaRequiresMachine(area) {
  return area && !SITE_WIDE_ISSUE_AREAS.has(area);
}

export const ISSUE_PRIORITIES = ["Low", "Medium", "High", "Critical"];

/** v1 primary machine — multi-template support TBD */
export const PRIMARY_MACHINE_CODE = "W2100";
export const TANK_LEVELS = ["Full", "¾", "½", "¼", "Empty"];

export const BREAKDOWN_STATUS = {
  OPEN: "open",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CLOSED: "closed",
};

export const MAINTENANCE_STATUS = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  DEFERRED: "deferred",
};

/** Tables synced with Supabase (incremental pull + outbox push) */
export const SYNC_TABLES = [
  "sites",
  "machines",
  "profiles",
  "shifts",
  "events",
  "expenses",
  "inspections",
  "issues",
  "issue_messages",
  "work_sessions",
  "shift_submissions",
  "shift_corrections",
  "fuel_logs",
  "machine_hour_readings",
  "breakdowns",
  "maintenance_jobs",
  "maintenance_parts",
  "inventory_items",
  "inventory_movements",
  "site_settings",
  "site_dispatch",
];

/** Columns allowed to push per table (prevents leaking local-only fields) */
export const ALLOWED_COLUMNS = {
  sites: ["id", "name", "code", "timezone", "organization_id", "active", "created_at", "updated_at"],
  machines: ["id", "site_id", "name", "code", "type", "organization_id", "start_hour_meter", "billable_rate", "active", "created_at", "updated_at"],
  profiles: ["id", "email", "name", "role", "site_id", "machine_id", "organization_id", "phone", "shift_band", "active", "created_at", "updated_at"],
  shifts: ["id", "site_id", "machine_id", "operator_id", "operator_name", "organization_id", "assigned_supervisor_id", "assigned_supervisor_name", "shift_status", "started_at", "ended_at", "start_hour_meter", "end_hour_meter", "hours_worked", "runtime_minutes", "downtime_minutes", "verification_token", "supervisor_comment", "supervisor_signature_ref", "supervisor_signature_name", "correction_history", "verified_at", "verified_by", "notes", "created_at", "updated_at", "is_manual", "tonnes_dispatched", "trucks_dispatched", "tonnes_on_floor", "weighbridge_photo"],
  events: ["id", "site_id", "shift_id", "machine_id", "operator_id", "operator_name", "organization_id", "type", "reason", "note", "stopped_at", "restarted_at", "downtime_minutes", "status", "photo_data", "timestamp", "created_at", "updated_at"],
  expenses: ["id", "site_id", "machine_id", "operator_id", "operator_name", "organization_id", "category", "amount", "vendor", "description", "receipt_photo", "date", "created_at", "updated_at"],
  inspections: ["id", "site_id", "machine_id", "operator_id", "operator_name", "organization_id", "type", "category", "item_name", "status", "photo", "remark", "inspection_id", "timestamp", "created_at", "updated_at"],
  issues: ["id", "site_id", "machine_id", "reporter_id", "reporter_name", "organization_id", "current_owner_id", "current_owner_role", "current_owner_name", "area", "priority", "description", "status", "created_at", "updated_at", "resolved_at", "resolved_by", "resolved_by_name"],
  issue_messages: ["id", "issue_id", "sender_id", "sender_name", "sender_role", "type", "text", "media_url", "media_type", "created_at"],
  work_sessions: ["id", "site_id", "machine_id", "operator_id", "operator_name", "organization_id", "clock_in", "clock_out", "status", "notes", "supervisor_signature", "signature_name", "signature_date", "created_at", "updated_at"],
  shift_submissions: ["id", "site_id", "machine_id", "shift_id", "operator_id", "operator_name", "organization_id", "status", "submitted_at", "verified_at", "verified_by", "correction_number", "created_at", "updated_at"],
  shift_corrections: ["id", "shift_id", "submission_id", "correction_number", "field", "old_value", "new_value", "reason", "corrected_by", "corrected_at"],
  fuel_logs: ["id", "site_id", "machine_id", "shift_id", "operator_id", "operator_name", "organization_id", "litres", "hour_meter", "tank_level", "photo_pump", "photo_dipstick", "note", "timestamp", "created_at", "updated_at"],
  machine_hour_readings: ["id", "site_id", "machine_id", "operator_id", "operator_name", "organization_id", "reading", "photo_data", "reading_at", "source", "shift_id", "notes", "created_at", "updated_at"],
  breakdowns: ["id", "site_id", "machine_id", "reported_by", "reported_by_name", "assigned_to", "assigned_to_name", "organization_id", "issue_id", "title", "description", "diagnosis", "status", "priority", "started_at", "completed_at", "created_at", "updated_at"],
  maintenance_jobs: ["id", "site_id", "machine_id", "breakdown_id", "mechanic_id", "mechanic_name", "organization_id", "title", "work_performed", "labour_hours", "recommendations", "status", "started_at", "completed_at", "created_at", "updated_at"],
  maintenance_parts: ["id", "maintenance_job_id", "inventory_item_id", "part_name", "quantity", "notes", "created_at"],
  inventory_items: ["id", "site_id", "sku", "name", "category", "organization_id", "quantity_on_hand", "unit", "reorder_level", "created_at", "updated_at"],
  inventory_movements: ["id", "site_id", "inventory_item_id", "maintenance_job_id", "quantity_change", "reason", "performed_by", "performed_by_name", "created_at"],
  site_settings: ["id", "site_id", "organization_id", "billing_cycle_start_day", "primary_machine_id", "contractor_name", "equipment_owner_name", "client_site_name", "excavator_bucket_tonnes", "fel_bucket_tonnes", "prestart_items", "earthmoving_prestart_items", "prestart_status_options", "inspection_groups", "earthmoving_inspection_groups", "stop_reasons", "created_at", "updated_at"],
  site_dispatch: ["id", "site_id", "organization_id", "dispatch_date", "tonnes_dispatched", "trucks_dispatched", "tonnes_on_floor", "tonnes_screened", "excavator_buckets", "fel_buckets", "excavator_bucket_tonnes", "fel_bucket_tonnes", "weighbridge_photo", "recorded_by", "recorded_by_name", "status", "assigned_supervisor_id", "assigned_supervisor_name", "submitted_at", "signed_at", "signed_by", "signed_by_name", "supervisor_comment", "created_at", "updated_at"],
};

/** Operator pre-start checklist (14 items) — before starting machine */
export const PRESTART_INSPECTION_ITEMS = [
  "Check engine fuel and lubrication oils and top up as necessary.",
  "Check hydraulic tank oil level, and top up as necessary.",
  "Check screens meshes for wear and material build up, clean or replace as necessary.",
  "Remove any material build up around moving parts and ensure ALL ROLLERS can rotate freely.",
  "Check ALL guards are in place and properly secured.",
  "Check ALL bolts are in place and fully tightened.",
  "Grease bearings.",
  "Check belt tensions.",
  "Check battery terminals.",
  "Check water levels.",
  "Check track tensioning.",
  "See that ALL conveyor belts are train properly.",
  "Check manganese wear (where applicable).",
  "Check ALL scirting rubbers.",
];

/** Shared walk-around for an excavator and a front end loader. Admin can edit it per site. */
export const EARTHMOVING_PRESTART_ITEMS = [
  "Walk around the machine. Look for leaks, cracks, and loose or missing parts.",
  "Check engine oil and top up if needed.",
  "Check hydraulic oil level and top up if needed.",
  "Check coolant and top up if needed.",
  "Check the fuel level.",
  "Check the battery terminals.",
  "Check tracks or tyres.",
  "Check the bucket, teeth or cutting edge, and the pins.",
  "Check the arms, rams, and hydraulic hoses for leaks or damage.",
  "Check all guards are in place and secured.",
  "Check lights, horn, and the reverse alarm.",
  "Check the seat belt and that the controls move freely.",
  "Grease the pins and bushings.",
];

export const PRESTART_STATUS_OPTIONS = ["OK", "Action taken", "Needs attention"];

export const PRESTART_STATUS_GUIDE = {
  OK: "This item looks fine. Go to the next check.",
  "Action taken": "You found something and already fixed it. Add a short note or a photo.",
  "Needs attention": "This is a problem. Add photos. You can report it now so the supervisor sees it.",
};

export const EARLY_CLOCK_OUT_GUIDE = {
  "Sent home / stood down": "You were told not to work. This still records your time on site.",
  "Wrong machine assigned": "You clocked in on the wrong machine. Leave now so the right operator can start.",
  "Medical / personal emergency": "You need to leave site. Your time stops when you confirm.",
  "Safety concern on site": "Leave if it is not safe. Tell the supervisor — you can also report a problem.",
  "Machine not ready / waiting for parts": "You arrived but the machine cannot start. Clock out so your time is recorded.",
  "Strike / site shutdown": "Work has stopped on site. Clock out to close your time.",
  Other: "Say why you are leaving. This is your time, not machine hours.",
};

export const STOP_REASON_GUIDE = {
  "Screenbox bearings or drive": "Noise, heat, or knock in the screenbox. Darkchild. Add what you hear or see.",
  "Conveyor or feeder drive": "A drive, drum, or coupling has failed. Darkchild. Worn belts are Berlington.",
  "Hydraulic system": "Leak, slow function, hot oil, or a pump, motor, or cylinder that will not move. Darkchild.",
  "Engine or cooling": "Overheating, low power, filters, fuel, or oil pressure. Darkchild.",
  "Electrical or controls": "Battery, wiring, switch, sensor, alarm, or remote. Darkchild.",
  "Tracks or final drive": "The machine will not track, or a final drive has failed. Darkchild. Worn pads are Berlington.",
  "Worn or torn screen media": "Mesh, punch plate, or panel is worn, torn, or loose. Berlington.",
  "Worn belts, skirting, or scrapers": "Belt, splice, skirting, or scraper is worn through. Berlington.",
  "Worn rollers or impact bars": "Rollers or impact bars are worn. A seized drive is Darkchild.",
  "Worn tracks or undercarriage": "Worn pads, rollers, idlers, or sprockets. Berlington.",
  "Hopper, chute, or wear plate": "Liners, hopper steel, or chutes are worn or holed. Berlington.",
  "No diesel": "No fuel. Berlington. Tell the supervisor.",
  "Feed rate or screen overflow": "Too much feed, or the decks are overflowing. The machine is not broken. Site.",
  "Product not to size": "Wrong media, angle, or speed for this feed. Site, unless the media is worn.",
  "Build-up, wet, or sticky material": "Material is packing up or blocking the plant. Site.",
  "Belt off-centre": "The machine is not level, or the load is uneven. Site. A failed drive is Darkchild.",
  Dust: "Dust has stopped work. Site.",
  "Waiting for material": "Machine is fine. You are waiting for feed. Site.",
  "Waiting for loader": "Machine is fine. You are waiting for the loader. Site.",
  Weather: "Weather has stopped work. The machine is not broken. Site.",
  Cleaning: "A short stop to clean. Restart when ready. Site.",
  "Safety stop": "You stopped for safety. Do not restart until it is safe. Site.",
  "Planned maintenance": "A planned stop. Restart when it is done, or finish the day. Site.",
  "End of operating period": "Work time for the machine is over. Finish the day next. Site.",
  Strike: "Work has stopped on site. Site.",
  Other: "Say what happened. This stops the machine, not your time on site.",
};

/** Mechanic full inspection — detailed grouped checklist */
export const INSPECTION_GROUPS = [
  { category: "Screen Box", icon: "📐", items: [
    ["Screen Media", ["Good", "Worn", "Replace"]],
    ["Screen Tension", ["Good", "Attention", "Fault"]],
    ["Springs / Rubber Buffers", ["Good", "Worn", "Replace"]],
    ["Bearings", ["Good", "Worn", "Fault"]],
    ["Screen Box Condition", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Conveyor System", icon: "⚙️", items: [
    ["Feed Conveyor Belt", ["Good", "Worn", "Replace"]],
    ["Main Conveyor Belt", ["Good", "Worn", "Replace"]],
    ["Side Conveyor Belt", ["Good", "Worn", "Replace"]],
    ["Belt Tracking", ["Good", "Attention", "Fault"]],
    ["Rollers", ["Good", "Worn", "Fault"]],
    ["Pulleys", ["Good", "Worn", "Fault"]],
    ["Belt Scrapers", ["Good", "Worn", "Replace"]],
  ]},
  { category: "Engine & Hydraulics", icon: "🔧", items: [
    ["Engine Oil Level", ["Good", "Low", "Critical"]],
    ["Hydraulic Oil Level", ["Good", "Low", "Critical"]],
    ["Coolant Level", ["Good", "Low", "Critical"]],
    ["Fuel Level", ["Good", "Low", "Critical"]],
    ["Hydraulic Hoses", ["Good", "Attention", "Fault"]],
    ["Hydraulic Cylinders", ["Good", "Attention", "Fault"]],
    ["Hydraulic Leaks", ["None", "Minor", "Major"]],
    ["Air Filter", ["Good", "Dirty", "Blocked"]],
    ["Radiator / Cooling", ["Good", "Attention", "Fault"]],
    ["Engine Leaks", ["None", "Minor", "Major"]],
  ]},
  { category: "Tracks & Undercarriage", icon: "🏗️", items: [
    ["Track Tension", ["Good", "Attention", "Fault"]],
    ["Track Wear", ["Good", "Worn", "Replace"]],
    ["Track Rollers", ["Good", "Worn", "Replace"]],
    ["Track Idlers", ["Good", "Worn", "Replace"]],
    ["Drive Motors", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Electrical & Controls", icon: "⚡", items: [
    ["Control Panel Lights", ["Working", "Faulty"]],
    ["Emergency Stops", ["Pass", "Fail"]],
    ["Beacon / Warning Lights", ["Working", "Faulty"]],
    ["Reverse Alarm", ["Working", "Faulty"]],
    ["Horn", ["Working", "Faulty"]],
    ["Battery Isolation Switch", ["Working", "Faulty"]],
    ["Joysticks / Controls", ["Working", "Faulty"]],
    ["Wiring / Connections", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Safety & Housekeeping", icon: "🛡️", items: [
    ["Fire Extinguisher", ["Present", "Missing", "Expired"]],
    ["Guards & Covers", ["Good", "Attention", "Missing"]],
    ["Hand Rails & Walkways", ["Good", "Attention", "Fault"]],
    ["Steps & Access", ["Good", "Attention", "Fault"]],
    ["General Cleanliness", ["Good", "Attention"]],
    ["Loose Bolts / Fasteners", ["None", "Found"]],
    ["Structural Cracks", ["None", "Found"]],
    ["Safety Decals", ["Good", "Faded", "Missing"]],
    ["Unusual Sounds", ["None", "Observed"]],
    ["Unusual Vibration", ["None", "Observed"]],
  ]},
];

/** Mechanic inspection for an excavator or front end loader. The screen keeps INSPECTION_GROUPS. */
export const EARTHMOVING_INSPECTION_GROUPS = [
  { category: "Engine", icon: "🔧", items: [
    ["Engine oil", ["Good", "Low", "Critical"]],
    ["Coolant", ["Good", "Low", "Critical"]],
    ["Fuel system", ["Good", "Attention", "Fault"]],
    ["Air filter", ["Good", "Dirty", "Blocked"]],
    ["Belts", ["Good", "Worn", "Replace"]],
    ["Engine leaks", ["None", "Minor", "Major"]],
    ["Radiator / cooling", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Hydraulics", icon: "💧", items: [
    ["Hydraulic oil", ["Good", "Low", "Critical"]],
    ["Hoses and pipes", ["Good", "Attention", "Fault"]],
    ["Cylinders / rams", ["Good", "Attention", "Fault"]],
    ["Hydraulic leaks", ["None", "Minor", "Major"]],
    ["Pump", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Bucket and linkage", icon: "⛏️", items: [
    ["Bucket or blade", ["Good", "Worn", "Replace"]],
    ["Teeth or cutting edge", ["Good", "Worn", "Replace"]],
    ["Pins and bushings", ["Good", "Worn", "Replace"]],
    ["Boom and arms", ["Good", "Attention", "Fault"]],
    ["Quick hitch / coupler", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Tracks, tyres and undercarriage", icon: "🏗️", items: [
    ["Tracks or tyres", ["Good", "Worn", "Replace"]],
    ["Track tension or tyre pressure", ["Good", "Attention", "Fault"]],
    ["Rollers, idlers or wheel bearings", ["Good", "Worn", "Replace"]],
    ["Sprockets or rims", ["Good", "Worn", "Replace"]],
    ["Final drives or axles", ["Good", "Attention", "Fault"]],
  ]},
  { category: "Cab and controls", icon: "⚡", items: [
    ["Seat and seat belt", ["Good", "Attention", "Fault"]],
    ["Joysticks / controls", ["Working", "Faulty"]],
    ["Gauges and warning lights", ["Working", "Faulty"]],
    ["Horn", ["Working", "Faulty"]],
    ["Lights and beacon", ["Working", "Faulty"]],
    ["Reverse alarm", ["Working", "Faulty"]],
    ["Mirrors and wipers", ["Good", "Attention", "Fault"]],
    ["Emergency stop", ["Pass", "Fail"]],
  ]},
  { category: "Safety", icon: "🛡️", items: [
    ["Fire extinguisher", ["Present", "Missing", "Expired"]],
    ["Guards and covers", ["Good", "Attention", "Missing"]],
    ["Steps and handrails", ["Good", "Attention", "Fault"]],
    ["Structural cracks", ["None", "Found"]],
    ["Loose bolts", ["None", "Found"]],
    ["Safety decals", ["Good", "Faded", "Missing"]],
  ]},
];

export function getMechanicInspectionItems() {
  return INSPECTION_GROUPS.flatMap((group) =>
    group.items.map(([item_name, options]) => ({
      item_name,
      category: group.category,
      options,
    }))
  );
}
