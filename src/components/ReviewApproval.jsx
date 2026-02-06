import React, { useState, useMemo } from 'react';
import {
  ALL_REVENUE_NAMES,
  ALL_EXPENSE_NAMES,
  getCategoryType,
} from '../models/categories.js';
import {
  categorizeAll,
  updateLearnedPatterns,
  batchUpdateLearnedPatterns,
} from '../engines/categorize.js';
import { createRule } from '../models/schema.js';
import { formatMoney, formatDate } from '../utils/format.js';

const ReviewApproval = ({ store, saveData }) => {
  // State for bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // State for search/filter
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // State for bulk category assignment
  const [bulkCategory, setBulkCategory] = useState('');

  // Get unapproved, non-transfer transactions
  const unapprovedTxs = useMemo(() => {
    let txs = store.transactions.filter(
      tx => !tx.approved && tx.type !== 'transfer'
    );

    // Apply search filter
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      txs = txs.filter(
        tx =>
          (tx.description || '').toLowerCase().includes(q) ||
          (tx.original_description || '').toLowerCase().includes(q) ||
          (tx.category || '').toLowerCase().includes(q) ||
          (tx.vendor_key || '').toLowerCase().includes(q)
      );
    }

    // Apply sorting
    txs.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = (a.date || '').localeCompare(b.date || '');
          break;
        case 'description':
          cmp = (a.description || '').localeCompare(b.description || '');
          break;
        case 'amount':
          cmp = (a.amount || 0) - (b.amount || 0);
          break;
        case 'category':
          cmp = (a.category || '').localeCompare(b.category || '');
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return txs;
  }, [store.transactions, searchText, sortField, sortDir]);

  // Count stats
  const totalPending = store.transactions.filter(
    tx => !tx.approved && tx.type !== 'transfer'
  ).length;
  const categorizedCount = unapprovedTxs.filter(tx => tx.category).length;
  const uncategorizedCount = unapprovedTxs.length - categorizedCount;

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Sort handler
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleSort = field => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  };

  const sortIndicator = field => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' â²' : ' â¼';
  };

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Helper: Get confidence indicator styling
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
        {tx.category ? 'Manual' : 'None'}
      </span>
    );
  };

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle single transaction approval
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle category change for a transaction (with type auto-detect)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleCategoryChange = (txId, newCategory) => {
    const tx = store.transactions.find(t => t.id === txId);
    if (!tx) return;

    // Auto-detect type from the selected category
    const detectedType = getCategoryType(newCategory);
    const newType = detectedType === 'revenue' ? 'revenue' : detectedType === 'expense' ? 'expense' : tx.type;

    // If category changed from the suggestion, mark as manual
    const isCategoryChanged = newCategory && newCategory !== tx.category;
    const newCategorization_source = isCategoryChanged ? 'manual' : tx.categorization_source;

    const updatedTx = {
      ...tx,
      category: newCategory,
      type: newType,
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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle "Create Rule" action
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleCreateRule = txId => {
    const tx = store.transactions.find(t => t.id === txId);
    if (!tx || !tx.category) {
      alert('Please assign a category before creating a rule.');
      return;
    }

    // Check for duplicate rule
    const vendorKey = tx.vendor_key || tx.description;
    const existingRule = store.rules.find(
      r => r.match.toLowerCase() === vendorKey.toLowerCase() && r.active
    );
    if (existingRule) {
      alert(`Rule already exists: "${existingRule.match}" â "${existingRule.category}"`);
      return;
    }

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
    alert(`Rule created: "${vendorKey}" â "${tx.category}"`);
  };

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle "Approve Selected" bulk action
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleApproveSelected = () => {
    if (selectedIds.size === 0) {
      alert('No transactions selected. Use checkboxes to select transactions.');
      return;
    }

    const selectedTxs = unapprovedTxs.filter(tx => selectedIds.has(tx.id));
    const uncategorized = selectedTxs.filter(tx => !tx.category);
    if (uncategorized.length > 0) {
      const proceed = confirm(
        `${uncategorized.length} selected transaction(s) have no category assigned. Approve anyway?`
      );
      if (!proceed) return;
    }

    const approved = selectedTxs.map(tx => ({ ...tx, approved: true }));
    let newPatterns = batchUpdateLearnedPatterns(approved, store.learned_patterns);

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle "Approve All" bulk action
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleApproveAll = () => {
    if (unapprovedTxs.length === 0) {
      alert('No transactions to approve.');
      return;
    }

    const uncategorized = unapprovedTxs.filter(tx => !tx.category);
    if (uncategorized.length > 0) {
      const proceed = confirm(
        `${uncategorized.length} transaction(s) have no category assigned. Approve all anyway?`
      );
      if (!proceed) return;
    }

    const approved = unapprovedTxs.map(tx => ({ ...tx, approved: true }));
    let newPatterns = batchUpdateLearnedPatterns(approved, store.learned_patterns);

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle "Approve High Confidence" bulk action
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleApproveHighConfidence = () => {
    const highConfidence = unapprovedTxs.filter(
      tx => tx.confidence === 'high' || tx.categorization_source === 'rule'
    );

    if (highConfidence.length === 0) {
      alert('No high-confidence transactions to approve.');
      return;
    }

    const approved = highConfidence.map(tx => ({ ...tx, approved: true }));
    let newPatterns = batchUpdateLearnedPatterns(approved, store.learned_patterns);

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle "Re-apply All Rules" action
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleReapplyRules = () => {
    const unapproved = store.transactions.filter(tx => !tx.approved);
    if (unapproved.length === 0) {
      alert('No unapproved transactions to re-categorize.');
      return;
    }

    const proceed = confirm(
      `Re-apply all ${store.rules.length} rules to ${unapproved.length} unapproved transactions? This will overwrite current category suggestions (but not manually set categories).`
    );
    if (!proceed) return;

    // Re-categorize unapproved transactions only
    const recategorized = categorizeAll(
      unapproved,
      store.rules,
      store.learned_patterns
    );

    // Merge back â only update unapproved transactions, preserve approved ones
    const unapprovedIds = new Set(unapproved.map(tx => tx.id));
    const recatMap = new Map(recategorized.map(tx => [tx.id, tx]));

    const updatedTransactions = store.transactions.map(t => {
      if (unapprovedIds.has(t.id)) {
        const recat = recatMap.get(t.id);
        // Don't overwrite if user manually set the category
        if (t.categorization_source === 'manual' && t.category) {
          return t;
        }
        return recat || t;
      }
      return t;
    });

    const newCategorized = updatedTransactions.filter(
      tx => !tx.approved && tx.category && tx.categorization_source
    ).length;

    const updatedStore = {
      ...store,
      transactions: updatedTransactions,
    };

    saveData(updatedStore);
    alert(`Done! ${newCategorized} unapproved transactions now have category suggestions.`);
  };

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle bulk category assignment
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleBulkCategoryApply = () => {
    if (selectedIds.size === 0) {
      alert('No transactions selected.');
      return;
    }
    if (!bulkCategory) {
      alert('Please select a category first.');
      return;
    }

    const detectedType = getCategoryType(bulkCategory);
    const newType = detectedType === 'revenue' ? 'revenue' : detectedType === 'expense' ? 'expense' : 'expense';

    const updatedTransactions = store.transactions.map(t => {
      if (selectedIds.has(t.id)) {
        return {
          ...t,
          category: bulkCategory,
          type: newType,
          categorization_source: 'manual',
        };
      }
      return t;
    });

    const updatedStore = {
      ...store,
      transactions: updatedTransactions,
    };

    saveData(updatedStore);
    alert(`Applied "${bulkCategory}" to ${selectedIds.size} transaction(s).`);
    setBulkCategory('');
  };

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Handle checkbox toggle
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleToggleRow = txId => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      setSelectAll(newSet.size === unapprovedTxs.length && unapprovedTxs.length > 0);
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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Category dropdown with optgroup
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const CategorySelect = ({ value, onChange, style }) => (
    <select style={style} value={value || ''} onChange={onChange}>
      <option value="">-- Select Category --</option>
      <optgroup label="Revenue">
        {ALL_REVENUE_NAMES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </optgroup>
      <optgroup label="Expenses">
        {ALL_EXPENSE_NAMES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </optgroup>
    </select>
  );

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Styling constants
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const headerStyle = {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: '16px',
    borderRadius: '4px 4px 0 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const toolbarStyle = {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '12px 16px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
  };

  const bulkBarStyle = {
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    padding: '10px 16px',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  };

  const buttonStyle = {
    padding: '7px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  };

  const approveButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#27ae60',
    color: '#fff',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ecf0f1',
    color: '#2c3e50',
    border: '1px solid #d5dbdb',
  };

  const warningButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#f39c12',
    color: '#fff',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    borderRadius: '0 0 4px 4px',
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
    padding: '10px 8px',
    textAlign: 'left',
    borderBottom: '2px solid #ecf0f1',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const tdStyle = {
    padding: '10px 8px',
    borderBottom: '1px solid #ecf0f1',
    fontSize: '13px',
  };

  const rowStyle = (index, isSelected) => ({
    backgroundColor: isSelected ? '#e8f8f5' : index % 2 === 0 ? '#fff' : '#f9f9f9',
    transition: 'background-color 0.15s',
  });

  const checkboxStyle = {
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  };

  const smallButtonStyle = {
    padding: '4px 8px',
    fontSize: '11px',
    marginLeft: '4px',
    border: '1px solid #bdc3c7',
    backgroundColor: '#ecf0f1',
    borderRadius: '3px',
    cursor: 'pointer',
    color: '#2c3e50',
  };

  const categoryDropdownStyle = {
    padding: '5px 4px',
    fontSize: '12px',
    border: '1px solid #bdc3c7',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
    maxWidth: '180px',
  };

  const searchInputStyle = {
    padding: '7px 12px',
    fontSize: '13px',
    border: '1px solid #d5dbdb',
    borderRadius: '4px',
    width: '240px',
    fontFamily: 'inherit',
  };

  const statBadgeStyle = (color) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: color,
    color: '#fff',
    marginRight: '8px',
  });

  const containerStyle = {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={{ margin: '0', fontSize: '18px', fontWeight: '600' }}>
          Transaction Review & Approval
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={statBadgeStyle('#f39c12')}>{totalPending} pending</span>
          <span style={statBadgeStyle('#27ae60')}>{categorizedCount} categorized</span>
          <span style={statBadgeStyle('#e74c3c')}>{uncategorizedCount} need category</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={toolbarStyle}>
        <input
          type="text"
          placeholder="Search descriptions, categories..."
          style={searchInputStyle}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        <button
          style={warningButtonStyle}
          onClick={handleReapplyRules}
          title="Re-run all categorization rules on unapproved transactions"
        >
          Re-apply All Rules
        </button>
        {searchText && (
          <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
            Showing {unapprovedTxs.length} of {totalPending} transactions
          </span>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <div style={bulkBarStyle}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={checkboxStyle}
              checked={selectAll}
              onChange={handleToggleSelectAll}
            />
            <span style={{ fontSize: '13px', fontWeight: '500' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select All'}
            </span>
          </label>

          <span style={{ color: '#bdc3c7' }}>|</span>

          <button style={approveButtonStyle} onClick={handleApproveSelected}
            disabled={selectedIds.size === 0}>
            Approve Selected ({selectedIds.size})
          </button>
          <button style={secondaryButtonStyle} onClick={handleApproveHighConfidence}>
            Approve High Confidence
          </button>
          <button style={secondaryButtonStyle} onClick={handleApproveAll}>
            Approve All
          </button>
        </div>

        {/* Bulk category assignment */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Bulk assign:</span>
            <CategorySelect
              value={bulkCategory}
              onChange={e => setBulkCategory(e.target.value)}
              style={{ ...categoryDropdownStyle, maxWidth: '160px' }}
            />
            <button
              style={{ ...secondaryButtonStyle, padding: '5px 10px', fontSize: '12px' }}
              onClick={handleBulkCategoryApply}
            >
              Apply to {selectedIds.size}
            </button>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      {unapprovedTxs.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7f8c8d', backgroundColor: '#fff', borderRadius: '0 0 4px 4px' }}>
          {searchText ? 'No transactions match your search.' : 'All transactions have been approved!'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead style={theadStyle}>
              <tr>
                <th style={{ ...thStyle, width: '36px', cursor: 'default' }}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={selectAll}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th style={{ ...thStyle, width: '90px' }} onClick={() => handleSort('date')}>
                  Date{sortIndicator('date')}
                </th>
                <th style={{ ...thStyle, width: '220px' }} onClick={() => handleSort('description')}>
                  Description{sortIndicator('description')}
                </th>
                <th style={{ ...thStyle, width: '90px', textAlign: 'right' }} onClick={() => handleSort('amount')}>
                  Amount{sortIndicator('amount')}
                </th>
                <th style={{ ...thStyle, width: '70px', cursor: 'default' }}>Source</th>
                <th style={{ ...thStyle, width: '180px' }} onClick={() => handleSort('category')}>
                  Category{sortIndicator('category')}
                </th>
                <th style={{ ...thStyle, width: '80px', cursor: 'default' }}>Confidence</th>
                <th style={{ ...thStyle, width: '120px', textAlign: 'center', cursor: 'default' }}>Actions</th>
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
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>

                    {/* Description (cleaned) */}
                    <td style={tdStyle}>
                      <span title={tx.original_description} style={{ display: 'block', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || tx.original_description}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: '500',
                      color: tx.type === 'revenue' ? '#27ae60' : '#2c3e50',
                    }}>
                      {tx.type === 'revenue' ? '+' : ''}{formatMoney(tx.amount)}
                    </td>

                    {/* Source */}
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor:
                            tx.source_account === 'checking' ? '#d6eaf8' : '#fadbd8',
                          color:
                            tx.source_account === 'checking' ? '#1a5490' : '#78281f',
                          fontSize: '11px',
                          fontWeight: '500',
                        }}
                      >
                        {tx.source_account === 'checking' ? 'Checking' : 'Card'}
                      </span>
                    </td>

                    {/* Category Dropdown */}
                    <td style={tdStyle}>
                      <CategorySelect
                        value={tx.category}
                        onChange={e => handleCategoryChange(tx.id, e.target.value)}
                        style={categoryDropdownStyle}
                      />
                    </td>

                    {/* Confidence Indicator */}
                    <td style={tdStyle}>{getConfidenceIndicator(tx)}</td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        style={{ ...approveButtonStyle, padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleApproveTransaction(tx.id)}
                        title="Approve this transaction"
                      >
                        Approve
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
        </div>
      )}
    </div>
  );
};

export default ReviewApproval;
