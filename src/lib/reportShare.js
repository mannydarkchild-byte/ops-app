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

async function htmlToPdfBlob(html) {
  const html2pdf = (await import("html2pdf.js")).default;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-1400px;top:0;width:794px;background:#fff;z-index:-1;";
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const target = host.querySelector(".page") || host;
    return await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        image: { type: "jpeg", quality: 0.88 },
        html2canvas: { scale: 1.4, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(target)
      .outputPdf("blob");
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
    return new File([html], `${base}.html`, { type: "text/html" });
  }
}

export async function downloadReportFile(html, title) {
  const file = await reportToFile(html, title);
  downloadBlob(file, file.name);
  return file;
}

export async function shareReportFile(html, title, text = "") {
  const file = await reportToFile(html, title);
  const payload = { title, text: text || title, files: [file] };
  if (navigator.canShare?.(payload)) {
    await navigator.share(payload);
    return "shared";
  }
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text: text || title });
    return "shared";
  }
  downloadBlob(file, file.name);
  return "downloaded";
}

export function openReportWhatsApp(title, text) {
  const msg = [title, text, "", "Attach the PDF from this phone if WhatsApp did not pick it up."]
    .filter(Boolean)
    .join("\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
}

export function openReportEmail(title, text) {
  const body = [text || title, "", "The daily report PDF is on this phone — attach it to this email."]
    .filter(Boolean)
    .join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
