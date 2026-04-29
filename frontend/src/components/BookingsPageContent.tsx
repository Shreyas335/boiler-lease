import { useEffect, useState } from "react";
import type { AxiosError } from "axios";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  type ChipProps,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  addFavorite,
  cancelBooking,
  createBookingExtensionRequest,
  removeFavorite,
  type BookingRecord,
  type BookingSortBy,
  type PropertyListingSummary,
  type SortOrder,
} from "../api/listings";
import { createDepositCheckoutSession } from "../api/payments";
import PropertySummaryCard from "./PropertySummaryCard";
import { useAuth } from "../contexts/AuthContext";

/** Next calendar day as `YYYY-MM-DD` (avoids DST edge cases around noon UTC). */
function datePlusOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return `$${amount.toFixed(2)}`;
}

interface BookingsPageContentProps {
  title: string;
  subtitle: string;
  emptyMessage: string;
  fetchBookings: (sortBy: BookingSortBy, order: SortOrder) => Promise<BookingRecord[]>;
  loadingText: string;
  allowCancelBookings?: boolean;
}

export default function BookingsPageContent({
  title,
  subtitle,
  emptyMessage,
  fetchBookings,
  loadingText,
  allowCancelBookings = false,
}: BookingsPageContentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const identityVerified = user?.identity_verification_status === "verified";
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<BookingSortBy>("date_booked");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null);
  const [payBusyId, setPayBusyId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [extensionDialogBooking, setExtensionDialogBooking] = useState<BookingRecord | null>(null);
  const [extensionEndDate, setExtensionEndDate] = useState("");
  const [extensionNotes, setExtensionNotes] = useState("");
  const [extensionSubmitBusy, setExtensionSubmitBusy] = useState(false);

  useEffect(() => {
    async function loadBookings() {
      try {
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        const data = await fetchBookings(sortBy, order);
        setBookings(data);
      } catch {
        setError("Unable to load bookings.");
      } finally {
        setLoading(false);
      }
    }

    if (user?.user_type === "sublessee") {
      loadBookings();
    } else {
      setLoading(false);
    }
  }, [user, fetchBookings, sortBy, order]);

  function getBookingStatusMeta(status: BookingRecord["status"]): {
    label: string;
    color: ChipProps["color"];
  } {
    if (status === "confirmed") {
      return { label: "Confirmed", color: "success" };
    }
    if (status === "declined") {
      return { label: "Declined", color: "warning" };
    }
    if (status === "cancelled") {
      return { label: "Cancelled", color: "default" };
    }
    if (status === "pending") {
      return { label: "Pending", color: "info" };
    }
    return { label: "Confirmed", color: "success" };
  }

  function buildFooterText(booking: BookingRecord) {
    return `Booked on ${new Date(booking.booked_at).toLocaleDateString()} | Stay ${booking.start_date} to ${booking.end_date} | Status ${booking.status_label}`;
  }

  function bookingFooterText(booking: BookingRecord): string {
    const base = buildFooterText(booking);
    const pe = booking.pending_extension_request;
    if (pe) {
      return `${base}\nExtension request pending (requested checkout through ${pe.requested_end_date}).`;
    }
    const latest = booking.latest_extension_request;
    if (!latest) return base;
    if (latest.status === "approved") {
      return `${base}\nExtension approved through ${latest.requested_end_date}. Additional amount due: ${formatMoney(latest.additional_amount_due)}.`;
    }
    if (latest.status === "declined") {
      const reason = latest.reviewer_notes?.trim();
      return reason
        ? `${base}\nExtension declined: ${reason}`
        : `${base}\nExtension declined.`;
    }
    return base;
  }

  function effectiveDepositAmount(booking: BookingRecord): number | null {
    const snap = booking.security_deposit_snapshot;
    if (snap != null && snap !== "" && Number(snap) > 0) return Number(snap);
    const list = booking.listing.security_deposit;
    if (list != null && list !== "" && Number(list) > 0) return Number(list);
    return null;
  }

  /** Listing has a deposit and booking isn’t closed — deposit may still require approval. */
  function depositActionEligible(booking: BookingRecord): boolean {
    if (booking.deposit_paid_at) return false;
    if (booking.status === "declined" || booking.status === "cancelled") return false;
    return effectiveDepositAmount(booking) != null;
  }

  function canPaySecurityDeposit(booking: BookingRecord): boolean {
    return (
      depositActionEligible(booking) &&
      booking.status === "confirmed" &&
      identityVerified
    );
  }

  async function handlePayDeposit(bookingId: number) {
    try {
      setPayBusyId(bookingId);
      setError(null);
      const { checkout_url } = await createDepositCheckoutSession(bookingId);
      window.location.assign(checkout_url);
    } catch (e) {
      const ax = e as AxiosError<{ detail?: string | string[] }>;
      const d = ax.response?.data?.detail;
      const msg =
        typeof d === "string"
          ? d
          : Array.isArray(d) && typeof d[0] === "string"
            ? d[0]
            : "Unable to start deposit checkout.";
      setError(msg);
      setPayBusyId(null);
    }
  }

  async function toggleFavorite(listing: PropertyListingSummary) {
    try {
      setFavoriteBusyId(listing.id);
      if (listing.is_favorited) {
        await removeFavorite(listing.id);
      } else {
        await addFavorite(listing.id);
      }
      setBookings((prev) =>
        prev.map((booking) =>
          booking.listing.id === listing.id
            ? { ...booking, listing: { ...booking.listing, is_favorited: !booking.listing.is_favorited } }
            : booking
        )
      );
    } catch {
      setError("Unable to update favorites. Please try again.");
    } finally {
      setFavoriteBusyId(null);
    }
  }

  async function handleCancelBooking(bookingId: number) {
    try {
      setCancelBusyId(bookingId);
      setError(null);
      setSuccessMessage(null);
      const response = await cancelBooking(bookingId);
      setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
      setSuccessMessage(response.detail);
    } catch {
      setError("Unable to cancel booking. Please try again.");
    } finally {
      setCancelBusyId(null);
    }
  }

  function openExtensionDialog(booking: BookingRecord) {
    setExtensionDialogBooking(booking);
    setExtensionEndDate(booking.listing.availability_end_date);
    setExtensionNotes("");
  }

  async function handleSubmitExtensionRequest() {
    if (!extensionDialogBooking) return;
    const booking = extensionDialogBooking;
    const minEnd = datePlusOneDay(booking.end_date);
    const maxEnd = booking.listing.availability_end_date;
    if (extensionEndDate < minEnd || extensionEndDate > maxEnd) {
      setError(`Checkout date must be between ${minEnd} and ${maxEnd}.`);
      return;
    }
    try {
      setExtensionSubmitBusy(true);
      setError(null);
      await createBookingExtensionRequest(booking.id, {
        requested_end_date: extensionEndDate,
        sublessee_notes: extensionNotes.trim() || undefined,
      });
      setExtensionDialogBooking(null);
      setSuccessMessage("Extension request submitted.");
      const data = await fetchBookings(sortBy, order);
      setBookings(data);
    } catch (e) {
      const ax = e as AxiosError<{ detail?: string | string[] }>;
      const d = ax.response?.data?.detail;
      const msg =
        typeof d === "string"
          ? d
          : Array.isArray(d) && typeof d[0] === "string"
            ? d[0]
            : "Unable to submit extension request.";
      setError(msg);
    } finally {
      setExtensionSubmitBusy(false);
    }
  }

  if (!user || user.user_type !== "sublessee") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only sublessees can view this page.</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="booking-sort-by">Sort by</InputLabel>
              <Select
                labelId="booking-sort-by"
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value as BookingSortBy)}
              >
                <MenuItem value="date_booked">Date booked</MenuItem>
                <MenuItem value="price">Price</MenuItem>
                <MenuItem value="start_date">Start date</MenuItem>
                <MenuItem value="end_date">End date</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="booking-order">Order</InputLabel>
              <Select
                labelId="booking-order"
                value={order}
                label="Order"
                onChange={(e) => setOrder(e.target.value as SortOrder)}
              >
                <MenuItem value="desc">Descending</MenuItem>
                <MenuItem value="asc">Ascending</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!identityVerified && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button component={RouterLink} to="/dashboard" color="inherit" size="small">
                Verify identity
              </Button>
            }
          >
            Verify your identity before paying a security deposit.
          </Alert>
        )}

        {loading ? (
          <Typography>{loadingText}</Typography>
        ) : bookings.length === 0 ? (
          <Alert severity="info">{emptyMessage}</Alert>
        ) : (
          <Stack spacing={2}>
            {bookings.map((booking) => {
              const statusMeta = getBookingStatusMeta(booking.status);
              const depositEligible = depositActionEligible(booking);
              const showPayDeposit = canPaySecurityDeposit(booking);
              const showPayBlockedIdentity =
                depositEligible && booking.status === "confirmed" && !identityVerified;
              const showAwaitingApproval = depositEligible && booking.status === "pending";
              const showCancel = allowCancelBookings && booking.is_cancelable;
              const showRequestExtension = Boolean(booking.can_request_extension);

              return (
                <PropertySummaryCard
                  key={booking.id}
                  listing={booking.listing}
                  onToggleFavorite={toggleFavorite}
                  favoriteLoading={favoriteBusyId === booking.listing.id}
                  statusLabel={statusMeta.label}
                  statusColor={statusMeta.color}
                  actionButton={
                    showPayDeposit
                      ? {
                          label: payBusyId === booking.id ? "Redirecting..." : "Pay security deposit",
                          onClick: () => void handlePayDeposit(booking.id),
                          disabled: payBusyId === booking.id,
                          color: "primary",
                        }
                      : showAwaitingApproval
                        ? {
                            label: "Awaiting approval",
                            onClick: () => undefined,
                            disabled: true,
                            color: "primary",
                          }
                      : showPayBlockedIdentity
                        ? {
                            label: "Verify identity to pay deposit",
                            onClick: () => navigate("/dashboard"),
                            color: "primary",
                          }
                        : showCancel
                          ? {
                              label: cancelBusyId === booking.id ? "Cancelling..." : "Cancel Booking",
                              onClick: () => handleCancelBooking(booking.id),
                              disabled: cancelBusyId === booking.id,
                              color: "error",
                            }
                          : undefined
                  }
                  secondaryActionButton={
                    depositEligible && showCancel
                      ? {
                          label: cancelBusyId === booking.id ? "Cancelling..." : "Cancel booking",
                          onClick: () => handleCancelBooking(booking.id),
                          disabled: cancelBusyId === booking.id || payBusyId === booking.id,
                          color: "error",
                        }
                      : undefined
                  }
                  extensionButton={
                    showRequestExtension
                      ? {
                          label: "Request extension",
                          onClick: () => openExtensionDialog(booking),
                          disabled: extensionSubmitBusy && extensionDialogBooking?.id === booking.id,
                          color: "primary",
                        }
                      : undefined
                  }
                  footerText={bookingFooterText(booking)}
                />
              );
            })}
          </Stack>
        )}
        <Dialog
          open={extensionDialogBooking !== null}
          onClose={() => !extensionSubmitBusy && setExtensionDialogBooking(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Request lease extension</DialogTitle>
          <DialogContent>
            {extensionDialogBooking && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Current checkout is {extensionDialogBooking.end_date}. The listing is available through{" "}
                  {extensionDialogBooking.listing.availability_end_date}.
                </Typography>
                <TextField
                  label="Requested new checkout date"
                  type="date"
                  value={extensionEndDate}
                  onChange={(e) => setExtensionEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: datePlusOneDay(extensionDialogBooking.end_date),
                    max: extensionDialogBooking.listing.availability_end_date,
                  }}
                  fullWidth
                />
                <TextField
                  label="Note (optional)"
                  multiline
                  minRows={2}
                  value={extensionNotes}
                  onChange={(e) => setExtensionNotes(e.target.value)}
                  fullWidth
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExtensionDialogBooking(null)} disabled={extensionSubmitBusy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubmitExtensionRequest()}
              disabled={extensionSubmitBusy}
            >
              {extensionSubmitBusy ? "Submitting…" : "Submit request"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
