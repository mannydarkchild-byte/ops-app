export const MEDIA_BUCKET = "ops-media";

export const ROLES = {
  OPERATOR: "operator",
  MECHANIC: "mechanic",
  SUPERVISOR: "supervisor",
  MANAGER: "manager",
  ADMIN: "admin",
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

/** Stop reasons that should prompt "Also report a problem?" */
export const MECHANICAL_STOP_REASONS = [
  "Mechanical Breakdown", "Hydraulic Breakdown", "Electrical Breakdown",
  "Engine Problem", "Screen Problem", "Conveyor/Belt Problem", "Track Problem",
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

export const STOP_REASONS = [
  "Mechanical Breakdown", "Hydraulic Breakdown", "Electrical Breakdown",
  "Engine Problem", "Screen Problem", "Conveyor/Belt Problem", "Track Problem",
  "Waiting for Material", "Waiting for Loader", "No Diesel", "Weather",
  "Planned Maintenance", "Safety Stop", "Cleaning", "End of Operating Period", "Strike", "Other",
];

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

/** Grouped problem types — not every issue is machine-related */
export const ISSUE_AREA_GROUPS = [
  {
    label: "Machine — mechanical",
    areas: ["Mechanical", "Hydraulic", "Electrical", "Engine", "Screen", "Conveyor", "Tracks"],
  },
  {
    label: "Machine — operations",
    areas: [
      "Safety", "Planned maintenance", "No diesel / fuel",
      "Waiting for material", "Waiting for loader",
    ],
  },
  {
    label: "Site & production",
    areas: [
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
];

/** Columns allowed to push per table (prevents leaking local-only fields) */
export const ALLOWED_COLUMNS = {
  sites: ["id", "name", "code", "timezone", "active", "created_at", "updated_at"],
  machines: ["id", "site_id", "name", "code", "type", "start_hour_meter", "billable_rate", "active", "created_at", "updated_at"],
  profiles: ["id", "email", "name", "role", "site_id", "machine_id", "phone", "shift_band", "active", "created_at", "updated_at"],
  shifts: ["id", "site_id", "machine_id", "operator_id", "operator_name", "assigned_supervisor_id", "assigned_supervisor_name", "shift_status", "started_at", "ended_at", "start_hour_meter", "end_hour_meter", "hours_worked", "runtime_minutes", "downtime_minutes", "verification_token", "supervisor_comment", "supervisor_signature_ref", "supervisor_signature_name", "correction_history", "verified_at", "verified_by", "notes", "created_at", "updated_at", "is_manual"],
  events: ["id", "site_id", "shift_id", "machine_id", "operator_id", "operator_name", "type", "reason", "note", "stopped_at", "restarted_at", "downtime_minutes", "status", "photo_data", "timestamp", "created_at", "updated_at"],
  expenses: ["id", "site_id", "machine_id", "operator_id", "operator_name", "category", "amount", "vendor", "description", "receipt_photo", "date", "created_at", "updated_at"],
  inspections: ["id", "site_id", "machine_id", "operator_id", "operator_name", "type", "category", "item_name", "status", "photo", "remark", "inspection_id", "timestamp", "created_at", "updated_at"],
  issues: ["id", "site_id", "machine_id", "reporter_id", "reporter_name", "current_owner_id", "current_owner_role", "current_owner_name", "area", "priority", "description", "status", "created_at", "updated_at", "resolved_at", "resolved_by", "resolved_by_name"],
  issue_messages: ["id", "issue_id", "sender_id", "sender_name", "sender_role", "type", "text", "media_url", "media_type", "created_at"],
  work_sessions: ["id", "site_id", "machine_id", "operator_id", "operator_name", "clock_in", "clock_out", "status", "notes", "supervisor_signature", "signature_name", "signature_date", "created_at", "updated_at"],
  shift_submissions: ["id", "site_id", "machine_id", "shift_id", "operator_id", "operator_name", "status", "submitted_at", "verified_at", "verified_by", "correction_number", "created_at", "updated_at"],
  shift_corrections: ["id", "shift_id", "submission_id", "correction_number", "field", "old_value", "new_value", "reason", "corrected_by", "corrected_at"],
  fuel_logs: ["id", "site_id", "machine_id", "shift_id", "operator_id", "operator_name", "litres", "hour_meter", "tank_level", "photo_pump", "photo_dipstick", "note", "timestamp", "created_at", "updated_at"],
  machine_hour_readings: ["id", "site_id", "machine_id", "operator_id", "operator_name", "reading", "photo_data", "reading_at", "source", "shift_id", "notes", "created_at", "updated_at"],
  breakdowns: ["id", "site_id", "machine_id", "reported_by", "reported_by_name", "assigned_to", "assigned_to_name", "issue_id", "title", "description", "diagnosis", "status", "priority", "started_at", "completed_at", "created_at", "updated_at"],
  maintenance_jobs: ["id", "site_id", "machine_id", "breakdown_id", "mechanic_id", "mechanic_name", "title", "work_performed", "labour_hours", "recommendations", "status", "started_at", "completed_at", "created_at", "updated_at"],
  maintenance_parts: ["id", "maintenance_job_id", "inventory_item_id", "part_name", "quantity", "notes", "created_at"],
  inventory_items: ["id", "site_id", "sku", "name", "category", "quantity_on_hand", "unit", "reorder_level", "created_at", "updated_at"],
  inventory_movements: ["id", "site_id", "inventory_item_id", "maintenance_job_id", "quantity_change", "reason", "performed_by", "performed_by_name", "created_at"],
  site_settings: ["id", "site_id", "billing_cycle_start_day", "primary_machine_id", "prestart_items", "prestart_status_options", "inspection_groups", "created_at", "updated_at"],
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
  "Mechanical Breakdown": "The machine is broken. Stop it here, then report the problem if you have not already.",
  "Hydraulic Breakdown": "Hydraulics have failed. Stop the machine and add what you see.",
  "Electrical Breakdown": "Electrical fault. Stop the machine. Do not restart until it is safe.",
  "Engine Problem": "Engine issue. Stop the machine and add details.",
  "Screen Problem": "Screen needs attention. Stop if you cannot keep working safely.",
  "Conveyor/Belt Problem": "Belt or conveyor is down. Stop and add what you see.",
  "Track Problem": "Tracks need attention. Stop if the machine cannot move safely.",
  "Waiting for Material": "Machine is fine. You are waiting for feed.",
  "Waiting for Loader": "Machine is fine. You are waiting for the loader.",
  "No Diesel": "No fuel. Stop the machine and tell the supervisor.",
  Weather: "Weather has stopped work. The machine is not broken.",
  "Planned Maintenance": "A planned stop. Restart when maintenance is done, or finish the day.",
  "Safety Stop": "You stopped for safety. Do not restart until it is safe.",
  Cleaning: "A short stop to clean. Restart when ready.",
  "End of Operating Period": "Work time for the machine is over. Finish the day next.",
  Strike: "Work has stopped on site.",
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

export function getMechanicInspectionItems() {
  return INSPECTION_GROUPS.flatMap((group) =>
    group.items.map(([item_name, options]) => ({
      item_name,
      category: group.category,
      options,
    }))
  );
}
