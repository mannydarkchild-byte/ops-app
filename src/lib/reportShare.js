import * as XLSX from "xlsx";

function safeFilename(name) {
  return String(name || "OPS_Report").replace(/[^\w.-]+/g, "_").slice(0, 80);
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

async function waitForImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(imgs.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 2500);
    });
  }));
}

async function mountReport(html) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-1600px;top:0;width:794px;background:#fff;z-index:-1;";
  host.innerHTML = html;
  document.body.appendChild(host);
  const target = host.querySelector(".page") || host;
  await waitForImages(target);
  return { host, target };
}

async function htmlToPdfBlob(html) {
  const html2pdf = (await import("html2pdf.js")).default;
  const { host, target } = await mountReport(html);
  try {
    return await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        image: { type: "jpeg", quality: 0.9 },
        html2canvas: { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(target)
      .outputPdf("blob");
  } finally {
    host.remove();
  }
}

async function htmlToPngBlob(html) {
  const html2canvas = (await import("html2canvas")).default;
  const { host, target } = await mountReport(html);
  try {
    const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make image"))), "image/png");
    });
  } finally {
    host.remove();
  }
}

export async function reportToFile(html, title) {
  const base = safeFilename(title);
  try {
    const pdf = await htmlToPdfBlob(html);
    return new File([pdf], `${base}.pdf`, { type: "application/pdf" });
  } catch {
    const png = await htmlToPngBlob(html);
    return new File([png], `${base}.png`, { type: "image/png" });
  }
}

export async function shareNativeFile(file, title, text = "") {
  const payload = { files: [file], title: title || file.name, text: text || title || file.name };
  if (navigator.canShare?.(payload)) {
    await navigator.share(payload);
    return "shared";
  }
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") throw e;
    }
  }
  downloadBlob(file, file.name);
  return "downloaded";
}

export async function downloadReportFile(html, title) {
  const file = await reportToFile(html, title);
  downloadBlob(file, file.name);
  return "downloaded";
}

export async function shareReportFile(html, title, text = "") {
  const file = await reportToFile(html, title);
  return shareNativeFile(file, title, text);
}

export function excelFileFromSheets(sheets, title) {
  const wb = XLSX.utils.book_new();
  const list = (sheets || []).filter((s) => s?.name && Array.isArray(s.rows) && s.rows.length);
  const use = list.length ? list : [{ name: "Report", rows: [[title || "OPS report"]] }];
  for (const sheet of use) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, String(sheet.name).slice(0, 31));
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new File(
    [buf],
    `${safeFilename(title)}.xlsx`,
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );
}

export async function downloadExcelFile(sheets, title) {
  const file = excelFileFromSheets(sheets, title);
  downloadBlob(file, file.name);
  return "downloaded";
}

export async function shareExcelFile(sheets, title) {
  const file = excelFileFromSheets(sheets, title);
  return shareNativeFile(file, title, title);
}
