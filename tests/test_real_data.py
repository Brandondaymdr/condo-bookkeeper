"""
Test the BOA parser against Brandon's real 2025 Bank Ledger.

This script:
1. Reads the real Excel file
2. Applies the parsing and normalization logic (reimplemented in Python for testing)
3. Applies the default categorization rules
4. Prints a summary showing how well the parser + rules work
"""
import openpyxl
import re
import json
from datetime import datetime

# ─── BOA Prefixes to strip ───────────────────────────────────────────
BOA_PREFIXES = [
    "ONLINE BANKING PAYMENT TO",
    "ONLINE BANKING TRANSFER TO",
    "ONLINE BANKING TRANSFER FROM",
    "Online Banking payment to CRD",
    "Online Banking transfer from CHK",
    "Online Banking transfer to CHK",
    "Online Banking transfer from SAV",
    "DEBIT CARD PURCHASE",
    "ACH DEBIT",
    "ACH CREDIT",
    "WIRE TRANSFER FROM",
    "ZELLE PAYMENT FROM",
    "ZELLE PAYMENT TO",
    "Online transfer from CHK",
    "Online transfer to CHK",
]

# Transfer patterns
TRANSFER_PATTERNS = [
    r"online\s*(banking\s*)?transfer\s*(from|to)\s*chk",
    r"online\s*(banking\s*)?transfer\s*(from|to)\s*sav",
    r"online\s*(banking\s*)?payment\s*to\s*crd",
    r"payment\s*-?\s*thank\s*you",
    r"citi\s*card\s*online.*payment",
    r"pncbk\s*sv\s*webxfr",
]

# Revenue patterns
REVENUE_PATTERNS = [
    r"zelle\s*payment\s*from",
    r"wire\s*type:\s*wire\s*in",
    r"^interest\s*earned$",
]

# Default rules from SKILL-auto-categorize.md + real vendor additions
DEFAULT_RULES = [
    {"match": "spectrum",           "type": "expense", "category": "Internet & Cable"},
    {"match": "edison",             "type": "expense", "category": "Utilities"},
    {"match": "so cal edison",      "type": "expense", "category": "Utilities"},
    {"match": "socal gas",          "type": "expense", "category": "Utilities"},
    {"match": "desert water",       "type": "expense", "category": "Utilities"},
    {"match": "coachella valley",   "type": "expense", "category": "Utilities"},
    {"match": "waste management",   "type": "expense", "category": "Utilities"},
    {"match": "burrtec",            "type": "expense", "category": "Utilities"},
    {"match": "arrowhead",          "type": "expense", "category": "Utilities"},
    {"match": "hoa",                "type": "expense", "category": "HOA Fees"},
    {"match": "desert falls",       "type": "expense", "category": "HOA Fees"},
    {"match": "gaffney",            "type": "expense", "category": "HOA Fees"},
    {"match": "paylease",           "type": "expense", "category": "HOA Fees"},
    {"match": "home depot",         "type": "expense", "category": "Repairs & Maintenance"},
    {"match": "lowes",              "type": "expense", "category": "Repairs & Maintenance"},
    {"match": "ace hardware",       "type": "expense", "category": "Repairs & Maintenance"},
    {"match": "terminix",           "type": "expense", "category": "Pest Control"},
    {"match": "orkin",              "type": "expense", "category": "Pest Control"},
    {"match": "mr.cooper",          "type": "expense", "category": "Mortgage Interest"},
    {"match": "dbamr.cooper",       "type": "expense", "category": "Mortgage Interest"},
    {"match": "nsm dbamr",          "type": "expense", "category": "Mortgage Interest"},
    {"match": "property tax",       "type": "expense", "category": "Property Tax"},
    {"match": "county of riverside","type": "expense", "category": "Property Tax"},
    {"match": "insurance",          "type": "expense", "category": "Insurance"},
    {"match": "bank of america fee","type": "expense", "category": "Bank & Merchant Fees"},
    {"match": "monthly maint",      "type": "expense", "category": "Bank & Merchant Fees"},
    {"match": "amazon",             "type": "expense", "category": "Supplies"},
    {"match": "zelle",              "type": "revenue", "category": "Rental Income"},
    {"match": "chavez",             "type": "revenue", "category": "Rental Income"},
    # Tax payments
    {"match": "irs",                "type": "expense", "category": "Other Expense"},
    {"match": "franchise tax",      "type": "expense", "category": "Other Expense"},
]


def clean_description(raw):
    """Strip BOA prefixes for cleaner display."""
    desc = str(raw).strip()
    for prefix in BOA_PREFIXES:
        if desc.lower().startswith(prefix.lower()):
            desc = desc[len(prefix):].strip()
            break

    # Strip DES: and everything after for ACH-style descriptions
    ach_match = re.match(r'^(.+?)\s+DES:', raw, re.IGNORECASE)
    if ach_match and len(ach_match.group(1)) > 2:
        desc = ach_match.group(1).strip()
        # Also strip BOA prefix from the extracted part
        for prefix in BOA_PREFIXES:
            if desc.lower().startswith(prefix.lower()):
                desc = desc[len(prefix):].strip()
                break

    # Strip Confirmation# and everything after
    desc = re.sub(r'\s*Confirmation#.*$', '', desc, flags=re.IGNORECASE).strip()
    # Strip trailing semicolons
    desc = desc.rstrip('; ').strip()

    if not desc:
        desc = str(raw).strip()

    return desc


def classify_transaction(raw_desc, amount):
    """Determine if transaction is revenue, expense, or transfer."""
    desc = str(raw_desc).lower()

    # Check transfers first
    for pattern in TRANSFER_PATTERNS:
        if re.search(pattern, desc, re.IGNORECASE):
            return "transfer", True

    # Check revenue patterns
    for pattern in REVENUE_PATTERNS:
        if re.search(pattern, raw_desc or "", re.IGNORECASE):
            return "revenue", False

    # Default: positive = revenue, negative = expense
    if amount >= 0:
        return "revenue", False
    else:
        return "expense", False


def apply_rules(description, original_description, rules):
    """Apply categorization rules. Returns (category, type) or None."""
    # Check against both cleaned and original description
    for text in [description, original_description]:
        text_lower = str(text).lower()
        for rule in rules:
            if rule["match"].lower() in text_lower:
                return rule["category"], rule["type"]
    return None, None


def main():
    # Read the real 2025 Bank Ledger
    wb = openpyxl.load_workbook(
        '/sessions/dazzling-friendly-goldberg/mnt/uploads/2025_Bank Ledger.xlsx',
        data_only=True
    )
    ws = wb.active

    # Extract all rows
    all_rows = list(ws.iter_rows(values_only=True))

    # Find the header row (Date, Description, Amount, Running Bal.)
    header_idx = None
    for i, row in enumerate(all_rows):
        if row and row[0] and str(row[0]).strip().lower() == 'date':
            header_idx = i
            break

    if header_idx is None:
        print("ERROR: Could not find header row")
        return

    headers = [str(h).strip() if h else "" for h in all_rows[header_idx]]
    data_rows = all_rows[header_idx + 1:]

    print(f"Found headers at row {header_idx + 1}: {headers}")
    print(f"Data rows: {len(data_rows)}")
    print()

    # Parse each row
    transactions = []
    skipped = 0
    errors = []

    for i, row in enumerate(data_rows):
        raw_date = row[0]
        raw_desc = row[1]
        raw_amount = row[2]
        raw_balance = row[3] if len(row) > 3 else None

        # Skip empty rows or summary rows
        if not raw_date or not raw_desc:
            skipped += 1
            continue
        if str(raw_desc).lower().startswith(('beginning', 'total', 'ending')):
            skipped += 1
            continue

        # Parse date
        if isinstance(raw_date, datetime):
            date = raw_date.strftime('%Y-%m-%d')
        else:
            date = str(raw_date).strip()[:10]

        # Parse amount
        if raw_amount is None or raw_amount == '':
            skipped += 1
            continue
        amount = float(raw_amount) if isinstance(raw_amount, (int, float)) else 0

        # Parse balance
        balance = float(raw_balance) if isinstance(raw_balance, (int, float)) and raw_balance is not None else None

        # Classify
        tx_type, is_transfer = classify_transaction(raw_desc, amount)

        # Clean description
        cleaned = clean_description(raw_desc)

        # Apply rules
        category, rule_type = apply_rules(cleaned, raw_desc, DEFAULT_RULES)
        if category:
            tx_type = rule_type  # Rule overrides auto-classification

        tx = {
            "date": date,
            "description": cleaned,
            "original_description": str(raw_desc).strip(),
            "amount": abs(amount),
            "type": tx_type,
            "category": category or "",
            "is_transfer": is_transfer,
            "running_balance": balance,
        }
        transactions.append(tx)

    # ─── Summary Report ──────────────────────────────────────────────
    print("=" * 80)
    print("PARSER TEST RESULTS — 2025 Bank Ledger")
    print("=" * 80)
    print(f"Total data rows:    {len(data_rows)}")
    print(f"Skipped (empty/summary): {skipped}")
    print(f"Parsed transactions: {len(transactions)}")
    print(f"Parse errors:        {len(errors)}")
    print()

    # Type breakdown
    types = {}
    for tx in transactions:
        types[tx["type"]] = types.get(tx["type"], 0) + 1
    print("Transaction types:")
    for t, count in sorted(types.items()):
        print(f"  {t}: {count}")
    print()

    # Categorization coverage
    categorized = [tx for tx in transactions if tx["category"]]
    uncategorized = [tx for tx in transactions if not tx["category"]]
    non_transfer = [tx for tx in transactions if not tx["is_transfer"]]
    categorized_non_transfer = [tx for tx in non_transfer if tx["category"]]

    print(f"Categorization coverage (all):  {len(categorized)}/{len(transactions)} ({100*len(categorized)/max(len(transactions),1):.0f}%)")
    print(f"Categorization coverage (non-transfer): {len(categorized_non_transfer)}/{len(non_transfer)} ({100*len(categorized_non_transfer)/max(len(non_transfer),1):.0f}%)")
    print()

    # Category breakdown
    cats = {}
    for tx in transactions:
        if tx["category"]:
            key = f"{tx['category']} ({tx['type']})"
        else:
            key = f"[uncategorized] ({tx['type']})"
        if key not in cats:
            cats[key] = {"count": 0, "total": 0}
        cats[key]["count"] += 1
        cats[key]["total"] += tx["amount"]

    print("Category breakdown:")
    for cat in sorted(cats.keys()):
        info = cats[cat]
        print(f"  {cat}: {info['count']} txns, ${info['total']:,.2f}")
    print()

    # Revenue vs Expense totals
    revenue = sum(tx["amount"] for tx in transactions if tx["type"] == "revenue")
    expense = sum(tx["amount"] for tx in transactions if tx["type"] == "expense")
    transfers = sum(tx["amount"] for tx in transactions if tx["type"] == "transfer")

    print(f"Revenue total:   ${revenue:,.2f}")
    print(f"Expense total:   ${expense:,.2f}")
    print(f"Transfer total:  ${transfers:,.2f}")
    print(f"Net income:      ${revenue - expense:,.2f}")
    print()

    # Show uncategorized transactions that aren't transfers
    uncat_real = [tx for tx in transactions if not tx["category"] and not tx["is_transfer"]]
    if uncat_real:
        print(f"Uncategorized non-transfer transactions ({len(uncat_real)}):")
        for tx in uncat_real:
            print(f"  {tx['date']}  {tx['description'][:50]:<50}  ${tx['amount']:>10,.2f}  ({tx['type']})")
    print()

    # Show first 15 transactions as sample
    print("─" * 80)
    print("SAMPLE: First 15 parsed transactions")
    print("─" * 80)
    print(f"{'Date':<12} {'Type':<10} {'Category':<25} {'Amount':>10}  {'Description'}")
    print(f"{'─'*12} {'─'*10} {'─'*25} {'─'*10}  {'─'*40}")
    for tx in transactions[:15]:
        cat_display = tx["category"] or "[—]"
        type_display = tx["type"]
        if tx["is_transfer"]:
            type_display = "TRANSFER"
        print(f"{tx['date']:<12} {type_display:<10} {cat_display:<25} ${tx['amount']:>9,.2f}  {tx['description'][:40]}")


if __name__ == "__main__":
    main()
