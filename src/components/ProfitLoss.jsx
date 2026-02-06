import React, { useState, useEffect } from 'react';
import {
  generateProfitLoss,
  generateScheduleEData,
  getPresetDateRanges,
} from '../engines/reports.js';
import { formatMoney, formatDateRange } from '../utils/format.js';
import { exportPLToCSV } from '../storage/backup.js';

const ProfitLoss = ({ store, saveData }) => {
  const today = new Date();
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [report, setReport] = useState(null);

  // Generate report whenever dates change
  useEffect(() => {
    if (store.transactions && store.journal_entries) {
      const plReport = generateProfitLoss(
        store.transactions,
        store.journal_entries,
        startDate,
        endDate
      );
      setReport(plReport);
    }
  }, [startDate, endDate, store]);

  const handlePresetRange = (label) => {
    const ranges = getPresetDateRanges();
    const found = ranges.find(r => r.label === label);
    if (found) {
      setStartDate(found.start);
      setEndDate(found.end);
    }
  };

  const handleExportCSV = () => {
    if (report) {
      exportPLToCSV(
        report,
        store.condo_name || 'Condo',
        new Date(startDate),
        new Date(endDate)
      );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!report) {
    return <div style={{ padding: '20px' }}>Loading report...</div>;
  }

  const presetButtons = getPresetDateRanges().map(r => r.label);

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
        }}
      >
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Date Range
          </label>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontFamily: 'monospace',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666' }}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>
        </div>

        {/* Preset Buttons */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Quick Select
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {presetButtons.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetRange(preset)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#e9ecef',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#1a1a2e';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#e9ecef';
                  e.target.style.color = 'black';
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
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
            Export CSV
          </button>
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
            Profit &amp; Loss Statement
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {formatDateRange(startDate, endDate)}
          </div>
        </div>

        {/* Revenue Section */}
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
            REVENUE
          </div>
          <div style={{ marginBottom: '12px' }}>
            {(report.revenue || []).map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px' }}>
                <div style={{ paddingLeft: '20px' }}>{item.category || item.name}</div>
                <div style={{ textAlign: 'right' }}>{formatMoney(item.amount)}</div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
                  {item.scheduleE || ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px', marginBottom: '12px' }}>
            <div style={{ paddingLeft: '20px' }}></div>
            <div style={{ borderTop: '2px solid #1a1a2e', paddingTop: '6px' }}></div>
            <div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px', fontWeight: 'bold' }}>
            <div>Total Revenue</div>
            <div style={{ textAlign: 'right' }}>{formatMoney(report.totalRevenue)}</div>
            <div></div>
          </div>
        </div>

        {/* Expenses Section */}
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
            EXPENSES
          </div>
          <div style={{ marginBottom: '12px' }}>
            {(report.expenses || []).map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px' }}>
                <div style={{ paddingLeft: '20px' }}>{item.category || item.name}</div>
                <div style={{ textAlign: 'right' }}>{formatMoney(item.amount)}</div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
                  {item.scheduleE || ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px', marginBottom: '12px' }}>
            <div style={{ paddingLeft: '20px' }}></div>
            <div style={{ borderTop: '2px solid #1a1a2e', paddingTop: '6px' }}></div>
            <div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px', fontWeight: 'bold' }}>
            <div>Total Expenses</div>
            <div style={{ textAlign: 'right' }}>{formatMoney(report.totalExpenses)}</div>
            <div></div>
          </div>
        </div>

        {/* Net Income */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 80px',
            fontWeight: 'bold',
            fontSize: '14px',
            paddingTop: '12px',
            borderTop: '2px solid #1a1a2e',
          }}
        >
          <div>NET INCOME (LOSS)</div>
          <div
            style={{
              textAlign: 'right',
              color: report.netIncome < 0 ? '#d32f2f' : '#1a1a2e',
            }}
          >
            {formatMoney(report.netIncome)}
          </div>
          <div></div>
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

export default ProfitLoss;
