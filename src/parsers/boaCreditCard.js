/**
 * BOA Credit Card Excel/CSV Parser
 *
 * Handles the Bank of America credit card export format:
 *   Posted Date, Reference Number, Payee, Address, Amount
 *
 * Key differences from checking:
 *   - Has Reference Number (useful for deduplication)
 *   - Has Address field (useful for categorization context)
 *   - Positive amount = charge (EXPENSE)
 *   - Negative amount = payment or credit (TRANSFER — exclude from P&L)
 *
 * IMPORTANT: Credit card payments (negative amounts with descriptions
 * like "PAYMENT - THANK YOU") are NOT revenue. They are transfers
 * from checking to pay the card. To avoid double-counting, these are
 * marked as type "transfer" and excluded from P&L.
 */

import { parseCSV, parseCurrency, parseDate } from "../utils/csvParser.js";
import { createTransaction, createImportBatch, generateId } from "../models/schema.js";
import { cleanDescription, extractVendorKey } from "./normalize.js";

/**
 * Parse a BOA credit card CSV file.
 *
 * @param {string} csvText - Raw CSV file content
 * @param {string} filename - Original filename
 * @returns {{ transactions: Transaction[], batch: ImportBatch, errors: string[] }}
 */
export function parseBoaCreditCardCSV(csvText, filename = "boa-creditcard.csv") {
  const errors = [];
  const transactions = [];

  const { headers, rows } = parseCSV(csvText);

  const colMap = detectCreditCardColumns(headers);
  if (colMap.date === null || colMap.payee === null || colMap.amount === null) {
    errors.push(`Could not detect required columns (date, payee, amount) in headers: [${headers.join(", ")}]`);
    return { transactions: [], batch: null, errors };
  }

  const batchId = generateId("batch");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = parseCreditCardRow(row, colMap, filename, batchId, i + 2);
    if (result.error) {
      errors.push(result.error);
    } else if (result.transaction) {
      transactions.push(result.transaction);
    }
  }

  const batch = createImportBatch({
    id: batchId,
    filename,
    source_account: "credit_card",
    transaction_count: transactions.length,
    date_range_start: transactions.length > 0 ? transactions[0].date : "",
    date_range_end: transactions.length > 0 ? transactions[transactions.length - 1].date : "",
  });

  return { transactions, batch, errors };
}

/**
 * Parse pre-extracted rows from Excel.
 *
 * @param {Array[]} dataRows - Row arrays (NO header)
 * @param {string[]} headers - Column headers
 * @param {string} filename - Original filename
 * @returns {{ transactions: Transaction[], batch: ImportBatch, errors: string[] }}
 */
export function parseBoaCreditCardRows(dataRows, headers, filename = "boa-creditcard.xlsx") {
  const errors = [];
  const transactions = [];

  const colMap = detectCreditCardColumns(headers);
  if (!colMap.date || !colMap.payee || !colMap.amount) {
    errors.push(`Could not detect required columns in headers: [${headers.join(", ")}]`);
    return { transactions: [], batch: null, errors };
  }

  const batchId = generateId("batch");

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i].map(v => (v === null || v === undefined) ? "" : String(v));
    const result = parseCreditCardRow(row, colMap, filename, batchId, i + 2);
    if (result.error) {
      errors.push(result.error);
    } else if (result.transaction) {
      transactions.push(result.transaction);
    }
  }

  const batch = createImportBatch({
    id: batchId,
    filename,
    source_account: "credit_card",
    transaction_count: transactions.length,
    date_range_start: transactions.length > 0 ? transactions[0].date : "",
    date_range_end: transactions.length > 0 ? transactions[transactions.length - 1].date : "",
  });

  return { transactions, batch, errors };
}

// ─── Internal Helpers ────────────────────────────────────────────────

function parseCreditCardRow(row, colMap, filename, batchId, rowNum) {
  const rawDate = row[colMap.date] || "";
  const rawPayee = row[colMap.payee] || "";
  const rawAmount = row[colMap.amount] || "";
  const rawRef = colMap.reference !== null ? (row[colMap.reference] || "") : "";
  const rawAddr = colMap.address !== null ? (row[colMap.address] || "") : "";

  // Skip empty rows
  if (!rawDate && !rawPayee) {
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

  // Determine type
  const payeeLower = rawPayee.toLowerCase();
  let type = "expense";
  let is_transfer = false;

  if (amount < 0) {
    // Negative = payment or refund
    if (payeeLower.includes("payment") || payeeLower.includes("thank you")) {
      type = "transfer";
      is_transfer = true;
    } else {
      // Could be a refund/credit — still mark as expense but negative
      // Actually, refunds should reduce expenses, so keep as expense
      type = "expense";
    }
  }

  const tx = createTransaction({
    date,
    description: cleanDescription(rawPayee),
    original_description: rawPayee.trim(),
    amount: Math.abs(amount),
    type,
    source_account: "credit_card",
    source_file: filename,
    import_batch_id: batchId,
    reference_number: rawRef || null,
    address: rawAddr || null,
    is_transfer,
    vendor_key: extractVendorKey(rawPayee),
  });

  return { transaction: tx, error: null };
}

function detectCreditCardColumns(headers) {
  const map = { date: null, reference: null, payee: null, address: null, amount: null };
  const lower = headers.map(h => String(h).toLowerCase().trim());

  for (let i = 0; i < lower.length; i++) {
    if (map.date === null && (lower[i].includes("date") || lower[i] === "posted date")) {
      map.date = i;
    } else if (map.reference === null && (lower[i].includes("reference") || lower[i].includes("ref"))) {
      map.reference = i;
    } else if (map.payee === null && (lower[i].includes("payee") || lower[i].includes("description") || lower[i].includes("merchant"))) {
      map.payee = i;
    } else if (map.address === null && (lower[i].includes("address") || lower[i].includes("location"))) {
      map.address = i;
    } else if (map.amount === null && lower[i].includes("amount")) {
      map.amount = i;
    }
  }

  // Fallback: if exactly 5 columns, assume standard BOA order
  if (map.date === null && headers.length === 5) {
    map.date = 0;
    map.reference = 1;
    map.payee = 2;
    map.address = 3;
    map.amount = 4;
  }

  return map;
}
