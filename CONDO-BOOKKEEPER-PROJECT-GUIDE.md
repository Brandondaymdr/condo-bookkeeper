# Condo Bookkeeper — Complete Project Guide

> **Last Updated:** February 7, 2026
> **Author:** Brandon Day (brandon@daysllc.com)
> **Status:** Active Development — v0.2.0

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Links & Access](#links--access)
3. [Tech Stack](#tech-stack)
4. [Directory Structure](#directory-structure)
5. [Architecture & Data Flow](#architecture--data-flow)
6. [Components Reference](#components-reference)
7. [Data Models](#data-models)
8. [Categorization Engine](#categorization-engine)
9. [Bank File Parsers](#bank-file-parsers)
10. [Reporting Engine](#reporting-engine)
11. [Data Persistence](#data-persistence)
12. [Chart of Accounts (IRS Schedule E)](#chart-of-accounts-irs-schedule-e)
13. [Deployment & CI/CD](#deployment--cicd)
14. [Commit History](#commit-history)
15. [Known Issues & Areas for Improvement](#known-issues--areas-for-improvement)
16. [Continuation Prompt](#continuation-prompt)

---

## Project Overview

**Condo Bookkeeper** is a browser-based bookkeeping application built as a QuickBooks replacement for managing a Palm Springs rental condo. It runs entirely in the browser with no backend server — all data is stored locally in IndexedDB.

The app handles the full bookkeeping lifecycle: importing bank statements from Bank of America (CSV/Excel), auto-categorizing transactions using a 3-layer learning engine, reviewing and approving transactions, generating IRS Schedule E-aligned Profit & Loss and Balance Sheet reports, and managing double-entry journal adjustments.

It is a single-entity system designed for one property with multiple bank accounts (checking, savings, credit cards).

---

## Links & Access

| Resource | URL |
|----------|-----|
| **Live App** | [https://brandondaymdr.github.io/condo-bookkeeper/](https://brandondaymdr.github.io/condo-bookkeeper/) |
| **GitHub Repo** | [https://github.com/Brandondaymdr/condo-bookkeeper](https://github.com/Brandondaymdr/condo-bookkeeper) |
| **GitHub Actions** | [https://github.com/Brandondaymdr/condo-bookkeeper/actions](https://github.com/Brandondaymdr/condo-bookkeeper/actions) |

The repo is **public**. Deployment is automatic — every push to `main` triggers a GitHub Actions build that deploys to GitHub Pages.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 18.3.1 |
| **Build Tool** | Vite | 6.0.0 |
| **Spreadsheet Parsing** | SheetJS (xlsx) | 0.18.5 |
| **Styling** | Inline CSS (no framework) | — |
| **Storage** | IndexedDB (browser-local) | — |
| **Hosting** | GitHub Pages | — |
| **CI/CD** | GitHub Actions | Node 20 |

No backend, no database server, no API. The entire app runs client-side. Data persists in the browser's IndexedDB as a single JSON blob.

---

## Directory Structure

```
condo-bookkeeper/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions → GitHub Pages
├── docs/
│   ├── BUGS.md                       # Known bugs tracker
│   └── PROJECT.md                    # Original project planning doc
├── src/
│   ├── components/                   # React UI components
│   │   ├── BalanceSheet.jsx          # Balance sheet report
│   │   ├── Banking.jsx               # Account management + drill-down
│   │   ├── ImportWizard.jsx          # 4-step bank file import
│   │   ├── JournalEntries.jsx        # Double-entry adjustments
│   │   ├── ProfitLoss.jsx            # P&L report with export
│   │   ├── ReviewApproval.jsx        # Transaction categorization review
│   │   ├── RuleManager.jsx           # Rules & learned patterns
│   │   ├── Settings.jsx              # App settings (TBD)
│   │   └── TransactionList.jsx       # Full transaction ledger
│   ├── engines/                      # Business logic
│   │   ├── categorize.js             # 3-layer categorization pipeline
│   │   └── reports.js                # P&L + Balance Sheet generators
│   ├── models/                       # Data schemas & defaults
│   │   ├── categories.js             # Chart of Accounts (Schedule E)
│   │   ├── defaultRules.js           # 35 pre-loaded rules
│   │   └── schema.js                 # Data structures & factories
│   ├── parsers/                      # Bank file import
│   │   ├── boaChecking.js            # BOA checking CSV/Excel parser
│   │   ├── boaCreditCard.js          # BOA credit card CSV/Excel parser
│   │   ├── deduplicate.js            # Duplicate transaction detection
│   │   └── normalize.js              # Description cleaning, vendor keys
│   ├── storage/                      # Persistence
│   │   ├── backup.js                 # JSON export/import, CSV export
│   │   └── db.js                     # IndexedDB wrapper
│   ├── utils/                        # Utilities
│   │   ├── csvParser.js              # CSV parsing (quoted fields, etc.)
│   │   └── format.js                 # formatMoney(), formatDate()
│   ├── App.jsx                       # Main app shell + Dashboard + routing
│   └── main.jsx                      # React DOM entry point
├── index.html                        # HTML template
├── package.json                      # Dependencies & scripts
├── vite.config.js                    # Vite config (base path for GH Pages)
└── .gitignore
```

---

## Architecture & Data Flow

### State Management

The app uses a simple top-down data flow with no state management library:

```
App.jsx
  ├── useState: store (entire app state)
  ├── useState: activeTab (current page)
  ├── useEffect: loads store from IndexedDB on mount
  ├── saveData(updates): merges updates into store, persists to IndexedDB
  │
  └── Renders activeTab component with props: { store, saveData }
        ├── Dashboard (inline in App.jsx)
        ├── Banking.jsx
        ├── ImportWizard.jsx
        ├── ReviewApproval.jsx
        ├── TransactionList.jsx
        ├── RuleManager.jsx
        ├── JournalEntries.jsx
        ├── ProfitLoss.jsx
        ├── BalanceSheet.jsx
        └── Settings.jsx
```

Every component receives the full `store` object and a `saveData` function. When a component needs to update data, it calls `saveData({ transactions: updatedArray })` which merges into the store and persists to IndexedDB.

### Navigation

The sidebar has 10 tabs. Clicking a tab sets `activeTab` state, which renders the corresponding component. There is no URL routing — it's all in-memory state.

### Data Persistence

All app data lives in a single IndexedDB database ("condo-bookkeeper") with one object store ("app-data") and one key ("store"). The entire state is serialized as JSON on every save. On load, it's deserialized and merged with schema defaults to handle version upgrades.

---

## Components Reference

### Dashboard (inline in App.jsx)
The landing page showing summary cards in a responsive grid layout: Total Transactions, Pending Review, Revenue, Expenses (top row of 4), Net Income, Last Import (second row of 2), Rules & Patterns, Approved count (third row of 2). All currency values use `whiteSpace: 'nowrap'` to prevent overflow.

### Banking.jsx (~1175 lines)
Manages bank accounts with two views. The **account list view** shows checking/savings and credit cards in separate sections, each with name, type badge, institution, opening balance, and edit/delete buttons. The **drill-down view** shows when you click into an account — it displays account details, summary cards (Transactions, Total Credits, Total Debits), and a full transaction table filtered to that account with inline editing, add transaction form, and status badges (Approved/Pending). Supports add/edit/delete accounts with type selection (checking, savings, credit_card).

### ImportWizard.jsx
A 4-step wizard for importing bank statements. Step 1: file upload (drag-and-drop or click) supporting CSV and XLSX. Step 2: account selection — dynamically lists accounts from the Banking module, selecting the right parser (BOA checking or credit card). Step 3: preview of first 10 parsed rows. Step 4: import summary showing total parsed, already categorized, duplicates found, and ready-to-import count. On confirm, transactions are added to the store with categorization engine applied, and an ImportBatch metadata record is created.

### ReviewApproval.jsx
The categorization workbench. Shows all unapproved, non-transfer transactions. Features include: search by description/category, sortable columns (date, description, amount, category), bulk select with checkboxes, "Approve Selected" / "Approve High Confidence" / "Approve All" bulk actions, inline category dropdown grouped by Revenue/Expenses using `<optgroup>`, auto-type detection when category changes, "Create Rule" from any transaction, "Re-apply All Rules" to recategorize, confidence badges, and stat badges showing pending/categorized/uncategorized counts.

### TransactionList.jsx (~574 lines)
The full transaction ledger. Summary cards show Total Transactions, Total Revenue, Total Expenses, and Net in a 4-column grid. Features: search by description, filter by type/category/account/status, sortable columns with indicators, inline editing (date, description, amount, type, category), delete with confirmation, and pagination (25 items per page).

### RuleManager.jsx
Two-tab interface. **Explicit Rules tab**: table of all categorization rules with match text, match type (contains/exact/startsWith), type, category, and active toggle. Add/edit/delete rules, plus "Re-apply Rules" button. **Learned Patterns tab**: auto-populated as users approve transactions. Shows vendor key, type, category, times used, confidence level, last used date. Can promote a pattern to an explicit rule or delete it.

### JournalEntries.jsx
Double-entry journal form with templates for common adjustments: depreciation, owner's draw, and mortgage principal. Each entry has a date, memo, and debit/credit lines. Validates that debits equal credits before saving. Shows existing entries in a table with expand/collapse for line details.

### ProfitLoss.jsx
Date range-based P&L report. Preset buttons for This Month, Last Month, This Quarter, YTD, Last Year, and All Time. Revenue section grouped by category with Schedule E line references. Expense section similarly grouped. Totals for revenue, expenses, and net income. Export to CSV and print functionality.

### BalanceSheet.jsx
As-of-date balance sheet. Sections for Current Assets, Fixed Assets, Current Liabilities, Long-Term Liabilities, and Equity. Balance validation check (Assets = Liabilities + Equity). Print functionality. Opening balances configurable.

### Settings.jsx
Placeholder component — not yet built out. Intended for property details, depreciation settings, and app configuration.

---

## Data Models

### Complete Store Object (root of all app data)

```javascript
{
  version: 1,
  entity: "Palm Springs Condo",
  transactions: [],           // Array of Transaction objects
  rules: [],                  // Array of Rule objects (explicit)
  learned_patterns: [],       // Array of LearnedPattern objects
  journal_entries: [],        // Array of JournalEntry objects
  import_batches: [],         // Array of ImportBatch metadata
  accounts: [],               // Array of Account objects
  balance_sheet_openings: {   // Opening balances for Balance Sheet
    "Cash - Checking (BOA)": 5000,
    "Cash - Credit Card Balance": 0,
    "Property": 500000,
    "Accumulated Depreciation": -50000,
    "Mortgage Payable": -400000,
    // ... other BS accounts
  },
  settings: {
    property_cost_basis: 500000,
    land_value: 100000,
    depreciation_start_year: 2025
  }
}
```

### Transaction

```javascript
{
  id: "tx-1704067200000-1",
  date: "2025-01-01",                    // ISO date
  description: "LOWES #2156",            // Cleaned description
  original_description: "DEBIT CARD...", // Raw from bank file
  amount: -156.42,                       // Negative = expense, Positive = revenue
  type: "expense",                       // "expense" | "revenue" | "transfer"
  category: "Repairs & Maintenance",
  account_id: "acct-xxxxx",             // Links to Account
  source_account: "checking",            // "checking" | "credit_card" | "manual"
  source_file: "boa-checking-2025.csv",
  import_batch_id: "batch-xxxxx",
  import_date: "2025-01-15",
  reference_number: null,                // Credit card transactions only
  address: null,                         // Credit card transactions only
  running_balance: 5432.10,
  is_transfer: false,
  approved: false,
  categorization_source: "rule",         // "rule" | "learned" | "smart" | "manual" | ""
  confidence: "high",                    // "high" | "medium" | "low" | "none"
  vendor_key: "lowes"                    // Normalized for pattern matching
}
```

### Account

```javascript
{
  id: "acct-1704067200000-1",
  name: "BOA Checking",
  type: "checking",                      // "checking" | "savings" | "credit_card"
  institution: "BOA",
  opening_balance: 5000.00,
  opening_date: "2025-01-01",
  active: true,
  created: "2025-01-01"
}
```

### Rule (Explicit Categorization)

```javascript
{
  id: "rule-default-16",
  match: "home depot",
  type: "expense",
  category: "Repairs & Maintenance",
  match_type: "contains",               // "contains" | "exact" | "startsWith"
  active: true,
  created: "2025-01-01"
}
```

### Learned Pattern (Auto-generated)

```javascript
{
  vendor_key: "amazon",
  type: "expense",
  category: "Supplies",
  times_used: 5,
  last_used: "2025-01-15",
  confidence: "high",                   // "high" (3+ uses) | "medium" (1-2)
  sample_descriptions: ["AMAZON PURCHASE..."]
}
```

### Journal Entry

```javascript
{
  id: "je-1704067200000-1",
  date: "2025-01-15",
  memo: "Monthly depreciation expense",
  lines: [
    { account: "Depreciation", debit: 1181.82, credit: 0 },
    { account: "Accumulated Depreciation", debit: 0, credit: 1181.82 }
  ]
}
```

---

## Categorization Engine

The categorization system uses three layers, checked in order of priority:

**Layer 1 — Explicit Rules (highest priority):** User-defined and 35 pre-loaded rules. Matches transaction descriptions using `contains`, `exact`, or `startsWith` match types. Checks both `original_description` and cleaned `description`. Returns `confidence: "high"`.

**Layer 2 — Learned Patterns (medium priority):** Auto-built as users categorize and approve transactions. Matches on normalized `vendor_key` extracted from descriptions. Confidence is "high" if the pattern has been used 3+ times, "medium" for 1-2 uses.

**Layer 3 — Smart Suggestions (fallback):** Keyword heuristics checking for common terms like "hoa", "mortgage", "insurance", "electric", "water", "internet", etc. Returns `confidence: "low"`.

If no layer matches, the transaction is left uncategorized with `confidence: "none"`.

The learning system updates automatically when users approve transactions — `updateLearnedPatterns()` increments usage counts or creates new patterns.

---

## Bank File Parsers

### BOA Checking (boaChecking.js)
Parses Bank of America checking account CSV/Excel files. Expected columns: Date, Description, Amount, Running Bal. Auto-detects column positions. Positive amounts = deposits (revenue), negative = withdrawals (expenses). Auto-detects transfers (online transfers, bill payments). Cleans descriptions by stripping BOA prefixes and standardizing format.

### BOA Credit Card (boaCreditCard.js)
Parses BOA credit card CSV/Excel files. Expected columns: Posted Date, Reference Number, Payee, Address, Amount. Positive amounts = charges (expenses), negative = payments (transfers excluded from P&L). Reference numbers used for definitive deduplication.

### Deduplication (deduplicate.js)
Two-pass duplicate detection: first checks reference numbers (credit card — definitive match), then checks date + description + amount combination (fuzzy match). Returns `{ clean, duplicates }` arrays.

### Normalization (normalize.js)
`cleanDescription(raw)` strips BOA-specific prefixes and standardizes formatting. `extractVendorKey(raw)` produces a normalized vendor name for pattern matching. `classifyTransaction(desc, amount, source)` determines transaction type and transfer status.

---

## Reporting Engine

### Profit & Loss (generateProfitLoss)
Filters approved, non-transfer transactions by date range. Sums amounts by category, separating revenue and expenses. Applies journal entry lines to P&L accounts. Calculates net income as `totalRevenue + totalExpenses` (expenses are stored as negative values). Includes Schedule E line number mapping for tax reporting.

### Balance Sheet (generateBalanceSheet)
Initializes all Balance Sheet accounts with opening balances. Applies journal entry debits/credits with proper asset/liability accounting logic. Calculates retained earnings from all P&L activity through the as-of date. Organizes into Current Assets, Fixed Assets, Current Liabilities, Long-Term Liabilities, and Equity sections. Includes balance validation (Assets = Liabilities + Equity).

### Schedule E Mapping
Revenue and expense categories are mapped to IRS Schedule E line numbers in `categories.js`. The `generateScheduleEData()` function translates a P&L report into Schedule E line totals for tax filing.

---

## Data Persistence

### IndexedDB Storage (db.js)
Database name: `condo-bookkeeper`, version 1. Single object store `app-data` with one key `store`. The entire app state is stored as a single JSON blob. On load, data is merged with schema defaults (handles version upgrades gracefully). Falls back to defaults if IndexedDB is unavailable.

### Backup & Restore (backup.js)
`exportToJSON(store)` downloads the full store as `condo-bookkeeper-backup-YYYY-MM-DD.json`. `importFromJSON(file)` parses and validates a backup file. `exportPLToCSV(report)` exports a P&L report as CSV for spreadsheet use.

### Important Notes
- Data is stored **only in the browser** — clearing browser data deletes everything
- Use the JSON backup/restore feature regularly
- There is no cloud sync or multi-device support
- Each browser/device has its own independent data store

---

## Chart of Accounts (IRS Schedule E)

### Revenue Categories (3)
| Category | Schedule E Line |
|----------|----------------|
| Rental Income | Line 3 |
| Late Fees | — |
| Other Revenue | — |

### Expense Categories (19)
| Category | Schedule E Line |
|----------|----------------|
| Advertising | Line 5 |
| Auto & Travel | Line 6 |
| Cleaning & Maintenance | Line 7 |
| Insurance | Line 9 |
| Legal & Professional | Line 10 |
| Management Fees | Line 11 |
| Mortgage Interest | Line 12 |
| Repairs & Maintenance | Line 14 |
| Supplies | Line 15 |
| Property Tax | Line 16 |
| Utilities | Line 17 |
| HOA Fees | Line 19 |
| Depreciation | Line 20 |
| Internet & Cable | Line 17 |
| Pest Control | Line 14 |
| Bank & Merchant Fees | Line 19 |
| Earthquake Insurance | Line 9 |
| Other Expense | Line 19 |

### Balance Sheet Accounts
**Assets:** Cash - Checking (BOA), Cash - Savings, Cash - Credit Card Balance, Property, Accumulated Depreciation

**Liabilities:** Mortgage Payable, Credit Card Payable, Security Deposit Liability, Other Liabilities

**Equity:** Owner's Equity, Owner's Draw, Retained Earnings

---

## Deployment & CI/CD

### GitHub Actions Workflow (deploy.yml)
Triggers on every push to `main` and manual dispatch. Uses Node 20 with npm caching. Runs `npm ci` then `npm run build` to create the `dist/` folder. Uploads and deploys to GitHub Pages automatically. Typical deploy time is 30-60 seconds after push.

### Vite Configuration
Base path set to `/condo-bookkeeper/` for GitHub Pages subdirectory hosting. Output directory is `dist/`. React plugin enabled.

### Local Development
```bash
git clone https://github.com/Brandondaymdr/condo-bookkeeper.git
cd condo-bookkeeper
npm install
npm run dev      # Starts dev server at localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

---

## Commit History

### Feb 7, 2026 (20 commits)

| Hash | Message |
|------|---------|
| `b391503` | Fix TransactionList summary card sizing and layout consistency |
| `7a51e88` | Fix Banking summary card sizing and layout consistency |
| `0eb32e7` | Fix Dashboard summary card sizing and layout consistency |
| `0f5509b` | Add account filter and fix save/delete in TransactionList |
| `663a891` | Add transaction drill-down to Banking tab |
| `be501d0` | feat: update ImportWizard with dynamic account selection |
| `1a37d63` | Add transaction-to-account migration in App.jsx |
| `a254cae` | Add account_id to transactions, migration, and connect accounts to banking |
| `20f8270` | Fix corrupted emoji icons in sidebar tabs |
| `0a2ff07` | Wire Banking tab into App.jsx with migration logic |
| `32394da` | Add Banking component for account management |
| `d5cd3af` | Add Banking: account data model, createAccount factory, migration |
| `403a85f` | Fix Balance Sheet crash: align component with report engine data structure |
| `46a2377` | Fix Rules page: display match text and match type columns |
| `c4b5542` | Fix Dashboard net income sign error for negative expenses |
| `09a2b6a` | Fix P&L net income and balance sheet sign error |
| `fc82b16` | Use amount sign for coloring: reconcile display with bank ledger |
| `f75d823` | Fix transaction amount colors: red for expenses, green for revenue |
| `ea4f72c` | Add bug tracker documentation (docs/BUGS.md) |
| `2974832` | Add project documentation (docs/PROJECT.md) |

### Feb 6, 2026 (8 commits)

| Hash | Message |
|------|---------|
| `3d5fa71` | Update ProfitLoss.jsx |
| `e363628` | Fix P&L report crash: align property names with reports engine |
| `7d30d5c` | Enhanced Review & Approval page with sorting, search, bulk actions |
| `50c4ea0` | Fix CSV/XLSX import parsing bug (ge.slice is not a function) |
| `72b8942` | Add GitHub Actions workflow for Pages deployment |
| `0a13f60` | Add GitHub Pages base path to Vite config |
| `d85de0e` | Phase 2: categorization engine, React UI, reports, storage |
| `87cc640` | Initial build: data model, BOA parsers, categorization rules |

**Total: 28 commits**

---

## Known Issues & Areas for Improvement

### Current Known Issues
- **Settings page:** Placeholder only — needs implementation for property details, depreciation config, and balance sheet opening balances
- **No cloud backup:** Data exists only in browser IndexedDB — if browser data is cleared, everything is lost
- **Single bank support:** Only BOA checking and credit card parsers exist — other banks would need new parsers
- **No reconciliation workflow:** No formal bank reconciliation feature to match statement balances

### Suggested Next Steps
1. **Settings page build-out** — Property cost basis, land value, depreciation start year, balance sheet opening balances editor
2. **Data backup improvements** — Auto-backup reminders, cloud storage integration (Google Drive / Dropbox)
3. **Additional bank parsers** — Chase, Wells Fargo, generic CSV templates
4. **Reconciliation** — Match imported statement ending balance against calculated balance
5. **Mobile responsiveness** — Current layout is desktop-optimized with fixed sidebar
6. **Print styling** — Dedicated print CSS for reports
7. **Multi-property support** — Extend data model for multiple entities
8. **Transaction attachments** — Link receipt images/PDFs to transactions
9. **Recurring transactions** — Auto-generate monthly entries (mortgage, HOA, etc.)
10. **Dashboard charts** — Visual graphs for revenue/expense trends over time

---

## Continuation Prompt

Use the following prompt to resume development with an AI assistant. It provides all the context needed to pick up where we left off:

---

```
I'm continuing development on my Condo Bookkeeper app — a React-based bookkeeping
application for my Palm Springs rental property.

LINKS:
- Live app: https://brandondaymdr.github.io/condo-bookkeeper/
- GitHub repo: https://github.com/Brandondaymdr/condo-bookkeeper
- Full project guide: See CONDO-BOOKKEEPER-PROJECT-GUIDE.md in the repo root

TECH STACK: React 18 + Vite 6, no backend, IndexedDB for storage, GitHub Pages
hosting via GitHub Actions auto-deploy on push to main.

PROJECT STRUCTURE:
- src/App.jsx — Main shell with Dashboard and sidebar navigation (10 tabs)
- src/components/ — Banking, ImportWizard, ReviewApproval, TransactionList,
  RuleManager, JournalEntries, ProfitLoss, BalanceSheet, Settings
- src/engines/ — categorize.js (3-layer categorization), reports.js (P&L + BS)
- src/models/ — categories.js (Chart of Accounts/Schedule E), defaultRules.js,
  schema.js (data structures)
- src/parsers/ — boaChecking.js, boaCreditCard.js, deduplicate.js, normalize.js
- src/storage/ — db.js (IndexedDB), backup.js (JSON export/import)
- src/utils/ — csvParser.js, format.js (formatMoney, formatDate)

DATA: Single JSON blob in IndexedDB containing transactions, rules,
learned_patterns, journal_entries, import_batches, accounts, balance_sheet_openings,
and settings. Components receive {store, saveData} props — saveData merges updates
and persists to IndexedDB.

KEY ARCHITECTURE DECISIONS:
- Amounts are stored with their natural sign (negative = expense, positive = revenue)
- Transaction type values are lowercase: "expense", "revenue", "transfer"
- Categorization uses 3 layers: explicit rules → learned patterns → smart suggestions
- Expenses stored as negative in P&L, so net income = totalRevenue + totalExpenses
- Grid layouts use repeat(N, 1fr) with minWidth:0 and whiteSpace:'nowrap' for cards
- All styling is inline CSS (no CSS framework)

CURRENT STATE (as of Feb 7, 2026):
- 28 commits, all features functional
- Import, Review, Transactions, Banking, Rules, Journal Entries, P&L, Balance Sheet
  all working
- Recent work: added Banking tab with account management and transaction drill-down,
  connected accounts to transactions via account_id with migration logic, fixed
  summary card sizing across all pages for consistent layout
- Settings page is still a placeholder

WHAT I WANT TO WORK ON NEXT:
[Describe what you want to build or fix here]
```

---

*This document is stored in the GitHub repo as `CONDO-BOOKKEEPER-PROJECT-GUIDE.md` and is the single source of truth for resuming development on this project.*
