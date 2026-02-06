import React, { useState } from 'react';
import {
  ALL_PL_CATEGORIES,
  ALL_REVENUE_NAMES,
  ALL_EXPENSE_NAMES,
} from '../models/categories.js';
import {
  updateLearnedPatterns,
  batchUpdateLearnedPatterns,
} from '../engines/categorize.js';
import { createRule } from '../models/schema.js';
import { formatMoney, formatDate } from '../utils/format.js';

const ReviewApproval = ({ store, saveData }) => {
  // State for bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Get unapproved, non-transfer transactions
  const unapprovedTxs = store.transactions.filter(
    tx => !tx.approved && tx.type !== 'transfer'
  );

  // ─────────────────────────────────────────────────────────────
  // Helper: Get confidence indicator styling
  // ─────────────────────────────────────────────────────────────
  const getConfidenceIndicator = tx => {
    const dotStyle = {
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      marginRight: '6px',
      verticalAlign: 'middle',
    };

    const baseStyle = { display: 'flex', alignItems: 'center', gap: '4px' };

    if (tx.categorization_source === 'rule') {
      return (
        <span style={baseStyle}>
          <span style={{ ...dotStyle, backgroundColor: '#27ae60' }} />
          Rule
        </span>
      );
    }
    if (tx.categorization_source === 'learned') {
      return (
        <span style={baseStyle}>
          <span style={{ ...dotStyle, backgroundColor: '#3498db' }} />
          Learned
        </span>
      );
    }
    if (tx.categorization_source === 'smart') {
      return (
        <span style={baseStyle}>
          <span style={{ ...dotStyle, backgroundColor: '#f39c12' }} />
          Suggested
        </span>
      );
    }
    // Manual or uncategorized (confidence === "none")
    return (
      <span style={baseStyle}>
        <span style={{ ...dotStyle, backgroundColor: '#e74c3c' }} />
        Manual
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Handle single transaction approval
  // ─────────────────────────────────────────────────────────────
  const handleApproveTransaction = (txId, updatedTx = null) => {
    const tx = updatedTx || store.transactions.find(t => t.id === txId);
    if (!tx) return;

    // Mark as approved
    const approved = { ...tx, approved: true };

    // Update learned patterns
    let newPatterns = updateLearnedPatterns(approved, store.learned_patterns);

    // Update store
    const updatedTransactions = store.transactions.map(t =>
      t.id === txId ? approved : t
    );

    const updatedStore = {
      ...store,
      transactions: updatedTransactions,
      learned_patterns: newPatterns,
    };

    saveData(updatedStore);
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(txId);
      return newSet;
    });
  };

  // ─────────────────────────────────────────────────────────────
  // Handle category change for a transaction
  // ─────────────────────────────────────────────────────────────
  const handleCategoryChange = (txId, newCategory) => {
    const tx = store.transactions.find(t => t.id === txId);
    if (!tx) return;

    // If category changed from the suggestion, mark as manual
    const isCategoryChanged =
      newCategory && newCategory !== tx.category;
    const newCategorization_source = isCategoryChanged ? 'manual' : tx.categorization_source;

    const updatedTx = {
      ...tx,
      category: newCategory,
      categorization_source: newCategorization_source,
    };

    // Update store immediately (but don't approve yet)
    const updatedTransactions = store.transactions.map(t =>
      t.id === txId ? updatedTx : t
    );

    const updatedStore = {
      ...store,
      transactions: updatedTransactions,
    };

    saveData(updatedStore);
  };

  // ─────────────────────────────────────────────────────────────
  // Handle "Create Rule" action
  // ─────────────────────────────────────────────────────────────
  const handleCreateRule = txId => {
    const tx = store.transactions.find(t => t.id === txId);
    if (!tx || !tx.category) {
      alert('Please assign a category before creating a rule.');
      return;
    }

    // Create rule from vendor_key → category
    const vendorKey = tx.vendor_key || tx.description;
    const newRule = createRule({
      match: vendorKey,
      category: tx.category,
      type: tx.type || 'expense',
      match_type: 'contains',
    });

    const updatedStore = {
      ...store,
      rules: [...store.rules, newRule],
    };

    saveData(updatedStore);
    alert(
      `Rule created: "${vendorKey}" → "${tx.category}"`
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Handle "Approve All" bulk action
  // ─────────────────────────────────────────────────────────────
  const handleApproveAll = () => {
    if (unapprovedTxs.length === 0) {
      alert('No transactions to approve.');
      return;
    }

    const approved = unapprovedTxs.map(tx => ({ ...tx, approved: true }));
    let newPatterns = batchUpdateLearnedPatterns(
      approved,
      store.learned_patterns
    );

    const approvedIds = new Set(approved.map(tx => tx.id));
    const updatedTransactions = store.transactions.map(t =>
      approvedIds.has(t.id) ? { ...t, approved: true } : t
    );

    const updatedStore = {
      ...store,
      transactions: updatedTransactions,
      learned_patterns: newPatterns,
    };

    saveData(updatedStore);
    setSelectedIds(new Set());
    setSelectAll(false);
  };

  // ─────────────────────────────────────────────────────────────
  // Handle "Approve High Confidence" bulk action
  // ─────────────────────────────────────────────────────────────
  const handleApproveHighConfidence = () => {
    const highConfidence = unapprovedTxs.filter(
      tx => tx.confidence === 'high' || tx.categorization_source === 'rule'
    );

    if (highConfidence.length === 0) {
      alert('No high-confidence transactions to approve.');
      return;
    }

    const approved = highConfidence.map(tx => ({ ...tx, approved: true }));
    let newPatterns = batchUpdateLearnedPatterns(
      approved,
      store.learned_patterns
    );

    const approvedIds = new Set(approved.map(tx => tx.id));
    const updatedTransactions = store.transactions.map(t =>
      approvedIds.has(t.id) ? { ...t, approved: true } : t
    );

    const updatedStore = {
      ...store,
      transactions: updatedTransactions,
      learned_patterns: newPatterns,
    };

    saveData(updatedStore);
    setSelectedIds(new Set());
    setSelectAll(false);
  };

  // ─────────────────────────────────────────────────────────────
  // Handle checkbox toggle
  // ─────────────────────────────────────────────────────────────
  const handleToggleRow = txId => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      // Update selectAll if all are selected
      setSelectAll(newSet.size === unapprovedTxs.length);
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(unapprovedTxs.map(tx => tx.id));
      setSelectedIds(allIds);
      setSelectAll(true);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Styling constants
  // ─────────────────────────────────────────────────────────────
  const headerStyle = {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: '16px',
    borderRadius: '4px 4px 0 0',
  };

  const bulkBarStyle = {
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
  };

  const bulkActionsStyle = {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  };

  const buttonStyle = {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  };

  const approveButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#27ae60',
    color: '#fff',
  };

  const approveButtonHoverStyle = {
    ...approveButtonStyle,
    backgroundColor: '#229954',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ecf0f1',
    color: '#2c3e50',
  };

  const secondaryButtonHoverStyle = {
    ...secondaryButtonStyle,
    backgroundColor: '#d5dbdb',
  };

  const countStyle = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2c3e50',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  };

  const theadStyle = {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const thStyle = {
    padding: '12px 8px',
    textAlign: 'left',
    borderBottom: '2px solid #ecf0f1',
  };

  const tdStyle = {
    padding: '12px 8px',
    borderBottom: '1px solid #ecf0f1',
    fontSize: '13px',
  };

  const rowStyle = (index, isSelected) => ({
    backgroundColor: isSelected ? '#e8f8f5' : index % 2 === 0 ? '#fff' : '#f9f9f9',
    transition: 'background-color 0.15s',
  });

  const checkboxStyle = {
    cursor: 'pointer',
    width: '18px',
    height: '18px',
  };

  const smallButtonStyle = {
    padding: '4px 8px',
    fontSize: '12px',
    marginLeft: '4px',
    border: '1px solid #bdc3c7',
    backgroundColor: '#ecf0f1',
    borderRadius: '3px',
    cursor: 'pointer',
    color: '#2c3e50',
  };

  const categoryDropdownStyle = {
    padding: '6px 4px',
    fontSize: '13px',
    border: '1px solid #bdc3c7',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
  };

  const containerStyle = {
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={{ margin: '0', fontSize: '18px', fontWeight: '600' }}>
          Transaction Review & Approval
        </h2>
      </div>

      {/* Bulk Actions Bar */}
      <div style={bulkBarStyle}>
        <div style={bulkActionsStyle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={checkboxStyle}
              checked={selectAll}
              onChange={handleToggleSelectAll}
            />
            <span style={{ fontSize: '13px', fontWeight: '500' }}>Select All</span>
          </label>
          <button
            style={approveButtonStyle}
            onMouseEnter={e => Object.assign(e.target.style, approveButtonHoverStyle)}
            onMouseLeave={e => Object.assign(e.target.style, approveButtonStyle)}
            onClick={handleApproveAll}
          >
            Approve All
          </button>
          <button
            style={secondaryButtonStyle}
            onMouseEnter={e => Object.assign(e.target.style, secondaryButtonHoverStyle)}
            onMouseLeave={e => Object.assign(e.target.style, secondaryButtonStyle)}
            onClick={handleApproveHighConfidence}
          >
            Approve High Confidence
          </button>
        </div>
        <div style={countStyle}>
          {selectedIds.size} of {unapprovedTxs.length} transactions pending review
        </div>
      </div>

      {/* Transactions Table */}
      {unapprovedTxs.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7f8c8d' }}>
          All transactions have been approved!
        </div>
      ) : (
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>
              <th style={{ ...thStyle, width: '40px' }}>
                <input
                  type="checkbox"
                  style={checkboxStyle}
                  checked={selectAll}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th style={{ ...thStyle, width: '100px' }}>Date</th>
              <th style={{ ...thStyle, width: '220px' }}>Description</th>
              <th style={{ ...thStyle, width: '90px', textAlign: 'right' }}>Amount</th>
              <th style={{ ...thStyle, width: '80px' }}>Source</th>
              <th style={{ ...thStyle, width: '160px' }}>Category</th>
              <th style={{ ...thStyle, width: '100px' }}>Confidence</th>
              <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {unapprovedTxs.map((tx, index) => {
              const isSelected = selectedIds.has(tx.id);
              return (
                <tr key={tx.id} style={rowStyle(index, isSelected)}>
                  {/* Checkbox */}
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      style={checkboxStyle}
                      checked={isSelected}
                      onChange={() => handleToggleRow(tx.id)}
                    />
                  </td>

                  {/* Date */}
                  <td style={tdStyle}>{formatDate(tx.date)}</td>

                  {/* Description (cleaned) */}
                  <td style={tdStyle}>
                    <span title={tx.original_description}>
                      {tx.description || tx.original_description}
                    </span>
                  </td>

                  {/* Amount */}
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '500' }}>
                    {formatMoney(tx.amount)}
                  </td>

                  {/* Source */}
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor:
                          tx.source_account === 'checking'
                            ? '#d6eaf8'
                            : '#fadbd8',
                        color:
                          tx.source_account === 'checking'
                            ? '#1a5490'
                            : '#78281f',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      {tx.source_account === 'checking'
                        ? '🏦 Checking'
                        : '💳 Card'}
                    </span>
                  </td>

                  {/* Category Dropdown */}
                  <td style={tdStyle}>
                    <select
                      style={categoryDropdownStyle}
                      value={tx.category || ''}
                      onChange={e => handleCategoryChange(tx.id, e.target.value)}
                    >
                      <option value="">— Select Category —</option>
                      {ALL_PL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Confidence Indicator */}
                  <td style={tdStyle}>{getConfidenceIndicator(tx)}</td>

                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      style={approveButtonStyle}
                      onMouseEnter={e =>
                        Object.assign(e.target.style, approveButtonHoverStyle)
                      }
                      onMouseLeave={e =>
                        Object.assign(e.target.style, approveButtonStyle)
                      }
                      onClick={() => handleApproveTransaction(tx.id)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      style={smallButtonStyle}
                      onClick={() => handleCreateRule(tx.id)}
                      title="Create a rule from this transaction"
                    >
                      + Rule
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ReviewApproval;
