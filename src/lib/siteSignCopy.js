import { htmlFromSiteSummary, siteSummaryReportTitle } from "../services/reports.js";
import { formatDurationMinutes, STANDARD_SHIFT_HOURS } from "./shiftMetrics.js";
import { isContractorStop } from "./stopReasons.js";
import { whatsappShareUrl } from "./shiftAgreement.js";
import { openWhatsApp } from "./whatsapp.js";

function stopMinutes(stop) {
  return Number(stop?.minutes || stop?.downtime_minutes || 0);
}

function billableFromSummary(data) {
  const settings = {
    stop_reasons: Array.isArray(data?.stop_reasons) ? data.stop_reasons : [],
    contractor_name: data?.contractor_name,
    equipment_owner_name: data?.owner_name,
    client_site_name: data?.client_name,
  };
  const stops = (Array.isArray(data?.stops) ? data.stops : []).filter((s) => s.status !== "open");
  const deducted = stops.reduce((sum, s) => (
    isContractorStop(s.reason, settings) ? sum + stopMinutes(s) : sum
  ), 0);
  return {
    deducted,
    billable: Math.max(0, STANDARD_SHIFT_HOURS - deducted / 60),
  };
}

function reportExtras(data, { ownerSigner, ownerSignature } = {}) {
  return {
    siteSignerName: ownerSigner,
    siteSignatureUrl: ownerSignature,
    siteSignedAt: new Date().toISOString(),
  };
}

/** Text fallback if the phone cannot attach a PDF. */
export function siteSignedCopyText(data, { ownerSigner } = {}) {
  const shift = data?.shift || {};
  const contractor = data?.contractor_name || "Darkchild";
  const owner = data?.owner_name || "Berlington";
  const { billable, deducted } = billableFromSummary(data);
  const when = shift.started_at ? new Date(shift.started_at).toLocaleDateString("en-ZA") : "";
  const contractorSigner = shift.machine_signature_name || shift.supervisor_signature_name || "Signed";
  return [
    "OPS signed shift report",
    "",
    `Machine: ${data?.machine_name || "Machine"}`,
    `Operator: ${shift.operator_name || "Operator"}`,
    when ? `Date: ${when}` : null,
    `Billable hours: ${billable.toFixed(1)}h (8h minus ${formatDurationMinutes(deducted)} ${contractor} downtime)`,
    `Hour meter: ${shift.start_hour_meter ?? "—"} to ${shift.end_hour_meter ?? "—"}`,
    "",
    `${contractor} signature: ${contractorSigner}`,
    `${owner} signature: ${ownerSigner || "Signed"}`,
  ].filter((line) => line != null).join("\n");
}

export function printSignedCopy() {
  const frame = document.getElementById("ops-site-sign-report");
  if (frame?.contentWindow) {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    return;
  }
  window.print();
}

export async function downloadSignedCopyPdf(data, extras) {
  const { downloadReportFile } = await import("./reportShare.js");
  await downloadReportFile(htmlFromSiteSummary(data, reportExtras(data, extras)), siteSummaryReportTitle(data));
}

export async function shareSignedCopyPdf(data, extras) {
  const { shareReportFile } = await import("./reportShare.js");
  try {
    return await shareReportFile(htmlFromSiteSummary(data, reportExtras(data, extras)), siteSummaryReportTitle(data));
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    openWhatsApp(whatsappShareUrl("", siteSignedCopyText(data, extras)));
    return "whatsapp-text";
  }
}
