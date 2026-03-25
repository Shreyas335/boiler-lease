import { useCallback } from "react";
import BookingsPageContent from "../components/BookingsPageContent";
import { getCurrentBookings, type BookingSortBy, type SortOrder } from "../api/listings";

export default function CurrentBookingsPage() {
  const fetchBookings = useCallback(
    async (sortBy: BookingSortBy, order: SortOrder) => getCurrentBookings(sortBy, order),
    []
  );

  return (
    <BookingsPageContent
      title="Current Bookings"
      subtitle="View all active and upcoming places you have booked."
      emptyMessage="You don't have any current bookings yet."
      loadingText="Loading current bookings..."
      fetchBookings={fetchBookings}
      allowCancelUpcoming
    />
  );
}
