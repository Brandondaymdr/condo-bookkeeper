/**
 * Chart of Accounts — aligned with IRS Schedule E for rental property reporting.
 *
 * Schedule E line numbers included for tax prep mapping.
 */

export const REVENUE_CATEGORIES = [
  { name: "Rental Income",   scheduleE: "3" },
  { name: "Late Fees",       scheduleE: null },
  { name: "Other Revenue",   scheduleE: null },
];

export const EXPENSE_CATEGORIES = [
  { name: "Advertising",           scheduleE: "5" },
  { name: "Auto & Travel",         scheduleE: "6" },
  { name: "Cleaning & Maintenance", scheduleE: "7" },
  { name: "Insurance",             scheduleE: "9" },
  { name: "Legal & Professional",  scheduleE: "10" },
  { name: "Management Fees",       scheduleE: "11" },
  { name: "Mortgage Interest",     scheduleE: "12" },
  { name: "Repairs & Maintenance", scheduleE: "14" },
  { name: "Supplies",              scheduleE: "15" },
  { name: "Property Tax",          scheduleE: "16" },
  { name: "Utilities",             scheduleE: "17" },
  { name: "HOA Fees",              scheduleE: "19" },
  { name: "Depreciation",          scheduleE: "20" },
  { name: "Internet & Cable",      scheduleE: "17" },  // Grouped with utilities on Sch E
  { name: "Pest Control",          scheduleE: "14" },  // Grouped with repairs on Sch E
  { name: "Bank & Merchant Fees",  scheduleE: "19" },
  { name: "Earthquake Insurance",  scheduleE: "9" },
  { name: "Other Expense",         scheduleE: "19" },
];

export const ASSET_ACCOUNTS = [
  "Cash - Checking (BOA)",
  "Cash - Credit Card Balance",
  "Security Deposit Held",
  "Property",
  "Accumulated Depreciation",  // Contra-asset (credit normal balance)
];

export const LIABILITY_ACCOUNTS = [
  "Mortgage Payable",
  "Credit Card Payable",
  "Security Deposit Liability",
  "Other Liability",
];

export const EQUITY_ACCOUNTS = [
  "Owner's Equity",
  "Owner's Draw",
  "Retained Earnings",  // Auto-calculated
];

// Flat lists for dropdowns
export const ALL_REVENUE_NAMES = REVENUE_CATEGORIES.map(c => c.name);
export const ALL_EXPENSE_NAMES = EXPENSE_CATEGORIES.map(c => c.name);
export const ALL_PL_CATEGORIES = [...ALL_REVENUE_NAMES, ...ALL_EXPENSE_NAMES];
export const ALL_BS_ACCOUNTS = [...ASSET_ACCOUNTS, ...LIABILITY_ACCOUNTS, ...EQUITY_ACCOUNTS];
export const ALL_ACCOUNTS = [...ALL_PL_CATEGORIES, ...ALL_BS_ACCOUNTS];

/**
 * Look up Schedule E line number for a category name.
 * Returns null if not mapped.
 */
export function getScheduleELine(categoryName) {
  const found = [...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES]
    .find(c => c.name === categoryName);
  return found ? found.scheduleE : null;
}

/**
 * Determine if a category is revenue, expense, or balance-sheet.
 */
export function getCategoryType(categoryName) {
  if (ALL_REVENUE_NAMES.includes(categoryName)) return "revenue";
  if (ALL_EXPENSE_NAMES.includes(categoryName)) return "expense";
  if (ASSET_ACCOUNTS.includes(categoryName)) return "asset";
  if (LIABILITY_ACCOUNTS.includes(categoryName)) return "liability";
  if (EQUITY_ACCOUNTS.includes(categoryName)) return "equity";
  return null;
}
