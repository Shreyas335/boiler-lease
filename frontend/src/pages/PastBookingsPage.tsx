import { useCallback } from "react";
import BookingsPageContent from "../components/BookingsPageContent";
import { getPastBookings, type BookingSortBy, type SortOrder } from "../api/listings";

export default function PastBookingsPage() {
  const fetchBookings = useCallback(
    async (sortBy: BookingSortBy, order: SortOrder) => getPastBookings(sortBy, order),
    []
  );

  return (
    <BookingsPageContent
      title="Past Bookings"
      subtitle="Review your completed booking history."
      emptyMessage="No past bookings found."
      loadingText="Loading past bookings..."
      fetchBookings={fetchBookings}
    />
  );
}
