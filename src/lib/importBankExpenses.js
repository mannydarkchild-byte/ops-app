import * as XLSX from "xlsx";
import { EXPENSE_CATEGORIES } from "./constants.js";

const DATE_HEADERS = ["date", "trans date", "transaction date", "posted date", "value date", "posting date"];
const DESC_HEADERS = ["description", "narrative", "details", "reference", "payee", "beneficiary", "name", "transaction"];
const DEBIT_HEADERS = ["debit", "money out", "withdrawal", "amount out", "paid out", "debits"];
const CREDIT_HEADERS = ["credit", "money in", "deposit", "amount in", "paid in", "credits"];
const AMOUNT_HEADERS = ["amount", "value", "amt", "transaction amount"];

function norm(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function excelDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return correctYear(value);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return correctYear(new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0));
  }
  const text = String(value).trim().replace(/(\d)([A-Za-z])/g, "$1 $2");
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return correctYear(new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0));
  }
  const named = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (named) {
    const month = monthIndex(named[2]);
    if (month == null) return null;
    return correctYear(new Date(Number(named[3]), month, Number(named[1]), 12, 0, 0));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : correctYear(parsed);
}

/** A typed 3026 in this recon is 2026. Keep the calendar day in local time. */
function correctYear(date) {
  const year = date.getFullYear();
  if (year >= 3000 && year < 4000) date.setFullYear(year - 1000);
  return date;
}

function localISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthIndex(name) {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const n = name.toLowerCase();
  const exact = months.indexOf(n);
  if (exact >= 0) return exact;
  const short = months.findIndex((month) => month.startsWith(n.slice(0, 3)));
  return short >= 0 ? short : null;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function moneyNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[R$£,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function guessCategory(description) {
  const text = description.toLowerCase();
  const rules = [
    ["Fuel", ["fuel", "diesel", "engen", "shell", "bp ", "sasol", "petrol", "filling"]],
    ["Parts", ["part", "bearing", "filter", "spares", "mesh", "roller", "starter"]],
    ["Hydraulic Oil", ["hydraulic"]],
    ["Engine Oil", ["engine oil", "lubricant"]],
    ["Belts", ["belt"]],
    ["Bolts & Nuts", ["bolt", "fastener"]],
    ["Consumables", ["grease", "consumable", "ppe"]],
    ["Labour", ["salary", "wage", "labour", "labor", "mechanic"]],
    ["Transport", ["transport", "courier", "delivery", "uber", "fuel levy", "lowbed", "tap n go"]],
    ["Tools", ["tool"]],
  ];
  for (const [category, words] of rules) {
    if (words.some((word) => text.includes(word))) return category;
  }
  return "Other";
}

function classifyHeader(header) {
  const n = norm(header);
  if (!n || n.includes("balance")) return null;
  if (n === "date" || n.endsWith(" date") || DATE_HEADERS.includes(n)) return "date";
  if (n === "dr" || n.includes("debit") || n.includes("money out") || n.includes("paid out") || DEBIT_HEADERS.includes(n)) return "debit";
  if (n === "cr" || n.includes("credit") || n.includes("money in") || n.includes("paid in") || CREDIT_HEADERS.includes(n)) return "credit";
  if (n.includes("categor")) return "category";
  if (n.includes("comment") || n === "note" || n === "notes" || n.includes("remark")) return "note";
  if (n === "machine" || n.includes("machine") || n === "asset" || n === "plant") return "machine";
  if (n.includes("description") || n.includes("narrative") || n.includes("detail") || n.includes("particular") || DESC_HEADERS.includes(n)) return "desc";
  if (n === "amount" || n.includes("amount") || n === "value" || n === "rand" || AMOUNT_HEADERS.includes(n)) return "amount";
  return null;
}

function columnMap(headers) {
  const map = {};
  headers.forEach((header, index) => {
    const kind = classifyHeader(header);
    if (kind && map[kind] == null) map[kind] = index;
  });
  return map;
}

function findHeaderRow(rows) {
  let best = { index: -1, score: 0 };
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const map = columnMap(rows[i] || []);
    const score = (map.date != null ? 2 : 0) + (map.debit != null || map.amount != null ? 2 : 0) + (map.desc != null ? 1 : 0);
    if (score > best.score) best = { index: i, score };
  }
  return best.score >= 4 ? best.index : -1;
}

function sheetScore(name, rowCount) {
  const n = norm(name);
  const named = /recon|expense|statement|bank|transaction/.test(n) ? 50 : 0;
  return named + rowCount;
}

function parseSheet(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const headerAt = findHeaderRow(rows);
  if (headerAt < 0) return { rows: [], skipped: 0, sheetName, error: "no-header" };

  const map = columnMap(rows[headerAt] || []);
  const amountLooksSigned = map.amount != null && rows.slice(headerAt + 1).some((line) => {
    const n = moneyNumber(line[map.amount]);
    return n != null && n < 0;
  });
  const parsed = [];
  let skipped = 0;
  for (const line of rows.slice(headerAt + 1)) {
    const date = excelDate(line[map.date]);
    const description = cleanText(map.desc != null ? line[map.desc] : "");
    const note = cleanText(map.note != null ? line[map.note] : "");
    const debit = map.debit != null ? moneyNumber(line[map.debit]) : null;
    const credit = map.credit != null ? moneyNumber(line[map.credit]) : null;
    const amount = map.amount != null ? moneyNumber(line[map.amount]) : null;
    const categoryCell = map.category != null ? cleanText(line[map.category]) : "";
    const machineName = map.machine != null ? cleanText(line[map.machine]) : "";

    if (norm(line[map.date]) === "date" || norm(description) === "total") continue;

    let spend = null;
    if (debit != null && debit !== 0) spend = Math.abs(debit);
    else if (amount != null && amount < 0) spend = Math.abs(amount);
    else if (amount != null && amount > 0 && map.debit == null && !amountLooksSigned && !(credit != null && credit > 0 && amount === credit)) spend = amount;

    if (!date || !spend) {
      if ((line || []).some((cell) => String(cell || "").trim())) skipped += 1;
      continue;
    }

    const detail = [description, note].filter(Boolean).join(" — ") || "Bank payment";
    const named = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === categoryCell.toLowerCase());
    const guessed = guessCategory(detail);
    parsed.push({
      date: localISODate(date),
      description: detail,
      vendor: (description || note).split(/\s+/).slice(0, 4).join(" ").slice(0, 60),
      amount: Math.round(spend * 100) / 100,
      category: named || (EXPENSE_CATEGORIES.includes(guessed) ? guessed : "Other"),
      machineName,
    });
  }

  return { rows: parsed, skipped, sheetName, error: null };
}

/** Parse a bank or recon spreadsheet into outgoing expenses. Credits are skipped when a debit column exists. */
export function parseBankExpenseSheet(buffer) {
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  if (!book.SheetNames.length) return { rows: [], skipped: 0, error: "The file is empty." };

  let best = null;
  for (const name of book.SheetNames) {
    const parsed = parseSheet(book.Sheets[name], name);
    if (parsed.error === "no-header") continue;
    const score = sheetScore(name, parsed.rows.length);
    if (!best || score > best.score) best = { score, parsed };
  }

  if (!best) {
    return {
      rows: [],
      skipped: 0,
      error: "Could not find Date and Amount or Debit columns. Put those headings on one row.",
    };
  }
  if (!best.parsed.rows.length) {
    return { ...best.parsed, error: "No outgoing payments were found." };
  }
  return best.parsed;
}
