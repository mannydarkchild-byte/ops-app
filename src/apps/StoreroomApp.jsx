import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AppPage } from "../components/AppShell.jsx";
import { AlertModal } from "../components/ui/Modal.jsx";
import { ProductivityPulseScreen } from "../components/ProductivityPulseScreen.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { ISSUE } from "../lib/constants.js";
import { createInventoryItem, issueInventory, receiveInventory } from "../services/inventory.js";
import * as wf from "../services/workflows.js";

const TABS = [
  { id: "stock", label: "Stock" },
  { id: "requests", label: "Requests" },
  { id: "pulse", label: "Pulse" },
  { id: "hours", label: "Hours" },
];

function QtyRow({ item, busy, onReceive, onIssue }) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const low = Number(item.quantity_on_hand || 0) <= Number(item.reorder_level || 0);
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-logo text-[#F2F0EA]">{item.name}</p>
          <p className="font-body text-xs text-[#F2F0EA]/50">{item.sku} · {item.category || "General"}</p>
        </div>
        <div className="text-right">
          <p className={`font-logo text-lg ${low ? "text-[#F97316]" : "text-[#F2F0EA]"}`}>{item.quantity_on_hand ?? 0}</p>
          <p className="font-body text-[10px] text-[#F2F0EA]/40">{low ? "Reorder" : "On hand"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="1"
          step="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
          aria-label={`Quantity for ${item.name}`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
          className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => onReceive(item, qty, note)} className="py-3 rounded-full bg-[#22C55E] text-black font-logo disabled:opacity-40">Receive</button>
        <button type="button" disabled={busy} onClick={() => onIssue(item, qty, note)} className="py-3 rounded-full bg-[#F5C518] text-black font-logo disabled:opacity-40">Issue</button>
      </div>
    </div>
  );
}

export function StoreroomApp() {
  const { user, activeSite, inventoryItems, issues, issueMessages, machines, refreshLocal, syncNow } = useOps();
  const [tab, setTab] = useState("stock");
  const [alert, setAlert] = useState({ isOpen: false });
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", category: "General" });
  const [issueItemId, setIssueItemId] = useState("");
  const [issueQty, setIssueQty] = useState("1");
  const siteId = user?.site_id || activeSite?.id;
  const showAlert = (title, message) => setAlert({ isOpen: true, title, message, onConfirm: () => setAlert({ isOpen: false }) });

  const stock = useMemo(
    () => (inventoryItems || []).filter((item) => item.site_id === siteId).sort((a, b) => a.name.localeCompare(b.name)),
    [inventoryItems, siteId]
  );
  const requests = useMemo(
    () => (issues || []).filter((issue) => issue.site_id === siteId && issue.status === ISSUE.WAITING_FOR_PARTS),
    [issues, siteId]
  );
  const machineName = (id) => machines.find((m) => m.id === id)?.name || "Site";

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refreshLocal();
    } catch (e) {
      showAlert("Could not save", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppPage
      subtitle="Storeroom"
      context={activeSite?.name || "Site"}
      showSite={false}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      onSync={syncNow}
      alert={<AlertModal {...alert} confirmText="OK" />}
    >
      {tab === "hours" && <WorkHoursPanel />}
      {tab === "pulse" && <ProductivityPulseScreen embedded />}
      {tab === "stock" && (
        <div className="space-y-4">
          <WorkHoursPanel variant="clock" />
          <p className="font-body text-sm text-[#F2F0EA]/70">Receive goods in, and issue tools and parts out. Orange means the quantity is at or below the reorder level.</p>
          <button type="button" onClick={() => setShowAdd((v) => !v)} className="w-full py-3 rounded-full border border-[#22C55E] text-[#22C55E] font-logo">
            {showAdd ? "Close" : "Add a part"}
          </button>
          {showAdd && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-2">
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SKU" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
              <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
              <button
                type="button"
                disabled={busy || !form.sku || !form.name}
                onClick={() => run(async () => {
                  await createInventoryItem({ siteId, ...form });
                  setForm({ sku: "", name: "", category: "General" });
                  setShowAdd(false);
                  showAlert("Added", "The part is on the stock list.");
                })}
                className="w-full py-3 rounded-full bg-[#F5C518] text-black font-logo disabled:opacity-40"
              >
                Save part
              </button>
            </div>
          )}
          {stock.length === 0 ? (
            <p className="font-body text-sm text-[#F2F0EA]/40">Nothing in the storeroom yet.</p>
          ) : stock.map((item) => (
            <QtyRow
              key={item.id}
              item={item}
              busy={busy}
              onReceive={(row, qty, note) => run(() => receiveInventory(user, row, qty, note))}
              onIssue={(row, qty, note) => run(() => issueInventory(user, row, qty, note))}
            />
          ))}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-4">
          <p className="font-body text-sm text-[#F2F0EA]/70">Mechanics ask for parts here. Issue them from stock, or mark the request as ordered if it is not on the shelf yet.</p>
          {requests.length === 0 ? (
            <p className="font-body text-sm text-[#F2F0EA]/40">No parts requests waiting.</p>
          ) : requests.map((issue) => {
            const note = [...(issueMessages || [])].reverse().find((m) => m.issue_id === issue.id && m.type === "parts_request");
            return (
              <div key={issue.id} className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
                <p className="font-logo text-[#F2F0EA]">{issue.title || issue.description || "Parts request"}</p>
                <p className="font-body text-xs text-[#F2F0EA]/50">{machineName(issue.machine_id)}</p>
                {note?.text && <p className="font-body text-sm text-[#F2F0EA]/80">{note.text}</p>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(async () => {
                    await wf.markPartsOrdered(user, issue);
                    showAlert("Ordered", "The mechanic can see that these parts are on order.");
                  })}
                  className="w-full py-3 rounded-full border border-[#F5C518]/50 text-[#F5C518] font-logo disabled:opacity-40"
                >
                  Mark ordered
                </button>
                <label className="block">
                  <span className="font-logo text-[10px] text-[#F2F0EA]/50">ISSUE FROM STOCK</span>
                  <select value={issueItemId} onChange={(e) => setIssueItemId(e.target.value)} className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]">
                    <option value="">Choose a part</option>
                    {stock.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {item.quantity_on_hand ?? 0} on hand</option>
                    ))}
                  </select>
                </label>
                <input type="number" min="1" step="1" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-xl text-[#F2F0EA]" />
                <button
                  type="button"
                  disabled={busy || !issueItemId}
                  onClick={() => run(async () => {
                    const item = stock.find((row) => row.id === issueItemId);
                    if (!item) throw new Error("Choose a part");
                    await issueInventory(user, item, issueQty, note?.text || issue.title || "Issued to a repair");
                    await wf.markPartsOnSite(user, issue, `Issued ${issueQty} × ${item.name}`);
                    showAlert("Issued", `${item.name} left the storeroom and the mechanic has it.`);
                  })}
                  className="w-full py-3 rounded-full bg-[#22C55E] text-black font-logo disabled:opacity-40"
                >
                  Issue and send to the mechanic
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}
