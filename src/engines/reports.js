/**
 * Financial Report Engines — P&L and Balance Sheet
 *
 * Generates professional Profit & Loss and Balance Sheet reports
 * aligned with IRS Schedule E for rental property reporting.
 */

import {
  REVENUE_CATEGORIES,
  EXPENSE_CATEGORIES,
  ASSET_ACCOUNTS,
  LIABILITY_ACCOUNTS,
  EQUITY_ACCOUNTS,
  getScheduleELine,
} from "../models/categories.js";

// ─── Profit & Loss ───────────────────────────────────────────────────

/**
 * Generate a Profit & Loss report for a given date range.
 *
 * @param {Transaction[]} transactions - All approved transactions
 * @param {JournalEntry[]} journalEntries - All journal entries
 * @param {string} startDate - ISO date (inclusive)
 * @param {string} endDate - ISO date (inclusive)
 * @returns {ProfitLossReport}
 */
export function generateProfitLoss(transactions, journalEntries, startDate, endDate) {
  // Filter transactions by date range and exclude transfers
  const filteredTxs = transactions.filter(tx => {
    if (!tx.approved) return false;
    if (tx.is_transfer || tx.type === "transfer") return false;
    return tx.date >= startDate && tx.date <= endDate;
  });

  // Filter journal entries by date range
  const filteredJEs = (journalEntries || []).filter(je => {
    return je.date >= startDate && je.date <= endDate;
  });

  // Build revenue breakdown
  const revenue = {};
  for (const cat of REVENUE_CATEGORIES) {
    revenue[cat.name] = 0;
  }

  // Build expense breakdown
  const expenses = {};
  for (const cat of EXPENSE_CATEGORIES) {
    expenses[cat.name] = 0;
  }

  // Sum transactions
  for (const tx of filteredTxs) {
    if (tx.type === "revenue") {
      if (revenue[tx.category] !== undefined) {
        revenue[tx.category] += tx.amount;
      } else {
        revenue["Other Revenue"] = (revenue["Other Revenue"] || 0) + tx.amount;
      }
    } else if (tx.type === "expense") {
      if (expenses[tx.category] !== undefined) {
        expenses[tx.category] += tx.amount;
      } else {
        expenses["Other Expense"] = (expenses["Other Expense"] || 0) + tx.amount;
      }
    }
  }

  // Add journal entry lines that hit P&L accounts
  for (const je of filteredJEs) {
    for (const line of je.lines || []) {
      // Revenue accounts — credit increases revenue
      if (revenue[line.account] !== undefined) {
        revenue[line.account] += (line.credit || 0) - (line.debit || 0);
      }
      // Expense accounts — debit increases expense
      if (expenses[line.account] !== undefined) {
        expenses[line.account] += (line.debit || 0) - (line.credit || 0);
      }
    }
  }

  // Calculate totals
  const totalRevenue = Object.values(revenue).reduce((sum, v) => sum + v, 0);
  const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const netIncome = totalRevenue - totalExpenses;

  // Build line items (only non-zero categories, in chart-of-accounts order)
  const revenueLines = REVENUE_CATEGORIES
    .filter(cat => revenue[cat.name] !== 0)
    .map(cat => ({
      category: cat.name,
      amount: revenue[cat.name],
      scheduleE: cat.scheduleE,
    }));

  const expenseLines = EXPENSE_CATEGORIES
    .filter(cat => expenses[cat.name] !== 0)
    .map(cat => ({
      category: cat.name,
      amount: expenses[cat.name],
      scheduleE: cat.scheduleE,
    }));

  return {
    startDate,
    endDate,
    revenue: revenueLines,
    totalRevenue,
    expenses: expenseLines,
    totalExpenses,
    netIncome,
    transactionCount: filteredTxs.length,
  };
}

// ─── Schedule E Export ───────────────────────────────────────────────

/**
 * Generate Schedule E line mappings from a P&L report.
 *
 * @param {ProfitLossReport} plReport
 * @returns {Object} Map of Schedule E line numbers to amounts
 */
export function generateScheduleEData(plReport) {
  const scheduleE = {};

  // Revenue
  for (const line of plReport.revenue) {
    if (line.scheduleE) {
      scheduleE[`Line ${line.scheduleE}`] = (scheduleE[`Line ${line.scheduleE}`] || 0) + line.amount;
    }
  }

  // Expenses
  for (const line of plReport.expenses) {
    if (line.scheduleE) {
      scheduleE[`Line ${line.scheduleE}`] = (scheduleE[`Line ${line.scheduleE}`] || 0) + line.amount;
    }
  }

  return scheduleE;
}

// ─── Balance Sheet ───────────────────────────────────────────────────

/**
 * Generate a Balance Sheet as of a specific date.
 *
 * @param {Transaction[]} transactions - All approved transactions
 * @param {JournalEntry[]} journalEntries - All journal entries
 * @param {Object} openings - Opening balance for each BS account
 * @param {string} asOfDate - ISO date (inclusive)
 * @returns {BalanceSheetReport}
 */
export function generateBalanceSheet(transactions, journalEntries, openings, asOfDate) {
  // Initialize all BS accounts with opening balances
  const balances = {};
  for (const account of [...ASSET_ACCOUNTS, ...LIABILITY_ACCOUNTS, ...EQUITY_ACCOUNTS]) {
    balances[account] = openings[account] || 0;
  }

  // Filter journal entries up to asOfDate
  const filteredJEs = (journalEntries || []).filter(je => je.date <= asOfDate);

  // Apply journal entry lines
  for (const je of filteredJEs) {
    for (const line of je.lines || []) {
      if (balances[line.account] === undefined) continue;

      if (ASSET_ACCOUNTS.includes(line.account)) {
        if (line.account === "Accumulated Depreciation") {
          // Contra-asset: credits increase (more negative), debits decrease
          balances[line.account] += (line.credit || 0) - (line.debit || 0);
        } else {
          // Normal asset: debits increase, credits decrease
          balances[line.account] += (line.debit || 0) - (line.credit || 0);
        }
      } else if (LIABILITY_ACCOUNTS.includes(line.account)) {
        // Liabilities: credits increase, debits decrease
        balances[line.account] += (line.credit || 0) - (line.debit || 0);
      } else if (EQUITY_ACCOUNTS.includes(line.account)) {
        if (line.account === "Owner's Draw") {
          // Draws: debits increase (reduce equity), credits decrease
          balances[line.account] += (line.debit || 0) - (line.credit || 0);
        } else if (line.account !== "Retained Earnings") {
          // Other equity: credits increase, debits decrease
          balances[line.account] += (line.credit || 0) - (line.debit || 0);
        }
      }
    }
  }

  // Calculate Retained Earnings from P&L activity
  // Retained Earnings = Opening RE + All Revenue - All Expenses (from inception through asOfDate)
  const allApprovedTxs = (transactions || []).filter(tx => {
    if (!tx.approved) return false;
    if (tx.is_transfer || tx.type === "transfer") return false;
    return tx.date <= asOfDate;
  });

  let totalRevenue = 0;
  let totalExpenses = 0;
  for (const tx of allApprovedTxs) {
    if (tx.type === "revenue") totalRevenue += tx.amount;
    else if (tx.type === "expense") totalExpenses += tx.amount;
  }

  // Also include JE lines hitting P&L accounts
  const allRevNames = REVENUE_CATEGORIES.map(c => c.name);
  const allExpNames = EXPENSE_CATEGORIES.map(c => c.name);

  for (const je of filteredJEs) {
    for (const line of je.lines || []) {
      if (allRevNames.includes(line.account)) {
        totalRevenue += (line.credit || 0) - (line.debit || 0);
      }
      if (allExpNames.includes(line.account)) {
        totalExpenses += (line.debit || 0) - (line.credit || 0);
      }
    }
  }

  const retainedEarningsFromPL = totalRevenue - totalExpenses;
  balances["Retained Earnings"] = (openings["Retained Earnings"] || 0) + retainedEarningsFromPL;

  // Build report sections
  const currentAssets = ["Cash - Checking (BOA)", "Cash - Credit Card Balance", "Security Deposit Held"]
    .map(name => ({ account: name, balance: balances[name] || 0 }));

  const fixedAssets = ["Property", "Accumulated Depreciation"]
    .map(name => ({ account: name, balance: balances[name] || 0 }));

  const totalAssets = [...currentAssets, ...fixedAssets].reduce((sum, a) => {
    // Accumulated Depreciation is stored as positive but reduces assets
    if (a.account === "Accumulated Depreciation") {
      return sum - Math.abs(a.balance);
    }
    return sum + a.balance;
  }, 0);

  const currentLiabilities = ["Credit Card Payable", "Security Deposit Liability"]
    .map(name => ({ account: name, balance: balances[name] || 0 }));

  const longTermLiabilities = ["Mortgage Payable", "Other Liability"]
    .map(name => ({ account: name, balance: balances[name] || 0 }));

  const totalLiabilities = [...currentLiabilities, ...longTermLiabilities]
    .reduce((sum, l) => sum + l.balance, 0);

  const equity = ["Owner's Equity", "Owner's Draw", "Retained Earnings"]
    .map(name => ({
      account: name,
      balance: name === "Owner's Draw" ? -(balances[name] || 0) : (balances[name] || 0),
    }));

  const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
  const difference = totalAssets - (totalLiabilities + totalEquity);

  return {
    asOfDate,
    currentAssets,
    fixedAssets,
    totalAssets,
    currentLiabilities,
    longTermLiabilities,
    totalLiabilities,
    equity,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced,
    difference,
    retainedEarningsFromPL,
  };
}

// ─── Date Range Helpers ──────────────────────────────────────────────

/**
 * Get preset date ranges for report filtering.
 */
export function getPresetDateRanges() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10);
  const endOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const startOfLastMonth = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const endOfLastMonth = new Date(year, month, 0).toISOString().slice(0, 10);

  const quarter = Math.floor(month / 3);
  const startOfQuarter = new Date(year, quarter * 3, 1).toISOString().slice(0, 10);
  const endOfQuarter = new Date(year, (quarter + 1) * 3, 0).toISOString().slice(0, 10);

  const lastQuarter = quarter - 1;
  const lastQuarterYear = lastQuarter < 0 ? year - 1 : year;
  const lastQuarterIdx = lastQuarter < 0 ? 3 : lastQuarter;
  const startOfLastQuarter = new Date(lastQuarterYear, lastQuarterIdx * 3, 1).toISOString().slice(0, 10);
  const endOfLastQuarter = new Date(lastQuarterYear, (lastQuarterIdx + 1) * 3, 0).toISOString().slice(0, 10);

  return [
    { label: "This Month", start: startOfMonth, end: endOfMonth },
    { label: "Last Month", start: startOfLastMonth, end: endOfLastMonth },
    { label: "This Quarter", start: startOfQuarter, end: endOfQuarter },
    { label: "Last Quarter", start: startOfLastQuarter, end: endOfLastQuarter },
    { label: `${year} YTD`, start: `${year}-01-01`, end: today.toISOString().slice(0, 10) },
    { label: `${year - 1} Full Year`, start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
  ];
}
