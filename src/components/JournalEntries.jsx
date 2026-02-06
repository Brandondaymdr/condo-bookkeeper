import React, { useState } from 'react';
import {
  ALL_ACCOUNTS,
  ALL_PL_CATEGORIES,
  ALL_BS_ACCOUNTS,
} from '../models/categories.js';
import { createJournalEntry, generateId } from '../models/schema.js';
import { formatMoney, formatDate } from '../utils/format.js';

const JournalEntries = ({ store, saveData }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    memo: '',
    lines: [{ account: '', debit: '', credit: '' }],
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const journalEntries = store.journal_entries || [];

  const templates = {
    depreciation: {
      name: 'Annual Depreciation',
      lines: [
        { account: 'Depreciation Expense', debit: '', credit: '' },
        { account: 'Accumulated Depreciation - Property', debit: '', credit: '' },
      ],
    },
    ownersDraw: {
      name: "Owner's Draw",
      lines: [
        { account: "Owner's Draw", debit: '', credit: '' },
        { account: 'Cash - Checking', debit: '', credit: '' },
      ],
    },
    mortgagePayment: {
      name: 'Mortgage Payment Split',
      lines: [
        { account: 'Mortgage Interest', debit: '', credit: '' },
        { account: 'Mortgage Payable', debit: '', credit: '' },
        { account: 'Cash - Checking', debit: '', credit: '' },
      ],
    },
  };

  const calculateTotals = (lines) => {
    let debits = 0;
    let credits = 0;
    lines.forEach((line) => {
      if (line.debit) debits += parseFloat(line.debit) || 0;
      if (line.credit) credits += parseFloat(line.credit) || 0;
    });
    return { debits, credits };
  };

  const totals = calculateTotals(formData.lines);
  const isBalanced = Math.abs(totals.debits - totals.credits) < 0.01;

  const handleAddLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account: '', debit: '', credit: '' }],
    });
  };

  const handleRemoveLine = (index) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const applyTemplate = (templateKey) => {
    const template = templates[templateKey];
    if (template) {
      setFormData({
        ...formData,
        lines: template.lines.map((line) => ({ ...line })),
      });
      setSelectedTemplate(templateKey);
    }
  };

  const handleSaveEntry = () => {
    if (!isBalanced) {
      alert('Journal entry must be balanced (debits = credits)');
      return;
    }

    if (!formData.memo.trim()) {
      alert('Please enter a memo');
      return;
    }

    // Filter out empty lines
    const validLines = formData.lines.filter(
      (line) => line.account && (line.debit || line.credit)
    );

    if (validLines.length === 0) {
      alert('Please add at least one entry line');
      return;
    }

    const entry = {
      id: editingId || generateId(),
      date: formData.date,
      memo: formData.memo,
      lines: validLines,
      created_at: editingId
        ? journalEntries.find((e) => e.id === editingId)?.created_at
        : new Date().toISOString(),
    };

    let updatedEntries;
    if (editingId) {
      updatedEntries = journalEntries.map((e) => (e.id === editingId ? entry : e));
    } else {
      updatedEntries = [...journalEntries, entry];
    }

    const updatedStore = { ...store, journal_entries: updatedEntries };
    saveData(updatedStore);

    setShowForm(false);
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      memo: '',
      lines: [{ account: '', debit: '', credit: '' }],
    });
    setSelectedTemplate('');
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setFormData({
      date: entry.date,
      memo: entry.memo,
      lines: entry.lines.map((line) => ({ ...line })),
    });
    setShowForm(true);
    setExpandedId(null);
  };

  const handleDelete = (id) => {
    if (
      window.confirm(
        'Are you sure you want to delete this journal entry? This action cannot be undone.'
      )
    ) {
      const updatedEntries = journalEntries.filter((e) => e.id !== id);
      const updatedStore = { ...store, journal_entries: updatedEntries };
      saveData(updatedStore);
      setExpandedId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      memo: '',
      lines: [{ account: '', debit: '', credit: '' }],
    });
    setSelectedTemplate('');
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
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      margin: 0,
      fontSize: '24px',
      fontWeight: 'bold',
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
    buttonDanger: {
      backgroundColor: '#e94560',
      color: 'white',
      border: 'none',
      padding: '8px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
    },
    buttonDisabled: {
      backgroundColor: '#ccc',
      color: '#666',
      cursor: 'not-allowed',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '20px',
    },
    th: {
      backgroundColor: '#1a1a2e',
      color: 'white',
      padding: '12px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: '13px',
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #e0e0e0',
      fontSize: '13px',
    },
    tr: {
      cursor: 'pointer',
    },
    trHover: {
      backgroundColor: '#f5f5f5',
    },
    form: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '4px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '20px',
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
    select: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '13px',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '16px',
    },
    linesTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '12px',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #ddd',
    },
    linesTh: {
      backgroundColor: '#f0f0f0',
      padding: '10px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: '12px',
      borderBottom: '1px solid #ddd',
    },
    linesTd: {
      padding: '8px 10px',
      borderBottom: '1px solid #ddd',
    },
    errorMessage: {
      color: '#e94560',
      fontSize: '13px',
      marginTop: '4px',
    },
    successMessage: {
      color: '#28a745',
      fontSize: '13px',
      marginTop: '4px',
    },
    totalsRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '16px',
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #ddd',
    },
    totalItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontWeight: '600',
      color: '#1a1a2e',
    },
    totalValue: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#0f3460',
    },
    expandedContent: {
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderTop: '1px solid #e0e0e0',
    },
    expandedTable: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: 'white',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #ddd',
      marginBottom: '12px',
    },
    expandedTh: {
      backgroundColor: '#f0f0f0',
      padding: '10px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: '12px',
      borderBottom: '1px solid #ddd',
    },
    expandedTd: {
      padding: '10px',
      borderBottom: '1px solid #ddd',
      fontSize: '13px',
    },
    formActions: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'flex-end',
      marginTop: '16px',
    },
    templateSelect: {
      marginBottom: '16px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Journal Entries</h1>
        {!showForm && (
          <button
            style={styles.button}
            onClick={() => setShowForm(true)}
          >
            + New Journal Entry
          </button>
        )}
      </div>

      {showForm && (
        <div style={styles.form}>
          <h2 style={{ marginTop: 0, color: '#1a1a2e' }}>
            {editingId ? 'Edit Journal Entry' : 'New Journal Entry'}
          </h2>

          <div style={styles.templateSelect}>
            <label style={styles.label}>Quick Templates (Optional)</label>
            <select
              style={styles.select}
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">-- Select a template --</option>
              {Object.entries(templates).map(([key, template]) => (
                <option key={key} value={key}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                style={styles.input}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Memo</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Description of this entry"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Entry Lines</label>
            <table style={styles.linesTable}>
              <thead>
                <tr>
                  <th style={styles.linesTh}>Account</th>
                  <th style={styles.linesTh}>Debit</th>
                  <th style={styles.linesTh}>Credit</th>
                  <th style={styles.linesTh}>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.lines.map((line, index) => (
                  <tr key={index}>
                    <td style={styles.linesTd}>
                      <select
                        style={styles.select}
                        value={line.account}
                        onChange={(e) =>
                          handleLineChange(index, 'account', e.target.value)
                        }
                      >
                        <option value="">-- Select Account --</option>
                        {ALL_ACCOUNTS.map((account) => (
                          <option key={account} value={account}>
                            {account}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.linesTd}>
                      <input
                        type="number"
                        step="0.01"
                        style={styles.input}
                        placeholder="0.00"
                        value={line.debit}
                        onChange={(e) =>
                          handleLineChange(index, 'debit', e.target.value)
                        }
                      />
                    </td>
                    <td style={styles.linesTd}>
                      <input
                        type="number"
                        step="0.01"
                        style={styles.input}
                        placeholder="0.00"
                        value={line.credit}
                        onChange={(e) =>
                          handleLineChange(index, 'credit', e.target.value)
                        }
                      />
                    </td>
                    <td style={styles.linesTd}>
                      {formData.lines.length > 1 && (
                        <button
                          style={styles.buttonDanger}
                          onClick={() => handleRemoveLine(index)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              style={styles.button}
              onClick={handleAddLine}
            >
              + Add Line
            </button>
          </div>

          <div style={styles.totalsRow}>
            <div style={styles.totalItem}>
              <span style={styles.totalLabel}>Total Debits:</span>
              <span style={styles.totalValue}>{formatMoney(totals.debits)}</span>
            </div>
            <div style={styles.totalItem}>
              <span style={styles.totalLabel}>Total Credits:</span>
              <span style={styles.totalValue}>{formatMoney(totals.credits)}</span>
            </div>
          </div>

          {!isBalanced && (
            <div style={styles.errorMessage}>
              ⚠ Entry not balanced. Debits must equal credits.
            </div>
          )}
          {isBalanced && formData.lines.some((l) => l.account && (l.debit || l.credit)) && (
            <div style={styles.successMessage}>✓ Entry is balanced</div>
          )}

          <div style={styles.formActions}>
            <button
              style={styles.button}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              style={{
                ...styles.button,
                ...(isBalanced ? {} : styles.buttonDisabled),
              }}
              disabled={!isBalanced}
              onClick={handleSaveEntry}
            >
              {editingId ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {journalEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>No journal entries yet. Create one to get started.</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Memo</th>
              <th style={styles.th}>Lines</th>
              <th style={styles.th}>Total Debits</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journalEntries.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr
                  style={styles.tr}
                  onClick={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = styles.trHover.backgroundColor)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <td style={styles.td}>{formatDate(entry.date)}</td>
                  <td style={styles.td}>{entry.memo}</td>
                  <td style={styles.td}>{entry.lines.length}</td>
                  <td style={styles.td}>
                    {formatMoney(
                      entry.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0)
                    )}
                  </td>
                  <td
                    style={styles.td}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      style={{
                        ...styles.button,
                        marginRight: '4px',
                      }}
                      onClick={() => handleEdit(entry)}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.buttonDanger}
                      onClick={() => handleDelete(entry.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {expandedId === entry.id && (
                  <tr>
                    <td
                      colSpan="5"
                      style={{ padding: 0 }}
                    >
                      <div style={styles.expandedContent}>
                        <h4 style={{ marginTop: 0, color: '#1a1a2e' }}>
                          Entry Details
                        </h4>
                        <table style={styles.expandedTable}>
                          <thead>
                            <tr>
                              <th style={styles.expandedTh}>Account</th>
                              <th style={styles.expandedTh}>Debit</th>
                              <th style={styles.expandedTh}>Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((line, index) => (
                              <tr key={index}>
                                <td style={styles.expandedTd}>{line.account}</td>
                                <td style={styles.expandedTd}>
                                  {line.debit ? formatMoney(line.debit) : '—'}
                                </td>
                                <td style={styles.expandedTd}>
                                  {line.credit ? formatMoney(line.credit) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default JournalEntries;
