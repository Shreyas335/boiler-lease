import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Container, FormControl, InputLabel, MenuItem, Select, Stack, Typography, type ChipProps } from "@mui/material";
import {
  addFavorite,
  cancelBooking,
  removeFavorite,
  type BookingRecord,
  type BookingSortBy,
  type PropertyListingSummary,
  type SortOrder,
} from "../api/listings";
import PropertySummaryCard from "./PropertySummaryCard";
import { useAuth } from "../contexts/AuthContext";

interface BookingsPageContentProps {
  title: string;
  subtitle: string;
  emptyMessage: string;
  fetchBookings: (sortBy: BookingSortBy, order: SortOrder) => Promise<BookingRecord[]>;
  loadingText: string;
  allowCancelUpcoming?: boolean;
}

export default function BookingsPageContent({
  title,
  subtitle,
  emptyMessage,
  fetchBookings,
  loadingText,
  allowCancelUpcoming = false,
}: BookingsPageContentProps) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<BookingSortBy>("date_booked");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null);

  useEffect(() => {
    async function loadBookings() {
      try {
        setError(null);
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

  const sortLabel = useMemo(() => {
    if (sortBy === "price") return "Price";
    if (sortBy === "start_date") return "Start date";
    if (sortBy === "end_date") return "End date";
    return "Date booked";
  }, [sortBy]);

  function getBookingStatusMeta(status: BookingRecord["booking_status"]): {
    label: string;
    color: ChipProps["color"];
  } {
    if (status === "active") {
      return { label: "Active", color: "success" };
    }
    if (status === "completed") {
      return { label: "Completed", color: "default" };
    }
    return { label: "Upcoming", color: "info" };
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
      await cancelBooking(bookingId);
      setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
    } catch {
      setError("Unable to cancel booking. Please try again.");
    } finally {
      setCancelBusyId(null);
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

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Typography>{loadingText}</Typography>
        ) : bookings.length === 0 ? (
          <Alert severity="info">{emptyMessage}</Alert>
        ) : (
          <Stack spacing={2}>
            {bookings.map((booking) => (
              <PropertySummaryCard
                key={booking.id}
                listing={booking.listing}
                onToggleFavorite={toggleFavorite}
                favoriteLoading={favoriteBusyId === booking.listing.id}
                statusLabel={getBookingStatusMeta(booking.booking_status).label}
                statusColor={getBookingStatusMeta(booking.booking_status).color}
                actionButton={
                  allowCancelUpcoming && booking.booking_status === "upcoming"
                    ? {
                        label: cancelBusyId === booking.id ? "Canceling..." : "Cancel booking",
                        onClick: () => handleCancelBooking(booking.id),
                        disabled: cancelBusyId === booking.id,
                        color: "error",
                      }
                    : undefined
                }
                footerText={`Booked on ${new Date(booking.booked_at).toLocaleDateString()} | Stay ${booking.start_date} to ${booking.end_date} | Sorted by ${sortLabel.toLowerCase()} (${order})`}
              />
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
