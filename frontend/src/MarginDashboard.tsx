import React from 'react';
import { useStreamQueries, useLedger, useParty } from '@c7/react';
import { ClearedTrade } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Main/ClearedTrade';
import { MarginAccount } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Main/Margin';
import { VariationMarginCall } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Main/Margin';
import { TradeValuation } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Main/Valuation';
import { ContractId } from '@daml/types';

// A simple styling object. In a real app, this might come from a CSS-in-JS library or a CSS file.
const styles: { [key: string]: React.CSSProperties } = {
  dashboard: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    padding: '24px',
    maxWidth: '1280px',
    margin: '0 auto',
    color: '#333',
  },
  header: {
    fontSize: '2.25rem',
    fontWeight: 600,
    marginBottom: '24px',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '16px',
  },
  summaryContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
  },
  summaryCard: {
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    border: '1px solid #e0e0e0',
    backgroundColor: '#ffffff',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  summaryValue: {
    fontSize: '2rem',
    fontWeight: 700,
  },
  pnlPositive: {
    color: '#28a745',
  },
  pnlNegative: {
    color: '#dc3545',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '1.75rem',
    fontWeight: 600,
    marginBottom: '16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.95rem',
  },
  th: {
    borderBottom: '2px solid #ddd',
    padding: '12px 16px',
    textAlign: 'left',
    backgroundColor: '#f7f7f7',
    fontWeight: 600,
  },
  td: {
    borderBottom: '1px solid #eee',
    padding: '12px 16px',
  },
  loading: {
    textAlign: 'center',
    fontSize: '1.2em',
    padding: '40px',
    color: '#888',
  },
  noData: {
    textAlign: 'center',
    color: '#888',
    padding: '24px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    border: '1px dashed #ddd',
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background-color 0.2s',
  },
  buttonHover: {
    backgroundColor: '#0056b3',
  }
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

/**
 * The main dashboard component for viewing margin accounts, P&L,
 * and outstanding margin calls.
 */
export const MarginDashboard: React.FC = () => {
  const party = useParty();
  const ledger = useLedger();

  const { contracts: marginAccounts, loading: loadingAccounts } = useStreamQueries(MarginAccount, [{ owner: party }]);
  const { contracts: trades, loading: loadingTrades } = useStreamQueries(ClearedTrade);
  const { contracts: vmCalls, loading: loadingVmCalls } = useStreamQueries(VariationMarginCall);
  const { contracts: valuations, loading: loadingValuations } = useStreamQueries(TradeValuation);

  const loading = loadingAccounts || loadingTrades || loadingVmCalls || loadingValuations;

  // Memoize derived data to prevent recalculations on every render
  const { myAccount, myTrades, myOutstandingVmCalls, dailyPnl } = React.useMemo(() => {
    const account = marginAccounts.length > 0 ? marginAccounts[0].payload : null;
    const userTrades = trades.filter(t => t.payload.partyA === party || t.payload.partyB === party);
    const outstandingCalls = vmCalls.filter(c => c.payload.status === "Pending" && (c.payload.payer === party || c.payload.receiver === party));

    // A simplified P&L calculation based on settled VM today.
    // A more accurate calculation would compare today's MTM with yesterday's.
    const settledToday = vmCalls.filter(c =>
      c.payload.status === "Settled" &&
      (c.payload.payer === party || c.payload.receiver === party) &&
      new Date(c.payload.settlementDate).toDateString() === new Date().toDateString()
    );

    const pnl = settledToday.reduce((acc, call) => {
      const amount = parseFloat(call.payload.amount);
      return call.payload.receiver === party ? acc + amount : acc - amount;
    }, 0);

    return { myAccount: account, myTrades: userTrades, myOutstandingVmCalls: outstandingCalls, dailyPnl: pnl };
  }, [marginAccounts, trades, vmCalls, party]);

  const getLatestValuation = React.useCallback((tradeId: string): string => {
    const tradeValuations = valuations
      .filter(v => v.payload.tradeId === tradeId)
      .sort((a, b) => new Date(b.payload.valuationDate).getTime() - new Date(a.payload.valuationDate).getTime());
    return tradeValuations.length > 0 ? tradeValuations[0].payload.mtmValue : "0.0";
  }, [valuations]);

  const handleSettleVmCall = async (cid: ContractId<VariationMarginCall>) => {
    try {
      // The choice to exercise depends on whether the user is the payer.
      // We assume the payer is responsible for initiating the settlement transaction.
      const vmCall = vmCalls.find(c => c.contractId === cid);
      if (vmCall && vmCall.payload.payer === party) {
        await ledger.exercise(VariationMarginCall.SettleCall, cid, {});
        alert('Variation Margin Call settled successfully!');
      } else {
        alert('Only the designated payer can settle this margin call.');
      }
    } catch (error) {
      console.error("Failed to settle VM Call:", error);
      alert(`Error settling VM Call: ${error instanceof Error ? error.message : String(error)}`);
    }
  };


  if (loading) {
    return <div style={styles.loading}>Loading Margin Dashboard...</div>;
  }

  return (
    <div style={styles.dashboard}>
      <h1 style={styles.header}>Margin Dashboard</h1>

      <div style={styles.summaryContainer}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Initial Margin (IM)</div>
          <div style={styles.summaryValue}>{formatCurrency(myAccount?.initialMargin ?? '0.0')}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Variation Margin (VM)</div>
          <div style={styles.summaryValue}>{formatCurrency(myAccount?.variationMargin ?? '0.0')}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Daily P&L (Settled VM)</div>
          <div style={{ ...styles.summaryValue, ...(dailyPnl >= 0 ? styles.pnlPositive : styles.pnlNegative) }}>
            {formatCurrency(dailyPnl)}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Outstanding Variation Margin Calls</h2>
        {myOutstandingVmCalls.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Call ID</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {myOutstandingVmCalls.map(({ contractId, payload }) => (
                <tr key={contractId}>
                  <td style={styles.td}>{payload.callId.slice(0, 8)}...</td>
                  <td style={styles.td}>{payload.payer === party ? 'Payer' : 'Receiver'}</td>
                  <td style={styles.td}>{formatCurrency(payload.amount)}</td>
                  <td style={styles.td}>{new Date(payload.dueDate).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    {payload.payer === party && (
                      <button style={styles.button} onClick={() => handleSettleVmCall(contractId)}>Settle</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={styles.noData}>No outstanding variation margin calls.</p>
        )}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Active Trades</h2>
        {myTrades.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Trade ID</th>
                <th style={styles.th}>Counterparty</th>
                <th style={styles.th}>Notional</th>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>Maturity</th>
                <th style={styles.th}>Latest MTM</th>
              </tr>
            </thead>
            <tbody>
              {myTrades.map(({ contractId, payload }) => (
                <tr key={contractId}>
                  <td style={styles.td}>{payload.tradeId.slice(0, 8)}...</td>
                  <td style={styles.td}>{payload.partyA === party ? payload.partyB : payload.partyA}</td>
                  <td style={styles.td}>{formatCurrency(payload.tradeDetails.notional)}</td>
                  <td style={styles.td}>{payload.tradeDetails.productType}</td>
                  <td style={styles.td}>{new Date(payload.tradeDetails.maturityDate).toLocaleDateString()}</td>
                  <td style={styles.td}>{formatCurrency(getLatestValuation(payload.tradeId))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={styles.noData}>You have no active cleared trades.</p>
        )}
      </div>
    </div>
  );
};