/**
 * JSON Backup & Restore utilities.
 *
 * Export the entire app store as a JSON file for backup.
 * Import a previously exported JSON file to restore data.
 */

/**
 * Export the app store as a downloadable JSON file.
 *
 * @param {Object} store - The complete app store
 * @param {string} filename - Desired filename (default: auto-generated)
 */
export function exportToJSON(store, filename) {
  const date = new Date().toISOString().slice(0, 10);
  const name = filename || `condo-bookkeeper-backup-${date}.json`;

  const json = JSON.stringify(store, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import a JSON backup file. Returns the parsed store object.
 *
 * @param {File} file - The JSON file to import
 * @returns {Promise<Object>} The parsed store
 */
export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Basic validation
        if (!data.version || !Array.isArray(data.transactions)) {
          reject(new Error("Invalid backup file: missing required fields (version, transactions)."));
          return;
        }

        resolve(data);
      } catch (err) {
        reject(new Error(`Failed to parse backup file: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

/**
 * Export P&L report as a CSV file.
 *
 * @param {ProfitLossReport} report
 * @param {string} filename
 */
export function exportPLToCSV(report, filename) {
  const lines = [];
  lines.push("Palm Springs Condo - Profit & Loss Statement");
  lines.push(`"${report.startDate} to ${report.endDate}"`);
  lines.push("");
  lines.push("Category,Schedule E Line,Amount");

  lines.push("");
  lines.push("REVENUE,,");
  for (const line of report.revenue) {
    lines.push(`"${line.category}","Line ${line.scheduleE || 'N/A'}","${line.amount.toFixed(2)}"`);
  }
  lines.push(`"Total Revenue",,"${report.totalRevenue.toFixed(2)}"`);

  lines.push("");
  lines.push("EXPENSES,,");
  for (const line of report.expenses) {
    lines.push(`"${line.category}","Line ${line.scheduleE || 'N/A'}","${line.amount.toFixed(2)}"`);
  }
  lines.push(`"Total Expenses",,"${report.totalExpenses.toFixed(2)}"`);

  lines.push("");
  lines.push(`"NET INCOME",,"${report.netIncome.toFixed(2)}"`);

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `PL-${report.startDate}-to-${report.endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
