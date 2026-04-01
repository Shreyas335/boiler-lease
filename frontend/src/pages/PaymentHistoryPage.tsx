import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink, Navigate } from "react-router-dom";
import { fetchPaymentHistory, type PaymentTransaction } from "../api/payments";
import { useAuth } from "../contexts/AuthContext";

function formatMoney(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return amount;
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPaymentHistory();
      setRows(data);
    } catch {
      setError("Unable to load payment history.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;
  if (user.user_type !== "sublessee") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Payment history
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Completed security deposits and other successful charges on your account.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Typography color="text.secondary">Loading transactions…</Typography>
        ) : rows.length === 0 ? (
          <Alert severity="info">You don&apos;t have any completed payments yet.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="medium" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Paid</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((tx) => {
                  const bookingRef = tx.booking_reference?.trim();
                  const description = bookingRef
                    ? `Security deposit (booking #${bookingRef})`
                    : "Security deposit";
                  return (
                    <TableRow key={tx.id} hover>
                      <TableCell>{formatDateTime(tx.paid_at)}</TableCell>
                      <TableCell>{description}</TableCell>
                      <TableCell align="right">{formatMoney(tx.amount, tx.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography
            component={RouterLink}
            to="/dashboard"
            variant="body2"
            sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
          >
            ← Back to dashboard
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
