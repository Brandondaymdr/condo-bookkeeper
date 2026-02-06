/**
 * 3-Layer Categorization Engine
 *
 * Layer 1: Explicit Rules (highest priority) — user-defined substring matches
 * Layer 2: Learned Patterns (medium priority) — auto-learned from past categorizations
 * Layer 3: Smart Suggestions (lowest priority) — keyword heuristics
 *
 * Each layer returns { category, type, source, confidence } or null.
 */

import { createLearnedPattern } from "../models/schema.js";

// ─── Layer 1: Explicit Rules ─────────────────────────────────────────

/**
 * Match a transaction description against explicit rules.
 * First matching rule wins (rules evaluated in order).
 *
 * @param {string} description - Cleaned transaction description
 * @param {Rule[]} rules - Array of active rules
 * @returns {{ category, type, source, confidence, ruleId }|null}
 */
export function applyExplicitRules(description, rules) {
  if (!description || !rules) return null;
  const desc = description.toLowerCase();

  for (const rule of rules) {
    if (!rule.active) continue;

    const match = rule.match.toLowerCase();
    let matched = false;

    switch (rule.match_type) {
      case "startsWith":
        matched = desc.startsWith(match);
        break;
      case "exact":
        matched = desc === match;
        break;
      case "contains":
      default:
        matched = desc.includes(match);
        break;
    }

    if (matched) {
      return {
        category: rule.category,
        type: rule.type,
        source: "rule",
        confidence: "high",
        ruleId: rule.id,
      };
    }
  }

  return null;
}

// ─── Layer 2: Learned Patterns ───────────────────────────────────────

/**
 * Match a vendor key against learned patterns from past categorizations.
 *
 * @param {string} vendorKey - Normalized vendor key
 * @param {LearnedPattern[]} patterns - Array of learned patterns
 * @returns {{ category, type, source, confidence }|null}
 */
export function applyLearnedPatterns(vendorKey, patterns) {
  if (!vendorKey || !patterns || patterns.length === 0) return null;
  const key = vendorKey.toLowerCase().trim();

  // Exact vendor_key match
  const exactMatch = patterns.find(p => p.vendor_key === key);
  if (exactMatch) {
    return {
      category: exactMatch.category,
      type: exactMatch.type,
      source: "learned",
      confidence: exactMatch.confidence || (exactMatch.times_used >= 3 ? "high" : "medium"),
    };
  }

  // Partial match — vendor_key is contained in the pattern or vice versa
  const partialMatch = patterns.find(
    p => key.includes(p.vendor_key) || p.vendor_key.includes(key)
  );
  if (partialMatch && partialMatch.vendor_key.length >= 3) {
    return {
      category: partialMatch.category,
      type: partialMatch.type,
      source: "learned",
      confidence: "low",
    };
  }

  return null;
}

// ─── Layer 3: Smart Suggestions ──────────────────────────────────────

/**
 * Keyword-based heuristic suggestions for uncategorized transactions.
 * These are fallback suggestions when no rules or patterns match.
 */
const SMART_SUGGESTIONS = [
  // HOA
  { keywords: ["hoa", "homeowner", "association"], category: "HOA Fees", type: "expense" },
  // Mortgage
  { keywords: ["mortgage", "loan pmt", "mr.cooper", "cooper"], category: "Mortgage Interest", type: "expense" },
  // Insurance
  { keywords: ["insurance", "geico", "state farm", "allstate", "farmers"], category: "Insurance", type: "expense" },
  // Property Tax
  { keywords: ["property tax", "county tax", "treasurer", "riverside"], category: "Property Tax", type: "expense" },
  // Utilities - Electric
  { keywords: ["electric", "edison", "power", "energy", "sce"], category: "Utilities", type: "expense" },
  // Utilities - Gas
  { keywords: ["socal gas", "natural gas", "gas company"], category: "Utilities", type: "expense" },
  // Utilities - Water
  { keywords: ["water", "sewer", "desert water", "coachella valley water"], category: "Utilities", type: "expense" },
  // Utilities - Trash
  { keywords: ["trash", "waste management", "republic", "burrtec"], category: "Utilities", type: "expense" },
  // Internet & Cable
  { keywords: ["spectrum", "cox", "att", "internet", "cable", "comcast"], category: "Internet & Cable", type: "expense" },
  // Repairs & Maintenance
  { keywords: ["home depot", "lowes", "ace hardware", "harbor freight"], category: "Repairs & Maintenance", type: "expense" },
  { keywords: ["plumber", "plumbing", "hvac", "electrician", "handyman"], category: "Repairs & Maintenance", type: "expense" },
  // Pest Control
  { keywords: ["pest", "terminix", "orkin", "exterminator"], category: "Pest Control", type: "expense" },
  // Cleaning
  { keywords: ["cleaning", "maid", "janitorial", "housekeep"], category: "Cleaning & Maintenance", type: "expense" },
  // Supplies
  { keywords: ["amazon", "target", "walmart", "costco"], category: "Supplies", type: "expense" },
  // Legal & Professional
  { keywords: ["legal", "attorney", "cpa", "accountant", "tax prep"], category: "Legal & Professional", type: "expense" },
  // Advertising
  { keywords: ["advertising", "zillow", "apartments.com", "craigslist"], category: "Advertising", type: "expense" },
  // Bank Fees
  { keywords: ["bank fee", "service charge", "maintenance fee", "overdraft"], category: "Bank & Merchant Fees", type: "expense" },
  // Revenue - Rental
  { keywords: ["rent payment", "tenant"], category: "Rental Income", type: "revenue" },
  // Revenue - Interest
  { keywords: ["interest earned", "interest payment", "dividend"], category: "Other Revenue", type: "revenue" },
];

/**
 * Apply smart keyword suggestions.
 *
 * @param {string} description - Cleaned transaction description
 * @returns {{ category, type, source, confidence }|null}
 */
export function applySmartSuggestions(description) {
  if (!description) return null;
  const desc = description.toLowerCase();

  for (const suggestion of SMART_SUGGESTIONS) {
    for (const keyword of suggestion.keywords) {
      if (desc.includes(keyword)) {
        return {
          category: suggestion.category,
          type: suggestion.type,
          source: "smart",
          confidence: "low",
        };
      }
    }
  }

  return null;
}

// ─── Full Pipeline ───────────────────────────────────────────────────

/**
 * Run the full 3-layer categorization pipeline on a single transaction.
 *
 * @param {Transaction} tx - The transaction to categorize
 * @param {Rule[]} rules - Explicit rules (Layer 1)
 * @param {LearnedPattern[]} patterns - Learned patterns (Layer 2)
 * @returns {Transaction} The transaction with category, type, categorization_source, confidence set
 */
export function categorizeTransaction(tx, rules, patterns) {
  // Skip if already manually categorized and approved
  if (tx.approved && tx.categorization_source === "manual") {
    return tx;
  }

  // Skip transfers — they don't need P&L categorization
  if (tx.is_transfer || tx.type === "transfer") {
    return { ...tx, categorization_source: "", confidence: "none" };
  }

  const description = tx.original_description || tx.description || "";
  const vendorKey = tx.vendor_key || "";

  // Layer 1: Explicit Rules
  const ruleMatch = applyExplicitRules(description, rules);
  if (ruleMatch) {
    return {
      ...tx,
      category: ruleMatch.category,
      type: ruleMatch.type,
      categorization_source: ruleMatch.source,
      confidence: ruleMatch.confidence,
    };
  }

  // Also try matching against cleaned description
  const cleanMatch = applyExplicitRules(tx.description, rules);
  if (cleanMatch) {
    return {
      ...tx,
      category: cleanMatch.category,
      type: cleanMatch.type,
      categorization_source: cleanMatch.source,
      confidence: cleanMatch.confidence,
    };
  }

  // Layer 2: Learned Patterns
  const learnedMatch = applyLearnedPatterns(vendorKey, patterns);
  if (learnedMatch) {
    return {
      ...tx,
      category: learnedMatch.category,
      type: learnedMatch.type,
      categorization_source: learnedMatch.source,
      confidence: learnedMatch.confidence,
    };
  }

  // Layer 3: Smart Suggestions
  const smartMatch = applySmartSuggestions(description) || applySmartSuggestions(tx.description);
  if (smartMatch) {
    return {
      ...tx,
      category: smartMatch.category,
      type: smartMatch.type,
      categorization_source: smartMatch.source,
      confidence: smartMatch.confidence,
    };
  }

  // No match — needs manual categorization
  return {
    ...tx,
    category: "",
    type: tx.type || "expense",
    categorization_source: "",
    confidence: "none",
  };
}

/**
 * Categorize an array of transactions through the full pipeline.
 *
 * @param {Transaction[]} transactions
 * @param {Rule[]} rules
 * @param {LearnedPattern[]} patterns
 * @returns {Transaction[]}
 */
export function categorizeAll(transactions, rules, patterns) {
  return transactions.map(tx => categorizeTransaction(tx, rules, patterns));
}

// ─── Learning ────────────────────────────────────────────────────────

/**
 * Update learned patterns when a user approves or edits a transaction's category.
 * Call this after the user confirms a categorization.
 *
 * @param {Transaction} tx - The approved transaction
 * @param {LearnedPattern[]} patterns - Current learned patterns
 * @returns {LearnedPattern[]} Updated patterns array
 */
export function updateLearnedPatterns(tx, patterns) {
  if (!tx.vendor_key || tx.is_transfer || tx.type === "transfer") {
    return patterns;
  }
  if (!tx.category) return patterns;

  const key = tx.vendor_key.toLowerCase().trim();
  const existingIndex = patterns.findIndex(p => p.vendor_key === key);

  if (existingIndex >= 0) {
    const existing = patterns[existingIndex];

    if (existing.category === tx.category && existing.type === tx.type) {
      // Same category — reinforce the pattern
      const updated = {
        ...existing,
        times_used: existing.times_used + 1,
        last_used: new Date().toISOString().slice(0, 10),
        confidence: (existing.times_used + 1) >= 3 ? "high" : "medium",
        sample_descriptions: [
          ...new Set([...(existing.sample_descriptions || []), tx.original_description || tx.description]),
        ].slice(0, 5),
      };
      const newPatterns = [...patterns];
      newPatterns[existingIndex] = updated;
      return newPatterns;
    } else {
      // Different category — user is overriding. Update pattern with new category.
      const updated = {
        ...existing,
        category: tx.category,
        type: tx.type,
        times_used: 1,
        last_used: new Date().toISOString().slice(0, 10),
        confidence: "medium",
        sample_descriptions: [tx.original_description || tx.description],
      };
      const newPatterns = [...patterns];
      newPatterns[existingIndex] = updated;
      return newPatterns;
    }
  } else {
    // New pattern
    const newPattern = createLearnedPattern({
      vendor_key: key,
      type: tx.type,
      category: tx.category,
      times_used: 1,
      last_used: new Date().toISOString().slice(0, 10),
      confidence: "medium",
      sample_descriptions: [tx.original_description || tx.description],
    });
    return [...patterns, newPattern];
  }
}

/**
 * Batch-update learned patterns from multiple approved transactions.
 *
 * @param {Transaction[]} approvedTxs
 * @param {LearnedPattern[]} patterns
 * @returns {LearnedPattern[]}
 */
export function batchUpdateLearnedPatterns(approvedTxs, patterns) {
  let updated = [...patterns];
  for (const tx of approvedTxs) {
    updated = updateLearnedPatterns(tx, updated);
  }
  return updated;
}
