import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
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
            <Table size="medium" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Stay</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(tx.paid_at ?? tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {tx.listing_title ?? "—"}
                      </Typography>
                      {tx.listing_address && (
                        <Typography variant="caption" color="text.secondary">
                          {tx.listing_address}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {tx.booking_start_date && tx.booking_end_date
                        ? `${tx.booking_start_date} – ${tx.booking_end_date}`
                        : "—"}
                    </TableCell>
                    <TableCell>{tx.transaction_type}</TableCell>
                    <TableCell>
                      <Chip
                        label={tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                        size="small"
                        color={
                          tx.status === "succeeded"
                            ? "success"
                            : tx.status === "pending"
                              ? "warning"
                              : "error"
                        }
                      />
                    </TableCell>
                    <TableCell align="right">{formatMoney(tx.amount, tx.currency)}</TableCell>
                  </TableRow>
                ))}
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
