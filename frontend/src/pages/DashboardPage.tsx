import { useState, useEffect } from "react";
import * as identityApi from "../api/identity";
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
  Tooltip,
  type ChipProps,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import VerifiedIcon from "@mui/icons-material/Verified";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import PropertySummaryCard from "../components/PropertySummaryCard";
import { getBookingHistory, type BookingRecord } from "../api/listings";
import { getCompanyDashboardStats, type CompanyDashboardStats } from '../api/company';
import { useAuth } from "../contexts/AuthContext";
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';

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
  const { user, refreshUser } = useAuth();
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityNotice, setIdentityNotice] = useState<"verified" | "pending" | "failed" | "sync_error" | null>(
    null
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [recentBookings, setRecentBookings] = useState<BookingRecord[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [depositNotice, setDepositNotice] = useState<"success" | "canceled" | null>(null);
  const [dashStats, setDashStats] = useState<CompanyDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const userType = user?.user_type;

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (searchParams.get("identity_return") !== "1") {
      return undefined;
    }
    if (!user || (user.user_type !== "sublessee" && user.user_type !== "subleaser")) {
      return undefined;
    }

    let cancelled = false;

    async function pullStripeStatus() {
      try {
        const { identity_verification_status: next } = await identityApi.syncIdentityVerificationStatus();
        if (cancelled) return;
        await refreshUser();
        if (next === "verified") setIdentityNotice("verified");
        else if (next === "failed") setIdentityNotice("failed");
        else setIdentityNotice("pending");
      } catch {
        if (!cancelled) setIdentityNotice("sync_error");
      } finally {
        if (!cancelled) navigate("/dashboard", { replace: true });
      }
    }

    void pullStripeStatus();
    return () => {
      cancelled = true;
    };
  }, [user, searchParams, navigate, refreshUser]);

  function getBookingStatusMeta(status: BookingRecord["status"]): {
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

  useEffect(() => {
    if (userType !== 'management') return undefined;
    if (user?.company_status !== 'approved') return undefined;
    let isMounted = true;
    async function loadStats(showSpinner: boolean) {
      try {
        if (showSpinner && isMounted) setStatsLoading(true);
        if (isMounted) setStatsError(null);
        const data = await getCompanyDashboardStats();
        if (isMounted) setDashStats(data);
      } catch {
        if (isMounted) setStatsError('Unable to load dashboard stats.');
      } finally {
        if (showSpinner && isMounted) setStatsLoading(false);
      }
    }
    void loadStats(true);
    const intervalId = window.setInterval(() => void loadStats(false), 30000);
    return () => { isMounted = false; window.clearInterval(intervalId); };
  }, [userType, user?.company_status]);

  useEffect(() => {
    if (userType !== "sublessee") return;
    const d = searchParams.get("deposit");
    if (d === "success" || d === "canceled") {
      setDepositNotice(d);
      navigate("/dashboard", { replace: true });
    }
  }, [searchParams, navigate, userType]);

  if (!user) return null;

  const config = USER_TYPE_CONFIG[user.user_type] || USER_TYPE_CONFIG.sublessee;

  const showIdentityCta =
    (user.user_type === "sublessee" || user.user_type === "subleaser") &&
    user.identity_verification_status !== "verified";
  const identityActionLabel =
    user.identity_verification_status === "failed"
      ? "Retry verification"
      : user.identity_verification_status === "pending"
        ? "Continue verification"
        : "Verify identity";

  const startIdentity = async () => {
    setIdentityBusy(true);
    try {
      const { url } = await identityApi.startIdentityVerificationSession();
      window.location.assign(url);
    } catch {
      setIdentityBusy(false);
    }
  };

  const refreshIdentityStatus = async () => {
    setIdentityBusy(true);
    setIdentityNotice(null);
    try {
      const { identity_verification_status: next } = await identityApi.syncIdentityVerificationStatus();
      await refreshUser();
      if (next === "verified") setIdentityNotice("verified");
      else if (next === "failed") setIdentityNotice("failed");
      else setIdentityNotice("pending");
    } catch {
      setIdentityNotice("sync_error");
    } finally {
      setIdentityBusy(false);
    }
  };

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        {identityNotice === "verified" && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setIdentityNotice(null)}>
            Identity verified. You can list properties, book, and pay deposits as allowed for your account.
          </Alert>
        )}
        {identityNotice === "failed" && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setIdentityNotice(null)}
            action={
              <Button color="inherit" size="small" disabled={identityBusy} onClick={() => void startIdentity()}>
                Retry verification
              </Button>
            }
          >
            We couldn&apos;t verify your identity. You can try again with clear document photos.
          </Alert>
        )}
        {identityNotice === "pending" && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            onClose={() => setIdentityNotice(null)}
            action={
              <Button
                color="inherit"
                size="small"
                disabled={identityBusy}
                onClick={() => void refreshIdentityStatus()}
              >
                Refresh status
              </Button>
            }
          >
            Verification is still processing. If you just finished on Stripe, tap Refresh status—it may take a few
            seconds.
          </Alert>
        )}
        {identityNotice === "sync_error" && (
          <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setIdentityNotice(null)}>
            Could not refresh verification status from Stripe. Check your connection, ensure Stripe is configured,
            then try Refresh status from the verification card below.
          </Alert>
        )}
        {showIdentityCta && (
          <Alert
            severity={user.identity_verification_status === "failed" ? "warning" : "info"}
            sx={{ mb: 3 }}
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                {(user.identity_verification_status === "pending" ||
                  user.identity_verification_status === "failed") && (
                  <Button
                    color="inherit"
                    size="small"
                    disabled={identityBusy}
                    onClick={() => void refreshIdentityStatus()}
                  >
                    Refresh status
                  </Button>
                )}
                <Button
                  color="inherit"
                  size="small"
                  disabled={identityBusy}
                  onClick={() => void startIdentity()}
                >
                  {identityBusy ? "Starting…" : identityActionLabel}
                </Button>
              </Stack>
            }
          >
            Verify your identity for trust before you list or
            book. You&apos;ll complete checks on Stripe&apos;s secure page (test mode
            uses sample documents).
          </Alert>
        )}
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
        {user.user_type === "management" && user.company_status === "pending" && (
          <Alert severity="warning" icon={<WarningAmberRoundedIcon />} sx={{ mb: 3 }}>
            Your company is pending verification. Upload your documents to speed up the review process.{" "}
            <RouterLink to="/company/verify" style={{ fontWeight: 600 }}>
              Upload Documents
            </RouterLink>
          </Alert>
        )}
        {user.user_type === "management" && user.company_status === "rejected" && (
          <Alert severity="error" icon={<WarningAmberRoundedIcon />} sx={{ mb: 3 }}>
            Your company verification was rejected. Please re-upload your documents.{" "}
            <RouterLink to="/company/verify" style={{ fontWeight: 600 }}>
              Re-upload Documents
            </RouterLink>
          </Alert>
        )}
        {user.user_type === "sublessee" && depositNotice === "success" && (
          <Alert
            severity="success"
            onClose={() => setDepositNotice(null)}
            sx={{ mb: 3 }}
          >
            Your security deposit payment went through. If your booking does not show as paid yet, wait a few seconds
            and refresh—confirmation arrives via Stripe. View details in{" "}
            <RouterLink to="/payments/history" style={{ fontWeight: 600 }}>
              payment history
            </RouterLink>
            .
          </Alert>
        )}
        {user.user_type === "sublessee" && depositNotice === "canceled" && (
          <Alert severity="info" onClose={() => setDepositNotice(null)} sx={{ mb: 3 }}>
            Checkout was canceled; no charge was made. You can pay the deposit again from your booking when you are
            ready.
          </Alert>
        )}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Welcome back, {user.first_name || user.username}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
            <Chip label={config.label} color="primary" size="small" />
            {(user.user_type === "sublessee" || user.user_type === "subleaser") &&
              user.identity_verification_status === "verified" && (
                <Chip icon={<VerifiedIcon fontSize="small" />} label="Identity verified" color="success" size="small" />
              )}
          </Stack>
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
            {user.user_type === 'management' && (
              <>
                {user.company_status !== 'approved' && (
                  <Alert severity='warning' sx={{ mt: 1 }}>
                    Your company must be approved before you can access dashboard stats and management features.
                  </Alert>
                )}
                {statsLoading && <CircularProgress size={24} sx={{ mt: 1 }} />}
                {statsError && <Alert severity='error' sx={{ mt: 1 }}>{statsError}</Alert>}
                {dashStats && (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card variant='outlined'>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant='h3' color='primary'>{dashStats.total_listings}</Typography>
                          <Typography variant='body2' color='text.secondary'>Total Listings</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card variant='outlined'>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant='h3' color='warning.main'>{dashStats.pending_approvals}</Typography>
                          <Typography variant='body2' color='text.secondary'>Pending Approvals</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card variant='outlined'>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography variant='h3' color='success.main'>{dashStats.active_bookings}</Typography>
                          <Typography variant='body2' color='text.secondary'>Active Bookings</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={12}>
                      <Typography variant='subtitle2' sx={{ mt: 1, mb: 1 }}>Recent Transactions</Typography>
                      {dashStats.recent_transactions.length === 0 ? (
                        <Alert severity='info'>No recent transactions.</Alert>
                      ) : (
                        <Stack spacing={1}>
                          {dashStats.recent_transactions.map(txn => (
                            <Box key={txn.id} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <Typography variant='body2'>${txn.amount} {txn.currency.toUpperCase()}</Typography>
                              <Chip label={txn.status} size='small' color={txn.status === 'succeeded' ? 'success' : 'default'} />
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Grid>
                  </Grid>
                )}
              </>
            )}
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
              <Button component={RouterLink} to="/payments/history" variant="outlined">
                Payment history
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
              <Button
                component={RouterLink}
                to="/booking-requests"
                variant="outlined"
              >
                Booking requests
              </Button>
            </>
          )}
          { user.user_type === "management" && user.company_status !== "approved" &&
            <Button
                component={RouterLink}
                to="/company/verify"
                variant="outlined"
              >
                Upload Documents
              </Button>
          }
          {user.user_type === "management" && (
            <>
              <Tooltip title={user.company_status !== "approved" ? "Company verification required" : ""}>
                <span>
                  <Button
                    component={user.company_status === "approved" ? RouterLink : "button"}
                    to={user.company_status === "approved" ? "/company/guidelines" : undefined}
                    variant="outlined"
                    disabled={user.company_status !== "approved"}
                  >
                    Guideline Settings
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={user.company_status !== "approved" ? "Company verification required" : ""}>
                <span>
                  <Button
                    component={user.company_status === "approved" ? RouterLink : "button"}
                    to={user.company_status === "approved" ? "/company/approvals" : undefined}
                    variant="outlined"
                    disabled={user.company_status !== "approved"}
                  >
                    Approval Queue
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={user.company_status !== "approved" ? "Company verification required" : ""}>
                <span>
                  <Button
                    component={user.company_status === "approved" ? RouterLink : "button"}
                    to={user.company_status === "approved" ? "/company/bookings" : undefined}
                    variant="outlined"
                    disabled={user.company_status !== "approved"}
                  >
                    Booking approvals
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={user.company_status !== 'approved' ? 'Company verification required' : ''}>
                <span>
                  <Button
                    component={user.company_status === 'approved' ? RouterLink : 'button'}
                    to={user.company_status === 'approved' ? '/company/listings' : undefined}
                    variant="outlined"
                    disabled={user.company_status !== 'approved'}
                  >
                    My Listings
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
