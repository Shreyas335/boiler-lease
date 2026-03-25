import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Grid, Stack, TextField, Typography } from "@mui/material";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { addFavorite, createBooking, getPropertyListingDetail, removeFavorite, type PropertyListing } from "../api/listings";
import { useAuth } from "../contexts/AuthContext";

function formatMoney(value: string | null) {
  if (!value) return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return `$${number.toLocaleString()}`;
}

export default function PropertyDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bookingDates, setBookingDates] = useState({ start_date: "", end_date: "" });

  useEffect(() => {
    async function loadListing() {
      if (!id) {
        setError("Property id is required.");
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);
        const data = await getPropertyListingDetail(Number(id));
        setListing(data);
        setBookingDates({
          start_date: data.availability_start_date,
          end_date: data.availability_end_date,
        });
      } catch {
        setError("Unable to load property details.");
      } finally {
        setLoading(false);
      }
    }

    loadListing();
  }, [id]);

  async function handleToggleFavorite() {
    if (!listing) return;
    try {
      setFavoriteBusy(true);
      if (listing.is_favorited) {
        await removeFavorite(listing.id);
      } else {
        await addFavorite(listing.id);
      }
      setListing((prev) => (prev ? { ...prev, is_favorited: !prev.is_favorited } : prev));
    } catch {
      setError("Unable to update favorites.");
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleBookingSubmit() {
    if (!listing) return;

    try {
      setBookingBusy(true);
      setBookingMessage(null);
      await createBooking({
        listing: listing.id,
        start_date: bookingDates.start_date,
        end_date: bookingDates.end_date,
      });
      setBookingMessage({
        type: "success",
        text: "Booking confirmed. You can track it from your current bookings.",
      });
    } catch (err) {
      const fallback = "Unable to complete booking. Please review your dates and try again.";
      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof err.response === "object" &&
        err.response !== null &&
        "data" in err.response
      ) {
        const data = err.response.data as Record<string, string[] | string> | undefined;
        const firstMessage = data
          ? Object.values(data).flatMap((value) => (Array.isArray(value) ? value : [value]))[0]
          : null;
        setBookingMessage({ type: "error", text: typeof firstMessage === "string" ? firstMessage : fallback });
      } else {
        setBookingMessage({ type: "error", text: fallback });
      }
    } finally {
      setBookingBusy(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="lg">
          <Typography>Loading property details...</Typography>
        </Container>
      </Box>
    );
  }

  if (error || !listing) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="lg">
          <Alert severity="error">{error || "Property not found."}</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {listing.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {listing.street_line_1}
              {listing.street_line_2 ? `, ${listing.street_line_2}` : ""}, {listing.city}, {listing.state} {listing.postal_code}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={`${formatMoney(listing.monthly_rent)}/mo`} size="small" />
            {user?.user_type === "sublessee" && (
              <Button
                variant="outlined"
                color={listing.is_favorited ? "error" : "primary"}
                startIcon={listing.is_favorited ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
                onClick={handleToggleFavorite}
                disabled={favoriteBusy}
                size="small"
              >
                {listing.is_favorited ? "Saved" : "Save"}
              </Button>
            )}
          </Stack>
        </Stack>

        {listing.media.length > 0 ? (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {listing.media.map((media) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={media.id}>
                <Box
                  component="img"
                  src={media.file_url}
                  alt={listing.title}
                  sx={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            No photos available for this listing.
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>Description</Typography>
                <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>{listing.description}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>Details</Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2"><strong>Bedrooms/Bathrooms:</strong> {listing.bedrooms}/{listing.bathrooms}</Typography>
                  <Typography variant="body2"><strong>Square feet:</strong> {listing.square_feet || "-"}</Typography>
                  <Typography variant="body2"><strong>Furnished:</strong> {listing.furnished_status}</Typography>
                  <Typography variant="body2"><strong>Deposit:</strong> {formatMoney(listing.security_deposit)}</Typography>
                  <Typography variant="body2"><strong>Availability:</strong> {listing.availability_start_date} to {listing.availability_end_date}</Typography>
                  <Typography variant="body2"><strong>Utilities included:</strong> {listing.utilities_included ? "Yes" : "No"}</Typography>
                  <Typography variant="body2"><strong>Pets allowed:</strong> {listing.pets_allowed ? "Yes" : "No"}</Typography>
                  <Typography variant="body2"><strong>Smoking allowed:</strong> {listing.smoking_allowed ? "Yes" : "No"}</Typography>
                  <Typography variant="body2"><strong>Parking:</strong> {listing.parking_available ? `Yes${listing.parking_details ? ` (${listing.parking_details})` : ""}` : "No"}</Typography>
                  <Typography variant="body2"><strong>Amenities:</strong> {listing.amenities.length > 0 ? listing.amenities.map((a) => a.label).join(", ") : "None listed"}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
