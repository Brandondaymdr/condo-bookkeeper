import React, { useState } from 'react';
import {
  ASSET_ACCOUNTS,
  LIABILITY_ACCOUNTS,
  EQUITY_ACCOUNTS,
} from '../models/categories.js';
import { exportToJSON, importFromJSON } from '../storage/backup.js';
import { clearStore } from '../storage/db.js';
import { formatMoney, formatDate } from '../utils/format.js';

const Settings = ({ store, saveData }) => {
  const [openingBalances, setOpeningBalances] = useState(
    store.balance_sheet_openings || {}
  );
  const [propertyCostBasis, setPropertyCostBasis] = useState(
    store.property_cost_basis || 0
  );
  const [landValue, setLandValue] = useState(store.land_value || 0);
  const [depreciationStartYear, setDepreciationStartYear] = useState(
    store.depreciation_start_year || new Date().getFullYear()
  );
  const [importMessage, setImportMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  const residentialDepreciationYears = 27.5;
  const depreciableValue = propertyCostBasis - landValue;
  const annualDepreciation =
    depreciableValue > 0 ? depreciableValue / residentialDepreciationYears : 0;

  const handleOpeningBalanceChange = (account, value) => {
    setOpeningBalances({
      ...openingBalances,
      [account]: parseFloat(value) || 0,
    });
  };

  const handleSaveOpeningBalances = () => {
    const updatedStore = {
      ...store,
      balance_sheet_openings: openingBalances,
    };
    saveData(updatedStore);
    alert('Opening balances saved successfully');
  };

  const handleSavePropertySettings = () => {
    const updatedStore = {
      ...store,
      property_cost_basis: parseFloat(propertyCostBasis) || 0,
      land_value: parseFloat(landValue) || 0,
      depreciation_start_year: parseInt(depreciationStartYear) || new Date().getFullYear(),
    };
    saveData(updatedStore);
    alert(
      `Property settings saved. Annual depreciation: ${formatMoney(annualDepreciation)}`
    );
  };

  const handleExport = async () => {
    try {
      const json = await exportToJSON();
      const element = document.createElement('a');
      element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' + encodeURIComponent(json)
      );
      element.setAttribute('download', `condo-bookkeeper-backup-${Date.now()}.json`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setExportMessage('Backup exported successfully');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (error) {
      alert('Error exporting backup: ' + error.message);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmImport = window.confirm(
      'This will replace all current data with the backup. Are you sure? This action cannot be undone.'
    );
    if (!confirmImport) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importFromJSON(json);
      setImportMessage('Backup imported successfully. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      alert('Error importing backup: ' + error.message);
    }
  };

  const handleResetData = () => {
    const confirmReset = window.confirm(
      'Are you sure you want to reset all data? This action cannot be undone. Click "OK" to continue.'
    );
    if (!confirmReset) return;

    const confirmAgain = window.confirm(
      'This is your final warning. All data will be permanently deleted. Are you absolutely sure?'
    );
    if (!confirmAgain) return;

    clearStore();
    setImportMessage('All data has been reset. Reloading...');
    setTimeout(() => window.location.reload(), 1500);
  };

  const getAccountLabel = (account) => {
    // Extract account name and account details
    const match = account.match(/^(.+?)\s*(?:\(([^)]+)\))?$/);
    if (match) {
      const name = match[1];
      const details = match[2];
      return details ? `${name} (${details})` : name;
    }
    return account;
  };

  const getLastBackupDate = () => {
    const lastBackup = localStorage.getItem('lastBackupDate');
    return lastBackup ? new Date(lastBackup) : null;
  };

  const stats = {
    transactions: store.transactions?.length || 0,
    rules: store.rules?.length || 0,
    journalEntries: store.journal_entries?.length || 0,
    lastBackup: getLastBackupDate(),
  };

  const styles = {
    container: {
      padding: '20px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
    },
    header: {
      backgroundColor: '#1a1a2e',
      color: 'white',
      padding: '20px',
      borderRadius: '4px',
      marginBottom: '20px',
    },
    headerTitle: {
      margin: 0,
      fontSize: '24px',
      fontWeight: 'bold',
    },
    section: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '4px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    sectionTitle: {
      marginTop: 0,
      marginBottom: '16px',
      color: '#1a1a2e',
      fontSize: '18px',
      fontWeight: '600',
      borderBottom: '2px solid #0f3460',
      paddingBottom: '10px',
    },
    formGroup: {
      marginBottom: '16px',
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontWeight: '600',
      color: '#1a1a2e',
      fontSize: '13px',
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '13px',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    accountsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
    },
    accountCard: {
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #ddd',
    },
    propertyGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
    },
    button: {
      backgroundColor: '#0f3460',
      color: 'white',
      border: 'none',
      padding: '10px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
    },
    buttonSecondary: {
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      padding: '10px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
    },
    buttonDanger: {
      backgroundColor: '#e94560',
      color: 'white',
      border: 'none',
      padding: '10px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
    },
    messageSuccess: {
      color: '#28a745',
      fontSize: '13px',
      marginTop: '8px',
    },
    messageError: {
      color: '#e94560',
      fontSize: '13px',
      marginTop: '8px',
    },
    calculatedValue: {
      padding: '12px',
      backgroundColor: '#f0f0f0',
      borderRadius: '4px',
      border: '1px solid #ddd',
      marginTop: '8px',
    },
    calculatedLabel: {
      fontWeight: '600',
      color: '#1a1a2e',
      fontSize: '13px',
    },
    calculatedAmount: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#0f3460',
      marginTop: '4px',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
    },
    statCard: {
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #ddd',
      textAlign: 'center',
    },
    statLabel: {
      display: 'block',
      color: '#666',
      fontSize: '12px',
      fontWeight: '600',
      marginBottom: '4px',
    },
    statValue: {
      display: 'block',
      fontSize: '20px',
      fontWeight: '700',
      color: '#1a1a2e',
    },
    fileInput: {
      padding: '8px 12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    actionButtons: {
      display: 'flex',
      gap: '8px',
      marginTop: '16px',
      flexWrap: 'wrap',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Settings</h1>
      </div>

      {/* Opening Balances Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Opening Balances</h2>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
          Enter the opening balance for each account as of your starting date.
        </p>

        <div style={styles.accountsGrid}>
          {/* Asset Accounts */}
          <div>
            <h3 style={{ marginTop: 0, color: '#1a1a2e', fontSize: '14px' }}>
              Assets
            </h3>
            {ASSET_ACCOUNTS.map((account) => (
              <div key={account} style={styles.accountCard}>
                <label style={styles.label}>{getAccountLabel(account)}</label>
                <input
                  type="number"
                  step="0.01"
                  style={styles.input}
                  placeholder="0.00"
                  value={openingBalances[account] || ''}
                  onChange={(e) =>
                    handleOpeningBalanceChange(account, e.target.value)
                  }
                />
              </div>
            ))}
          </div>

          {/* Liability Accounts */}
          <div>
            <h3 style={{ marginTop: 0, color: '#1a1a2e', fontSize: '14px' }}>
              Liabilities
            </h3>
            {LIABILITY_ACCOUNTS.map((account) => (
              <div key={account} style={styles.accountCard}>
                <label style={styles.label}>{getAccountLabel(account)}</label>
                <input
                  type="number"
                  step="0.01"
                  style={styles.input}
                  placeholder="0.00"
                  value={openingBalances[account] || ''}
                  onChange={(e) =>
                    handleOpeningBalanceChange(account, e.target.value)
                  }
                />
              </div>
            ))}
          </div>

          {/* Equity Accounts */}
          <div>
            <h3 style={{ marginTop: 0, color: '#1a1a2e', fontSize: '14px' }}>
              Equity
            </h3>
            {EQUITY_ACCOUNTS.map((account) => (
              <div key={account} style={styles.accountCard}>
                <label style={styles.label}>{getAccountLabel(account)}</label>
                <input
                  type="number"
                  step="0.01"
                  style={styles.input}
                  placeholder="0.00"
                  value={openingBalances[account] || ''}
                  onChange={(e) =>
                    handleOpeningBalanceChange(account, e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <button style={styles.button} onClick={handleSaveOpeningBalances}>
          Save Opening Balances
        </button>
      </div>

      {/* Property Settings Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Property Settings</h2>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
          Configure your rental property details for depreciation calculations.
        </p>

        <div style={styles.propertyGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Property Cost Basis</label>
            <input
              type="number"
              step="0.01"
              style={styles.input}
              placeholder="Total property purchase price"
              value={propertyCostBasis}
              onChange={(e) => setPropertyCostBasis(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Land Value (Non-Depreciable)</label>
            <input
              type="number"
              step="0.01"
              style={styles.input}
              placeholder="Land value portion"
              value={landValue}
              onChange={(e) => setLandValue(e.target.value)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Depreciation Start Year</label>
            <input
              type="number"
              style={styles.input}
              placeholder="Year"
              value={depreciationStartYear}
              onChange={(e) => setDepreciationStartYear(e.target.value)}
            />
          </div>
        </div>

        <div style={styles.calculatedValue}>
          <div style={styles.calculatedLabel}>
            Annual Depreciation (Residential Rental - 27.5 years)
          </div>
          <div style={styles.calculatedAmount}>
            {formatMoney(annualDepreciation)}
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>
            ({formatMoney(depreciableValue)} ÷ 27.5 years)
          </div>
        </div>

        <button
          style={{ ...styles.button, marginTop: '16px' }}
          onClick={handleSavePropertySettings}
        >
          Save Property Settings
        </button>
      </div>

      {/* Data Management Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Data Management</h2>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Total Transactions</span>
            <span style={styles.statValue}>{stats.transactions}</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Categorization Rules</span>
            <span style={styles.statValue}>{stats.rules}</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Journal Entries</span>
            <span style={styles.statValue}>{stats.journalEntries}</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Last Backup</span>
            <span style={styles.statValue}>
              {stats.lastBackup ? formatDate(stats.lastBackup) : 'Never'}
            </span>
          </div>
        </div>

        <div style={styles.formGroup}>
          <h3 style={{ marginTop: 0, color: '#1a1a2e', fontSize: '14px' }}>
            Backup & Restore
          </h3>
          <div style={styles.actionButtons}>
            <button style={styles.button} onClick={handleExport}>
              Download Backup (JSON)
            </button>
            <label style={styles.button}>
              Import Backup
              <input
                type="file"
                accept=".json"
                style={{
                  display: 'none',
                }}
                onChange={handleImport}
              />
            </label>
          </div>
          {exportMessage && <div style={styles.messageSuccess}>{exportMessage}</div>}
          {importMessage && <div style={styles.messageSuccess}>{importMessage}</div>}
        </div>

        <div style={styles.formGroup}>
          <h3 style={{ marginTop: 0, color: '#1a1a2e', fontSize: '14px' }}>
            Danger Zone
          </h3>
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
            This action will permanently delete all data from your application.
            You will not be able to recover it.
          </p>
          <button style={styles.buttonDanger} onClick={handleResetData}>
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
