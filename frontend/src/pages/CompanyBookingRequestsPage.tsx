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
  getCompanyManageableBookings,
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
  if (status === "declined") {
    return { label: "Declined", color: "error" };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", color: "default" };
  }
  return { label: "Pending", color: "warning" };
}

export default function CompanyBookingRequestsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<ManagedBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [busyExtensionId, setBusyExtensionId] = useState<number | null>(null);

  const canAccess = user?.user_type === "management" && user.company_status === "approved";

  useEffect(() => {
    if (!canAccess) {
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
        const data = await getCompanyManageableBookings();
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
  }, [canAccess]);

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
        nextStatus === "confirmed"
          ? "Booking approved. The sublessee can now pay the security deposit."
          : "Booking declined.",
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
      await reviewBookingExtensionRequest(extensionRequestId, {
        status: nextStatus,
        reviewer_notes: reviewerNotes || undefined,
      });
      const refreshed = await getCompanyManageableBookings();
      setBookings(refreshed);
      setSuccessMessage(
        nextStatus === "approved"
          ? "Extension approved and booking dates updated."
          : "Extension request declined.",
      );
    } catch {
      setError("Unable to review extension request. Please try again.");
    } finally {
      setBusyExtensionId(null);
    }
  }

  if (!user || user.user_type !== "management") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only management companies can view this page.</Alert>
        </Container>
      </Box>
    );
  }

  if (user.company_status !== "approved") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="warning">
            Your company must be approved before you can manage booking requests.
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
              Booking approvals
            </Typography>
            <Typography variant="body2" color="text.secondary">
              For listings your company approved, review booking requests here. Sublessees can pay the security deposit
              only after you approve.
            </Typography>
          </Box>

          {successMessage && <Alert severity="success">{successMessage}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          {loading ? (
            <Typography>Loading booking requests...</Typography>
          ) : bookings.length === 0 ? (
            <Alert severity="info">No booking requests for your company&apos;s listings yet.</Alert>
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
