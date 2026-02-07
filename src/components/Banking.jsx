import React, { useState } from "react";
import { createAccount, accountToBalanceSheetName, createTransaction } from "../models/schema.js";
import { formatMoney, formatDate } from "../utils/format.js";
import { ALL_PL_CATEGORIES } from "../models/categories.js";

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

const TX_TYPE_LABELS = {
  revenue: "Revenue",
  expense: "Expense",
  transfer: "Transfer",
};

const TX_STATUS_LABELS = {
  true: "Approved",
  false: "Pending",
};

const emptyForm = {
  name: "",
  type: "checking",
  institution: "",
  opening_balance: "",
  opening_date: new Date().toISOString().slice(0, 10),
};

const emptyTxForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  type: "expense",
  category: "",
};

const Banking = ({ store, saveData }) => {
  const accounts = store.accounts || [];
  const transactions = store.transactions || [];

  // Account form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Transaction drill-down state
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [showAddTx, setShowAddTx] = useState(false);
  const [txEditingId, setTxEditingId] = useState(null);
  const [txEditingData, setTxEditingData] = useState({});
  const [txFormData, setTxFormData] = useState({ ...emptyTxForm });
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState(null);

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

  // ─── Account Form Handlers ──────────────────────────────────────
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

  // ─── Transaction Handlers ──────────────────────────────────────
  const handleTxFormChange = (field, value) => {
    setTxFormData({ ...txFormData, [field]: value });
  };

  const handleAddTransaction = () => {
    setTxFormData({ ...emptyTxForm });
    setTxEditingId(null);
    setShowAddTx(true);
  };

  const handleTxCancel = () => {
    setShowAddTx(false);
    setTxEditingId(null);
    setTxEditingData({});
    setTxFormData({ ...emptyTxForm });
  };

  const handleTxSave = () => {
    if (!txFormData.date.trim()) {
      alert("Date is required.");
      return;
    }
    if (!txFormData.description.trim()) {
      alert("Description is required.");
      return;
    }
    if (!txFormData.amount || parseFloat(txFormData.amount) <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    if (!selectedAccount) return;

    const amount = Math.abs(parseFloat(txFormData.amount));

    if (txEditingId) {
      // Update existing transaction
      const updatedTransactions = transactions.map((t) =>
        t.id === txEditingId
          ? {
              ...t,
              date: txFormData.date,
              description: txFormData.description.trim(),
              amount: amount,
              type: txFormData.type,
              category: txFormData.category.trim() || null,
            }
          : t
      );
      saveData({ transactions: updatedTransactions });
    } else {
      // Add new transaction
      const newTx = createTransaction({
        account_id: selectedAccountId,
        date: txFormData.date,
        description: txFormData.description.trim(),
        amount: amount,
        type: txFormData.type,
        category: txFormData.category.trim() || null,
        source_account: selectedAccount.name,
        import_date: new Date().toISOString().slice(0, 10),
        approved: false,
      });
      saveData({ transactions: [...transactions, newTx] });
    }

    handleTxCancel();
  };

  const handleTxEdit = (tx) => {
    setTxEditingData({
      ...tx,
      amount: Math.abs(tx.amount),
    });
    setTxEditingId(tx.id);
    setTxFormData({
      date: tx.date,
      description: tx.description,
      amount: Math.abs(tx.amount).toString(),
      type: tx.type,
      category: tx.category || "",
    });
  };

  const handleTxDelete = (id) => {
    const updatedTransactions = transactions.filter((t) => t.id !== id);
    saveData({ transactions: updatedTransactions });
    setTxDeleteConfirmId(null);
  };

  // ─── Rendering ──────────────────────────────────────────────────────────
  const renderAccountCard = (account) => {
    const typeStyle = TYPE_COLORS[account.type] || TYPE_COLORS.checking;
    const isCredit = account.type === "credit_card";
    const bal = account.opening_balance || 0;

    return (
      <div key={account.id} style={s.accountCardWrapper}>
        <div
          style={s.accountCard}
          onClick={() => setSelectedAccountId(account.id)}
        >
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
              Opened {account.opening_date || "—"}
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
          <div style={{ fontSize: 20, color: "#0f3460", marginRight: 12 }}>›</div>
        </div>
        <div style={{ display: "flex", gap: 8, paddingLeft: 20 }}>
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

  // Account Detail View
  if (selectedAccountId) {
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    if (!selectedAccount) {
      setSelectedAccountId(null);
      return null;
    }

    const accountTransactions = transactions.filter(
      (tx) => tx.account_id === selectedAccountId
    );
    const sortedTransactions = [...accountTransactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const txCount = accountTransactions.length;
    const totalCredits = accountTransactions
      .filter((tx) => tx.type === "revenue")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalDebits = accountTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const typeStyle = TYPE_COLORS[selectedAccount.type] || TYPE_COLORS.checking;

    return (
      <div>
        {/* Back Button */}
        <button
          style={s.backBtn}
          onClick={() => setSelectedAccountId(null)}
        >
          ← Back to Accounts
        </button>

        {/* Account Header */}
        <div style={s.accountDetailHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                {selectedAccount.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    ...s.typeBadge,
                    backgroundColor: typeStyle.bg,
                    color: typeStyle.color,
                  }}
                >
                  {TYPE_LABELS[selectedAccount.type]}
                </span>
                {selectedAccount.institution && (
                  <span style={{ fontSize: 14, color: "#666" }}>
                    {selectedAccount.institution}
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#27ae60", marginBottom: 4 }}>
                {formatMoney(selectedAccount.opening_balance || 0)}
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>Opening Balance</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>
            Opened {selectedAccount.opening_date || "—"}
          </div>
        </div>

        {/* Transaction Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 24,
            marginTop: 20,
          }}
        >
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Transactions</div>
            <div style={s.summaryValue}>{txCount}</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total Credits</div>
            <div style={{ ...s.summaryValue, color: "#27ae60" }}>
              {formatMoney(totalCredits)}
            </div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total Debits</div>
            <div style={{ ...s.summaryValue, color: "#e94560" }}>
              {formatMoney(totalDebits)}
            </div>
          </div>
        </div>

        {/* Add Transaction Button */}
        <div style={{ marginBottom: 20 }}>
          <button style={s.txAddBtn} onClick={handleAddTransaction}>
            + Add Transaction
          </button>
        </div>

        {/* Add Transaction Form */}
        {showAddTx && (
          <div style={s.txFormContainer}>
            <div style={s.formHeader}>
              {txEditingId ? "Edit Transaction" : "Add New Transaction"}
            </div>
            <div style={s.formGrid}>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Date *</label>
                <input
                  type="date"
                  value={txFormData.date}
                  onChange={(e) => handleTxFormChange("date", e.target.value)}
                  style={s.formInput}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Type *</label>
                <select
                  value={txFormData.type}
                  onChange={(e) => handleTxFormChange("type", e.target.value)}
                  style={s.formInput}
                >
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div style={{ ...s.formGroup, gridColumn: "1 / -1" }}>
                <label style={s.formLabel}>Description *</label>
                <input
                  type="text"
                  value={txFormData.description}
                  onChange={(e) => handleTxFormChange("description", e.target.value)}
                  placeholder="e.g., Office supplies"
                  style={s.formInput}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={txFormData.amount}
                  onChange={(e) => handleTxFormChange("amount", e.target.value)}
                  placeholder="0.00"
                  style={s.formInput}
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Category</label>
                <select
                  value={txFormData.category}
                  onChange={(e) => handleTxFormChange("category", e.target.value)}
                  style={s.formInput}
                >
                  <option value="">-- None --</option>
                  {ALL_PL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button style={s.saveBtn} onClick={handleTxSave}>
                {txEditingId ? "Save Changes" : "Add Transaction"}
              </button>
              <button style={s.cancelFormBtn} onClick={handleTxCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Transaction Table */}
        {sortedTransactions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={s.txTable}>
              <thead>
                <tr style={s.txHeaderRow}>
                  <th style={s.txHeaderCell}>Date</th>
                  <th style={s.txHeaderCell}>Description</th>
                  <th style={{ ...s.txHeaderCell, textAlign: "right" }}>Amount</th>
                  <th style={s.txHeaderCell}>Type</th>
                  <th style={s.txHeaderCell}>Category</th>
                  <th style={s.txHeaderCell}>Status</th>
                  <th style={s.txHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((tx) => (
                  txDeleteConfirmId === tx.id ? (
                    <tr key={tx.id} style={{ backgroundColor: "#fff3cd" }}>
                      <td colSpan="7" style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 14, marginBottom: 8 }}>
                          Delete this transaction? This cannot be undone.
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button
                            style={s.confirmDeleteBtn}
                            onClick={() => handleTxDelete(tx.id)}
                          >
                            Confirm Delete
                          </button>
                          <button
                            style={s.cancelBtn}
                            onClick={() => setTxDeleteConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : txEditingId === tx.id ? (
                    <tr key={tx.id} style={{ backgroundColor: "#f0f8ff", borderBottom: "1px solid #ddd" }}>
                      <td style={s.txCell}>
                        <input
                          type="date"
                          value={txEditingData.date}
                          onChange={(e) =>
                            setTxEditingData({ ...txEditingData, date: e.target.value })
                          }
                          style={{ ...s.formInput, width: "100%", boxSizing: "border-box" }}
                        />
                      </td>
                      <td style={s.txCell}>
                        <input
                          type="text"
                          value={txEditingData.description}
                          onChange={(e) =>
                            setTxEditingData({ ...txEditingData, description: e.target.value })
                          }
                          style={{ ...s.formInput, width: "100%", boxSizing: "border-box" }}
                        />
                      </td>
                      <td style={{ ...s.txCell, textAlign: "right" }}>
                        <input
                          type="number"
                          step="0.01"
                          value={txEditingData.amount}
                          onChange={(e) =>
                            setTxEditingData({
                              ...txEditingData,
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                          style={{ ...s.formInput, width: "100%", boxSizing: "border-box" }}
                        />
                      </td>
                      <td style={s.txCell}>
                        <select
                          value={txEditingData.type}
                          onChange={(e) =>
                            setTxEditingData({ ...txEditingData, type: e.target.value })
                          }
                          style={{ ...s.formInput, width: "100%", boxSizing: "border-box" }}
                        >
                          <option value="revenue">Revenue</option>
                          <option value="expense">Expense</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </td>
                      <td style={s.txCell}>
                        <input
                          type="text"
                          value={txEditingData.category || ""}
                          onChange={(e) =>
                            setTxEditingData({ ...txEditingData, category: e.target.value })
                          }
                          style={{ ...s.formInput, width: "100%", boxSizing: "border-box" }}
                        />
                      </td>
                      <td style={s.txCell}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: txEditingData.approved ? "#c8e6c9" : "#fff9c4",
                            color: txEditingData.approved ? "#2e7d32" : "#f57f17",
                          }}
                        >
                          {txEditingData.approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td style={s.txCell}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            style={{ ...s.saveBtn, padding: "4px 8px", fontSize: 12 }}
                            onClick={() => {
                              const updatedTransactions = transactions.map((t) =>
                                t.id === txEditingId ? txEditingData : t
                              );
                              saveData({ transactions: updatedTransactions });
                              setTxEditingId(null);
                              setTxEditingData({});
                            }}
                          >
                            Save
                          </button>
                          <button
                            style={{ ...s.cancelBtn, padding: "4px 8px", fontSize: 12 }}
                            onClick={() => {
                              setTxEditingId(null);
                              setTxEditingData({});
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={tx.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={s.txCell}>{formatDate(tx.date)}</td>
                      <td style={s.txCell}>{tx.description}</td>
                      <td style={{ ...s.txCell, textAlign: "right" }}>
                        <span
                          style={{
                            color:
                              tx.type === "revenue"
                                ? "#27ae60"
                                : tx.type === "expense"
                                ? "#e94560"
                                : "#666",
                            fontWeight: 500,
                          }}
                        >
                          {tx.type === "revenue" ? "+" : "-"}
                          {formatMoney(Math.abs(tx.amount))}
                        </span>
                      </td>
                      <td style={s.txCell}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor:
                              tx.type === "revenue"
                                ? "#c8e6c9"
                                : tx.type === "expense"
                                ? "#ffcdd2"
                                : "#e0e0e0",
                            color:
                              tx.type === "revenue"
                                ? "#2e7d32"
                                : tx.type === "expense"
                                ? "#c62828"
                                : "#555",
                          }}
                        >
                          {TX_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td style={s.txCell}>{tx.category || "—"}</td>
                      <td style={s.txCell}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: tx.approved ? "#c8e6c9" : "#fff9c4",
                            color: tx.approved ? "#2e7d32" : "#f57f17",
                          }}
                        >
                          {TX_STATUS_LABELS[tx.approved] || "Pending"}
                        </span>
                      </td>
                      <td style={s.txCell}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            style={{ ...s.editBtn, padding: "4px 8px", fontSize: 12 }}
                            onClick={() => handleTxEdit(tx)}
                          >
                            Edit
                          </button>
                          <button
                            style={{ ...s.deleteBtn, padding: "4px 8px", fontSize: 12 }}
                            onClick={() => setTxDeleteConfirmId(tx.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "#888",
              fontSize: 14,
              backgroundColor: "#f5f5f5",
              borderRadius: 6,
              marginTop: 20,
            }}
          >
            No transactions for this account yet.
          </div>
        )}
      </div>
    );
  }

  // Account List View
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

// ─── Styles ──────────────────────────────────────────────────────────
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
  accountCardWrapper: {
    marginBottom: 10,
  },
  accountCard: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: "16px 20px",
    borderRadius: 6,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    border: "1px solid #eee",
    cursor: "pointer",
    transition: "all 0.2s ease",
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
  backBtn: {
    backgroundColor: "transparent",
    color: "#0f3460",
    border: "none",
    padding: "8px 0",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 20,
  },
  accountDetailHeader: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: "20px 24px",
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #eee",
  },
  txTable: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
    borderRadius: 6,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  txHeaderRow: {
    backgroundColor: "#f5f5f5",
    borderBottom: "2px solid #ddd",
  },
  txHeaderCell: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  txCell: {
    padding: "12px 16px",
    fontSize: 14,
    color: "#1a1a2e",
  },
  txAddBtn: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  txFormContainer: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 6,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #ddd",
  },
};

export default Banking;
