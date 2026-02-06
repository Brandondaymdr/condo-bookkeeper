/**
 * Transaction normalization — cleans BOA descriptions and extracts vendor keys.
 *
 * From SKILL-boa-import.md:
 * - Strip common BOA prefixes for cleaner display
 * - Preserve original_description for reference
 * - Extract normalized vendor_key for learned pattern matching
 */

// BOA prefixes to strip from descriptions (order matters — longest first)
const BOA_PREFIXES = [
  "ONLINE BANKING PAYMENT TO",
  "ONLINE BANKING TRANSFER TO",
  "ONLINE BANKING TRANSFER FROM",
  "ONLINE BANKING payment to CRD",
  "ONLINE BANKING transfer from CHK",
  "ONLINE BANKING transfer to CHK",
  "ONLINE BANKING transfer from SAV",
  "DEBIT CARD PURCHASE",
  "ACH DEBIT",
  "ACH CREDIT",
  "WIRE TRANSFER FROM",
  "ZELLE PAYMENT FROM",
  "ZELLE PAYMENT TO",
  "Online transfer from CHK",
  "Online transfer to CHK",
  "Online Banking transfer from CHK",
  "Online Banking transfer to CHK",
  "Online Banking transfer from SAV",
  "Online Banking payment to CRD",
];

// Patterns that indicate a transfer (not a P&L transaction)
const TRANSFER_PATTERNS = [
  /^online\s*(banking\s*)?transfer\s*(from|to)\s*chk/i,
  /^online\s*(banking\s*)?transfer\s*(from|to)\s*sav/i,
  /^online\s*(banking\s*)?payment\s*to\s*crd/i,
  /payment\s*-?\s*thank\s*you/i,
  /online\s*payment/i,
  /^transfer\s/i,
  /citi\s*card\s*online.*payment/i,
];

// Patterns that indicate revenue (deposits, rent payments)
const REVENUE_PATTERNS = [
  /zelle\s*payment\s*from/i,
  /wire\s*type:\s*wire\s*in/i,
  /^interest\s*earned$/i,
];

/**
 * Clean a BOA description by stripping common prefixes.
 * Returns a shorter, more readable version.
 */
export function cleanDescription(raw) {
  if (!raw) return "";
  let desc = String(raw).trim();

  // Strip BOA prefixes
  for (const prefix of BOA_PREFIXES) {
    const regex = new RegExp(`^${escapeRegex(prefix)}\\s*`, "i");
    if (regex.test(desc)) {
      desc = desc.replace(regex, "").trim();
      break;
    }
  }

  // Strip DES:, ID:, CO ID:, INDN:, WEB, PPD suffixes for ACH transactions
  desc = desc.replace(/\s+DES:.*$/i, "");
  // But keep the meaningful part before DES:
  // Actually, let's be smarter — extract the vendor name from ACH format
  const achMatch = raw.match(/^(.+?)\s+DES:/i);
  if (achMatch && achMatch[1].length > 2) {
    const achVendor = achMatch[1].trim();
    // Strip any BOA prefix from the ACH vendor name too
    for (const prefix of BOA_PREFIXES) {
      if (achVendor.toLowerCase().startsWith(prefix.toLowerCase())) {
        desc = achVendor.slice(prefix.length).trim();
        break;
      }
    }
    if (desc === "" || desc.length < achVendor.length / 2) {
      desc = achVendor;
    }
  }

  // Strip Confirmation# and everything after
  desc = desc.replace(/\s*Confirmation#.*$/i, "").trim();

  // Strip trailing semicolons and whitespace
  desc = desc.replace(/[;\s]+$/, "").trim();

  // If we ended up with an empty string, fall back to original
  if (!desc) desc = String(raw).trim();

  return desc;
}

/**
 * Extract a normalized vendor key for learned pattern matching.
 *
 * From SKILL-auto-categorize.md:
 * 1. Start with cleaned description
 * 2. Convert to lowercase
 * 3. Remove trailing location info (city + state)
 * 4. Remove trailing numbers and reference codes
 * 5. Trim whitespace
 */
export function extractVendorKey(rawDescription) {
  let key = cleanDescription(rawDescription).toLowerCase();

  // Remove trailing state codes (2-letter state abbreviation)
  key = key.replace(/\s+[a-z]{2}\s*$/, "");

  // Remove trailing city + state patterns like "palm springs ca"
  key = key.replace(/\s+\w+\s+[a-z]{2}\s*$/, "");

  // Remove trailing phone numbers (800-892-4357)
  key = key.replace(/\s+[\d-]{7,}\s*[a-z]{0,2}\s*$/, "");

  // Remove trailing # + numbers (LOWES #2156)
  key = key.replace(/\s*#\d+\s*$/, "");

  // Remove trailing reference codes (long number sequences)
  key = key.replace(/\s+\d{5,}\s*$/, "");

  // Remove .COM/.NET suffixes for matching
  key = key.replace(/\.(com|net|org)\s*$/i, "");

  return key.trim();
}

/**
 * Determine the transaction type from the raw BOA description and amount.
 *
 * For checking:
 *   - Positive amount = money in (revenue or transfer in)
 *   - Negative amount = money out (expense or transfer out)
 *
 * For credit card:
 *   - Positive amount = charge (expense)
 *   - Negative amount = payment/credit (transfer)
 */
export function classifyTransaction(rawDescription, amount, sourceAccount) {
  const desc = String(rawDescription || "").toLowerCase();

  // Check if it's a transfer
  for (const pattern of TRANSFER_PATTERNS) {
    if (pattern.test(desc)) {
      return { type: "transfer", is_transfer: true };
    }
  }

  if (sourceAccount === "checking") {
    // Check for revenue patterns
    for (const pattern of REVENUE_PATTERNS) {
      if (pattern.test(rawDescription || "")) {
        return { type: "revenue", is_transfer: false };
      }
    }
    // Default: positive = revenue, negative = expense
    if (amount >= 0) {
      return { type: "revenue", is_transfer: false };
    } else {
      return { type: "expense", is_transfer: false };
    }
  }

  if (sourceAccount === "credit_card") {
    // Credit card: positive = charge (expense), negative = payment (transfer)
    if (amount < 0) {
      return { type: "transfer", is_transfer: true };
    }
    return { type: "expense", is_transfer: false };
  }

  // Fallback
  return { type: amount >= 0 ? "revenue" : "expense", is_transfer: false };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
