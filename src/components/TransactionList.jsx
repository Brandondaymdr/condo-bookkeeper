import React, { useState, useMemo } from 'react';
import { ALL_PL_CATEGORIES } from '../models/categories.js';
import { formatMoney, formatDate } from '../utils/format.js';

export default function TransactionList({ store, saveData }) {
  // State
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const itemsPerPage = 25;

  // Get unique categories for filter dropdown
  const categoryOptions = useMemo(() => {
    const cats = new Set(store.transactions.map(t => t.category).filter(Boolean));
    return ['All', ...Array.from(cats).sort()];
  }, [store.transactions]);

  // Filter and search transactions
  const filtered = useMemo(() => {
    let result = store.transactions.filter(t => {
      // Search filter
      if (searchText && !t.description.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      // Type filter
      if (filterType !== 'All' && t.type !== filterType) {
        return false;
      }
      // Category filter
      if (filterCategory !== 'All' && t.category !== filterCategory) {
        return false;
      }
      // Source filter
      if (filterSource !== 'All' && t.source !== filterSource) {
        return false;
      }
      // Status filter
      if (filterStatus !== 'All' && (t.approved ? 'Approved' : 'Pending') !== filterStatus) {
        return false;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'date':
          aVal = new Date(a.date);
          bVal = new Date(b.date);
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'description':
          aVal = a.description.toLowerCase();
          bVal = b.description.toLowerCase();
          break;
        default:
          aVal = new Date(a.date);
          bVal = new Date(b.date);
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [store.transactions, searchText, filterType, filterCategory, filterSource, filterStatus, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate summary stats
  const stats = useMemo(() => {
    const revenue = store.transactions
      .filter(t => t.type === 'Revenue')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const expenses = store.transactions
      .filter(t => t.type === 'Expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return {
      count: store.transactions.length,
      revenue,
      expenses,
      net: revenue - expenses
    };
  }, [store.transactions]);

  // Handler: Edit transaction
  const handleStartEdit = (transaction) => {
    setEditingId(transaction.id);
    setEditingData({ ...transaction });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleSaveEdit = () => {
    const updated = store.transactions.map(t =>
      t.id === editingId ? editingData : t
    );
    store.transactions = updated;
    saveData();
    setEditingId(null);
    setEditingData({});
  };

  // Handler: Delete transaction
  const handleDelete = (id) => {
    store.transactions = store.transactions.filter(t => t.id !== id);
    saveData();
    setDeleteConfirmId(null);
  };

  // Handler: Sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Render sort indicator
  const SortIndicator = ({ field }) => {
    if (sortBy !== field) return <span style={{ opacity: 0.3 }}>▼</span>;
    return <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={statBoxStyle}>
          <div style={{ color: '#666', fontSize: '14px' }}>Total Transactions</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{stats.count}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ color: '#666', fontSize: '14px' }}>Total Revenue</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2ecc71' }}>+{formatMoney(stats.revenue)}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ color: '#666', fontSize: '14px' }}>Total Expenses</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>-{formatMoney(stats.expenses)}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ color: '#666', fontSize: '14px' }}>Net</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: stats.net >= 0 ? '#2ecc71' : '#e74c3c' }}>
            {formatMoney(stats.net)}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Search by description..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px'
        }}>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            style={selectStyle}
          >
            <option>All Types</option>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setCurrentPage(1);
            }}
            style={selectStyle}
          >
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>

          <select
            value={filterSource}
            onChange={(e) => {
              setFilterSource(e.target.value);
              setCurrentPage(1);
            }}
            style={selectStyle}
          >
            <option value="All">All Sources</option>
            <option value="Checking">Checking</option>
            <option value="Credit Card">Credit Card</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={selectStyle}
          >
            <option value="All">All Status</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#003366', color: 'white' }}>
              <th style={headerCellStyle} onClick={() => handleSort('date')} title="Click to sort">
                Date <SortIndicator field="date" />
              </th>
              <th style={headerCellStyle} onClick={() => handleSort('description')} title="Click to sort">
                Description <SortIndicator field="description" />
              </th>
              <th style={headerCellStyle} onClick={() => handleSort('amount')} title="Click to sort">
                Amount <SortIndicator field="amount" />
              </th>
              <th style={headerCellStyle}>Type</th>
              <th style={headerCellStyle}>Category</th>
              <th style={headerCellStyle}>Source</th>
              <th style={headerCellStyle}>Status</th>
              <th style={headerCellStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((transaction, idx) => {
              const isEditing = editingId === transaction.id;
              const isEven = idx % 2 === 0;

              return (
                <tr
                  key={transaction.id}
                  style={{
                    backgroundColor: isEven ? '#ffffff' : '#f9f9f9',
                    borderBottom: '1px solid #e0e0e0',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f4f8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isEven ? '#ffffff' : '#f9f9f9'; }}
                >
                  <td style={cellStyle}>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editingData.date}
                        onChange={(e) => setEditingData({ ...editingData, date: e.target.value })}
                        style={inputStyle}
                      />
                    ) : (
                      formatDate(transaction.date)
                    )}
                  </td>
                  <td style={cellStyle}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingData.description}
                        onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                        style={inputStyle}
                      />
                    ) : (
                      transaction.description
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editingData.amount}
                        onChange={(e) => setEditingData({ ...editingData, amount: parseFloat(e.target.value) })}
                        style={inputStyle}
                      />
                    ) : (
                      <span style={{ color: transaction.type === 'Revenue' ? '#2ecc71' : '#e74c3c' }}>
                        {transaction.type === 'Revenue' ? '+' : '-'}{formatMoney(transaction.amount)}
                      </span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {isEditing ? (
                      <select
                        value={editingData.type}
                        onChange={(e) => setEditingData({ ...editingData, type: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="Revenue">Revenue</option>
                        <option value="Expense">Expense</option>
                        <option value="Transfer">Transfer</option>
                      </select>
                    ) : (
                      transaction.type
                    )}
                  </td>
                  <td style={cellStyle}>
                    {isEditing ? (
                      <select
                        value={editingData.category || ''}
                        onChange={(e) => setEditingData({ ...editingData, category: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">None</option>
                        {ALL_PL_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      transaction.category || '-'
                    )}
                  </td>
                  <td style={cellStyle}>{transaction.source || '-'}</td>
                  <td style={cellStyle}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: transaction.approved ? '#d4edda' : '#fff3cd',
                      fontSize: '13px'
                    }}>
                      {transaction.approved ? '✓' : '⏱'}
                      {transaction.approved ? 'Approved' : 'Pending'}
                    </div>
                  </td>
                  <td style={cellStyle}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={handleSaveEdit}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#2ecc71',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#999',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleStartEdit(transaction)}
                          style={actionButtonStyle}
                        >
                          Edit
                        </button>
                        {deleteConfirmId === transaction.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              style={{
                                ...actionButtonStyle,
                                backgroundColor: '#e74c3c',
                                fontSize: '11px'
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              style={{
                                ...actionButtonStyle,
                                backgroundColor: '#999',
                                fontSize: '11px'
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(transaction.id)}
                            style={{
                              ...actionButtonStyle,
                              backgroundColor: '#e74c3c'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 0'
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} transactions
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === 1 ? '#ddd' : '#003366',
              color: currentPage === 1 ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'default' : 'pointer'
            }}
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{
                padding: '8px 12px',
                backgroundColor: page === currentPage ? '#003366' : '#f0f0f0',
                color: page === currentPage ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === totalPages ? '#ddd' : '#003366',
              color: currentPage === totalPages ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'default' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline styles
const statBoxStyle = {
  padding: '15px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  border: '1px solid #e0e0e0'
};

const selectStyle = {
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer'
};

const headerCellStyle = {
  padding: '12px 15px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '14px',
  cursor: 'pointer',
  userSelect: 'none'
};

const cellStyle = {
  padding: '12px 15px',
  fontSize: '13px',
  color: '#333'
};

const inputStyle = {
  padding: '6px 8px',
  fontSize: '13px',
  border: '1px solid #003366',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box'
};

const actionButtonStyle = {
  padding: '6px 10px',
  fontSize: '12px',
  backgroundColor: '#003366',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background-color 0.2s'
};
