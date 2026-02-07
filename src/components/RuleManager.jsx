import React, { useState, useMemo } from 'react';
import { ALL_PL_CATEGORIES, ALL_REVENUE_NAMES, ALL_EXPENSE_NAMES } from '../models/categories.js';
import { createRule } from '../models/schema.js';
import { categorizeAll } from '../engines/categorize.js';

export default function RuleManager({ store, saveData }) {
  // State
  const [activeTab, setActiveTab] = useState('explicit');
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleForm, setNewRuleForm] = useState({
    matchText: '',
    type: 'Expense',
    category: '',
    matchType: 'contains'
  });
  const [promotePatternId, setPromotePatternId] = useState(null);

  // Get all types for dropdowns
  const typeOptions = ['Revenue', 'Expense', 'Transfer'];

  // Format date for last used
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Handler: Add explicit rule
  const handleAddRule = () => {
    if (!newRuleForm.matchText.trim() || !newRuleForm.category) {
      alert('Please fill in match text and category');
      return;
    }

    const newRule = createRule({
      matchText: newRuleForm.matchText,
      type: newRuleForm.type,
      category: newRuleForm.category,
      matchType: newRuleForm.matchType,
      active: true
    });

    if (!store.rules) store.rules = [];
    store.rules.push(newRule);
    saveData();

    setNewRuleForm({ matchText: '', type: 'Expense', category: '', matchType: 'contains' });
    setShowAddForm(false);
  };

  // Handler: Edit rule
  const handleStartEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setEditingData({ ...rule });
  };

  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setEditingData({});
  };

  const handleSaveEditRule = () => {
    const updated = (store.rules || []).map(r =>
      r.id === editingRuleId ? editingData : r
    );
    store.rules = updated;
    saveData();
    setEditingRuleId(null);
    setEditingData({});
  };

  // Handler: Delete rule
  const handleDeleteRule = (id) => {
    store.rules = (store.rules || []).filter(r => r.id !== id);
    saveData();
    setDeleteConfirmId(null);
  };

  // Handler: Delete learned pattern
  const handleDeletePattern = (vendorKey) => {
    if (!store.learnedPatterns) return;
    delete store.learnedPatterns[vendorKey];
    saveData();
  };

  // Handler: Re-apply rules
  const handleReapplyRules = () => {
    if (window.confirm('Re-apply all rules to unapproved transactions? This will categorize them based on current rules.')) {
      categorizeAll(store);
      saveData();
      alert('Rules applied successfully!');
    }
  };

  // Handler: Promote pattern to rule
  const handlePromotePattern = (vendorKey, pattern) => {
    const newRule = createRule({
      matchText: vendorKey,
      type: pattern.type,
      category: pattern.category,
      matchType: 'exact',
      active: true
    });

    if (!store.rules) store.rules = [];
    store.rules.push(newRule);
    saveData();
    setPromotePatternId(null);
    alert(`Pattern "${vendorKey}" promoted to explicit rule!`);
  };

  // Get explicit rules
  const rules = useMemo(() => store.rules || [], [store.rules]);

  // Get learned patterns
  const patterns = useMemo(() => {
    if (!store.learnedPatterns) return [];
    return Object.entries(store.learnedPatterns).map(([vendorKey, pattern]) => ({
      vendorKey,
      ...pattern
    }));
  }, [store.learnedPatterns]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e0e0e0',
        marginBottom: '30px'
      }}>
        <button
          onClick={() => setActiveTab('explicit')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'explicit' ? '#003366' : 'transparent',
            color: activeTab === 'explicit' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'explicit' ? '3px solid #003366' : 'none'
          }}
        >
          Explicit Rules ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('learned')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: activeTab === 'learned' ? '#003366' : 'transparent',
            color: activeTab === 'learned' ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'learned' ? '3px solid #003366' : 'none'
          }}
        >
          Learned Patterns ({patterns.length})
        </button>
      </div>

      {/* EXPLICIT RULES TAB */}
      {activeTab === 'explicit' && (
        <div>
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                padding: '10px 16px',
                backgroundColor: '#003366',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              {showAddForm ? '✕ Cancel' : '+ Add Rule'}
            </button>
            <button
              onClick={handleReapplyRules}
              style={{
                padding: '10px 16px',
                backgroundColor: '#1fa64d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              ↻ Re-apply Rules
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddForm && (
            <div style={{
              backgroundColor: '#f9f9f9',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Match Text</label>
                  <input
                    type="text"
                    placeholder="e.g., Amazon, Utility"
                    value={newRuleForm.matchText}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, matchText: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Type</label>
                  <select
                    value={newRuleForm.type}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, type: e.target.value })}
                    style={selectStyle}
                  >
                    {typeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select
                    value={newRuleForm.category}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, category: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">Select category</option>
                    {ALL_PL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Match Type</label>
                  <select
                    value={newRuleForm.matchType}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, matchType: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="contains">Contains</option>
                    <option value="exact">Exact Match</option>
                    <option value="starts">Starts With</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddRule}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2ecc71',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                Create Rule
              </button>
            </div>
          )}

          {/* Rules Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#003366', color: 'white' }}>
                  <th style={headerCellStyle}>Match Text</th>
                  <th style={headerCellStyle}>Type</th>
                  <th style={headerCellStyle}>Category</th>
                  <th style={headerCellStyle}>Match Type</th>
                  <th style={{ ...headerCellStyle, width: '80px', textAlign: 'center' }}>Active</th>
                  <th style={headerCellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, idx) => {
                  const isEditing = editingRuleId === rule.id;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={rule.id}
                      style={{
                        backgroundColor: isEven ? '#ffffff' : '#f9f9f9',
                        borderBottom: '1px solid #e0e0e0'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f4f8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isEven ? '#ffffff' : '#f9f9f9'; }}
                    >
                      <td style={cellStyle}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingData.matchText || editingData.match}
                            onChange={(e) => setEditingData({ ...editingData, matchText: e.target.value })}
                            style={inputStyle}
                          />
                        ) : (
                          <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>
                            {rule.matchText || rule.match}
                          </code>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {isEditing ? (
                          <select
                            value={editingData.type}
                            onChange={(e) => setEditingData({ ...editingData, type: e.target.value })}
                            style={selectStyle}
                          >
                            {typeOptions.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        ) : (
                          rule.type
                        )}
                      </td>
                      <td style={cellStyle}>
                        {isEditing ? (
                          <select
                            value={editingData.category}
                            onChange={(e) => setEditingData({ ...editingData, category: e.target.value })}
                            style={selectStyle}
                          >
                            <option value="">None</option>
                            {ALL_PL_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          editingData.category || rule.category || '-'
                        )}
                      </td>
                      <td style={cellStyle}>
                        {isEditing ? (
                          <select
                            value={editingData.matchType || editingData.match_type}
                            onChange={(e) => setEditingData({ ...editingData, matchType: e.target.value })}
                            style={selectStyle}
                          >
                            <option value="contains">Contains</option>
                            <option value="exact">Exact Match</option>
                            <option value="starts">Starts With</option>
                          </select>
                        ) : (
                          rule.matchType || rule.match_type
                        )}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editingData.active}
                            onChange={(e) => setEditingData({ ...editingData, active: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div style={{
                            display: 'inline-block',
                            width: '16px',
                            height: '16px',
                            borderRadius: '3px',
                            backgroundColor: rule.active ? '#2ecc71' : '#ccc',
                            color: 'white',
                            textAlign: 'center',
                            lineHeight: '16px',
                            fontSize: '12px'
                          }}>
                            {rule.active ? '✓' : '-'}
                          </div>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={handleSaveEditRule}
                              style={{
                                padding: '6px 10px',
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
                              onClick={handleCancelEditRule}
                              style={{
                                padding: '6px 10px',
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
                              onClick={() => handleStartEditRule(rule)}
                              style={actionButtonStyle}
                            >
                              Edit
                            </button>
                            {deleteConfirmId === rule.id ? (
                              <>
                                <button
                                  onClick={() => handleDeleteRule(rule.id)}
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
                                onClick={() => setDeleteConfirmId(rule.id)}
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

          {rules.length === 0 && !showAddForm && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#999'
            }}>
              No explicit rules yet. Click "Add Rule" to create one.
            </div>
          )}
        </div>
      )}

      {/* LEARNED PATTERNS TAB */}
      {activeTab === 'learned' && (
        <div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#003366', color: 'white' }}>
                  <th style={headerCellStyle}>Vendor Key</th>
                  <th style={headerCellStyle}>Type</th>
                  <th style={headerCellStyle}>Category</th>
                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>Times Used</th>
                  <th style={{ ...headerCellStyle, textAlign: 'right' }}>Confidence</th>
                  <th style={headerCellStyle}>Last Used</th>
                  <th style={headerCellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patterns
                  .sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0))
                  .map((pattern, idx) => {
                    const isEven = idx % 2 === 0;
                    const confidence = pattern.confidence || 0;
                    const confidenceColor = confidence >= 0.9 ? '#2ecc71' : confidence >= 0.7 ? '#f39c12' : '#e74c3c';

                    return (
                      <tr
                        key={pattern.vendorKey}
                        style={{
                          backgroundColor: isEven ? '#ffffff' : '#f9f9f9',
                          borderBottom: '1px solid #e0e0e0'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f4f8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isEven ? '#ffffff' : '#f9f9f9'; }}
                      >
                        <td style={cellStyle}>
                          <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>
                            {pattern.vendorKey}
                          </code>
                        </td>
                        <td style={cellStyle}>{pattern.type}</td>
                        <td style={cellStyle}>{pattern.category || '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'right' }}>{pattern.timesUsed || 0}</td>
                        <td style={{ ...cellStyle, textAlign: 'right' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            backgroundColor: confidenceColor + '20',
                            color: confidenceColor,
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {(confidence * 100).toFixed(0)}%
                          </div>
                        </td>
                        <td style={cellStyle}>{formatDate(pattern.lastUsed)}</td>
                        <td style={cellStyle}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handlePromotePattern(pattern.vendorKey, pattern)}
                              style={{
                                padding: '6px 10px',
                                fontSize: '12px',
                                backgroundColor: '#1fa64d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Promote
                            </button>
                            {promotePatternId === pattern.vendorKey ? (
                              <>
                                <button
                                  onClick={() => handleDeletePattern(pattern.vendorKey)}
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    backgroundColor: '#e74c3c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setPromotePatternId(null)}
                                  style={{
                                    padding: '6px 10px',
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
                              </>
                            ) : (
                              <button
                                onClick={() => setPromotePatternId(pattern.vendorKey)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  backgroundColor: '#e74c3c',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {patterns.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#999'
            }}>
              No learned patterns yet. Patterns will appear as you categorize transactions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline styles
const headerCellStyle = {
  padding: '12px 15px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '14px'
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

const selectStyle = {
  padding: '6px 8px',
  fontSize: '13px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'white',
  cursor: 'pointer'
};

const actionButtonStyle = {
  padding: '6px 10px',
  fontSize: '12px',
  backgroundColor: '#003366',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};
