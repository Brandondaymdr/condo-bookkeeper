/**
 * Condo Bookkeeper — Data Model / Schema
 *
 * All data is stored in a single JSON object (the "store").
 * This file defines the shape of every object, default values,
 * and factory functions for creating new records.
 */

// ─── Unique ID Generator ────────────────────────────────────────────
let _counters = { tx: 0, rule: 0, je: 0, pattern: 0, batch: 0 };

export function generateId(prefix = "tx") {
  _counters[prefix] = (_counters[prefix] || 0) + 1;
  return `${prefix}-${Date.now()}-${_counters[prefix]}`;
}

// ─── Transaction ─────────────────────────────────────────────────────
/**
 * A single financial transaction (imported from bank or manually entered).
 *
 * @typedef {Object} Transaction
 * @property {string}  id                  - Unique identifier
 * @property {string}  date                - ISO date string (YYYY-MM-DD)
 * @property {string}  description         - Cleaned display description
 * @property {string}  original_description - Raw description from bank file
 * @property {number}  amount              - Always positive
 * @property {string}  type                - "revenue" | "expense" | "transfer"
 * @property {string}  category            - From Chart of Accounts (empty if uncategorized)
 * @property {string}  source_account      - "checking" | "credit_card" | "manual"
 * @property {string}  source_file         - Original filename
 * @property {string}  import_batch_id     - Groups transactions from same import
 * @property {string}  import_date         - ISO date when imported
 * @property {string|null}  reference_number - BOA reference (credit card only)
 * @property {string|null}  address         - Merchant address (credit card only)
 * @property {number|null}  running_balance - From bank statement
 * @property {boolean} is_transfer         - True if this is an internal transfer
 * @property {boolean} approved            - User has reviewed and approved
 * @property {string}  categorization_source - "rule" | "learned" | "smart" | "manual" | ""
 * @property {string}  confidence          - "high" | "medium" | "low" | "none"
 */
export function createTransaction(overrides = {}) {
  return {
    id: generateId("tx"),
    date: "",
    description: "",
    original_description: "",
    amount: 0,
    type: "",               // revenue | expense | transfer
    category: "",
    source_account: "",     // checking | credit_card | manual
    source_file: "",
    import_batch_id: "",
    import_date: new Date().toISOString().slice(0, 10),
    reference_number: null,
    address: null,
    running_balance: null,
    is_transfer: false,
    approved: false,
    categorization_source: "",  // rule | learned | smart | manual
    confidence: "none",         // high | medium | low | none
    ...overrides,
  };
}

// ─── Explicit Rule ───────────────────────────────────────────────────
/**
 * A user-defined categorization rule (Layer 1).
 * Substring match against transaction descriptions.
 *
 * @typedef {Object} Rule
 * @property {string}  id
 * @property {string}  match        - Substring to match (case-insensitive)
 * @property {string}  type         - "revenue" | "expense"
 * @property {string}  category     - Category from Chart of Accounts
 * @property {string}  match_type   - "contains" (default) | "startsWith" | "exact"
 * @property {boolean} active
 * @property {string}  created      - ISO date
 */
export function createRule(overrides = {}) {
  return {
    id: generateId("rule"),
    match: "",
    type: "expense",
    category: "",
    match_type: "contains",
    active: true,
    created: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
}

// ─── Learned Pattern (Layer 2) ───────────────────────────────────────
/**
 * Auto-learned vendor → category mapping from past user categorizations.
 *
 * @typedef {Object} LearnedPattern
 * @property {string}   vendor_key         - Normalized vendor name (lowercase)
 * @property {string}   type               - "revenue" | "expense"
 * @property {string}   category
 * @property {number}   times_used         - How many times this mapping was confirmed
 * @property {string}   last_used          - ISO date
 * @property {string}   confidence         - "high" (3+) | "medium" (1-2)
 * @property {string[]} sample_descriptions - Examples of raw descriptions
 */
export function createLearnedPattern(overrides = {}) {
  return {
    vendor_key: "",
    type: "expense",
    category: "",
    times_used: 0,
    last_used: "",
    confidence: "medium",
    sample_descriptions: [],
    ...overrides,
  };
}

// ─── Journal Entry ───────────────────────────────────────────────────
/**
 * Double-entry journal entry for non-transaction adjustments
 * (depreciation, mortgage allocation, owner draws, etc.)
 *
 * @typedef {Object} JournalEntry
 * @property {string} id
 * @property {string} date     - ISO date
 * @property {string} memo     - Description
 * @property {Object[]} lines  - Array of { account, debit, credit }
 */
export function createJournalEntry(overrides = {}) {
  return {
    id: generateId("je"),
    date: "",
    memo: "",
    lines: [],  // [{ account: "Depreciation", debit: 10181.82, credit: 0 }, ...]
    ...overrides,
  };
}

// ─── Import Batch ────────────────────────────────────────────────────
/**
 * Metadata for a single file import operation.
 * Groups transactions that were imported together.
 */
export function createImportBatch(overrides = {}) {
  return {
    id: generateId("batch"),
    filename: "",
    source_account: "",    // checking | credit_card
    import_date: new Date().toISOString().slice(0, 10),
    transaction_count: 0,
    date_range_start: "",
    date_range_end: "",
    duplicates_skipped: 0,
    ...overrides,
  };
}

// ─── Full Data Store ─────────────────────────────────────────────────
/**
 * The complete application state — everything saved/loaded as one JSON blob.
 */
export function createDefaultStore() {
  return {
    version: 1,
    entity: "Palm Springs Condo",  // Single-entity system
    transactions: [],
    rules: [],                      // Explicit rules (Layer 1)
    learned_patterns: [],           // Learned vendor mappings (Layer 2)
    journal_entries: [],
    import_batches: [],
    balance_sheet_openings: {
      // User sets these once during initial setup
      "Cash - Checking (BOA)": 0,
      "Cash - Credit Card Balance": 0,
      "Security Deposit Held": 0,
      "Property": 0,
      "Accumulated Depreciation": 0,
      "Mortgage Payable": 0,
      "Credit Card Payable": 0,
      "Security Deposit Liability": 0,
      "Other Liability": 0,
      "Owner's Equity": 0,
      "Owner's Draw": 0,
      "Retained Earnings": 0,
    },
    settings: {
      property_cost_basis: 0,    // For depreciation calculation
      land_value: 0,
      depreciation_start_year: null,
    },
  };
}
