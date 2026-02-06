"""
Unit tests for core parsing and normalization logic.
Tests the Python equivalents of the JS modules.
"""
import sys
sys.path.insert(0, '/sessions/dazzling-friendly-goldberg/condo-bookkeeper/tests')

# ─── Test CSV Line Parser ─────────────────────────────────────────────
def parse_csv_line(line):
    result = []
    current = ""
    in_quotes = False
    for ch in line:
        if ch == '"':
            if in_quotes and len(line) > line.index(ch) + 1 and line[line.index(ch) + 1] == '"':
                current += '"'
            else:
                in_quotes = not in_quotes
        elif ch == ',' and not in_quotes:
            result.append(current.strip())
            current = ""
        else:
            current += ch
    result.append(current.strip())
    return result

def test_csv_parser():
    """Test CSV parsing with quoted fields."""
    # Simple line
    assert parse_csv_line('a,b,c') == ['a', 'b', 'c']

    # Quoted field with comma
    assert parse_csv_line('01/15/2025,"ZELLE FROM JOHN, SMITH",1800.00,5432.10') == \
        ['01/15/2025', 'ZELLE FROM JOHN, SMITH', '1800.00', '5432.10']

    # Empty fields
    assert parse_csv_line('a,,c') == ['a', '', 'c']

    print("  CSV parser: PASSED")


# ─── Test Currency Parser ─────────────────────────────────────────────
def parse_currency(val):
    if isinstance(val, (int, float)):
        return float(val)
    if not val:
        return 0
    import re
    cleaned = re.sub(r'[$,\s"]', '', str(val))
    cleaned = re.sub(r'\((.+)\)', r'-\1', cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return 0

def test_currency_parser():
    """Test currency parsing with various formats."""
    assert parse_currency("$1,234.56") == 1234.56
    assert parse_currency("-89.99") == -89.99
    assert parse_currency("($485.00)") == -485.00
    assert parse_currency(1800.00) == 1800.00
    assert parse_currency("") == 0
    assert parse_currency(None) == 0
    assert parse_currency('"$1,234.56"') == 1234.56
    print("  Currency parser: PASSED")


# ─── Test Date Parser ─────────────────────────────────────────────────
def parse_date(val):
    if not val:
        return None
    import re
    from datetime import datetime
    s = str(val).strip()

    # ISO format
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if m:
        try:
            d = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            return d.strftime('%Y-%m-%d')
        except:
            pass

    # MM/DD/YYYY
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})', s)
    if m:
        try:
            d = datetime(int(m.group(3)), int(m.group(1)), int(m.group(2)))
            return d.strftime('%Y-%m-%d')
        except:
            pass

    return None

def test_date_parser():
    """Test date parsing with various formats."""
    assert parse_date("01/15/2025") == "2025-01-15"
    assert parse_date("1/5/2025") == "2025-01-05"
    assert parse_date("2025-01-15") == "2025-01-15"
    assert parse_date("12/31/2024") == "2024-12-31"
    assert parse_date("") is None
    assert parse_date(None) is None
    print("  Date parser: PASSED")


# ─── Test Description Cleaning ────────────────────────────────────────
BOA_PREFIXES = [
    "ONLINE BANKING PAYMENT TO",
    "ONLINE BANKING TRANSFER TO",
    "DEBIT CARD PURCHASE",
    "ACH DEBIT",
    "ACH CREDIT",
    "WIRE TRANSFER FROM",
    "ZELLE PAYMENT FROM",
    "ZELLE PAYMENT TO",
    "Online transfer from CHK",
    "Online transfer to CHK",
    "Online Banking transfer from CHK",
    "Online Banking transfer to CHK",
    "Online Banking transfer from SAV",
    "Online Banking payment to CRD",
]

def clean_description(raw):
    import re
    desc = str(raw).strip()
    for prefix in BOA_PREFIXES:
        if desc.lower().startswith(prefix.lower()):
            desc = desc[len(prefix):].strip()
            break
    ach_match = re.match(r'^(.+?)\s+DES:', raw, re.IGNORECASE)
    if ach_match and len(ach_match.group(1)) > 2:
        desc = ach_match.group(1).strip()
        for prefix in BOA_PREFIXES:
            if desc.lower().startswith(prefix.lower()):
                desc = desc[len(prefix):].strip()
                break
    desc = re.sub(r'\s*Confirmation#.*$', '', desc, flags=re.IGNORECASE).strip()
    desc = desc.rstrip('; ').strip()
    if not desc:
        desc = str(raw).strip()
    return desc

def test_description_cleaning():
    """Test BOA description cleaning."""
    assert clean_description("DEBIT CARD PURCHASE HOME DEPOT PALM SPRINGS CA") == "HOME DEPOT PALM SPRINGS CA"
    assert clean_description("ZELLE PAYMENT FROM JOHN SMITH") == "JOHN SMITH"

    # ACH format
    cleaned = clean_description("SO CAL EDISON CO DES:BILL PAYMT ID:XXXXX4814795 INDN:Day Brandon CO ID:XXXXX40335 WEB")
    assert "SO CAL EDISON" in cleaned

    # Mortgage
    cleaned = clean_description("NSM DBAMR.COOPER DES:NSM DBAMR ID:0089790 INDN:BRANDON *DAY CO ID:XXXXX52701 WEB")
    assert "NSM DBAMR.COOPER" in cleaned

    # Transfer with confirmation#
    cleaned = clean_description("Online Banking transfer from CHK 4191 Confirmation# XXXXX02865")
    assert "4191" in cleaned or "CHK" in cleaned

    # HOA
    cleaned = clean_description("PL*TheGaffneyGro DES:WEB PMTS ID:4C2J57 INDN:Brandon Day CO ID:XXXXX80577 WEB")
    assert "Gaffney" in cleaned or "TheGaffney" in cleaned

    print("  Description cleaning: PASSED")


# ─── Test Transaction Classification ──────────────────────────────────
import re

TRANSFER_PATTERNS = [
    r"online\s*(banking\s*)?transfer\s*(from|to)\s*chk",
    r"online\s*(banking\s*)?transfer\s*(from|to)\s*sav",
    r"online\s*(banking\s*)?payment\s*to\s*crd",
    r"payment\s*-?\s*thank\s*you",
]

def classify(raw_desc, amount, source="checking"):
    desc = str(raw_desc).lower()
    for pattern in TRANSFER_PATTERNS:
        if re.search(pattern, desc):
            return "transfer"
    if source == "checking":
        return "revenue" if amount >= 0 else "expense"
    if source == "credit_card":
        return "transfer" if amount < 0 else "expense"
    return "revenue" if amount >= 0 else "expense"

def test_classification():
    """Test transaction type classification."""
    # Checking transfers
    assert classify("Online Banking transfer from CHK 4191 Confirmation# XXX", 125.0) == "transfer"
    assert classify("Online Banking payment to CRD 3919 Confirmation# XXX", -8.15) == "transfer"

    # Checking deposits = revenue
    assert classify("ZELLE PAYMENT FROM JOHN SMITH", 1800.00) == "revenue"

    # Checking withdrawals = expense
    assert classify("SPECTRUM PAYMENT", -89.99) == "expense"

    # Credit card charges = expense
    assert classify("HOME DEPOT", 127.45, "credit_card") == "expense"

    # Credit card payments = transfer
    assert classify("PAYMENT - THANK YOU", -1800.00, "credit_card") == "transfer"

    print("  Transaction classification: PASSED")


# ─── Test Deduplication ───────────────────────────────────────────────
def test_deduplication():
    """Test duplicate detection logic."""
    existing = [
        {"date": "2025-01-15", "description": "spectrum payment", "original_description": "SPECTRUM PAYMENT", "amount": 89.99, "reference_number": None},
        {"date": "2025-01-10", "description": "home depot", "original_description": "HOME DEPOT", "amount": 127.45, "reference_number": "REF123"},
    ]

    # Same date + desc + amount = duplicate
    new_dup = {"date": "2025-01-15", "original_description": "SPECTRUM PAYMENT", "amount": 89.99, "reference_number": None}
    key1 = f"{new_dup['date']}|{new_dup['original_description'].lower()}|{abs(new_dup['amount']):.2f}"
    existing_keys = [f"{e['date']}|{e['original_description'].lower()}|{abs(e['amount']):.2f}" for e in existing]
    assert key1 in existing_keys, "Should detect duplicate by date+desc+amount"

    # Different date = not duplicate
    new_diff = {"date": "2025-02-15", "original_description": "SPECTRUM PAYMENT", "amount": 89.99, "reference_number": None}
    key2 = f"{new_diff['date']}|{new_diff['original_description'].lower()}|{abs(new_diff['amount']):.2f}"
    assert key2 not in existing_keys, "Different date should not be duplicate"

    # Same reference number = duplicate
    new_ref = {"date": "2025-02-10", "original_description": "HOME DEPOT", "amount": 52.00, "reference_number": "REF123"}
    ref_index = {e["reference_number"]: e for e in existing if e["reference_number"]}
    assert new_ref["reference_number"] in ref_index, "Should detect duplicate by reference number"

    print("  Deduplication: PASSED")


# ─── Run All Tests ────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Running unit tests...")
    print()
    test_csv_parser()
    test_currency_parser()
    test_date_parser()
    test_description_cleaning()
    test_classification()
    test_deduplication()
    print()
    print("ALL TESTS PASSED")
