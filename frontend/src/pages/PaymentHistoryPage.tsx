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
  type ChipProps,
} from "@mui/material";
import { Link as RouterLink, Navigate } from "react-router-dom";
import { fetchPaymentHistory, type PaymentTransaction, type TransactionStatus } from "../api/payments";
import { useAuth } from "../contexts/AuthContext";

function statusMeta(status: TransactionStatus): { label: string; color: ChipProps["color"] } {
  switch (status) {
    case "succeeded":
      return { label: "Succeeded", color: "success" };
    case "pending":
      return { label: "Pending", color: "warning" };
    case "failed":
      return { label: "Failed", color: "error" };
    case "canceled":
      return { label: "Canceled", color: "default" };
    default:
      return { label: status, color: "default" };
  }
}

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
          Security deposits and other payments tied to your account.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Typography color="text.secondary">Loading transactions…</Typography>
        ) : rows.length === 0 ? (
          <Alert severity="info">You don&apos;t have any transactions yet.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="medium" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((tx) => {
                  const meta = statusMeta(tx.status);
                  const bookingRef = tx.booking_reference?.trim();
                  const description = bookingRef
                    ? `Security deposit (booking #${bookingRef})`
                    : "Security deposit";
                  const primaryDate =
                    tx.status === "succeeded" && tx.paid_at ? tx.paid_at : tx.created_at;
                  return (
                    <TableRow key={tx.id} hover>
                      <TableCell>{formatDateTime(primaryDate)}</TableCell>
                      <TableCell>{description}</TableCell>
                      <TableCell align="right">{formatMoney(tx.amount, tx.currency)}</TableCell>
                      <TableCell>
                        <Chip label={meta.label} color={meta.color} size="small" />
                      </TableCell>
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
