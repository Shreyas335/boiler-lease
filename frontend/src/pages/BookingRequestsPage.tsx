import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
  type ChipProps,
} from "@mui/material";
import {
  getManageableBookings,
  reviewBookingExtensionRequest,
  updateBookingStatus,
  type ManagedBookingRecord,
} from "../api/listings";
import { useAuth } from "../contexts/AuthContext";

function getBookingStatusMeta(status: ManagedBookingRecord["status"]): {
  label: string;
  color: ChipProps["color"];
} {
  if (status === "confirmed") {
    return { label: "Confirmed", color: "success" };
  }
  if (status === "partially_paid") {
    return { label: "Partially Paid", color: "warning" };
  }
  if (status === "fully_paid") {
    return { label: "Fully Paid", color: "success" };
  }
  if (status === "declined") {
    return { label: "Declined", color: "error" };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", color: "default" };
  }
  return { label: "Pending", color: "warning" };
}

function formatMoney(value: string | null): string {
  const amount = Number(value ?? "");
  if (Number.isNaN(amount)) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

export default function BookingRequestsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<ManagedBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [busyExtensionId, setBusyExtensionId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.user_type !== "subleaser") {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function loadBookings(showSpinner: boolean) {
      try {
        if (showSpinner && isMounted) {
          setLoading(true);
        }
        if (isMounted) {
          setError(null);
        }
        const data = await getManageableBookings();
        if (isMounted) {
          setBookings(data);
        }
      } catch {
        if (isMounted) {
          setError("Unable to load booking requests.");
        }
      } finally {
        if (showSpinner && isMounted) {
          setLoading(false);
        }
      }
    }

    void loadBookings(true);
    const intervalId = window.setInterval(() => {
      void loadBookings(false);
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user]);

  async function handleStatusUpdate(
    bookingId: number,
    nextStatus: "confirmed" | "declined",
  ) {
    try {
      setBusyBookingId(bookingId);
      setError(null);
      setSuccessMessage(null);
      const updatedBooking = await updateBookingStatus(bookingId, nextStatus);
      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === bookingId ? updatedBooking : booking,
        ),
      );
      setSuccessMessage(
        `Booking ${nextStatus === "confirmed" ? "approved" : "declined"} successfully.`,
      );
    } catch {
      setError("Unable to update booking status. Please try again.");
    } finally {
      setBusyBookingId(null);
    }
  }

  async function handleExtensionReview(
    extensionRequestId: number,
    nextStatus: "approved" | "declined",
  ) {
    try {
      setBusyExtensionId(extensionRequestId);
      setError(null);
      setSuccessMessage(null);
      const reviewerNotes =
        nextStatus === "declined"
          ? window.prompt("Optional decline reason to share with the sublessee:", "") || ""
          : "";
      const reviewed = await reviewBookingExtensionRequest(extensionRequestId, {
        status: nextStatus,
        reviewer_notes: reviewerNotes || undefined,
      });
      const refreshed = await getManageableBookings();
      setBookings(refreshed);
      setSuccessMessage(
        nextStatus === "approved"
          ? `Extension approved. Additional amount due: ${formatMoney(reviewed.additional_amount_due)}.`
          : "Extension request declined.",
      );
    } catch {
      setError("Unable to review extension request. Please try again.");
    } finally {
      setBusyExtensionId(null);
    }
  }

  if (!user || user.user_type !== "subleaser") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">
            Only subleasers can view booking requests.
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Booking Requests
            </Typography>
            <Typography variant="body2" color="text.secondary">
              For your listings that are not under a management company, approve or decline bookings here. If a listing
              was approved by a management company, that company approves bookings instead—sublessees pay the deposit
              only after approval.
            </Typography>
          </Box>

          {successMessage && <Alert severity="success">{successMessage}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          {loading ? (
            <Typography>Loading booking requests...</Typography>
          ) : bookings.length === 0 ? (
            <Alert severity="info">No booking requests yet.</Alert>
          ) : (
            <Stack spacing={2}>
              {bookings.map((booking) => {
                const statusMeta = getBookingStatusMeta(booking.status);
                const isPending = booking.status === "pending";
                const isBusy = busyBookingId === booking.id;
                const pendingExtension = booking.pending_extension_request;
                const isExtensionBusy = pendingExtension
                  ? busyExtensionId === pendingExtension.id
                  : false;

                return (
                  <Card key={booking.id}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          gap={1}
                        >
                          <Box>
                            <Typography variant="h6">{booking.listing.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {booking.listing.city}, {booking.listing.state}
                            </Typography>
                          </Box>
                          <Chip label={statusMeta.label} color={statusMeta.color} />
                        </Stack>

                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            Requested by {booking.sublessee_name} ({booking.sublessee_email})
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Stay {booking.start_date} to {booking.end_date}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Submitted {new Date(booking.booked_at).toLocaleDateString()}
                          </Typography>
                        </Stack>

                        {pendingExtension && (
                          <Stack spacing={1}>
                            <Alert severity="info">
                              Extension requested through {pendingExtension.requested_end_date}.
                            </Alert>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                              <Button
                                variant="contained"
                                disabled={isExtensionBusy}
                                onClick={() =>
                                  handleExtensionReview(
                                    pendingExtension.id,
                                    "approved",
                                  )
                                }
                              >
                                {isExtensionBusy ? "Saving..." : "Approve extension"}
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                                disabled={isExtensionBusy}
                                onClick={() =>
                                  handleExtensionReview(
                                    pendingExtension.id,
                                    "declined",
                                  )
                                }
                              >
                                {isExtensionBusy ? "Saving..." : "Decline extension"}
                              </Button>
                            </Stack>
                          </Stack>
                        )}

                        {isPending && (
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button
                              variant="contained"
                              disabled={isBusy}
                              onClick={() => handleStatusUpdate(booking.id, "confirmed")}
                            >
                              {isBusy ? "Saving..." : "Approve"}
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              disabled={isBusy}
                              onClick={() => handleStatusUpdate(booking.id, "declined")}
                            >
                              {isBusy ? "Saving..." : "Decline"}
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
