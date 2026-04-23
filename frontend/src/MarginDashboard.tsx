import React, { useMemo } from 'react';
import { useParty, useStreamQueries } from '@c7/react';
import { ClearedTrade } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Trade/ClearedTrade';
import { InitialMarginAccount } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Margin/InitialMargin';
import { VariationMarginMovement } from '@daml.js/canton-derivatives-clearing-0.1.0/lib/Margin/VariationMargin';
import { Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';

// Daml Decimal is a string, so we need functions to handle arithmetic
const sumDecimals = (decimals: string[]): number => {
  return decimals.reduce((acc, val) => acc + parseFloat(val), 0.0);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const getTodayDateString = (): string => {
  // Daml Date serializes to "YYYY-MM-DD"
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DashboardCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}));

const PnlPositive = styled('span')(({ theme }) => ({
  color: theme.palette.success.main,
  fontWeight: 500,
}));

const PnlNegative = styled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  fontWeight: 500,
}));

const MarginDashboard: React.FC = () => {
  const party = useParty();

  const tradeQueries = useStreamQueries(ClearedTrade);
  const imAccountQueries = useStreamQueries(InitialMarginAccount);
  const vmMovementQueries = useStreamQueries(VariationMarginMovement);

  const isLoading = tradeQueries.loading || imAccountQueries.loading || vmMovementQueries.loading;

  const summary = useMemo(() => {
    if (!party || isLoading) {
      return { totalIM: 0, netVM: 0, dailyPnl: 0, unrealizedPnl: 0 };
    }

    const todayStr = getTodayDateString();

    const totalIM = sumDecimals(imAccountQueries.contracts
      .filter(c => c.payload.owner === party)
      .map(c => c.payload.amount)
    );

    const paidVm = sumDecimals(vmMovementQueries.contracts
      .filter(c => c.payload.payer === party)
      .map(c => c.payload.amount)
    );
    const receivedVm = sumDecimals(vmMovementQueries.contracts
      .filter(c => c.payload.receiver === party)
      .map(c => c.payload.amount)
    );
    const netVM = receivedVm - paidVm;

    const dailyVmMovements = vmMovementQueries.contracts.filter(c => c.payload.paymentDate === todayStr);

    const dailyPaidVm = sumDecimals(dailyVmMovements
      .filter(c => c.payload.payer === party)
      .map(c => c.payload.amount)
    );
    const dailyReceivedVm = sumDecimals(dailyVmMovements
      .filter(c => c.payload.receiver === party)
      .map(c => c.payload.amount)
    );
    const dailyPnl = dailyReceivedVm - dailyPaidVm;

    const unrealizedPnl = sumDecimals(tradeQueries.contracts.map(c => c.payload.markToMarket.value));

    return { totalIM, netVM, dailyPnl, unrealizedPnl };

  }, [party, tradeQueries.contracts, imAccountQueries.contracts, vmMovementQueries.contracts, isLoading]);

  const PnlComponent = ({ value }: { value: number }) => {
    const formattedValue = formatCurrency(value);
    if (value >= 0) {
      return <PnlPositive>{formattedValue}</PnlPositive>;
    }
    return <PnlNegative>{formattedValue}</PnlNegative>;
  };

  if (isLoading) {
    return (
      <Grid container justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
        <CircularProgress />
      </Grid>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Typography variant="h4" gutterBottom>
        Margin & P&L Dashboard
      </Typography>

      <Grid container spacing={3} style={{ marginBottom: '2rem' }}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard elevation={3}>
            <Typography variant="subtitle1">Total Initial Margin</Typography>
            <Typography variant="h4">{formatCurrency(summary.totalIM)}</Typography>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard elevation={3}>
            <Typography variant="subtitle1">Net Variation Margin</Typography>
            <Typography variant="h4"><PnlComponent value={summary.netVM} /></Typography>
            <Typography variant="body2">(Cumulative)</Typography>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard elevation={3}>
            <Typography variant="subtitle1">Daily P&L (Realized)</Typography>
            <Typography variant="h4"><PnlComponent value={summary.dailyPnl} /></Typography>
             <Typography variant="body2">(Today's VM)</Typography>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard elevation={3}>
            <Typography variant="subtitle1">Unrealized P&L</Typography>
            <Typography variant="h4"><PnlComponent value={summary.unrealizedPnl} /></Typography>
            <Typography variant="body2">(Current MTM)</Typography>
          </DashboardCard>
        </Grid>
      </Grid>

      <Typography variant="h5" gutterBottom style={{ marginTop: '2rem' }}>
        Active Trades
      </Typography>

      {tradeQueries.contracts.length === 0 ? (
        <Alert severity="info">No active trades found for party {party}.</Alert>
      ) : (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Trade ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Counterparty</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">Notional</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">MTM</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Maturity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tradeQueries.contracts.map(({ contractId, payload }) => (
                <TableRow key={contractId} hover>
                  <TableCell component="th" scope="row">{payload.tradeId}</TableCell>
                  <TableCell>
                    {party === payload.partyA ? payload.partyB : payload.partyA}
                  </TableCell>
                  <TableCell>{payload.tradeDetails.product.tag}</TableCell>
                  <TableCell align="right">{formatCurrency(parseFloat(payload.tradeDetails.notional))}</TableCell>
                  <TableCell align="right">
                    <PnlComponent value={parseFloat(payload.markToMarket.value)} />
                  </TableCell>
                  <TableCell>{payload.tradeDetails.maturityDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </div>
  );
};

export default MarginDashboard;