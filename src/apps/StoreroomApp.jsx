import { useMemo, useState } from "react";
import { useOps } from "../context/OpsContext.jsx";
import { AppPage } from "../components/AppShell.jsx";
import { AlertModal } from "../components/ui/Modal.jsx";
import { WorkHoursPanel } from "../components/WorkHoursPanel.jsx";
import { RolePulse } from "../components/RolePulse.jsx";
import { Button } from "../components/ui/Button.jsx";
import { FieldSelect } from "../components/ui/FieldSelect.jsx";
import { ISSUE } from "../lib/constants.js";
import { createInventoryItem, issueInventory, receiveInventory } from "../services/inventory.js";
import * as wf from "../services/workflows.js";

const TABS = [
  { id: "stock", label: "Stock" },
  { id: "pulse", label: "Pulse" },
  { id: "requests", label: "Requests" },
];

function QtyRow({ item, busy, onReceive, onIssue }) {
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const low = Number(item.quantity_on_hand || 0) <= Number(item.reorder_level || 0);
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-ui font-semibold text-[#F2F0EA]">{item.name}</p>
          <p className="font-body text-xs text-[#F2F0EA]/50">{item.sku} - {item.category || "General"}</p>
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
          className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
          aria-label={`Quantity for ${item.name}`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
          className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="teal" className="w-full" disabled={busy} onClick={() => onReceive(item, qty, note)}>Receive</Button>
        <Button className="w-full" disabled={busy} onClick={() => onIssue(item, qty, note)}>Issue</Button>
      </div>
    </div>
  );
}

function PartsRequestCard({ issue, note, machineLabel, stock, busy, onMarkOrdered, onIssue }) {
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-3">
      <p className="font-ui font-semibold text-[#F2F0EA]">{issue.title || issue.description || "Parts request"}</p>
      <p className="font-body text-xs text-[#F2F0EA]/50">{machineLabel}</p>
      {note?.text && <p className="font-body text-sm text-[#F2F0EA]/80">{note.text}</p>}
      <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={onMarkOrdered}>
        Mark ordered
      </Button>
      <label className="block">
        <span className="ops-field-label">Issue from stock</span>
        <FieldSelect value={itemId} onChange={setItemId} placeholder="Choose a part">
          {stock.map((item) => (
            <option key={item.id} value={item.id}>{item.name} - {item.quantity_on_hand ?? 0} on hand</option>
          ))}
        </FieldSelect>
      </label>
      <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]" />
      <Button
        variant="teal"
        size="lg"
        className="w-full"
        disabled={busy || !itemId}
        onClick={() => {
          const item = stock.find((row) => row.id === itemId);
          if (!item) return;
          onIssue(item, qty, note?.text);
        }}
      >
        Issue and send to the mechanic
      </Button>
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
  const tabItems = useMemo(
    () => TABS.map((t) => ({ ...t, badge: t.id === "requests" ? requests.length : 0 })),
    [requests.length]
  );

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refreshLocal();
      if (navigator.onLine) await syncNow();
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
      tabs={tabItems}
      activeTab={tab}
      onTabChange={setTab}
      onSync={syncNow}
      openHeaderTools
      alert={<AlertModal {...alert} confirmText="OK" />}
    >
      {tab !== "pulse" && (
        <div className="mb-4">
          <WorkHoursPanel variant="clock" />
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-4">
          <p className="font-body text-sm text-[#F2F0EA]/70">Receive goods in, and issue tools and parts out. Orange means the quantity is at or below the reorder level.</p>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Close" : "Add a part"}
          </Button>
          {showAdd && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-4 space-y-2">
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SKU" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]" />
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]" />
              <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded-2xl text-[#F2F0EA]" />
              <Button
                size="lg"
                className="w-full"
                disabled={busy || !form.sku || !form.name}
                onClick={() => run(async () => {
                  await createInventoryItem({ siteId, ...form });
                  setForm({ sku: "", name: "", category: "General" });
                  setShowAdd(false);
                  showAlert("Added", "The part is on the stock list.");
                })}
              >
                Save part
              </Button>
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

      {tab === "pulse" && <RolePulse />}

      {tab === "requests" && (
        <div className="space-y-4">
          <p className="font-body text-sm text-[#F2F0EA]/70">Mechanics ask for parts here. Issue them from stock, or mark the request as ordered if it is not on the shelf yet.</p>
          {requests.length === 0 ? (
            <p className="font-body text-sm text-[#F2F0EA]/40">No parts requests waiting.</p>
          ) : requests.map((issue) => (
            <PartsRequestCard
              key={issue.id}
              issue={issue}
              note={[...(issueMessages || [])].reverse().find((m) => m.issue_id === issue.id && m.type === "parts_request")}
              machineLabel={machineName(issue.machine_id)}
              stock={stock}
              busy={busy}
              onMarkOrdered={() => run(async () => {
                await wf.markPartsOrdered(user, issue);
                showAlert("Ordered", "The mechanic can see that these parts are on order.");
              })}
              onIssue={(item, qty, noteText) => run(async () => {
                await issueInventory(user, item, qty, noteText || issue.title || "Issued to a repair");
                await wf.markPartsOnSite(user, issue, `Issued ${qty} x ${item.name}`);
                showAlert("Issued", `${item.name} left the storeroom and the mechanic has it.`);
              })}
            />
          ))}
        </div>
      )}
    </AppPage>
  );
}
