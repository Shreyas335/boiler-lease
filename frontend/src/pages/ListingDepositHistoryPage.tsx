import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";
import type { AxiosError } from "axios";
import { getPropertyListingDetail, type PropertyListing } from "../api/listings";
import { useAuth } from "../contexts/AuthContext";
import ListingOwnerDepositTransactions from "../components/ListingOwnerDepositTransactions";

export default function ListingDepositHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const listingId = Number.parseInt(id ?? "", 10);
  const { user } = useAuth();
  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingListing, setLoadingListing] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(listingId) || listingId < 1) {
      setLoadError("Invalid listing.");
      setLoadingListing(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadError(null);
      setLoadingListing(true);
      try {
        const data = await getPropertyListingDetail(listingId);
        if (!cancelled) {
          setListing(data);
        }
      } catch (err) {
        const ax = err as AxiosError<{ detail?: string }>;
        const msg =
          (typeof ax.response?.data?.detail === "string" && ax.response.data.detail) ||
          "Unable to load this listing.";
        if (!cancelled) {
          setListing(null);
          setLoadError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoadingListing(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!user) return null;
  if (user.user_type !== "subleaser") {
    return <Navigate to="/dashboard" replace />;
  }

  const invalidId = !Number.isFinite(listingId) || listingId < 1;

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/my-listings" underline="hover" color="inherit" variant="body2">
            My listings
          </Link>
          <Typography color="text.primary" variant="body2">
            Deposit payments
          </Typography>
        </Breadcrumbs>

        {invalidId ? (
          <Alert severity="error">Invalid listing.</Alert>
        ) : loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : loadingListing || !listing ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : listing.owner !== undefined && listing.owner !== user.id ? (
          <Alert severity="error">You can only view deposit payments for your own listings.</Alert>
        ) : (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }} sx={{ mb: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Deposit payments
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>
                  {listing.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Successful security deposits from Stripe checkout for bookings on this listing.
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                to={`/listings/${listing.id}/edit`}
                state={{ listing }}
                variant="outlined"
                sx={{ flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}
              >
                Edit listing
              </Button>
            </Stack>

            <ListingOwnerDepositTransactions listingId={listing.id} showSectionHeader={false} />
          </>
        )}
      </Container>
    </Box>
  );
}
