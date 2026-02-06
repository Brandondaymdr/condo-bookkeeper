/**
 * Deduplication engine for imported transactions.
 *
 * From SKILL-boa-import.md:
 * - Check for existing transactions with same date + description + amount
 * - For credit cards: also use Reference Number as unique identifier
 * - Flag potential duplicates for user review
 */

/**
 * Check a batch of new transactions against existing ones for duplicates.
 *
 * @param {Transaction[]} newTransactions - Transactions being imported
 * @param {Transaction[]} existingTransactions - Already in the ledger
 * @returns {{ clean: Transaction[], duplicates: DuplicateMatch[] }}
 *
 * DuplicateMatch: { newTx, existingTx, reason }
 */
export function findDuplicates(newTransactions, existingTransactions) {
  const clean = [];
  const duplicates = [];

  // Build lookup indices for fast matching
  const dateDescAmountIndex = new Map(); // "date|desc|amount" -> existingTx
  const referenceIndex = new Map();       // referenceNumber -> existingTx

  for (const tx of existingTransactions) {
    // Date + description + amount key
    const key = makeDedupKey(tx.date, tx.original_description || tx.description, tx.amount);
    if (!dateDescAmountIndex.has(key)) {
      dateDescAmountIndex.set(key, []);
    }
    dateDescAmountIndex.get(key).push(tx);

    // Reference number index (credit card only)
    if (tx.reference_number) {
      referenceIndex.set(tx.reference_number, tx);
    }
  }

  for (const newTx of newTransactions) {
    let isDuplicate = false;
    let reason = "";
    let matchedTx = null;

    // Check 1: Reference number (credit card — definitive match)
    if (newTx.reference_number && referenceIndex.has(newTx.reference_number)) {
      isDuplicate = true;
      reason = "Matching reference number";
      matchedTx = referenceIndex.get(newTx.reference_number);
    }

    // Check 2: Date + description + amount
    if (!isDuplicate) {
      const key = makeDedupKey(
        newTx.date,
        newTx.original_description || newTx.description,
        newTx.amount
      );
      const matches = dateDescAmountIndex.get(key);
      if (matches && matches.length > 0) {
        isDuplicate = true;
        reason = "Matching date, description, and amount";
        matchedTx = matches[0];
      }
    }

    if (isDuplicate) {
      duplicates.push({
        newTx,
        existingTx: matchedTx,
        reason,
      });
    } else {
      clean.push(newTx);
    }
  }

  return { clean, duplicates };
}

/**
 * Create a deduplication key from date + description + amount.
 * Normalized to handle minor formatting differences.
 */
function makeDedupKey(date, description, amount) {
  const normDate = String(date || "").trim();
  const normDesc = String(description || "").trim().toLowerCase();
  const normAmount = Math.abs(parseFloat(amount) || 0).toFixed(2);
  return `${normDate}|${normDesc}|${normAmount}`;
}
