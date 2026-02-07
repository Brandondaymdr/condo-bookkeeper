import React, { useState } from "react";
import { createAccount, accountToBalanceSheetName } from "../models/schema.js";
import { formatMoney } from "../utils/format.js";

const TYPE_LABELS = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
};

const TYPE_COLORS = {
  checking: { bg: "#e8f5e9", color: "#2e7d32" },
  savings: { bg: "#e3f2fd", color: "#1565c0" },
  credit_card: { bg: "#fce4ec", color: "#c62828" },
};

const emptyForm = {
  name: "",
  type: "checking",
  institution: "",
  opening_balance: "",
  opening_date: new Date().toISOString().slice(0, 10),
};

const Banking = ({ store, saveData }) => {
  const accounts = store.accounts || [];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Group accounts by type
  const bankAccounts = accounts.filter(
    (a) => a.type === "checking" || a.type === "savings"
  );
  const creditCards = accounts.filter((a) => a.type === "credit_card");

  // Summary totals
  const totalBankBalance = bankAccounts.reduce(
    (sum, a) => sum + (a.opening_balance || 0),
    0
  );
  const totalCreditBalance = creditCards.reduce(
    (sum, a) => sum + (a.opening_balance || 0),
    0
  );

  const handleFormChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleAddNew = () => {
    setFormData({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (account) => {
    setFormData({
      name: account.name,
      type: account.type,
      institution: account.institution || "",
      opening_balance: account.opening_balance || 0,
      opening_date: account.opening_date || "",
    });
    setEditingId(account.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...emptyForm });
  };

  const handleSave = () => {
    // Validation
    if (!formData.name.trim()) {
      alert("Account name is required.");
      return;
    }
    if (!formData.opening_date) {
      alert("Opening date is required.");
      return;
    }

    // Check name uniqueness
    const nameExists = accounts.some(
      (a) =>
        a.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        a.id !== editingId
    );
    if (nameExists) {
      alert("An account with this name already exists.");
      return;
    }

    const balance = parseFloat(formData.opening_balance) || 0;

    let updatedAccounts;
    if (editingId) {
      // Update existing
      updatedAccounts = accounts.map((a) =>
        a.id === editingId
          ? {
              ...a,
              name: formData.name.trim(),
              type: formData.type,
              institution: formData.institution.trim(),
              opening_balance: balance,
              opening_date: formData.opening_date,
            }
          : a
      );
    } else {
      // Add new
      const newAccount = createAccount({
        name: formData.name.trim(),
        type: formData.type,
        institution: formData.institution.trim(),
        opening_balance: balance,
        opening_date: formData.opening_date,
      });
      updatedAccounts = [...accounts, newAccount];
    }

    // Sync balance_sheet_openings
    const updatedOpenings = { ...(store.balance_sheet_openings || {}) };
    for (const acct of updatedAccounts) {
      const bsName = accountToBalanceSheetName(acct);
      updatedOpenings[bsName] = acct.opening_balance || 0;
    }

    saveData({
      accounts: updatedAccounts,
      balance_sheet_openings: updatedOpenings,
    });

    handleCancel();
  };

  const handleDelete = (id) => {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;

    const updatedAccounts = accounts.filter((a) => a.id !== id);

    // Remove from balance_sheet_openings
    const bsName = accountToBalanceSheetName(account);
    const updatedOpenings = { ...(store.balance_sheet_openings || {}) };
    delete updatedOpenings[bsName];

    saveData({
      accounts: updatedAccounts,
      balance_sheet_openings: updatedOpenings,
    });
    setDeleteConfirmId(null);
  };

  const renderAccountCard = (account) => {
    const typeStyle = TYPE_COLORS[account.type] || TYPE_COLORS.checking;
    const isCredit = account.type === "credit_card";
    const bal = account.opening_balance || 0;

    return (
      <div key={account.id} style={s.accountCard}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a2e" }}>
              {account.name}
            </span>
            <span
              style={{
                ...s.typeBadge,
                backgroundColor: typeStyle.bg,
                color: typeStyle.color,
              }}
            >
              {TYPE_LABELS[account.type]}
            </span>
          </div>
          {account.institution && (
            <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>
              {account.institution}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#888" }}>
            Opened {account.opening_date || "â"}
          </div>
        </div>
        <div style={{ textAlign: "right", marginRight: 20 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: isCredit
                ? bal < 0
                  ? "#e94560"
                  : "#1a1a2e"
                : bal >= 0
                ? "#27ae60"
                : "#e94560",
            }}
          >
            {formatMoney(bal)}
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
            Opening Balance
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.editBtn} onClick={() => handleEdit(account)}>
            Edit
          </button>
          {deleteConfirmId === account.id ? (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                style={s.confirmDeleteBtn}
                onClick={() => handleDelete(account.id)}
              >
                Confirm
              </button>
              <button
                style={s.cancelBtn}
                onClick={() => setDeleteConfirmId(null)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              style={s.deleteBtn}
              onClick={() => setDeleteConfirmId(account.id)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={s.summaryCard}>
          <div style={s.summaryLabel}>Total Accounts</div>
          <div style={s.summaryValue}>{accounts.length}</div>
        </div>
        <div style={s.summaryCard}>
          <div style={s.summaryLabel}>Bank Balance</div>
          <div
            style={{
              ...s.summaryValue,
              color: totalBankBalance >= 0 ? "#27ae60" : "#e94560",
            }}
          >
            {formatMoney(totalBankBalance)}
          </div>
        </div>
        <div style={s.summaryCard}>
          <div style={s.summaryLabel}>Credit Cards</div>
          <div
            style={{
              ...s.summaryValue,
              color: totalCreditBalance <= 0 ? "#e94560" : "#27ae60",
            }}
          >
            {formatMoney(totalCreditBalance)}
          </div>
        </div>
      </div>

      {/* Add Account Button */}
      <div style={{ marginBottom: 24 }}>
        <button style={s.addBtn} onClick={handleAddNew}>
          + Add Account
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={s.formContainer}>
          <div style={s.formHeader}>
            {editingId ? "Edit Account" : "Add New Account"}
          </div>
          <div style={s.formGrid}>
            <div style={s.formGroup}>
              <label style={s.formLabel}>Account Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="e.g., Wells Fargo Checking"
                style={s.formInput}
              />
            </div>
            <div style={s.formGroup}>
              <label style={s.formLabel}>Account Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleFormChange("type", e.target.value)}
                style={s.formInput}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>
            <div style={s.formGroup}>
              <label style={s.formLabel}>Institution</label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) =>
                  handleFormChange("institution", e.target.value)
                }
                placeholder="e.g., Wells Fargo"
                style={s.formInput}
              />
            </div>
            <div style={s.formGroup}>
              <label style={s.formLabel}>Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={formData.opening_balance}
                onChange={(e) =>
                  handleFormChange("opening_balance", e.target.value)
                }
                placeholder="0.00"
                style={s.formInput}
              />
            </div>
            <div style={s.formGroup}>
              <label style={s.formLabel}>As-of Date *</label>
              <input
                type="date"
                value={formData.opening_date}
                onChange={(e) =>
                  handleFormChange("opening_date", e.target.value)
                }
                style={s.formInput}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button style={s.saveBtn} onClick={handleSave}>
              {editingId ? "Save Changes" : "Add Account"}
            </button>
            <button style={s.cancelFormBtn} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Account Lists */}
      {bankAccounts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={s.sectionHeader}>Checking & Savings</div>
          {bankAccounts.map(renderAccountCard)}
        </div>
      )}

      {creditCards.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={s.sectionHeader}>Credit Cards</div>
          {creditCards.map(renderAccountCard)}
        </div>
      )}

      {accounts.length === 0 && !showForm && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#888",
            fontSize: 15,
          }}
        >
          No accounts yet. Click "+ Add Account" to get started.
        </div>
      )}
    </div>
  );
};

// âââ Styles ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const s = {
  summaryCard: {
    background: "#fff",
    borderRadius: 8,
    padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  addBtn: {
    backgroundColor: "#0f3460",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1a1a2e",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "2px solid #1a1a2e",
  },
  accountCard: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: "16px 20px",
    borderRadius: 6,
    marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    border: "1px solid #eee",
  },
  typeBadge: {
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  editBtn: {
    backgroundColor: "#0f3460",
    color: "white",
    border: "none",
    padding: "6px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  deleteBtn: {
    backgroundColor: "#e94560",
    color: "white",
    border: "none",
    padding: "6px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  confirmDeleteBtn: {
    backgroundColor: "#c62828",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  cancelBtn: {
    backgroundColor: "#888",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
  },
  formContainer: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 6,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #ddd",
  },
  formHeader: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1a1a2e",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "1px solid #eee",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 6,
  },
  formInput: {
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 14,
    fontFamily: "inherit",
  },
  saveBtn: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "10px 24px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  cancelFormBtn: {
    backgroundColor: "transparent",
    color: "#888",
    border: "1px solid #ccc",
    padding: "10px 24px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
  },
};

export default Banking;
