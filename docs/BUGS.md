# Condo Bookkeeper - Bug Tracker

This document tracks all known bugs, their status, and fix details.
Updated as bugs are found and fixed.

---

## Bug Status Legend
- OPEN: Not yet fixed
- IN PROGRESS: Currently being worked on
- FIXED: Fix deployed to GitHub Pages

---

## Critical Bugs

### BUG-001: TransactionList type filter uses wrong case
**Status:** OPEN
**File:** src/components/TransactionList.jsx
**Lines:** 89, 92, 216-218
**Description:** Type filter compares against Revenue (capitalized) but transactions store type as lowercase revenue. Revenue/expense totals in stats bar always show 0.
**Fix:** Change all type comparisons to lowercase. Change dropdown option values to lowercase.

### BUG-002: TransactionList source filter uses wrong property
**Status:** OPEN
**File:** src/components/TransactionList.jsx
**Line:** 43
**Description:** Filter checks t.source but transactions use source_account property. Source filter dropdown also uses Checking vs stored checking.
**Fix:** Change t.source to t.source_account. Match dropdown values to stored values.

### BUG-003: categorizeAll() called with wrong arguments
**Status:** OPEN
**Files:** src/components/RuleManager.jsx:100, src/components/ImportWizard.jsx:190
**Description:** categorizeAll(transactions, rules, patterns) expects 3 args but called with 1 arg.
**Fix:** Pass all 3 arguments: store.transactions, store.rules, store.learned_patterns

### BUG-004: applyLearnedPatterns treats patterns as array
**Status:** OPEN
**File:** src/engines/categorize.js
**Line:** 69
**Description:** Function checks patterns.length === 0 but learned_patterns is an object (keyed by vendor_key), not an array. Pattern matching always returns null.
**Fix:** Change to Object.keys(patterns).length === 0 and use patterns[vendorKey] lookup.

### BUG-005: P&L report property name mismatch
**Status:** OPEN
**File:** src/engines/reports.js
**Lines:** 92-104
**Description:** generateProfitLoss returns { category, amount, scheduleE } but ProfitLoss.jsx expects { name, amount, scheduleE }.
**Fix:** Change category to name in the report generator output.

### BUG-006: Balance Sheet structure mismatch
**Status:** OPEN
**File:** src/engines/reports.js
**Lines:** 252-256
**Description:** Balance sheet generator returns flat arrays but BalanceSheet.jsx expects nested { items: [...] } structure.
**Fix:** Align report output structure with what BalanceSheet.jsx expects.

---

## High Priority Bugs

### BUG-007: RuleManager uses wrong property name for patterns
**Status:** OPEN
**File:** src/components/RuleManager.jsx
**Lines:** 92, 128
**Description:** References store.learnedPatterns (camelCase) but store uses learned_patterns (snake_case). Pattern tab shows empty, deletion fails silently.
**Fix:** Change all references to store.learned_patterns

### BUG-008: TransactionList saveData called without store
**Status:** OPEN
**File:** src/components/TransactionList.jsx
**Lines:** 118, 126
**Description:** handleSaveEdit and handleDelete call saveData() with no arguments. App.jsx expects saveData(updatedStore) with full store object.
**Fix:** Construct updated store object and pass to saveData.

### BUG-009: Settings exportToJSON missing store argument
**Status:** OPEN
**File:** src/components/Settings.jsx
**Line:** 61
**Description:** Calls exportToJSON() without passing store. Export will fail because store is undefined inside the function.
**Fix:** Pass store: exportToJSON(store)

### BUG-010: importFromJSON receives wrong type
**Status:** OPEN
**File:** src/storage/backup.js
**Line:** 36
**Description:** Function expects File object and uses FileReader, but Settings.jsx passes parsed JSON object.
**Fix:** Either pass File object, or update importFromJSON to handle both File and JSON.

---

## Previously Fixed Bugs

### BUG-F001: P&L report crash on load
**Status:** FIXED (commit e363628)
**File:** src/components/ProfitLoss.jsx
**Description:** Property names in ProfitLoss.jsx did not match reports engine output. Page crashed with blank screen.
**Fix:** Aligned property names with reports engine.

### BUG-F002: P&L date handling - Invalid Date display
**Status:** FIXED (commit 3d5fa71)
**File:** src/components/ProfitLoss.jsx
**Lines:** 24-25, 31-37, 58, 235
**Description:** Three bugs: passed Date objects instead of strings to report engine, preset lookup used dictionary instead of array, hardcoded preset labels did not match engine labels.
**Fix:** Pass string dates directly, use array.find() for presets, generate labels dynamically.

---

## Bug Fix Workflow

When fixing a bug:
1. Read the affected file(s) to understand current code
2. Identify the root cause and all affected lines
3. Make the minimal fix needed
4. Build locally: npm run build
5. Deploy to GitHub (commit to main triggers auto-deploy)
6. Hard refresh the live app to verify fix
7. Update this file: move bug to Previously Fixed section with commit hash

---

## Important Notes

- All transaction types are LOWERCASE: revenue, expense, transfer
- Store property for patterns is learned_patterns (snake_case with underscore)
- Store property for source is source_account (snake_case)
- saveData() in App.jsx expects full store object as argument
- Date values are ISO strings (YYYY-MM-DD), never Date objects
- Reports engine functions expect string dates for comparison
- learned_patterns is an OBJECT keyed by vendor_key, NOT an array
