import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  fetchListingOwnerTransactions,
  type OwnerListingTransaction,
} from "../api/listings";

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

function formatPaidAt(iso: string | null): string {
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

function statusLabel(status: string): string {
  if (status === "succeeded") return "Paid";
  return status;
}

interface ListingOwnerDepositTransactionsProps {
  listingId: number;
  /** When false, only the table / alerts are rendered (page supplies title and context). */
  showSectionHeader?: boolean;
}

export default function ListingOwnerDepositTransactions({
  listingId,
  showSectionHeader = true,
}: ListingOwnerDepositTransactionsProps) {
  const [rows, setRows] = useState<OwnerListingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchListingOwnerTransactions(listingId);
      setRows(data);
    } catch {
      setError("Unable to load deposit transactions for this listing.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={2}>
      {showSectionHeader && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Security deposit payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed Stripe payments for bookings on this listing.
          </Typography>
        </>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : rows.length === 0 ? (
        <Alert severity="info">
          No paid security deposits yet for this listing. When a sublessee completes checkout, the transaction will
          appear here.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell>Paid</TableCell>
                <TableCell>Sublessee</TableCell>
                <TableCell>Booking</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((tx) => (
                <TableRow key={tx.id} hover>
                  <TableCell>{formatPaidAt(tx.paid_at)}</TableCell>
                  <TableCell>{tx.sublessee_display}</TableCell>
                  <TableCell>{tx.booking_id != null ? `#${tx.booking_id}` : "—"}</TableCell>
                  <TableCell align="right">{formatMoney(tx.amount, tx.currency)}</TableCell>
                  <TableCell>
                    <Chip label={statusLabel(tx.status)} color="success" size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
