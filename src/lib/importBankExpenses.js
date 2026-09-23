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

function headerIndex(headers, names) {
  return headers.findIndex((h) => names.includes(norm(h)));
}

function excelDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0);
  }
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    ["Fuel", ["fuel", "diesel", "engen", "shell", "bp ", "sasol", "petrol"]],
    ["Parts", ["part", "bearing", "filter", "spares"]],
    ["Hydraulic Oil", ["hydraulic"]],
    ["Engine Oil", ["engine oil", "lubricant"]],
    ["Belts", ["belt"]],
    ["Bolts & Nuts", ["bolt", "fastener"]],
    ["Consumables", ["grease", "consumable"]],
    ["Labour", ["salary", "wage", "labour", "labor"]],
    ["Transport", ["transport", "courier", "delivery", "uber", "fuel levy"]],
    ["Tools", ["tool"]],
  ];
  for (const [category, words] of rules) {
    if (words.some((word) => text.includes(word))) return category;
  }
  return "Other";
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const headers = (rows[i] || []).map((cell) => norm(cell));
    const hasDate = headers.some((h) => DATE_HEADERS.includes(h));
    const hasMoney = headers.some((h) => [...DEBIT_HEADERS, ...AMOUNT_HEADERS, ...CREDIT_HEADERS].includes(h));
    if (hasDate && hasMoney) return i;
  }
  return 0;
}

/** Parse a bank spreadsheet into outgoing expenses. Credits are skipped when a debit column exists. */
export function parseBankExpenseSheet(buffer) {
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  if (!rows.length) return { rows: [], skipped: 0, error: "The file is empty." };

  const headerAt = findHeaderRow(rows);
  const headers = rows[headerAt] || [];
  const dateCol = headerIndex(headers, DATE_HEADERS);
  const descCol = headerIndex(headers, DESC_HEADERS);
  const debitCol = headerIndex(headers, DEBIT_HEADERS);
  const creditCol = headerIndex(headers, CREDIT_HEADERS);
  const amountCol = headerIndex(headers, AMOUNT_HEADERS);

  if (dateCol < 0 || (debitCol < 0 && amountCol < 0)) {
    return {
      rows: [],
      skipped: 0,
      error: "Could not find Date and Amount (or Debit) columns. Use the first row as headings.",
    };
  }

  const parsed = [];
  let skipped = 0;
  for (const line of rows.slice(headerAt + 1)) {
    const date = excelDate(line[dateCol]);
    const description = descCol >= 0 ? String(line[descCol] || "").trim() : "";
    const debit = debitCol >= 0 ? moneyNumber(line[debitCol]) : null;
    const credit = creditCol >= 0 ? moneyNumber(line[creditCol]) : null;
    const amount = amountCol >= 0 ? moneyNumber(line[amountCol]) : null;

    let spend = null;
    if (debit != null && debit !== 0) spend = Math.abs(debit);
    else if (amount != null && amount < 0) spend = Math.abs(amount);
    else if (amount != null && amount > 0 && debitCol < 0 && !(credit != null && credit > 0 && amount === credit)) spend = amount;
    else if (credit != null && credit > 0 && debitCol < 0 && amountCol < 0) {
      skipped += 1;
      continue;
    }

    if (!date || !spend) {
      if (line.some((cell) => String(cell || "").trim())) skipped += 1;
      continue;
    }

    const category = EXPENSE_CATEGORIES.includes(guessCategory(description)) ? guessCategory(description) : "Other";
    parsed.push({
      date: date.toISOString().slice(0, 10),
      description: description || "Bank payment",
      vendor: description.split(/\s+/).slice(0, 4).join(" ").slice(0, 60),
      amount: Math.round(spend * 100) / 100,
      category,
    });
  }

  return { rows: parsed, skipped, error: parsed.length ? null : "No outgoing payments were found." };
}
