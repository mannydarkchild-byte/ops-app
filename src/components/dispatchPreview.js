function ticketSvg({ title, ticket, vehicle, net, time }) {
  return `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
  <rect width="420" height="560" fill="#FAFAF7"/>
  <rect x="18" y="18" width="384" height="524" fill="none" stroke="#2A2A2A" stroke-width="2"/>
  <text x="210" y="56" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="15" font-weight="700" fill="#1A1A1A">SITE WEIGHBRIDGE</text>
  <text x="210" y="78" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="12" fill="#57534E">${title}</text>
  <line x1="40" y1="96" x2="380" y2="96" stroke="#D9D7D0"/>
  <text x="40" y="128" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57534E">TICKET</text>
  <text x="380" y="128" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="16" font-weight="700" fill="#1A1A1A">${ticket}</text>
  <text x="40" y="164" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57534E">DATE / TIME</text>
  <text x="380" y="164" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#1A1A1A">${time}</text>
  <text x="40" y="200" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57534E">VEHICLE</text>
  <text x="380" y="200" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#1A1A1A">${vehicle}</text>
  <text x="40" y="236" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57534E">PRODUCT</text>
  <text x="380" y="236" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#1A1A1A">Crushed aggregate</text>
  <line x1="40" y1="260" x2="380" y2="260" stroke="#D9D7D0"/>
  <text x="40" y="300" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57534E">GROSS</text>
  <text x="380" y="300" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#1A1A1A">${(net + 14.8).toFixed(2)} t</text>
  <text x="40" y="336" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57534E">TARE</text>
  <text x="380" y="336" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#1A1A1A">14.80 t</text>
  <rect x="40" y="360" width="340" height="56" fill="#F2F0EA"/>
  <text x="56" y="396" font-family="ui-monospace,Consolas,monospace" font-size="16" font-weight="700" fill="#1A1A1A">NET</text>
  <text x="364" y="396" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="20" font-weight="700" fill="#1A1A1A">${net.toFixed(2)} t</text>
  <text x="210" y="460" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" fill="#6B6960">Operator signed on glass</text>
  <text x="210" y="500" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" fill="#6B6960">Keep this ticket with the daily report</text>
</svg>`)}`;
}

export function dispatchPreviewRow() {
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  const dayKey = day.toISOString().slice(0, 10);
  const time = day.toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return {
    id: "DSP-preview",
    dispatch_date: dayKey,
    tonnes_dispatched: 1240,
    trucks_dispatched: 31,
    tonnes_screened: 1180,
    tonnes_on_floor: 90,
    excavator_buckets: 236,
    fel_buckets: 45,
    recorded_by_name: "N. Dlamini",
    assigned_supervisor_name: "J. Petersen",
    signed_by_name: "J. Petersen",
    signed_at: new Date().toISOString(),
    status: "signed",
    weighbridge_photo: ticketSvg({ title: "Ticket 1 of 3", ticket: "8841", vehicle: "NP 123 GP", net: 38.4, time }),
    weighbridge_photo_2: ticketSvg({ title: "Ticket 2 of 3", ticket: "8842", vehicle: "NP 881 MP", net: 41.2, time }),
    weighbridge_photo_3: ticketSvg({ title: "Ticket 3 of 3", ticket: "8843", vehicle: "CA 440 NW", net: 39.6, time }),
  };
}

export function isDispatchPreview() {
  try {
    return new URLSearchParams(window.location.search).get("dispatch") === "preview";
  } catch {
    return false;
  }
}
