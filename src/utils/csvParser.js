/**
 * Generic CSV parser — handles quoted fields, commas inside quotes,
 * various line endings, and trailing empty rows.
 */

/**
 * Parse a single CSV line, respecting quoted fields.
 * Handles: "field with, comma", regular field, "field with ""escaped"" quotes"
 */
export function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse a full CSV string into { headers, rows }.
 * Skips empty rows and handles \r\n or \n line endings.
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parsed = parseCSVLine(lines[i]);
    // Skip rows where all fields are empty
    if (parsed.every(f => f === "")) continue;
    rows.push(parsed);
  }

  return { headers, rows };
}

/**
 * Parse a currency string into a number.
 * Handles: $1,234.56  (1234.56)  -1234.56  "$1,234.56"  etc.
 */
export function parseCurrency(val) {
  if (typeof val === "number") return val;
  if (val === null || val === undefined || val === "") return 0;
  const cleaned = String(val)
    .replace(/[$,\s"]/g, "")
    .replace(/\((.+)\)/, "-$1");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a date string into ISO format (YYYY-MM-DD).
 * Handles: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD, MM-DD-YYYY
 */
export function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();

  // Already ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + "T00:00:00");
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const d = new Date(+year, +month - 1, +day);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  // Excel serial date number (days since 1900-01-01)
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    // Excel date serial
    const excelEpoch = new Date(1899, 11, 30); // Dec 30 1899
    const d = new Date(excelEpoch.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  return null;
}
