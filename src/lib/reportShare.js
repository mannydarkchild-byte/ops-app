import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

function safeFilename(name) {
  return String(name || "OPS_Report").replace(/[^\w.-]+/g, "_").slice(0, 80);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || "")
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

async function waitForImages(root) {
  const imgs = [...(root.querySelectorAll?.("img") || [])];
  await Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 2500);
    });
  }));
}

function extractReportParts(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const styles = [...doc.querySelectorAll("style")].map((node) => node.textContent).join("\n");
  const page = doc.querySelector(".page");
  return {
    styles,
    pageHtml: page ? page.outerHTML : (doc.body?.innerHTML || String(html || "")),
  };
}

async function mountCaptureHost(html) {
  const { styles, pageHtml } = extractReportParts(html);
  const host = document.createElement("div");
  host.setAttribute("data-ops-report-capture", "1");
  host.style.cssText = "position:fixed;left:0;top:0;width:794px;background:#ffffff;z-index:1;pointer-events:none;opacity:0.02;";
  host.innerHTML = `<style>
    ${styles}
    [data-ops-report-capture] *{box-sizing:border-box}
    [data-ops-report-capture] .page{margin:0!important;min-height:0!important;max-width:none!important;width:794px!important;border:none!important}
  </style>${pageHtml}`;
  document.body.appendChild(host);
  const target = host.querySelector(".page") || host;
  await waitForImages(host);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!String(target.innerText || "").trim()) {
    host.remove();
    throw new Error("The report was empty, so a file could not be made.");
  }
  return { host, target };
}

async function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not make the report image."))),
      type,
      quality
    );
  });
}

async function canvasToPdfBlob(canvas) {
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 28;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const slicePxH = Math.max(1, Math.floor((maxH / maxW) * canvas.width));
  const pageCount = Math.max(1, Math.ceil(canvas.height / slicePxH));
  const slices = [];
  for (let i = 0; i < pageCount; i += 1) {
    const y = i * slicePxH;
    const sliceH = Math.min(slicePxH, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const blob = await canvasToBlob(slice, "image/jpeg", 0.9);
    slices.push({
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: slice.width,
      height: slice.height,
    });
  }

  const objects = [];
  const encoder = new TextEncoder();
  const asBinary = (text, binary) => {
    const head = encoder.encode(text);
    const out = new Uint8Array(head.length + binary.length + 18);
    out.set(head, 0);
    out.set(binary, head.length);
    out.set(encoder.encode("\nendstream"), head.length + binary.length);
    return out;
  };

  objects.push(encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"));
  const kids = [];
  let nextId = 3;
  const extras = [];
  for (const slice of slices) {
    const imgId = nextId;
    const pageId = nextId + 1;
    const contentId = nextId + 2;
    nextId += 3;
    kids.push(`${pageId} 0 R`);
    const drawW = maxW;
    const drawH = (slice.height / slice.width) * maxW;
    const y = pageH - margin - drawH;
    extras.push(asBinary(
      `<< /Type /XObject /Subtype /Image /Width ${slice.width} /Height ${slice.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${slice.bytes.length} >>\nstream\n`,
      slice.bytes
    ));
    extras.push(encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    const stream = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${margin} ${y.toFixed(2)} cm /Im0 Do Q`;
    extras.push(encoder.encode(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
  }
  objects.push(encoder.encode(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.join(" ")}] >>`));
  objects.push(...extras);

  const parts = [encoder.encode("%PDF-1.4\n")];
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(encoder.encode(`${i + 1} 0 obj\n`));
    parts.push(objects[i]);
    parts.push(encoder.encode("\nendobj\n"));
  }
  const xrefAt = parts.reduce((sum, part) => sum + part.length, 0);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  parts.push(encoder.encode(xref));
  parts.push(encoder.encode(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`));
  return new Blob(parts, { type: "application/pdf" });
}

async function captureReportCanvas(html) {
  const { host, target } = await mountCaptureHost(html);
  try {
    const canvas = await html2canvas(target, {
      scale: 1.6,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
    });
    if (!canvas || canvas.width < 40 || canvas.height < 40) {
      throw new Error("Could not capture the report on this phone.");
    }
    return canvas;
  } finally {
    host.remove();
  }
}

export async function buildReportFiles(html, title) {
  const base = safeFilename(title);
  const canvas = await captureReportCanvas(html);
  const [pdfBlob, pngBlob, jpegBlob] = await Promise.all([
    canvasToPdfBlob(canvas),
    canvasToBlob(canvas, "image/png"),
    canvasToBlob(canvas, "image/jpeg", 0.86),
  ]);
  const pdf = pdfBlob?.size > 80 ? new File([pdfBlob], `${base}.pdf`, { type: "application/pdf" }) : null;
  const png = pngBlob?.size > 80 ? new File([pngBlob], `${base}.png`, { type: "image/png" }) : null;
  const jpeg = jpegBlob?.size > 80 ? new File([jpegBlob], `${base}.jpg`, { type: "image/jpeg" }) : null;
  const file = pdf || jpeg || png;
  if (!file) throw new Error("Could not build the report file on this phone.");
  return { pdf, png, jpeg, file };
}

export async function reportToFile(html, title) {
  const { file } = await buildReportFiles(html, title);
  return file;
}

/** Files only — WhatsApp drops the attachment if we also send text. */
export async function shareNativeFile(file) {
  if (!file) throw new Error("Report file is not ready yet.");
  const attempts = [
    { files: [file] },
    { files: [file], title: file.name },
  ];
  for (const payload of attempts) {
    if (!navigator.share) break;
    if (navigator.canShare && !navigator.canShare(payload)) continue;
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

export async function downloadReportFile(html, title, readyFile) {
  const file = readyFile || await reportToFile(html, title);
  downloadBlob(file, file.name);
  return "downloaded";
}

export async function shareReportFile(html, title, _text, readyFile) {
  const file = readyFile || await reportToFile(html, title);
  return shareNativeFile(file);
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
  return shareNativeFile(excelFileFromSheets(sheets, title));
}
