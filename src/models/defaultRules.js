/**
 * Pre-loaded categorization rules for Palm Springs condo.
 * These are the 24 rules from SKILL-auto-categorize.md,
 * based on common Palm Springs rental property vendors.
 *
 * Users can modify, add, or delete these at any time.
 * Additional rules are learned automatically as transactions are categorized.
 */

export const DEFAULT_RULES = [
  // Utilities — local providers
  { id: "rule-default-1",  match: "spectrum",                  type: "expense", category: "Internet & Cable",      match_type: "contains", active: true },
  { id: "rule-default-2",  match: "edison",                    type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-3",  match: "socal edison",              type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-4",  match: "southern california edison", type: "expense", category: "Utilities",            match_type: "contains", active: true },
  { id: "rule-default-5",  match: "so cal edison",             type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-6",  match: "socal gas",                 type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-7",  match: "desert water",              type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-8",  match: "coachella valley water",    type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-9",  match: "waste management",          type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-10", match: "burrtec",                   type: "expense", category: "Utilities",             match_type: "contains", active: true },
  { id: "rule-default-11", match: "arrowhead",                 type: "expense", category: "Utilities",             match_type: "contains", active: true },

  // HOA
  { id: "rule-default-12", match: "hoa",                       type: "expense", category: "HOA Fees",              match_type: "contains", active: true },
  { id: "rule-default-13", match: "desert falls",              type: "expense", category: "HOA Fees",              match_type: "contains", active: true },
  { id: "rule-default-14", match: "gaffney",                   type: "expense", category: "HOA Fees",              match_type: "contains", active: true },
  { id: "rule-default-15", match: "paylease",                  type: "expense", category: "HOA Fees",              match_type: "contains", active: true },

  // Home improvement / repairs
  { id: "rule-default-16", match: "home depot",                type: "expense", category: "Repairs & Maintenance", match_type: "contains", active: true },
  { id: "rule-default-17", match: "lowes",                     type: "expense", category: "Repairs & Maintenance", match_type: "contains", active: true },
  { id: "rule-default-18", match: "ace hardware",              type: "expense", category: "Repairs & Maintenance", match_type: "contains", active: true },

  // Pest control
  { id: "rule-default-19", match: "terminix",                  type: "expense", category: "Pest Control",          match_type: "contains", active: true },
  { id: "rule-default-20", match: "orkin",                     type: "expense", category: "Pest Control",          match_type: "contains", active: true },

  // Mortgage
  { id: "rule-default-21", match: "mr.cooper",                 type: "expense", category: "Mortgage Interest",     match_type: "contains", active: true },
  { id: "rule-default-22", match: "dbamr.cooper",              type: "expense", category: "Mortgage Interest",     match_type: "contains", active: true },
  { id: "rule-default-23", match: "nsm dbamr",                 type: "expense", category: "Mortgage Interest",     match_type: "contains", active: true },

  // Property tax
  { id: "rule-default-24", match: "property tax",              type: "expense", category: "Property Tax",          match_type: "contains", active: true },
  { id: "rule-default-25", match: "county of riverside",       type: "expense", category: "Property Tax",          match_type: "contains", active: true },

  // Insurance
  { id: "rule-default-26", match: "insurance",                 type: "expense", category: "Insurance",             match_type: "contains", active: true },

  // Bank fees
  { id: "rule-default-27", match: "bank of america fee",       type: "expense", category: "Bank & Merchant Fees",  match_type: "contains", active: true },
  { id: "rule-default-28", match: "monthly maintenance fee",   type: "expense", category: "Bank & Merchant Fees",  match_type: "contains", active: true },

  // Supplies
  { id: "rule-default-29", match: "amazon",                    type: "expense", category: "Supplies",              match_type: "contains", active: true },

  // Revenue — rent payments via Zelle or transfers from tenant
  { id: "rule-default-30", match: "zelle",                     type: "revenue", category: "Rental Income",         match_type: "contains", active: true },
  { id: "rule-default-31", match: "chavez",                    type: "revenue", category: "Rental Income",         match_type: "contains", active: true },

  // Interest income
  { id: "rule-default-32", match: "interest earned",           type: "revenue", category: "Other Revenue",         match_type: "contains", active: true },

  // Tax payments (IRS, state)
  { id: "rule-default-33", match: "irs",                       type: "expense", category: "Other Expense",         match_type: "contains", active: true },
  { id: "rule-default-34", match: "franchise tax",             type: "expense", category: "Other Expense",         match_type: "contains", active: true },

  // Citi credit card payments (transfer, not expense)
  { id: "rule-default-35", match: "citi card online",          type: "transfer", category: "",                     match_type: "contains", active: true },
];
