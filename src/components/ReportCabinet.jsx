import { useState } from "react";
import { whenMs } from "../lib/utils.js";
import { IconFolder, IconReports } from "./FieldIcons.jsx";

function stamp(iso) {
  const time = whenMs(iso);
  return Number.isNaN(time) ? 0 : time;
}

function monthKey(iso) {
  const time = stamp(iso);
  if (!time) return "0000-00";
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(key) {
  if (key === "0000-00") return "Undated";
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

/** Group rows into month folders, newest month and newest file first. */
export function buildMonthFolders(rows, { dateOf, fileOf, noun = "report", plural = `${noun}s` } = {}) {
  const groups = new Map();
  const sorted = [...(rows || [])].sort((a, b) => stamp(dateOf(b)) - stamp(dateOf(a)));
  for (const row of sorted) {
    const key = monthKey(dateOf(row));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.keys()].sort((a, b) => b.localeCompare(a)).map((key) => {
    const items = groups.get(key);
    const label = items.length === 1 ? noun : plural;
    return {
      id: key,
      name: monthName(key),
      detail: `${items.length} ${label}`,
      files: items.map((row) => fileOf(row)),
    };
  });
}

function FolderRow({ folder, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 text-left bg-ops-card border border-ops-gold/40 rounded-2xl px-4 py-3 min-h-[64px]"
    >
      <span className="text-[#F5C518] shrink-0"><IconFolder size={28} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-ui font-semibold text-ops-text truncate">{folder.name}</span>
        {folder.detail ? <span className="block font-body text-xs text-ops-muted mt-0.5">{folder.detail}</span> : null}
      </span>
      <span className="text-[#F5C518] text-lg shrink-0" aria-hidden>›</span>
    </button>
  );
}

function FileRow({ file }) {
  return (
    <button
      type="button"
      onClick={file.onOpen}
      disabled={!file.onOpen || file.busy}
      className="w-full flex items-center gap-3 text-left bg-[#141414] border border-[#2A2A2A] rounded-2xl px-4 py-3 min-h-[64px] disabled:opacity-50"
    >
      <span className="text-[#F2F0EA]/70 shrink-0"><IconReports size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-ui font-semibold text-ops-text truncate">{file.name}</span>
        {file.detail ? <span className="block font-body text-xs text-ops-muted mt-0.5 truncate">{file.detail}</span> : null}
      </span>
      <span className="text-[#F5C518] text-lg shrink-0" aria-hidden>›</span>
    </button>
  );
}

export function ReportBrowser({ folders = [], empty = "Nothing filed here." }) {
  const [path, setPath] = useState([]);

  const crumbs = [];
  let node = { folders };
  let intact = true;
  for (const id of path) {
    const next = (node.folders || []).find((folder) => folder.id === id);
    if (!next) {
      intact = false;
      break;
    }
    crumbs.push(next);
    node = next;
  }
  const open = intact ? crumbs : [];
  const here = open[open.length - 1] || null;
  const childFolders = here ? here.folders || [] : folders;
  const files = here ? here.files || [] : [];

  if (!folders.length) {
    return <p className="font-body text-sm text-ops-muted">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      {here && (
        <button
          type="button"
          onClick={() => setPath(open.slice(0, -1).map((folder) => folder.id))}
          className="font-ui text-sm text-[#F5C518]"
        >
          ← {open.length > 1 ? open[open.length - 2].name : "Folders"}
        </button>
      )}
      {here && <p className="font-ui text-sm font-semibold text-ops-text">{here.name}</p>}
      {childFolders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          onOpen={() => setPath([...open.map((item) => item.id), folder.id])}
        />
      ))}
      {files.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </div>
  );
}
