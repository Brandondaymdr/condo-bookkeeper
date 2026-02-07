import React, { useState, useEffect } from 'react';
import { generateBalanceSheet } from '../engines/reports.js';
import { formatMoney } from '../utils/format.js';

const BalanceSheet = ({ store, saveData }) => {
  const today = new Date().toISOString().split('T')[0];
  const [asOfDate, setAsOfDate] = useState(today);
  const [report, setReport] = useState(null);

  // Generate report whenever date changes
  useEffect(() => {
    if (store.transactions) {
      const bsReport = generateBalanceSheet(
        store.transactions,
        store.journal_entries || [],
        store.balance_sheet_openings || {},
        new Date(asOfDate)
      );
      setReport(bsReport);
    }
  }, [asOfDate, store]);

  const handlePrint = () => {
    window.print();
  };

  if (!report) {
    return <div style={{ padding: '20px' }}>Loading report...</div>;
  }

  const isBalanced = Math.abs(report.difference) < 0.01;
  const formattedDate = new Date(asOfDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Controls Section */}
      <div
        style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          marginBottom: '30px',
          borderRadius: '6px',
          border: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            As of Date
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontFamily: 'monospace',
            }}
          />
        </div>

        <button
          onClick={handlePrint}
          style={{
            padding: '10px 18px',
            backgroundColor: '#1a1a2e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#2d2d44';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#1a1a2e';
          }}
        >
          Print
        </button>
      </div>

      {/* Report Section */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          padding: '40px',
          borderRadius: '6px',
          fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1a1a2e',
              marginBottom: '4px',
            }}
          >
            {store.condo_name || 'Property'}
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1a1a2e',
              marginBottom: '8px',
            }}
          >
            Balance Sheet
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            As of {formattedDate}
          </div>
        </div>

        {/* ASSETS Section */}
        <div style={{ marginBottom: '25px' }}>
          <div
            style={{
              color: '#1a1a2e',
              fontWeight: 'bold',
              marginBottom: '12px',
              borderBottom: '1px solid #1a1a2e',
              paddingBottom: '6px',
            }}
          >
            ASSETS
          </div>

          {/* Current Assets */}
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: '#1a1a2e',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '12px',
              }}
            >
              Current Assets
            </div>
            <div>
              {report.currentAssets.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px' }}>
                  <div style={{ paddingLeft: '20px' }}>{item.account}</div>
                  <div style={{ textAlign: 'right' }}>{formatMoney(item.balance)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Assets */}
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: '#1a1a2e',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '12px',
              }}
            >
              Fixed Assets
            </div>
            <div>
              {report.fixedAssets.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px' }}>
                  <div style={{ paddingLeft: '20px' }}>{item.account}</div>
                  <div style={{ textAlign: 'right' }}>{formatMoney(item.balance)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Assets */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 150px',
              fontWeight: 'bold',
              paddingTop: '12px',
              borderTop: '2px solid #1a1a2e',
            }}
          >
            <div>Total Assets</div>
            <div style={{ textAlign: 'right' }}>{formatMoney(report.totalAssets)}</div>
          </div>
        </div>

        {/* LIABILITIES Section */}
        <div style={{ marginBottom: '25px' }}>
          <div
            style={{
              color: '#1a1a2e',
              fontWeight: 'bold',
              marginBottom: '12px',
              borderBottom: '1px solid #1a1a2e',
              paddingBottom: '6px',
              marginTop: '25px',
            }}
          >
            LIABILITIES
          </div>

          {/* Current Liabilities */}
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: '#1a1a2e',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '12px',
              }}
            >
              Current Liabilities
            </div>
            <div>
              {report.currentLiabilities.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px' }}>
                  <div style={{ paddingLeft: '20px' }}>{item.account}</div>
                  <div style={{ textAlign: 'right' }}>{formatMoney(item.balance)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Long-Term Liabilities */}
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: '#1a1a2e',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '12px',
              }}
            >
              Long-Term Liabilities
            </div>
            <div>
              {report.longTermLiabilities.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px' }}>
                  <div style={{ paddingLeft: '20px' }}>{item.account}</div>
                  <div style={{ textAlign: 'right' }}>{formatMoney(item.balance)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Liabilities */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 150px',
              fontWeight: 'bold',
              paddingTop: '12px',
              borderTop: '2px solid #1a1a2e',
            }}
          >
            <div>Total Liabilities</div>
            <div style={{ textAlign: 'right' }}>{formatMoney(report.totalLiabilities)}</div>
          </div>
        </div>

        {/* EQUITY Section */}
        <div style={{ marginBottom: '25px' }}>
          <div
            style={{
              color: '#1a1a2e',
              fontWeight: 'bold',
              marginBottom: '12px',
              borderBottom: '1px solid #1a1a2e',
              paddingBottom: '6px',
              marginTop: '25px',
            }}
          >
            EQUITY
          </div>
          <div style={{ marginBottom: '12px' }}>
            {report.equity.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px' }}>
                <div style={{ paddingLeft: '20px' }}>{item.account}</div>
                <div style={{ textAlign: 'right' }}>{formatMoney(item.balance)}</div>
              </div>
            ))}
          </div>

          {/* Total Equity */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 150px',
              fontWeight: 'bold',
              paddingTop: '12px',
              borderTop: '2px solid #1a1a2e',
            }}
          >
            <div>Total Equity</div>
            <div style={{ textAlign: 'right' }}>{formatMoney(report.totalEquity)}</div>
          </div>
        </div>

        {/* Verification Line */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 150px',
            fontWeight: 'bold',
            paddingTop: '12px',
            borderTop: '2px solid #1a1a2e',
            marginTop: '25px',
          }}
        >
          <div>Total Liabilities + Equity</div>
          <div style={{ textAlign: 'right' }}>
            {formatMoney(report.totalLiabilitiesAndEquity)}
          </div>
        </div>

        {/* Balance Status */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '15px',
            paddingLeft: '20px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: isBalanced ? '#1b5e20' : '#d32f2f',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '16px' }}>
            {isBalanced ? '\u2713' : '\u2717'}
          </span>
          <span>
            {isBalanced
              ? 'Balanced'
              : `Out of balance by ${formatMoney(Math.abs(report.difference))}`}
          </span>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          div {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default BalanceSheet;
