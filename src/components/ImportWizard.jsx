import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  parseBoaCheckingCSV,
  parseBoaCheckingRows,
} from '../parsers/boaChecking.js';
import {
  parseBoaCreditCardCSV,
  parseBoaCreditCardRows,
} from '../parsers/boaCreditCard.js';
import { findDuplicates } from '../parsers/deduplicate.js';
import { categorizeAll } from '../engines/categorize.js';
import { createImportBatch } from '../models/schema.js';

const COLORS = {
  navy: '#1a1a2e',
  accentBlue: '#0f3460',
  successGreen: '#27ae60',
  warningOrange: '#f39c12',
  lightGray: '#f5f5f5',
  borderGray: '#ddd',
  textDark: '#333',
  textLight: '#666',
};

const ImportWizard = ({ store, saveData }) => {
  const [step, setStep] = useState('upload'); // upload, account, preview, summary
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [fileData, setFileData] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  const accounts = store.accounts || [];

  // Get the selected account object
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Determine parser type from account type
  const getParserType = (account) => {
    if (!account) return 'checking';
    return account.type === 'credit_card' ? 'creditCard' : 'checking';
  };

  const parserType = getParserType(selectedAccount);

  // File handling
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    setErrorMessage('');
    setLoadingMessage('Reading file...');

    const fileExt = file.name.split('.').pop().toLowerCase();

    if (fileExt === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          setFileData({ type: 'csv', content: text, name: file.name });
          setLoadingMessage('');
          setStep('account');
        } catch (err) {
          setErrorMessage(`Error reading file: ${err.message}`);
          setLoadingMessage('');
        }
      };
      reader.readAsText(file);
    } else if (fileExt === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          setFileData({ type: 'xlsx', rows: rows, name: file.name });
          setLoadingMessage('');
          setStep('account');
        } catch (err) {
          setErrorMessage(`Error reading Excel file: ${err.message}`);
          setLoadingMessage('');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrorMessage('Please select a CSV or XLSX file');
      setLoadingMessage('');
    }
  };

  const parsePreview = (pType) => {
    if (!fileData) return [];
    try {
      if (fileData.type === 'csv') {
        const lines = fileData.content.split('\n');
        const previewLines = lines.slice(0, 11).join('\n');
        if (pType === 'checking') {
          return parseBoaCheckingCSV(previewLines).transactions.slice(0, 10);
        } else {
          return parseBoaCreditCardCSV(previewLines).transactions.slice(0, 10);
        }
      } else {
        if (pType === 'checking') {
          return parseBoaCheckingRows(fileData.rows).transactions.slice(0, 10);
        } else {
          return parseBoaCreditCardRows(fileData.rows).transactions.slice(0, 10);
        }
      }
    } catch (err) {
      console.warn('Preview parse error:', err);
      return [];
    }
  };

  const handleAccountSelect = (accountId) => {
    setSelectedAccountId(accountId);
    setErrorMessage('');
    const acct = accounts.find((a) => a.id === accountId);
    const pType = getParserType(acct);
    setPreviewData(parsePreview(pType));
  };

  const proceedToPreview = () => {
    if (!selectedAccountId) {
      setErrorMessage('Please select an account.');
      return;
    }
    // Re-parse preview with selected account
    setPreviewData(parsePreview(parserType));
    setStep('preview');
  };

  const proceedToImport = async () => {
    setErrorMessage('');
    setLoadingMessage('Parsing and categorizing transactions...');

    try {
      let transactions = [];
      let parseResult;
      if (fileData.type === 'csv') {
        if (parserType === 'checking') {
          parseResult = parseBoaCheckingCSV(fileData.content, fileData.name);
        } else {
          parseResult = parseBoaCreditCardCSV(fileData.content, fileData.name);
        }
      } else {
        if (parserType === 'checking') {
          parseResult = parseBoaCheckingRows(fileData.rows, null, fileData.name);
        } else {
          parseResult = parseBoaCreditCardRows(fileData.rows, null, fileData.name);
        }
      }
      transactions = parseResult.transactions;

      // Tag each transaction with the selected account_id
      transactions = transactions.map((tx) => ({
        ...tx,
        account_id: selectedAccountId,
      }));

      if (parseResult.errors && parseResult.errors.length > 0) {
        console.warn('Parse warnings:', parseResult.errors);
      }

      // Categorize all transactions
      const categorized = categorizeAll(transactions);

      // Find duplicates
      const { clean: cleanTransactions, duplicates } = findDuplicates(
        categorized,
        store.transactions || []
      );

      // Prepare summary
      const dateRange = cleanTransactions.length > 0 ? {
        from: new Date(
          Math.min(...cleanTransactions.map((t) => new Date(t.date)))
        ),
        to: new Date(
          Math.max(...cleanTransactions.map((t) => new Date(t.date)))
        ),
      } : { from: null, to: null };

      const summary = {
        totalParsed: transactions.length,
        categorized: categorized.filter((t) => t.category && t.category !== 'Uncategorized').length,
        duplicatesSkipped: duplicates.length,
        forImport: cleanTransactions.length,
        dateRange: dateRange,
      };

      setParsedTransactions(cleanTransactions);
      setDuplicateCount(duplicates.length);
      setImportSummary(summary);
      setLoadingMessage('');
      setStep('summary');
    } catch (err) {
      setErrorMessage(`Error processing file: ${err.message}`);
      setLoadingMessage('');
    }
  };

  const handleConfirmImport = async () => {
    setLoadingMessage('Saving transactions...');

    try {
      const batch = createImportBatch({
        filename: fileData.name,
        source_account: selectedAccount ? selectedAccount.type : '',
        account_id: selectedAccountId,
        transaction_count: parsedTransactions.length,
        import_date: new Date().toISOString().slice(0, 10),
        date_range_start: importSummary?.dateRange?.from
          ? importSummary.dateRange.from.toISOString().slice(0, 10) : '',
        date_range_end: importSummary?.dateRange?.to
          ? importSummary.dateRange.to.toISOString().slice(0, 10) : '',
        duplicates_skipped: duplicateCount,
      });

      await saveData({
        transactions: [...(store.transactions || []), ...parsedTransactions],
        import_batches: [...(store.import_batches || []), batch],
      });

      setLoadingMessage('');
      alert(
        `Successfully imported ${parsedTransactions.length} transactions into ${selectedAccount?.name || 'account'}!`
      );

      resetWizard();
    } catch (err) {
      setErrorMessage(`Error saving data: ${err.message}`);
      setLoadingMessage('');
    }
  };

  const resetWizard = () => {
    setStep('upload');
    setSelectedAccountId('');
    setFileData(null);
    setPreviewData([]);
    setParsedTransactions([]);
    setDuplicateCount(0);
    setImportSummary(null);
    setErrorMessage('');
  };

  const containerStyle = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const headerStyle = {
    color: COLORS.navy,
    marginBottom: '24px',
    fontSize: '24px',
    fontWeight: '600',
  };

  const stepIndicatorStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '32px',
    gap: '12px',
  };

  const stepStyle = (isActive, isComplete) => ({
    flex: 1,
    padding: '12px',
    textAlign: 'center',
    borderRadius: '4px',
    backgroundColor: isActive
      ? COLORS.accentBlue
      : isComplete
        ? COLORS.successGreen
        : COLORS.lightGray,
    color: isActive || isComplete ? '#fff' : COLORS.textLight,
    fontSize: '14px',
    fontWeight: '500',
  });

  const errorBox = errorMessage ? (
    <div style={{
      padding: '12px', marginBottom: '16px', backgroundColor: '#ffe6e6',
      border: `1px solid ${COLORS.warningOrange}`, borderRadius: '4px', color: '#c33', fontSize: '14px',
    }}>
      {errorMessage}
    </div>
  ) : null;

  // STEP 1: File Upload
  if (step === 'upload') {
    return (
      <div style={containerStyle}>
        <h1 style={headerStyle}>Import Transactions</h1>
        <div style={stepIndicatorStyle}>
          <div style={stepStyle(true, false)}>1. Upload File</div>
          <div style={stepStyle(false, false)}>2. Select Account</div>
          <div style={stepStyle(false, false)}>3. Preview</div>
          <div style={stepStyle(false, false)}>4. Confirm</div>
        </div>
        {errorBox}
        <div
          onDragEnter={handleDrag} onDragLeave={handleDrag}
          onDragOver={handleDrag} onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? COLORS.accentBlue : COLORS.borderGray}`,
            borderRadius: '8px', padding: '48px 24px', textAlign: 'center',
            backgroundColor: dragActive ? '#f0f6ff' : COLORS.lightGray,
            cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
          <p style={{ color: COLORS.textDark, fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0' }}>
            {dragActive ? 'Drop your file here' : 'Drag and drop your CSV or Excel file'}
          </p>
          <p style={{ color: COLORS.textLight, fontSize: '14px', margin: '0 0 16px 0' }}>
            Supported formats: .csv, .xlsx
          </p>
          <label style={{
            display: 'inline-block', padding: '10px 24px', backgroundColor: COLORS.accentBlue,
            color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
          }}>
            Choose File
            <input type="file" accept=".csv,.xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
          </label>
        </div>
        {loadingMessage && <p style={{ color: COLORS.textLight, fontSize: '14px' }}>{loadingMessage}</p>}
        {fileData && (
          <div style={{
            padding: '12px', backgroundColor: '#e6ffe6',
            border: `1px solid ${COLORS.successGreen}`, borderRadius: '4px',
            color: COLORS.successGreen, fontSize: '14px', marginTop: '16px',
          }}>
            ✓ File loaded: {fileData.name}
          </div>
        )}
      </div>
    );
  }

  // STEP 2: Account Selection (dynamic from store.accounts)
  if (step === 'account') {
    return (
      <div style={containerStyle}>
        <h1 style={headerStyle}>Select Account</h1>
        <div style={stepIndicatorStyle}>
          <div style={stepStyle(false, true)}>1. Upload File</div>
          <div style={stepStyle(true, false)}>2. Select Account</div>
          <div style={stepStyle(false, false)}>3. Preview</div>
          <div style={stepStyle(false, false)}>4. Confirm</div>
        </div>
        {errorBox}
        <p style={{ color: COLORS.textDark, marginBottom: '20px' }}>
          Which account is this statement from?
        </p>

        {accounts.length === 0 ? (
          <div style={{
            padding: '24px', backgroundColor: '#fff5e6', borderRadius: '8px',
            border: `1px solid ${COLORS.warningOrange}`, marginBottom: '24px',
          }}>
            <p style={{ margin: 0, color: COLORS.textDark, fontWeight: '500' }}>
              No accounts found. Please add an account in the Banking tab first.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            {accounts.map((acct) => {
              const isSelected = selectedAccountId === acct.id;
              const typeLabel = acct.type === 'credit_card' ? 'Credit Card'
                : acct.type === 'savings' ? 'Savings' : 'Checking';
              return (
                <label
                  key={acct.id}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '16px',
                    border: `2px solid ${isSelected ? COLORS.accentBlue : COLORS.borderGray}`,
                    borderRadius: '4px', cursor: 'pointer', marginBottom: '12px',
                    backgroundColor: isSelected ? '#f0f6ff' : 'transparent',
                  }}
                  onClick={() => handleAccountSelect(acct.id)}
                >
                  <input
                    type="radio" name="accountSelect" value={acct.id}
                    checked={isSelected} readOnly
                    style={{ marginRight: '12px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: COLORS.textDark }}>
                      {acct.name}
                    </div>
                    <div style={{ fontSize: '12px', color: COLORS.textLight, marginTop: '4px' }}>
                      {typeLabel}{acct.institution ? ` — ${acct.institution}` : ''}
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase',
                    backgroundColor: acct.type === 'credit_card' ? '#fce4ec' : acct.type === 'savings' ? '#e3f2fd' : '#e8f5e9',
                    color: acct.type === 'credit_card' ? '#c62828' : acct.type === 'savings' ? '#1565c0' : '#2e7d32',
                  }}>
                    {typeLabel}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {/* Preview */}
        {previewData.length > 0 && (
          <div style={{
            marginTop: '24px', padding: '16px', backgroundColor: COLORS.lightGray,
            borderRadius: '4px',
          }}>
            <p style={{ margin: '0 0 12px 0', fontWeight: '500', color: COLORS.textDark }}>
              Preview (first 10 rows):
            </p>
            <div style={{ overflowX: 'auto', fontSize: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.borderGray}` }}>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} style={{
                        padding: '8px', textAlign: 'left', fontWeight: '600', color: COLORS.navy,
                        borderRight: `1px solid ${COLORS.borderGray}`,
                      }}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} style={{
                      borderBottom: `1px solid ${COLORS.borderGray}`,
                      backgroundColor: idx % 2 === 0 ? '#fff' : COLORS.lightGray,
                    }}>
                      {Object.values(row).map((val, colIdx) => (
                        <td key={colIdx} style={{
                          padding: '8px', borderRight: `1px solid ${COLORS.borderGray}`,
                          maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{String(val).substring(0, 50)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={resetWizard} style={{
            padding: '10px 24px', backgroundColor: COLORS.lightGray,
            border: `1px solid ${COLORS.borderGray}`, borderRadius: '4px',
            cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: COLORS.textDark,
          }}>Back</button>
          <button onClick={proceedToPreview} disabled={!selectedAccountId} style={{
            padding: '10px 24px', backgroundColor: selectedAccountId ? COLORS.accentBlue : '#ccc',
            color: '#fff', border: 'none', borderRadius: '4px',
            cursor: selectedAccountId ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '500',
          }}>Next: Preview Data</button>
        </div>
      </div>
    );
  }

  // STEP 3: Preview
  if (step === 'preview') {
    return (
      <div style={containerStyle}>
        <h1 style={headerStyle}>Preview Data</h1>
        <div style={stepIndicatorStyle}>
          <div style={stepStyle(false, true)}>1. Upload File</div>
          <div style={stepStyle(false, true)}>2. Select Account</div>
          <div style={stepStyle(true, false)}>3. Preview</div>
          <div style={stepStyle(false, false)}>4. Confirm</div>
        </div>
        <p style={{ color: COLORS.textDark, marginBottom: '16px' }}>
          Account: <strong>{selectedAccount?.name || '—'}</strong>
        </p>
        <div style={{
          padding: '16px', backgroundColor: COLORS.lightGray, borderRadius: '4px',
          marginBottom: '24px', overflowX: 'auto', fontSize: '12px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.navy}` }}>
                {previewData.length > 0 && Object.keys(previewData[0]).map((key) => (
                  <th key={key} style={{
                    padding: '12px', textAlign: 'left', fontWeight: '600',
                    color: '#fff', backgroundColor: COLORS.navy,
                    borderRight: `1px solid ${COLORS.borderGray}`,
                  }}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, idx) => (
                <tr key={idx} style={{
                  borderBottom: `1px solid ${COLORS.borderGray}`,
                  backgroundColor: idx % 2 === 0 ? '#fff' : COLORS.lightGray,
                }}>
                  {Object.values(row).map((val, colIdx) => (
                    <td key={colIdx} style={{
                      padding: '12px', borderRight: `1px solid ${COLORS.borderGray}`,
                      maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{String(val).substring(0, 60)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: COLORS.textLight, fontSize: '13px', marginTop: '12px' }}>
          Showing first 10 rows of data
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={() => setStep('account')} style={{
            padding: '10px 24px', backgroundColor: COLORS.lightGray,
            border: `1px solid ${COLORS.borderGray}`, borderRadius: '4px',
            cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: COLORS.textDark,
          }}>Back</button>
          <button onClick={proceedToImport} style={{
            padding: '10px 24px', backgroundColor: COLORS.accentBlue,
            color: '#fff', border: 'none', borderRadius: '4px',
            cursor: 'pointer', fontSize: '14px', fontWeight: '500',
          }}>{loadingMessage ? 'Processing...' : 'Next: Import'}</button>
        </div>
        {loadingMessage && (
          <p style={{ color: COLORS.accentBlue, fontSize: '14px', marginTop: '16px', textAlign: 'center' }}>
            {loadingMessage}
          </p>
        )}
      </div>
    );
  }

  // STEP 4: Summary & Confirm
  if (step === 'summary') {
    return (
      <div style={containerStyle}>
        <h1 style={headerStyle}>Import Summary</h1>
        <div style={stepIndicatorStyle}>
          <div style={stepStyle(false, true)}>1. Upload File</div>
          <div style={stepStyle(false, true)}>2. Select Account</div>
          <div style={stepStyle(false, true)}>3. Preview</div>
          <div style={stepStyle(true, false)}>4. Confirm</div>
        </div>
        {errorBox}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px', marginBottom: '24px',
        }}>
          <div style={{ padding: '16px', backgroundColor: '#e6f3ff', borderRadius: '4px', borderLeft: `4px solid ${COLORS.accentBlue}` }}>
            <div style={{ fontSize: '12px', color: COLORS.textLight }}>Total Parsed</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: COLORS.accentBlue, marginTop: '4px' }}>
              {importSummary?.totalParsed || 0}
            </div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#e6ffe6', borderRadius: '4px', borderLeft: `4px solid ${COLORS.successGreen}` }}>
            <div style={{ fontSize: '12px', color: COLORS.textLight }}>Auto-Categorized</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: COLORS.successGreen, marginTop: '4px' }}>
              {importSummary?.categorized || 0}
            </div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#fff5e6', borderRadius: '4px', borderLeft: `4px solid ${COLORS.warningOrange}` }}>
            <div style={{ fontSize: '12px', color: COLORS.textLight }}>Duplicates Skipped</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: COLORS.warningOrange, marginTop: '4px' }}>
              {duplicateCount}
            </div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f0f0f0', borderRadius: '4px', borderLeft: `4px solid ${COLORS.navy}` }}>
            <div style={{ fontSize: '12px', color: COLORS.textLight }}>Ready to Import</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: COLORS.navy, marginTop: '4px' }}>
              {importSummary?.forImport || 0}
            </div>
          </div>
        </div>

        {importSummary?.dateRange?.from && importSummary?.dateRange?.to && (
          <div style={{ padding: '16px', backgroundColor: COLORS.lightGray, borderRadius: '4px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: COLORS.textDark }}>Date Range:</p>
            <p style={{ margin: '0', color: COLORS.textLight }}>
              {importSummary.dateRange.from.toLocaleDateString()} to {importSummary.dateRange.to.toLocaleDateString()}
            </p>
          </div>
        )}

        <div style={{
          padding: '16px', backgroundColor: '#e6f3ff', borderRadius: '4px',
          borderLeft: `4px solid ${COLORS.accentBlue}`, marginBottom: '24px',
        }}>
          <p style={{ margin: '0', fontSize: '14px', color: COLORS.accentBlue, fontWeight: '500' }}>
            Account: {selectedAccount?.name || '—'}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: COLORS.textLight }}>
            File: {fileData?.name}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => setStep('preview')} style={{
            padding: '10px 24px', backgroundColor: COLORS.lightGray,
            border: `1px solid ${COLORS.borderGray}`, borderRadius: '4px',
            cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: COLORS.textDark,
          }}>Back</button>
          <button onClick={handleConfirmImport} disabled={loadingMessage !== ''} style={{
            padding: '10px 24px',
            backgroundColor: loadingMessage !== '' ? '#ccc' : COLORS.successGreen,
            color: '#fff', border: 'none', borderRadius: '4px',
            cursor: loadingMessage !== '' ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: '500',
          }}>{loadingMessage ? 'Importing...' : 'Confirm & Import'}</button>
        </div>

        {loadingMessage && (
          <p style={{ color: COLORS.accentBlue, fontSize: '14px', marginTop: '16px', textAlign: 'center' }}>
            {loadingMessage}
          </p>
        )}
      </div>
    );
  }

  return null;
};

export default ImportWizard;
