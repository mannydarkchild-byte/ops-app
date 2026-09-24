import { saveLocal, saveManyLocal, readTable, dropLocalRecord } from "../lib/db.js";
import { acquireMachineLock, releaseMachineLock } from "../lib/machineLock.js";
import { scheduleSync } from "../lib/sync/engine.js";
import { supabase } from "../lib/supabase.js";
import { SHIFT, ISSUE, ROLES, BREAKDOWN_STATUS, MAINTENANCE_STATUS, issueAreaRequiresMachine } from "../lib/constants.js";
import { canCloseIssue, getShiftStatus } from "../lib/utils.js";
import { makeId, nowISO } from "../lib/utils.js";
import { storeMediaDataUrl } from "../lib/media.js";
import { getPrestartConfigForSite, getInspectionConfigForSite } from "../lib/siteConfig.js";
import { reconcileMachineOpenState } from "../lib/machineStatus.js";
import { findOpenStopForShift, meterHoursWorked, shiftDowntimeMinutes, shiftRuntimeMinutes } from "../lib/shiftMetrics.js";
export async function clockIn(user, machine, site, { assignedSupervisor } = {}) {
  if (!assignedSupervisor?.id) {
    throw new Error("Select the supervisor on duty before clocking in");
  }
  const s = {
    id: makeId("WORK"),
    site_id: site?.id,
    machine_id: machine?.id,
    operator_id: user.id,
    operator_name: user.name,
    assigned_supervisor_id: assignedSupervisor.id,
    assigned_supervisor_name: assignedSupervisor.name,
    clock_in: nowISO(),
    clock_out: null,
    status: "active",
    notes: null,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await saveLocal("work_sessions", s);
  await addEvent(user, machine, site, "CLOCK_IN", { note: "Clocked in" });
  scheduleSync();
  return s;
}

export async function clockOut(user, workSession, { note, signatureRef, signatureName }) {
  const now = nowISO();
  const updated = {
    ...workSession,
    clock_out: now,
    status: "ended",
    notes: note || null,
    supervisor_signature_ref: signatureRef,
    signature_name: signatureName,
    signature_date: now,
    updated_at: now,
  };
  await saveLocal("work_sessions", updated);
  scheduleSync();
  return updated;
}

/** Clock out before pre-start or before starting the machine — reason required */
export async function clockOutEarly(user, workSession, machine, site, { reason, note = "" }) {
  if (!reason?.trim()) throw new Error("Select a reason for clocking out");
  if (workSession.status !== "active") throw new Error("No active session to clock out");

  const now = nowISO();
  const detail = [reason, note?.trim()].filter(Boolean).join(" — ");
  const updated = {
    ...workSession,
    clock_out: now,
    status: "ended_early",
    notes: detail,
    updated_at: now,
  };
  await saveLocal("work_sessions", updated);
  await addEvent(user, machine, site, "CLOCK_OUT", {
    reason,
    note: `Early clock out — no shift started. ${note || ""}`.trim(),
  });
  scheduleSync();
  return updated;
}

async function resolveInspectionPhotoRef(photo) {
  if (!photo) return null;
  const first = Array.isArray(photo) ? photo[0] : photo;
  if (!first) return null;
  if (typeof first === "object" && first.ref) return first.ref;
  if (typeof first === "string") {
    if (first.startsWith("data:")) return storeMediaDataUrl(first, "inspection");
    if (first.startsWith("MEDIA")) return first;
  }
  return null;
}

async function resolveInspectionPhotoRefs(photo) {
  const list = Array.isArray(photo) ? photo : photo ? [photo] : [];
  const refs = [];
  for (const item of list) {
    const ref = await resolveInspectionPhotoRef(item);
    if (ref) refs.push(ref);
  }
  return refs;
}

async function saveInspectionBatch(user, machine, site, { items, results, remarks, photos, type, getCategory }) {
  const missing = items.filter((item) => !results[item.item_name ?? item]);
  if (missing.length) {
    throw new Error(`${missing.length} of ${items.length} items still need a status`);
  }

  const batch = makeId("INSP");
  const now = nowISO();
  const records = await Promise.all(items.map(async (item, idx) => {
    const itemName = item.item_name ?? item;
    const category = typeof getCategory === "function" ? getCategory(item) : (item.category || "General");
    const photoRefs = await resolveInspectionPhotoRefs(photos[itemName]);
    const extra = photoRefs.slice(1);
    const remark = [remarks[itemName] || "", extra.length ? `Extra photos: ${extra.join(",")}` : ""]
      .filter(Boolean)
      .join("\n");
    return {
      id: `${batch}-${String(idx + 1).padStart(2, "0")}`,
      site_id: site?.id,
      machine_id: machine.id,
      operator_id: user.id,
      operator_name: user.name,
      type,
      category,
      item_name: itemName,
      status: results[itemName],
      photo_ref: photoRefs[0] || null,
      remark,
      timestamp: now,
      inspection_id: batch,
      created_at: now,
      updated_at: now,
    };
  }));

  await saveManyLocal("inspections", records);
  scheduleSync();
  return records;
}

export async function completeInspection(user, machine, site, { results, remarks, photos }) {
  const { items: prestartItems } = await getPrestartConfigForSite(site?.id);
  const items = prestartItems.map((item_name) => ({ item_name, category: "Pre-Start" }));
  return saveInspectionBatch(user, machine, site, {
    items,
    results,
    remarks,
    photos,
    type: "Pre-Start Inspection",
    getCategory: (item) => item.category,
  });
}

export async function completeMechanicInspection(user, machine, site, { results, remarks, photos }) {
  const { items } = await getInspectionConfigForSite(site?.id);
  return saveInspectionBatch(user, machine, site, {
    items,
    results,
    remarks,
    photos,
    type: "Mechanic Inspection",
    getCategory: (item) => item.category,
  });
}

export async function startMachine(user, machine, site, { hourMeter, photoRef, verifiedShifts, workSessionClockIn } = {}) {
  if (!photoRef) throw new Error("Hour meter photo is required");
  const h = Number(hourMeter);
  if (!Number.isFinite(h) || h < 0) throw new Error("Enter a valid hour meter reading");

  const remote = await reconcileMachineOpenState(machine.id);
  if (remote.known && remote.shift && remote.shift.operator_id !== user.id) {
    throw new Error(`${remote.shift.operator_name || "Another operator"} is already running ${machine.name || machine.id}`);
  }

  const existingShifts = await readTable("shifts");
  const existingRun = existingShifts.find(
    (s) => s.machine_id === machine.id && (s.shift_status === SHIFT.RUNNING || s.status === SHIFT.RUNNING)
  );
  if (existingRun) {
    const belongsToThisClockIn = existingRun.operator_id === user.id
      && (!workSessionClockIn || new Date(existingRun.started_at) >= new Date(workSessionClockIn));
    const liveOnServer = remote.known && remote.shift && remote.shift.id === existingRun.id;
    if (belongsToThisClockIn && (liveOnServer || !remote.known)) {
      return { run: existingRun, lock: { accepted: true }, alreadyRunning: true };
    }
    if (remote.known && remote.shift && remote.shift.id === existingRun.id && !belongsToThisClockIn) {
      const who = existingRun.operator_name || "An operator";
      const when = existingRun.started_at ? new Date(existingRun.started_at).toLocaleString() : "earlier";
      throw new Error(`${who} did not end their shift (started ${when}). A supervisor must close it on the Live tab.`);
    }
    await dropLocalRecord("shifts", existingRun.id);
  }

  let baseline = Number(machine.start_hour_meter || 0);
  const verified = (verifiedShifts || []).filter((s) => s.shift_status === SHIFT.VERIFIED && s.end_hour_meter != null);
  if (verified.length) {
    const latest = verified.reduce((a, b) => new Date(b.ended_at || 0) > new Date(a.ended_at || 0) ? b : a);
    baseline = Number(latest.end_hour_meter);
  }
  if (h < baseline) throw new Error(`Reading below last verified (${baseline}h)`);

  const now = nowISO();
  const run = {
    id: makeId("RUN"),
    site_id: site?.id,
    machine_id: machine.id,
    operator_id: user.id,
    operator_name: user.name,
    start_hour_meter: h,
    end_hour_meter: null,
    hours_worked: 0,
    started_at: now,
    ended_at: null,
    shift_status: SHIFT.RUNNING,
    created_at: now,
    updated_at: now,
  };

  const lock = await acquireMachineLock(machine.id, run.id, user.id);
  if (!lock.accepted) throw new Error(lock.reason || "Could not start machine");

  await saveLocal("shifts", run);
  await addEvent(user, machine, site, "MACHINE_STARTED", { shift_id: run.id, note: `Started at ${h}h`, photo_ref: photoRef });
  await recordHourReading(user, machine, site, {
    reading: h,
    photoRef,
    readingAt: now,
    source: "opening",
    shiftId: run.id,
    notes: "Opening meter",
  });
  scheduleSync();
  return { run, lock };
}

export async function stopMachine(user, machine, site, machineRun, { reason, note }) {
  if (!reason) throw new Error("Select a stop reason");
  const now = nowISO();
  const events = await readTable("events");
  const openStop = findOpenStopForShift(events, machineRun.id);
  if (openStop) {
    if (openStop.reason === reason && (openStop.note || "") === (note || "")) {
      return openStop;
    }
    const updated = {
      ...openStop,
      reason,
      note: note || openStop.note || "",
      updated_at: now,
    };
    await saveLocal("events", updated);
    scheduleSync();
    return updated;
  }

  const down = {
    id: makeId("DOWN"),
    site_id: site?.id,
    machine_id: machine.id,
    shift_id: machineRun.id,
    operator_id: user.id,
    operator_name: user.name,
    type: "STOP",
    reason,
    note: note || "",
    stopped_at: now,
    status: "open",
    timestamp: now,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("events", down);
  await releaseMachineLock(machine.id);
  scheduleSync();
  return down;
}

export async function restartMachine(user, machine, site, machineRun, downtime, { note }) {
  if (!downtime) throw new Error("No open stop to restart from");
  if (downtime.status === "closed") return downtime;

  const lock = await acquireMachineLock(machine.id, machineRun.id, user.id);
  if (!lock.accepted) throw new Error(lock.reason || "Could not restart");

  const now = nowISO();
  const minutes = Math.max(0, Math.round((new Date(now) - new Date(downtime.stopped_at)) / 60000));
  const closed = {
    ...downtime,
    restarted_at: now,
    downtime_minutes: minutes,
    status: "closed",
    note: [downtime.note, note ? `Action: ${note}` : "", "Restarted"].filter(Boolean).join(" | "),
    updated_at: now,
  };
  await saveLocal("events", closed);
  scheduleSync();
  return closed;
}

/** Close any open STOP for a shift (e.g. when ending day while machine is stopped) */
async function closeOpenDowntimeForShift(shiftId, endTime) {
  const events = await readTable("events");
  const openStop = events.find((e) => e.shift_id === shiftId && e.type === "STOP" && e.status === "open");
  if (!openStop) return events;

  const minutes = Math.max(0, Math.round((new Date(endTime) - new Date(openStop.stopped_at)) / 60000));
  const closed = {
    ...openStop,
    restarted_at: null,
    downtime_minutes: minutes,
    status: "closed",
    note: [openStop.note, "Closed at end of day"].filter(Boolean).join(" | "),
    updated_at: endTime,
  };
  await saveLocal("events", closed);
  return events.map((e) => (e.id === openStop.id ? closed : e));
}

export async function endMachineDay(user, machine, site, machineRun, { endHour, photoRef, assignedSupervisor }) {
  if (!photoRef) throw new Error("Closing hour meter photo is required");
  const h = Number(endHour);
  if (!Number.isFinite(h) || h < Number(machineRun.start_hour_meter)) throw new Error("Enter valid ending meter");
  if (!assignedSupervisor?.id) throw new Error("Select the supervisor on duty for this shift");

  const now = nowISO();
  const hoursWorked = meterHoursWorked(machineRun.start_hour_meter, h);

  // Close open downtime so the shift fully ends — no restart offered afterward
  const events = await closeOpenDowntimeForShift(machineRun.id, now);
  const downtimeMinutes = shiftDowntimeMinutes(events, machineRun.id);
  const runtimeMinutes = shiftRuntimeMinutes(machineRun.started_at, now, downtimeMinutes);

  const ended = {
    ...machineRun,
    end_hour_meter: h,
    hours_worked: hoursWorked,
    runtime_minutes: runtimeMinutes,
    downtime_minutes: downtimeMinutes,
    ended_at: now,
    shift_status: SHIFT.WAITING_FOR_VERIFICATION,
    verification_token: crypto.randomUUID?.() || makeId("TOK"),
    assigned_supervisor_id: assignedSupervisor.id,
    assigned_supervisor_name: assignedSupervisor.name,
    updated_at: now,
  };

  await saveLocal("shifts", ended);
  await addEvent(user, machine, site, "METER_END_CAPTURED", { shift_id: ended.id, note: `Ending meter ${h}h`, photo_ref: photoRef });
  await recordHourReading(user, machine, site, {
    reading: h,
    photoRef,
    readingAt: now,
    source: "closing",
    shiftId: ended.id,
    notes: "Closing meter",
  });
  await addEvent(user, machine, site, "MACHINE_ENDED", { shift_id: ended.id, note: `Machine day ended at ${h}h` });

  if (!site?.id) throw new Error("Site is missing — contact admin to link your profile to a site");

  const submission = {
    id: makeId("SUB"),
    site_id: site.id,
    machine_id: machine.id,
    shift_id: ended.id,
    operator_id: user.id,
    operator_name: user.name,
    status: SHIFT.WAITING_FOR_VERIFICATION,
    submitted_at: now,
    correction_number: 0,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("shift_submissions", submission);
  await releaseMachineLock(machine.id);
  scheduleSync();
  return { ended, submission };
}

/** Supervisor closes a shift the operator left running so a new shift can start. */
export async function closeOpenShift(supervisor, machine, shift, { endHour, note } = {}) {
  if (!shift || getShiftStatus(shift) !== SHIFT.RUNNING) throw new Error("That shift is not still open");
  const h = Number(endHour);
  if (!Number.isFinite(h) || h < Number(shift.start_hour_meter || 0)) {
    throw new Error("Enter a closing meter at or above the opening reading");
  }
  if (!navigator.onLine) {
    throw new Error("Need a connection to close this so the next operator can start");
  }
  const now = nowISO();
  const events = await closeOpenDowntimeForShift(shift.id, now);
  const downtimeMinutes = shiftDowntimeMinutes(events, shift.id);
  const runtimeMinutes = shiftRuntimeMinutes(shift.started_at, now, downtimeMinutes);
  const closed = {
    ...shift,
    end_hour_meter: h,
    hours_worked: meterHoursWorked(shift.start_hour_meter, h),
    runtime_minutes: runtimeMinutes,
    downtime_minutes: downtimeMinutes,
    ended_at: now,
    shift_status: SHIFT.WAITING_FOR_VERIFICATION,
    verification_token: shift.verification_token || crypto.randomUUID?.() || makeId("TOK"),
    assigned_supervisor_id: shift.assigned_supervisor_id || supervisor?.id || null,
    assigned_supervisor_name: shift.assigned_supervisor_name || supervisor?.name || null,
    notes: [shift.notes, `Closed by ${supervisor?.name || "supervisor"}`, note].filter(Boolean).join(" | "),
    updated_at: now,
  };
  const { error } = await supabase.from("shifts").update({
    end_hour_meter: closed.end_hour_meter,
    hours_worked: closed.hours_worked,
    runtime_minutes: closed.runtime_minutes,
    downtime_minutes: closed.downtime_minutes,
    ended_at: closed.ended_at,
    shift_status: closed.shift_status,
    verification_token: closed.verification_token,
    assigned_supervisor_id: closed.assigned_supervisor_id,
    assigned_supervisor_name: closed.assigned_supervisor_name,
    notes: closed.notes,
    updated_at: closed.updated_at,
  }).eq("id", shift.id);
  if (error) throw new Error(error.message || "Could not close the shift on the server");
  await saveLocal("shifts", closed);
  const machineId = machine?.id || shift.machine_id;
  if (machineId) await releaseMachineLock(machineId);
  scheduleSync();
  return closed;
}

export async function recordHourReading(user, machine, site, { reading, photoRef, readingAt, source = "manual", shiftId, notes }) {
  const row = {
    id: makeId("HR"),
    site_id: site?.id,
    machine_id: machine.id,
    operator_id: user.id,
    operator_name: user.name,
    reading: Number(reading),
    photo_ref: photoRef || null,
    reading_at: readingAt || nowISO(),
    source,
    shift_id: shiftId || null,
    notes: notes || null,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await saveLocal("machine_hour_readings", row);
  scheduleSync();
  return row;
}

export async function addFuelLog(user, machine, site, shiftId, data) {
  const log = {
    id: makeId("FUEL"),
    site_id: site?.id,
    machine_id: machine.id,
    shift_id: shiftId || null,
    operator_id: user.id,
    operator_name: user.name,
    litres: Number(data.litres),
    hour_meter: Number(data.hourMeter),
    tank_level: data.tankLevel,
    photo_pump_ref: data.photoPumpRef || null,
    photo_dipstick_ref: data.photoDipstickRef || null,
    note: data.note || "",
    timestamp: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await saveLocal("fuel_logs", log);
  scheduleSync();
  return log;
}

export async function addExpense(user, machine, site, { category, amount, vendor, description, receiptRef, date }) {
  const now = nowISO();
  const expenseDate = date
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date).toISOString()
    : now;
  const row = {
    id: makeId("EXP"),
    site_id: site?.id,
    machine_id: machine?.id,
    operator_id: user.id,
    operator_name: user.name,
    category,
    amount: Number(amount),
    vendor: vendor || "",
    description: description || "",
    receipt_ref: receiptRef || null,
    date: expenseDate,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("expenses", row);
  scheduleSync();
  return row;
}

export async function delegateIssue(supervisor, issue, assignee, note = "") {
  if (!assignee?.id) throw new Error("Select who to delegate to");
  if (![ROLES.OPERATOR, ROLES.MANAGER].includes(assignee.role)) {
    throw new Error("Issues can only be delegated to an operator or manager");
  }

  const now = nowISO();
  const updated = {
    ...issue,
    current_owner_id: assignee.id,
    current_owner_role: assignee.role,
    current_owner_name: assignee.name,
    status: ISSUE.IN_PROGRESS,
    updated_at: now,
  };
  await saveLocal("issues", updated);

  const msg = {
    id: makeId("IMSG"),
    issue_id: issue.id,
    sender_id: supervisor.id,
    sender_name: supervisor.name,
    sender_role: ROLES.SUPERVISOR,
    type: "delegation",
    text: note?.trim() || `Sent to ${assignee.name} (${assignee.role})`,
    created_at: now,
  };
  await saveLocal("issue_messages", msg);
  scheduleSync();
  return updated;
}

export async function addIssueReply(user, issue, text) {
  const now = nowISO();
  const msg = {
    id: makeId("IMSG"),
    issue_id: issue.id,
    sender_id: user.id,
    sender_name: user.name,
    sender_role: user.role || ROLES.OPERATOR,
    type: "reply",
    text,
    created_at: now,
  };
  await saveLocal("issue_messages", msg);
  await saveLocal("issues", { ...issue, updated_at: now });
  scheduleSync();
  return msg;
}

async function postIssueMessage(issue, user, type, text) {
  const now = nowISO();
  const msg = {
    id: makeId("IMSG"),
    issue_id: issue.id,
    sender_id: user.id,
    sender_name: user.name,
    sender_role: user.role || ROLES.OPERATOR,
    type,
    text: text || "",
    created_at: now,
  };
  await saveLocal("issue_messages", msg);
  return msg;
}

export async function closeIssue(user, issue, message = "") {
  if (!canCloseIssue(user, issue)) {
    throw new Error("Only the person who reported the problem, or the manager, can close it");
  }
  const now = nowISO();
  const updated = {
    ...issue,
    status: ISSUE.RESOLVED,
    resolved_at: now,
    resolved_by: user.id,
    resolved_by_name: user.name,
    updated_at: now,
  };
  await saveLocal("issues", updated);
  await postIssueMessage(issue, user, "closed", message?.trim() || "Problem closed");
  scheduleSync();
  return updated;
}

/** @deprecated use closeIssue */
export async function resolveIssue(user, issue, message = "") {
  return closeIssue(user, issue, message);
}

export async function sendToMechanic(supervisor, issue, mechanic, machine, site, note = "") {
  if (!mechanic?.id) throw new Error("Select a mechanic");
  if (mechanic.role !== ROLES.MECHANIC) throw new Error("Select a mechanic");

  const now = nowISO();
  const machineId = machine?.id || issue.machine_id;
  const breakdown = {
    id: makeId("BD"),
    site_id: site?.id,
    machine_id: machineId,
    reported_by: supervisor.id,
    reported_by_name: supervisor.name,
    assigned_to: mechanic.id,
    assigned_to_name: mechanic.name,
    issue_id: issue.id,
    title: `${issue.area} — ${issue.priority}`,
    description: issue.description,
    status: BREAKDOWN_STATUS.ASSIGNED,
    priority: issue.priority,
    created_at: now,
    updated_at: now,
  };
  const job = {
    id: makeId("MJ"),
    site_id: site?.id,
    machine_id: machineId,
    breakdown_id: breakdown.id,
    mechanic_id: mechanic.id,
    mechanic_name: mechanic.name,
    title: breakdown.title,
    status: MAINTENANCE_STATUS.IN_PROGRESS,
    started_at: now,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("breakdowns", breakdown);
  await saveLocal("maintenance_jobs", job);

  const updated = {
    ...issue,
    current_owner_id: mechanic.id,
    current_owner_role: ROLES.MECHANIC,
    current_owner_name: mechanic.name,
    status: ISSUE.WITH_MECHANIC,
    updated_at: now,
  };
  await saveLocal("issues", updated);
  await postIssueMessage(
    issue,
    supervisor,
    "repair_job",
    note?.trim() || `Sent to mechanic ${mechanic.name}`
  );
  scheduleSync();
  return { breakdown, job, issue: updated };
}

export async function requestParts(mechanic, issue, partsText) {
  if (!partsText?.trim()) throw new Error("Describe the parts you need");
  const now = nowISO();
  const updated = { ...issue, status: ISSUE.WAITING_FOR_PARTS, updated_at: now };
  await saveLocal("issues", updated);
  await postIssueMessage(issue, mechanic, "parts_request", partsText.trim());
  scheduleSync();
  return updated;
}

export async function markPartsOrdered(manager, issue, note = "") {
  if (manager.role !== ROLES.MANAGER) throw new Error("Only the manager can mark parts ordered");
  const now = nowISO();
  await saveLocal("issues", { ...issue, updated_at: now });
  await postIssueMessage(issue, manager, "parts_ordered", note?.trim() || "Parts ordered");
  scheduleSync();
  return issue;
}

export async function markPartsOnSite(manager, issue, note = "") {
  if (manager.role !== ROLES.MANAGER) throw new Error("Only the manager can mark parts on site");
  const now = nowISO();
  const updated = { ...issue, status: ISSUE.WITH_MECHANIC, updated_at: now };
  await saveLocal("issues", updated);
  await postIssueMessage(issue, manager, "parts_on_site", note?.trim() || "Parts on site");
  scheduleSync();
  return updated;
}

export async function completeRepair(mechanic, job, issue, breakdown, note = "") {
  const now = nowISO();
  await saveLocal("maintenance_jobs", {
    ...job,
    status: MAINTENANCE_STATUS.COMPLETED,
    completed_at: now,
    updated_at: now,
  });
  if (breakdown) {
    await saveLocal("breakdowns", {
      ...breakdown,
      status: BREAKDOWN_STATUS.COMPLETED,
      completed_at: now,
      updated_at: now,
    });
  }
  const updated = {
    ...issue,
    status: ISSUE.REPAIR_DONE,
    updated_at: now,
  };
  await saveLocal("issues", updated);
  await postIssueMessage(
    issue,
    mechanic,
    "repair_done",
    note?.trim() || "Repair finished — please check the machine and close the problem when sorted"
  );
  scheduleSync();
  return updated;
}

export async function reportIssue(user, machine, site, profiles, { area, priority, description, mediaRef, mediaType }) {
  const now = nowISO();
  const reporterRole = user.role || ROLES.OPERATOR;
  const siteSups = profiles.filter((p) => p.role === ROLES.SUPERVISOR && p.site_id === site?.id && p.active !== false);
  const siteOperators = profiles.filter(
    (p) => p.role === ROLES.OPERATOR && p.site_id === site?.id && p.active !== false
  );
  const machineRequired = issueAreaRequiresMachine(area);
  if (machineRequired && !machine?.id) {
    throw new Error("Select a machine for this problem type");
  }

  let owner;
  if (reporterRole === ROLES.OPERATOR) {
    const sup = siteSups[0];
    owner = sup ? { id: sup.id, name: sup.name, role: ROLES.SUPERVISOR } : { id: null, name: null, role: null };
  } else if (reporterRole === ROLES.MANAGER) {
    if (machineRequired && machine?.id) {
      const machineOperator = siteOperators.find((p) => p.machine_id === machine.id);
      const assignee = machineOperator || siteOperators[0];
      owner = assignee
        ? { id: assignee.id, name: assignee.name, role: ROLES.OPERATOR }
        : { id: null, name: null, role: null };
    } else {
      const sup = siteSups[0];
      owner = sup ? { id: sup.id, name: sup.name, role: ROLES.SUPERVISOR } : { id: null, name: null, role: null };
    }
  } else {
    // Supervisor/other — log for the site; assign via send-to flow
    owner = { id: null, name: null, role: null };
  }

  const issue = {
    id: makeId("ISS"),
    site_id: site?.id,
    machine_id: machine?.id || null,
    reporter_id: user.id,
    reporter_name: user.name,
    current_owner_id: owner.id,
    current_owner_role: owner.role,
    current_owner_name: owner.name,
    area,
    priority,
    description: description || "(no description)",
    status: ISSUE.OPEN,
    created_at: now,
    updated_at: now,
  };
  await saveLocal("issues", issue);

  const msg = {
    id: makeId("IMSG"),
    issue_id: issue.id,
    sender_id: user.id,
    sender_name: user.name,
    sender_role: reporterRole,
    type: "report",
    text: description || "",
    media_ref: mediaRef,
    media_type: mediaType,
    created_at: now,
  };
  await saveLocal("issue_messages", msg);
  scheduleSync();
  return issue;
}

async function addEvent(user, machine, site, type, details = {}) {
  const shiftScoped = new Set(["MACHINE_STARTED", "MACHINE_ENDED", "METER_END_CAPTURED"]);
  if (details.shift_id && shiftScoped.has(type)) {
    const events = await readTable("events");
    const existing = events.find((e) => e.shift_id === details.shift_id && e.type === type);
    if (existing) return existing;
  }

  const ev = {
    id: makeId("EV"),
    site_id: site?.id,
    machine_id: machine?.id,
    shift_id: details.shift_id || null,
    operator_id: user.id,
    operator_name: user.name,
    type,
    reason: details.reason || "",
    note: details.note || "",
    photo_ref: details.photo_ref || null,
    timestamp: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await saveLocal("events", ev);
  return ev;
}

export async function verifyShift(shift, supervisor, { action, reason, signatureDataUrl }) {
  if (action === "verify" && !signatureDataUrl) {
    throw new Error("Supervisor signature is required to verify");
  }

  let signatureRef = null;
  if (signatureDataUrl) {
    signatureRef = await storeMediaDataUrl(signatureDataUrl, "signature");
  }

  const now = nowISO();
  const token = shift.verification_token || crypto.randomUUID?.() || makeId("TOK");

  if (navigator.onLine) {
    if (!shift.verification_token) {
      const { error: tokenError } = await supabase.from("shifts").update({
        verification_token: token,
        updated_at: now,
      }).eq("id", shift.id);
      if (tokenError) throw tokenError;
    }

    const { error } = await supabase.rpc("verify_shift", {
      p_shift_id: shift.id,
      p_verification_token: token,
      p_action: action,
      p_reason: reason || null,
    });
    if (error) {
      const recoverable = /invalid shift or token/i.test(error.message || "");
      if (!recoverable) throw error;
      const patch = action === "verify"
        ? {
            shift_status: SHIFT.VERIFIED,
            verified_at: now,
            verified_by: supervisor.id,
            verification_token: null,
            updated_at: now,
          }
        : {
            shift_status: SHIFT.CORRECTION_REQUIRED,
            supervisor_comment: reason || "Correction required",
            verification_token: null,
            updated_at: now,
          };
      const { error: updErr } = await supabase.from("shifts").update(patch).eq("id", shift.id);
      if (updErr) throw updErr;
    }

    if (action === "verify" && signatureRef) {
      await supabase.from("shifts").update({
        supervisor_signature_ref: signatureRef,
        supervisor_signature_name: supervisor.name,
        updated_at: now,
      }).eq("id", shift.id);
    }
  }

  const updated = {
    ...shift,
    shift_status: action === "verify" ? SHIFT.VERIFIED : SHIFT.CORRECTION_REQUIRED,
    verified_at: action === "verify" ? now : shift.verified_at,
    verified_by: action === "verify" ? supervisor.id : shift.verified_by,
    supervisor_signature_ref: signatureRef || shift.supervisor_signature_ref,
    supervisor_signature_name: action === "verify" ? supervisor.name : shift.supervisor_signature_name,
    supervisor_comment: action !== "verify" ? (reason || "Correction required") : shift.supervisor_comment,
    verification_token: null,
    updated_at: now,
  };
  await saveLocal("shifts", updated);

  const submissions = await readTable("shift_submissions");
  const submission = submissions.find((s) => s.shift_id === shift.id);
  if (submission) {
    if (action === "verify") {
      await saveLocal("shift_submissions", {
        ...submission,
        status: SHIFT.VERIFIED,
        verified_at: now,
        verified_by: supervisor.id,
        updated_at: now,
      });
    } else {
      await saveLocal("shift_submissions", {
        ...submission,
        status: SHIFT.CORRECTION_REQUIRED,
        updated_at: now,
      });
    }
  }

  scheduleSync();
  return updated;
}

/** Operator fixes a shift after supervisor requested correction */
export async function resubmitShiftAfterCorrection(user, machine, site, shift, { endHour, photoRef, operatorNote }) {
  if (!photoRef) throw new Error("Closing hour meter photo is required");
  const h = Number(endHour);
  if (!Number.isFinite(h) || h < Number(shift.start_hour_meter)) {
    throw new Error("Enter a valid closing meter reading");
  }

  const now = nowISO();
  const events = await readTable("events");
  const downtimeMinutes = shiftDowntimeMinutes(events, shift.id);
  const runtimeMinutes = shiftRuntimeMinutes(shift.started_at, shift.ended_at || now, downtimeMinutes);
  const hoursWorked = meterHoursWorked(shift.start_hour_meter, h);

  const updated = {
    ...shift,
    end_hour_meter: h,
    hours_worked: hoursWorked,
    runtime_minutes: runtimeMinutes,
    downtime_minutes: downtimeMinutes,
    shift_status: SHIFT.RESUBMITTED,
    verification_token: crypto.randomUUID?.() || makeId("TOK"),
    notes: [shift.notes, operatorNote ? `Resubmit: ${operatorNote}` : "Resubmitted after correction"].filter(Boolean).join(" | "),
    updated_at: now,
  };
  await saveLocal("shifts", updated);
  await recordHourReading(user, machine, site, {
    reading: h,
    photoRef,
    readingAt: now,
    source: "closing",
    shiftId: shift.id,
    notes: "Corrected closing meter",
  });

  const endEv = events.find((e) => e.shift_id === shift.id && e.type === "METER_END_CAPTURED");
  if (endEv) {
    await saveLocal("events", {
      ...endEv,
      photo_ref: photoRef,
      note: `Corrected ending meter ${h}h`,
      updated_at: now,
    });
  }

  await addEvent(user, machine, site, "SHIFT_RESUBMITTED", {
    shift_id: shift.id,
    note: operatorNote || "Shift resubmitted after supervisor correction",
  });

  const submissions = await readTable("shift_submissions");
  const submission = submissions.find((s) => s.shift_id === shift.id);
  if (submission) {
    await saveLocal("shift_submissions", {
      ...submission,
      status: SHIFT.RESUBMITTED,
      submitted_at: now,
      correction_number: Number(submission.correction_number || 0) + 1,
      updated_at: now,
    });
  }

  scheduleSync();
  return updated;
}
