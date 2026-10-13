import { DEFAULT_STOP_REASONS } from "../lib/stopReasons.js";

export function isSiteSignPreview(shiftId, token) {
  return shiftId === "preview" || token === "preview";
}

const SAMPLE_SIGNATURE = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="90" viewBox="0 0 280 90">
  <path d="M18 58 C36 18 62 16 88 48 S130 86 158 42 S210 12 262 52" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/>
  <path d="M52 62 C70 70 96 66 118 58" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/>
</svg>`)}`;

/** Sample payload shaped like site_shift_summary, so the sign page shows the real daily report. */
export function siteSignPreviewData() {
  const started = new Date();
  started.setHours(6, 0, 0, 0);
  const ended = new Date(started);
  ended.setHours(14, 0, 0, 0);
  const t = (h, m) => {
    const d = new Date(started);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const shiftId = "preview";
  const operatorId = "op-preview";
  const machineId = "warrior-2100";
  return {
    machine_name: "Warrior 2100",
    site_name: "Site",
    contractor_name: "Darkchild",
    owner_name: "Berlington",
    client_name: "Site / operations",
    stop_reasons: DEFAULT_STOP_REASONS,
    fuel_litres: 186,
    machine: {
      id: machineId,
      name: "Warrior 2100",
      type: "screener",
      supplier_name: "Darkchild",
      wear_owner_name: "Berlington",
    },
    site: { name: "Site" },
    stops: [
      { reason: "Hydraulic system", minutes: 48, note: "", status: "closed", stopped_at: t(8, 10), restarted_at: t(8, 58) },
      { reason: "Waiting for loader", minutes: 35, note: "", status: "closed", stopped_at: t(11, 5), restarted_at: t(11, 40) },
      { reason: "Worn or torn screen media", minutes: 12, note: "", status: "closed", stopped_at: t(12, 20), restarted_at: t(12, 32) },
    ],
    events: [
      { id: "e-start", shift_id: shiftId, type: "MACHINE_STARTED", timestamp: t(6, 5) },
      { id: "e-s1", shift_id: shiftId, type: "STOP", reason: "Hydraulic system", downtime_minutes: 48, status: "closed", stopped_at: t(8, 10), restarted_at: t(8, 58), timestamp: t(8, 10) },
      { id: "e-s2", shift_id: shiftId, type: "STOP", reason: "Waiting for loader", downtime_minutes: 35, status: "closed", stopped_at: t(11, 5), restarted_at: t(11, 40), timestamp: t(11, 5) },
      { id: "e-s3", shift_id: shiftId, type: "STOP", reason: "Worn or torn screen media", downtime_minutes: 12, status: "closed", stopped_at: t(12, 20), restarted_at: t(12, 32), timestamp: t(12, 20) },
      { id: "e-end", shift_id: shiftId, type: "METER_END_CAPTURED", timestamp: t(14, 0) },
    ],
    fuel_logs: [
      { id: "f1", shift_id: shiftId, litres: 186, hour_meter: 4524, tank_level: "3/4", note: "", timestamp: t(6, 20) },
    ],
    inspections: [
      { id: "i1", machine_id: machineId, operator_id: operatorId, type: "Pre-Start Inspection", item_name: "Engine oil", status: "OK", remark: "", timestamp: t(5, 50) },
      { id: "i2", machine_id: machineId, operator_id: operatorId, type: "Pre-Start Inspection", item_name: "Tracks", status: "Action taken", remark: "Tensioned", timestamp: t(5, 50) },
    ],
    site_dispatch: {
      tonnes_dispatched: 1240,
      trucks_dispatched: 31,
      tonnes_screened: 1180,
      tonnes_on_floor: 90,
    },
    shift: {
      id: shiftId,
      machine_id: machineId,
      operator_id: operatorId,
      operator_name: "Thabo Mokoena",
      assigned_supervisor_name: "J. Petersen",
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      start_hour_meter: 4521,
      end_hour_meter: 4529.2,
      hours_worked: 8.2,
      runtime_minutes: 385,
      downtime_minutes: 95,
      shift_version: 1,
      machine_signature_name: "J. Petersen",
      machine_signature_ref: SAMPLE_SIGNATURE,
    },
  };
}
