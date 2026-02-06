/**
 * BOA Checking Account CSV/Excel Parser
 *
 * Handles the Bank of America checking account export format:
 *   Date, Description, Amount, Running Bal.
 *
 * Supports both CSV text input and pre-parsed rows (from Excel).
 *
 * Real-world BOA checking format observed from Brandon's 2025 Bank Ledger:
 *   - Has a summary section at top (Beginning balance, Total credits, etc.)
 *   - Date format can be YYYY-MM-DD (Excel) or MM/DD/YYYY (CSV)
 *   - Description column contains raw BOA text with prefixes
 *   - Amount column: positive = deposit, negative = withdrawal
 *   - Running Bal. column: informational only
 */

import { parseCSV, parseCurrency, parseDate } from "../utils/csvParser.js";
import { createTransaction, createImportBatch, generateId } from "../models/schema.js";
import { cleanDescription, classifyTransaction, extractVendorKey } from "./normalize.js";

/**
 * Parse a BOA checking CSV file.
 *
 * @param {string} csvText - Raw CSV file content
 * @param {string} filename - Original filename for metadata
 * @returns {{ transactions: Transaction[], batch: ImportBatch, errors: string[] }}
 */
export function parseBoaCheckingCSV(csvText, filename = "boa-checking.csv") {
  const errors = [];
  const transactions = [];

  const { headers, rows } = parseCSV(csvText);

  // Auto-detect column positions
  const colMap = detectCheckingColumns(headers);
  if (colMap.date === null || colMap.description === null || colMap.amount === null) {
    errors.push(`Could not detect required columns (date, description, amount) in headers: [${headers.join(", ")}]`);
    return { transactions: [], batch: null, errors };
  }

  const batchId = generateId("batch");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = parseCheckingRow(row, colMap, filename, batchId, i + 2); // +2 for 1-indexed + header
    if (result.error) {
      errors.push(result.error);
    } else if (result.transaction) {
      transactions.push(result.transaction);
    }
  }

  const batch = createImportBatch({
    id: batchId,
    filename,
    source_account: "checking",
    transaction_count: transactions.length,
    date_range_start: transactions.length > 0 ? transactions[0].date : "",
    date_range_end: transactions.length > 0 ? transactions[transactions.length - 1].date : "",
  });

  return { transactions, batch, errors };
}

/**
 * Parse pre-extracted rows from an Excel file (e.g., from openpyxl).
 * Each row is an array of values: [date, description, amount, running_balance]
 *
 * @param {Array[]} dataRows - Array of row arrays (NO header row)
 * @param {string[]} headers - Column headers
 * @param {string} filename - Original filename
 * @returns {{ transactions: Transaction[], batch: ImportBatch, errors: string[] }}
 */
export function parseBoaCheckingRows(dataRows, headers, filename = "boa-checking.xlsx") {
  const errors = [];
  const transactions = [];

  const colMap = detectCheckingColumns(headers);
  if (!colMap.date || !colMap.description || !colMap.amount) {
    errors.push(`Could not detect required columns in headers: [${headers.join(", ")}]`);
    return { transactions: [], batch: null, errors };
  }

  const batchId = generateId("batch");

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i].map(v => (v === null || v === undefined) ? "" : String(v));
    const result = parseCheckingRow(row, colMap, filename, batchId, i + 2);
    if (result.error) {
      errors.push(result.error);
    } else if (result.transaction) {
      transactions.push(result.transaction);
    }
  }

  const batch = createImportBatch({
    id: batchId,
    filename,
    source_account: "checking",
    transaction_count: transactions.length,
    date_range_start: transactions.length > 0 ? transactions[0].date : "",
    date_range_end: transactions.length > 0 ? transactions[transactions.length - 1].date : "",
  });

  return { transactions, batch, errors };
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Parse a single row into a Transaction object.
 */
function parseCheckingRow(row, colMap, filename, batchId, rowNum) {
  const rawDate = row[colMap.date] || "";
  const rawDesc = row[colMap.description] || "";
  const rawAmount = row[colMap.amount] || "";
  const rawBalance = colMap.running_balance !== null ? (row[colMap.running_balance] || "") : "";

  // Skip summary/header rows (beginning balance, total credits, etc.)
  if (/^(beginning|total|ending)\s+/i.test(rawDesc)) {
    return { transaction: null, error: null };
  }

  // Skip empty rows
  if (!rawDate && !rawDesc) {
    return { transaction: null, error: null };
  }

  // Parse date
  const date = parseDate(rawDate);
  if (!date) {
    return {
      transaction: null,
      error: `Row ${rowNum}: Could not parse date "${rawDate}"`,
    };
  }

  // Parse amount
  const amount = parseCurrency(rawAmount);
  if (amount === 0 && rawAmount !== "0" && rawAmount !== "0.00") {
    // Might be a non-monetary row (like "Beginning balance")
    // Only error if there was actually a description
    if (rawDesc && !rawDesc.toLowerCase().includes("interest earned")) {
      // Interest earned with 0.00 is valid
      if (rawAmount === "" || rawAmount === null) {
        return { transaction: null, error: null }; // Skip rows with no amount (summary rows)
      }
    }
  }

  // Parse running balance
  const running_balance = rawBalance ? parseCurrency(rawBalance) : null;

  // Classify the transaction
  const { type, is_transfer } = classifyTransaction(rawDesc, amount, "checking");

  // Create transaction
  const tx = createTransaction({
    date,
    description: cleanDescription(rawDesc),
    original_description: rawDesc.trim(),
    amount: Math.abs(amount),
    type,
    source_account: "checking",
    source_file: filename,
    import_batch_id: batchId,
    running_balance,
    is_transfer,
    vendor_key: extractVendorKey(rawDesc),
  });

  return { transaction: tx, error: null };
}

/**
 * Auto-detect column positions from headers.
 * Looks for keywords: date, description, amount, balance/running
 */
function detectCheckingColumns(headers) {
  const map = { date: null, description: null, amount: null, running_balance: null };
  const lower = headers.map(h => String(h).toLowerCase().trim());

  for (let i = 0; i < lower.length; i++) {
    if (map.date === null && (lower[i].includes("date") || lower[i] === "posted date")) {
      map.date = i;
    } else if (map.description === null && (lower[i].includes("description") || lower[i].includes("payee") || lower[i].includes("memo"))) {
      map.description = i;
    } else if (map.amount === null && (lower[i].includes("amount") || lower[i] === "sum" || lower[i].includes("summary"))) {
      map.amount = i;
    } else if (map.running_balance === null && (lower[i].includes("balance") || lower[i].includes("running"))) {
      map.running_balance = i;
    }
  }

  // Fallback: if we have exactly 4 columns, assume Date, Description, Amount, Balance
  if (map.date === null && headers.length >= 3) {
    map.date = 0;
    map.description = 1;
    map.amount = 2;
    if (headers.length >= 4) map.running_balance = 3;
  }

  return map;
}
