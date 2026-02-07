import React, { useState, useEffect } from "react";
import { loadStore, saveStore } from "./storage/db.js";

// Component imports
import ImportWizard from "./components/ImportWizard.jsx";
import ReviewApproval from "./components/ReviewApproval.jsx";
import TransactionList from "./components/TransactionList.jsx";
import RuleManager from "./components/RuleManager.jsx";
import JournalEntries from "./components/JournalEntries.jsx";
import ProfitLoss from "./components/ProfitLoss.jsx";
import BalanceSheet from "./components/BalanceSheet.jsx";
import Settings from "./components/Settings.jsx";
import Banking from "./components/Banking.jsx";
import { formatMoney } from "./utils/format.js";
import { migrateAccounts } from "./models/schema.js";

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#f5f5f5",
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  sidebar: {
    width: "240px",
    backgroundColor: "#1a1a2e",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
    overflowY: "auto",
  },
  sidebarHeader: {
    padding: "24px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    fontSize: "18px",
    fontWeight: "600",
    color: "#0f3460",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  sidebarNav: {
    display: "flex",
    flexDirection: "column",
    padding: "12px 0",
    flex: 1,
  },
  navTab: {
    padding: "14px 20px",
    borderLeft: "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontSize: "14px",
    fontWeight: "500",
    color: "#b0b0b0",
  },
  navTabHover: {
    backgroundColor: "rgba(15, 52, 96, 0.3)",
    color: "#ffffff",
  },
  navTabActive: {
    backgroundColor: "rgba(15, 52, 96, 0.5)",
    borderLeftColor: "#e94560",
    color: "#ffffff",
  },
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  contentHeader: {
    padding: "24px 32px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e0e0e0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  contentTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "600",
    color: "#1a1a2e",
  },
  contentBody: {
    flex: 1,
    overflow: "auto",
    padding: "32px",
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundColor: "#f5f5f5",
  },
  spinner: {
    border: "4px solid #e0e0e0",
    borderTop: "4px solid #0f3460",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
  },
};

// Add keyframe animation
const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "ð" },
  { id: "banking", label: "Banking", icon: "ð¦" },
  { id: "import", label: "Import", icon: "ð¥" },
  { id: "review", label: "Review", icon: "ðï¸" },
  { id: "transactions", label: "Transactions", icon: "ð³" },
  { id: "rules", label: "Rules", icon: "âï¸" },
  { id: "journalEntries", label: "Journal Entries", icon: "ð" },
  { id: "pl", label: "P&L", icon: "ð" },
  { id: "balanceSheet", label: "Balance Sheet", icon: "âï¸" },
  { id: "settings", label: "Settings", icon: "ð§" },
];

// Inline Dashboard component
function Dashboard({ store }) {
  const txs = store.transactions || [];
  const approved = txs.filter(t => t.approved);
  const pending = txs.filter(t => !t.approved && t.type !== "transfer");
  const revenue = approved.filter(t => t.type === "revenue").reduce((s, t) => s + t.amount, 0);
  const expenses = approved.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const batches = store.import_batches || [];
  const lastImport = batches.length > 0 ? batches[batches.length - 1].import_date : "â";
  const rules = store.rules || [];
  const patterns = store.learned_patterns || [];

  const cardStyle = {
    background: "#fff", borderRadius: 8, padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minWidth: 200,
  };
  const labelStyle = { fontSize: 13, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" };
  const valueStyle = { fontSize: 28, fontWeight: 700, color: "#1a1a2e" };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Total Transactions</div>
          <div style={valueStyle}>{txs.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Pending Review</div>
          <div style={{ ...valueStyle, color: pending.length > 0 ? "#f39c12" : "#27ae60" }}>{pending.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Revenue</div>
          <div style={{ ...valueStyle, color: "#27ae60" }}>{formatMoney(revenue)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Expenses</div>
          <div style={{ ...valueStyle, color: "#e94560" }}>{formatMoney(expenses)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Net Income</div>
          <div style={{ ...valueStyle, color: revenue + expenses >= 0 ? "#27ae60" : "#e94560" }}>
            {formatMoney(revenue + expenses)}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Last Import</div>
          <div style={{ ...valueStyle, fontSize: 18 }}>{lastImport}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...cardStyle, padding: "16px 24px" }}>
          <div style={labelStyle}>Rules & Patterns</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 14 }}>{rules.length} explicit rules, {patterns.length} learned patterns</span>
          </div>
        </div>
        <div style={{ ...cardStyle, padding: "16px 24px" }}>
          <div style={labelStyle}>Approved</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 14 }}>{approved.length} of {txs.length} transactions approved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const componentMap = {
  dashboard: Dashboard,
  banking: Banking,
  import: ImportWizard,
  review: ReviewApproval,
  transactions: TransactionList,
  rules: RuleManager,
  journalEntries: JournalEntries,
  pl: ProfitLoss,
  balanceSheet: BalanceSheet,
  settings: Settings,
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Load data on mount
  useEffect(() => {
    const initializeStore = async () => {
      try {
        let loadedStore = await loadStore();
        // Migrate: seed accounts array from existing balance_sheet_openings
        if (!loadedStore.accounts || loadedStore.accounts.length === 0) {
          loadedStore = migrateAccounts(loadedStore);
          await saveStore(loadedStore);
        }
        setStore(loadedStore);
      } catch (error) {
        console.error("Failed to load store:", error);
        // Initialize with empty store structure
        setStore({
          transactions: [],
          rules: [],
          journalEntries: [],
          categories: [],
          lastImportDate: null,
        });
      } finally {
        setLoading(false);
      }
    };

    initializeStore();
  }, []);

  // Save data function
  const saveData = async (updates) => {
    const updatedStore = { ...store, ...updates };
    setStore(updatedStore);
    try {
      await saveStore(updatedStore);
    } catch (error) {
      console.error("Failed to save store:", error);
    }
  };

  if (loading) {
    return (
      <>
        <style>{spinKeyframes}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
        </div>
      </>
    );
  }

  const ActiveComponent = componentMap[activeTab] || (() => (
    <div style={{ padding: 32 }}>
      <h2>{tabs.find(t => t.id === activeTab)?.label}</h2>
      <p>Coming soon...</p>
    </div>
  ));

  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || "Dashboard";

  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={styles.container}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Condo Bookkeeper</div>
          <nav style={styles.sidebarNav}>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{
                  ...styles.navTab,
                  ...(activeTab === tab.id ? styles.navTabActive : {}),
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = "rgba(15, 52, 96, 0.3)";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#b0b0b0";
                  }
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span style={{ marginRight: "8px" }}>{tab.icon}</span>
                {tab.label}
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div style={styles.mainContent}>
          <div style={styles.contentHeader}>
            <h1 style={styles.contentTitle}>{activeTabLabel}</h1>
          </div>
          <div style={styles.contentBody}>
            <ActiveComponent store={store} saveData={saveData} />
          </div>
        </div>
      </div>
    </>
  );
}
