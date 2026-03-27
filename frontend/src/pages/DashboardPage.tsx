import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Stack,
  type ChipProps,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import PropertySummaryCard from "../components/PropertySummaryCard";
import { getBookingHistory, type BookingRecord } from "../api/listings";
import { useAuth } from "../contexts/AuthContext";

const USER_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  sublessee: {
    label: "Sublessee",
    icon: <HomeWorkRoundedIcon sx={{ fontSize: 40 }} />,
    description: "Find and manage your sublets",
  },
  subleaser: {
    label: "Subleaser",
    icon: <PersonSearchRoundedIcon sx={{ fontSize: 40 }} />,
    description: "List your space and find sublessees",
  },
  management: {
    label: "Management Company",
    icon: <BusinessRoundedIcon sx={{ fontSize: 40 }} />,
    description: "Oversee subleases across your properties",
  },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [recentBookings, setRecentBookings] = useState<BookingRecord[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const userType = user?.user_type;

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
    return { label: "Pending", color: "info" };
  }

  useEffect(() => {
    if (userType !== "sublessee") return undefined;

    let isMounted = true;

    async function loadBookingHistory(showSpinner: boolean) {
      try {
        if (showSpinner && isMounted) {
          setBookingsLoading(true);
        }
        if (isMounted) {
          setBookingsError(null);
        }
        const data = await getBookingHistory("date_booked", "desc");
        if (isMounted) {
          setRecentBookings(data.slice(0, 3));
        }
      } catch {
        if (isMounted) {
          setBookingsError("Unable to load recent booking updates.");
        }
      } finally {
        if (showSpinner && isMounted) {
          setBookingsLoading(false);
        }
      }
    }

    void loadBookingHistory(true);
    const intervalId = window.setInterval(() => {
      void loadBookingHistory(false);
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [userType]);

  if (!user) return null;

  const config = USER_TYPE_CONFIG[user.user_type] || USER_TYPE_CONFIG.sublessee;

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        {!user.email_verified && (
          <Alert
            severity="warning"
            icon={<WarningAmberRoundedIcon />}
            sx={{ mb: 3 }}
          >
            Your email hasn&apos;t been verified yet. Please check your inbox
            for the verification link, or open Account settings (gear icon) to
            resend it.
          </Alert>
        )}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Welcome back, {user.first_name || user.username}
          </Typography>
          <Chip
            label={config.label}
            color="primary"
            size="small"
            sx={{ mt: 1 }}
          />
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Box sx={{ color: "primary.main" }}>{config.icon}</Box>
              <Box>
                <Typography variant="h6">Your dashboard</Typography>
                <Typography variant="body2" color="text.secondary">
                  {config.description}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              More features are coming soon. You're all set up and ready to go.
            </Typography>
          </CardContent>
        </Card>

        {user.user_type === "sublessee" && (
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Recent booking updates</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Booking statuses refresh automatically every 15 seconds.
                  </Typography>
                </Box>

                {bookingsError && <Alert severity="error">{bookingsError}</Alert>}

                {bookingsLoading ? (
                  <Typography>Loading recent booking updates...</Typography>
                ) : recentBookings.length === 0 ? (
                  <Alert severity="info">You haven&apos;t submitted any bookings yet.</Alert>
                ) : (
                  <Stack spacing={2}>
                    {recentBookings.map((booking) => {
                      const statusMeta = getBookingStatusMeta(booking.status);
                      return (
                        <PropertySummaryCard
                          key={booking.id}
                          listing={booking.listing}
                          statusLabel={statusMeta.label}
                          statusColor={statusMeta.color}
                          footerText={`Submitted ${new Date(booking.booked_at).toLocaleDateString()} | Stay ${booking.start_date} to ${booking.end_date}`}
                        />
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {user.user_type === "sublessee" && (
            <>
              <Button component={RouterLink} to="/browse" variant="outlined">
                Browse listings
              </Button>
              <Button
                component={RouterLink}
                to="/bookings/current"
                variant="outlined"
              >
                Current bookings
              </Button>
              <Button
                component={RouterLink}
                to="/bookings/past"
                variant="outlined"
              >
                Past bookings
              </Button>
              <Button component={RouterLink} to="/favorites" variant="outlined">
                Favorites
              </Button>
            </>
          )}
          {user.user_type === "subleaser" && (
            <>
              <Button
                component={RouterLink}
                to="/listings/new"
                variant="outlined"
              >
                Create listing
              </Button>
              <Button
                component={RouterLink}
                to="/my-listings"
                variant="outlined"
              >
                My listings
              </Button>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
