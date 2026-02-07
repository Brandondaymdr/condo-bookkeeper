# Condo Bookkeeper - Project Documentation

## Overview

Condo Bookkeeper is a browser-based bookkeeping application purpose-built for rental property management, replacing QuickBooks for a Palm Springs condo. It runs entirely client-side with no backend - data persists in the browser's IndexedDB, and the app is deployed as a static site on GitHub Pages.

**Live URL:** https://brandondaymdr.github.io/condo-bookkeeper/
**Repository:** https://github.com/Brandondaymdr/condo-bookkeeper

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 18.3.1 | Component-based interface |
| Build Tool | Vite 6.0.0 | Fast dev server and production builds |
| Spreadsheet Parsing | SheetJS (XLSX) 0.18.5 | Parse Excel/CSV bank statements |
| Data Persistence | IndexedDB | Browser-side database, survives page reloads |
| Hosting | GitHub Pages | Free static site hosting |
| CI/CD | GitHub Actions | Auto-deploy on push to main |
| Styling | Inline React styles | No CSS framework, all styles in JSX |
| State Management | React useState + prop drilling | Single store object passed to all components |

---

## Architecture

App.jsx serves as the main shell with sidebar navigation and content area. It holds the entire application state in a single store object via useState, and passes store + saveData function as props to all child components.

The store is loaded from IndexedDB on mount, and saved back on every change via saveData().

Key layers:
- Components (8 UI panels) - React components for each page
- Engines (business logic) - Categorization pipeline and report generation
- Parsers (bank file import) - BOA checking and credit card format parsers
- Storage (persistence) - IndexedDB load/save and JSON backup/restore
- Models (data schemas) - Transaction, Rule, Pattern factories and chart of accounts
- Utils (helpers) - Money/date formatting, CSV parsing

---

## File Structure

```
condo-bookkeeper/
  src/
    main.jsx                    - React DOM entry point
    App.jsx                     - Main app: sidebar routing + Dashboard
    components/
      ImportWizard.jsx          - 4-step CSV/Excel import wizard
      ReviewApproval.jsx        - Transaction review and bulk approval
      TransactionList.jsx       - Full transaction ledger with filters
      RuleManager.jsx           - Categorization rules + learned patterns
      JournalEntries.jsx        - Double-entry journal entries
      ProfitLoss.jsx            - P&L report with date ranges
      BalanceSheet.jsx          - Balance sheet report
      Settings.jsx              - Opening balances, depreciation, backup
    engines/
      categorize.js             - 3-layer categorization pipeline
      reports.js                - P&L, Balance Sheet, Schedule E generators
    storage/
      db.js                     - IndexedDB load/save/clear
      backup.js                 - JSON export/import, CSV export
    parsers/
      boaChecking.js            - BOA checking CSV/Excel
      boaCreditCard.js          - BOA credit card CSV/Excel
      deduplicate.js            - Duplicate transaction detection
      normalize.js              - Description cleaning and vendor extraction
    models/
      schema.js                 - Entity factories (Transaction, Rule, etc.)
      categories.js             - Chart of accounts with Schedule E mapping
      defaultRules.js           - 35 pre-loaded categorization rules
    utils/
      format.js                 - Money/date formatting
      csvParser.js              - CSV parsing, currency/date conversion
  .github/workflows/
    deploy.yml                  - GitHub Actions CI/CD pipeline
  vite.config.js                - Vite build configuration
  package.json                  - Dependencies and scripts
  index.html                    - HTML template
```

---

## Features Built

### 1. Bank Statement Import (ImportWizard.jsx)
- 4-step wizard: Upload, Select Account, Preview, Confirm
- Supports Bank of America checking and credit card formats
- Handles both CSV and Excel (.xlsx/.xls) files
- Drag-and-drop file upload
- Duplicate detection across imports
- Auto-categorizes transactions during import using the 3-layer engine

### 2. 3-Layer Categorization Engine (categorize.js)
- Layer 1 Explicit Rules: User-defined text matching rules (contains, startsWith, exact). 35 default rules pre-loaded.
- Layer 2 Learned Patterns: Auto-learned vendor-to-category mappings from approved transactions.
- Layer 3 Smart Suggestions: Keyword-based heuristics for 20+ common vendor patterns.
- Each layer returns a confidence level (high/medium/low) and source attribution

### 3. Transaction Review and Approval (ReviewApproval.jsx)
- Search and filter transactions by description
- Sort by date, amount, or description
- Inline category editing with dropdown
- Bulk Approve All and Approve High Confidence actions
- Create categorization rules directly from transactions
- Visual confidence indicators (rule/learned/smart/manual)

### 4. Transaction Ledger (TransactionList.jsx)
- Full transaction list with pagination (25 per page)
- Multi-filter: type, category, source, approval status
- Inline edit mode for individual transactions
- Delete transactions
- Summary stats: count, total revenue, total expenses, net

### 5. Rule Management (RuleManager.jsx)
- Two tabs: Explicit Rules and Learned Patterns
- CRUD operations for rules (add, edit, delete)
- Match types: contains, startsWith, exact
- Promote learned patterns to explicit rules
- Re-apply all rules to existing transactions

### 6. Journal Entries (JournalEntries.jsx)
- Double-entry bookkeeping with debit/credit lines
- Quick templates: Depreciation, Owners Draw, Mortgage Payment Split
- Balance validation (debits must equal credits)
- Full CRUD operations
- Affects both P&L and Balance Sheet reports

### 7. Profit and Loss Report (ProfitLoss.jsx)
- Configurable date range with date pickers
- Quick-select presets generated from getPresetDateRanges()
- Revenue and expense breakdown by category
- Schedule E line number references alongside each category
- Export to CSV with Schedule E columns

### 8. Balance Sheet (BalanceSheet.jsx)
- As-of-date report
- Assets, liabilities, and equity sections
- Balance verification: Assets = Liabilities + Equity
- Incorporates opening balances and journal entries

### 9. Settings (Settings.jsx)
- Opening balance entry for all balance sheet accounts
- Property cost basis and land value for depreciation
- Auto-calculated annual depreciation (27.5-year straight-line)
- Full JSON backup export/import
- Complete data reset

### 10. Dashboard (inline in App.jsx)
- Total transactions, pending review count
- Revenue, expenses, net income
- Rules and learned patterns count

---

## Data Model

### Transaction
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID (tx-timestamp-counter) |
| date | string | ISO date (YYYY-MM-DD) |
| description | string | Cleaned display description |
| original_description | string | Raw bank description |
| amount | number | Always positive |
| type | string | revenue / expense / transfer (lowercase) |
| category | string | From chart of accounts |
| source_account | string | checking / credit_card / manual |
| approved | boolean | User has reviewed |
| categorization_source | string | rule / learned / smart / manual |
| confidence | string | high / medium / low / none |
| is_transfer | boolean | Internal transfer (excluded from reports) |
| vendor_key | string | Normalized vendor name for pattern matching |

### Rule
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| match | string | Text to match against description |
| type | string | revenue / expense / transfer |
| category | string | Category to assign |
| match_type | string | contains / startsWith / exact |
| active | boolean | Whether rule is enabled |

### Learned Pattern (stored as object keyed by vendor_key)
| Field | Type | Description |
|-------|------|-------------|
| vendor_key | string | Normalized vendor name |
| type | string | revenue / expense |
| category | string | Learned category |
| times_used | number | How many times seen |
| confidence | string | Grows with usage (high at 3+ uses) |

### Store Structure (single IndexedDB blob)
```
{
  version: 1,
  entity: "Palm Springs Condo",
  transactions: [],
  rules: [],
  learned_patterns: {},        // Object keyed by vendor_key NOT an array
  journal_entries: [],
  import_batches: [],
  balance_sheet_openings: {},   // User-entered opening balances
  settings: {
    property_cost_basis: 500000,
    land_value: 100000,
    depreciation_start_year: 2020
  }
}
```

---

## Chart of Accounts (Schedule E Aligned)

### Revenue Categories
| Category | Schedule E Line |
|----------|----------------|
| Rental Income | Line 3 |
| Late Fees | - |
| Other Revenue | - |

### Expense Categories
| Category | Schedule E Line |
|----------|----------------|
| Advertising | Line 5 |
| Auto and Travel | Line 6 |
| Cleaning and Maintenance | Line 7 |
| Insurance | Line 9 |
| Legal and Professional | Line 10 |
| Management Fees | Line 11 |
| Mortgage Interest | Line 12 |
| Repairs and Maintenance | Line 14 |
| Supplies | Line 15 |
| Property Tax | Line 16 |
| Utilities | Line 17 |
| HOA Fees | Line 19 (Other) |
| Depreciation | Line 20 |
| Bank and Merchant Fees | Line 19 (Other) |
| Other Expense | Line 19 (Other) |

---

## Important Technical Notes

### Date Handling
- All dates stored as ISO strings (YYYY-MM-DD) NOT Date objects
- formatDateRange() in format.js appends T00:00:00 to string dates
- generateProfitLoss() compares string dates: tx.date >= startDate
- NEVER pass Date objects to report or format functions

### Store/State Flow
- App.jsx loads store from IndexedDB on mount
- Store passed as prop to all child components
- saveData(updatedStore) writes full store back to IndexedDB
- Components should NOT mutate store directly - create new object

### Categorization Pipeline
Transaction goes through: Explicit Rules then Learned Patterns then Smart Suggestions then Manual.
Each layer returns { type, category, confidence, source } or null to fall through.

### Deployment
- Vite creates hashed bundles (index-XXXXX.js)
- Browser may cache old bundles after deploy
- Hard refresh or cache-busting query param (?v=N) may be needed
- GitHub Actions auto-deploys on push to main in about 30 seconds

---

## Known Bugs

See docs/BUGS.md for the full bug tracker with status and fix details.

Critical bugs: 6 (type case mismatch, source property name, categorizeAll signature, learned patterns structure, P&L property names, Balance Sheet structure)
High priority: 4 (pattern naming, saveData args, export args, import type mismatch)

---

## Previous Commits
1. e363628 - Fix P&L report crash: align property names with reports engine
2. 3d5fa71 - Fix P&L date handling: pass strings not Date objects to report engine
