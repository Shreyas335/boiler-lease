import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import { DeleteOutlined, EditOutlined } from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  getMyListings,
  deleteListing,
  type PropertyListing,
} from "../api/listings";
import { useAuth } from "../contexts/AuthContext";

function formatMoney(value: string | null) {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `$${num.toLocaleString()}`;
}

export default function MyListingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<number | null>(
    null,
  );
  const [selectedListingTitle, setSelectedListingTitle] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function loadListings() {
      try {
        const data = await getMyListings();
        setListings(data);
      } catch {
        setError("Unable to load your listings.");
      } finally {
        setLoading(false);
      }
    }

    if (user?.user_type === "subleaser") {
      loadListings();
    } else {
      setLoading(false);
    }
  }, [user]);

  function handleEditClick(listing: PropertyListing) {
    navigate(`/listings/${listing.id}/edit`, { state: { listing } });
  }

  function handleDeleteClick(listing: PropertyListing) {
    setSelectedListingId(listing.id);
    setSelectedListingTitle(listing.title);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedListingId) return;

    setDeleteLoading(true);
    try {
      await deleteListing(selectedListingId);
      setListings((prev) => prev.filter((l) => l.id !== selectedListingId));
      setDeleteDialogOpen(false);
      setSelectedListingId(null);
      setSelectedListingTitle("");
    } catch (err) {
      setError("Failed to delete listing. Please try again.");
      console.log(err);
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleCancelDelete() {
    setDeleteDialogOpen(false);
    setSelectedListingId(null);
    setSelectedListingTitle("");
  }

  if (!user || user.user_type !== "subleaser") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only subleasers can view this page.</Alert>
        </Container>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="lg">
          <Typography>Loading listings...</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              My Listings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review all property listings you have created.
            </Typography>
          </Box>
          <Button component={RouterLink} to="/listings/new" variant="contained">
            Create new listing
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {listings.length === 0 ? (
          <Card>
            <CardContent>
              <Typography>No listings yet.</Typography>
              <Typography variant="body2" color="text.secondary">
                Create your first listing to make your unit visible to
                sublessees.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {listings.map((listing) => (
              <Card key={listing.id}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={2}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {listing.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {listing.street_line_1}
                          {listing.street_line_2
                            ? `, ${listing.street_line_2}`
                            : ""}
                          , {listing.city}, {listing.state}{" "}
                          {listing.postal_code}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Stack direction="row" spacing={1}>
                          <Chip size="small" label={listing.status} />
                          <Chip size="small" label={listing.approval_status} />
                        </Stack>
                        <Stack direction="row" spacing={0}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditClick(listing)}
                            title="Edit listing"
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(listing)}
                            title="Delete listing"
                          >
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Stack>

                    <Typography variant="body2">
                      {listing.description}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={3}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2">
                        <strong>Rent:</strong>{" "}
                        {formatMoney(listing.monthly_rent)}/mo
                      </Typography>
                      <Typography variant="body2">
                        <strong>Deposit:</strong>{" "}
                        {formatMoney(listing.security_deposit)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Beds/Baths:</strong> {listing.bedrooms}/
                        {listing.bathrooms}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Sq ft:</strong> {listing.square_feet || "-"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Furnished:</strong> {listing.furnished_status}
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={3}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2">
                        <strong>Availability:</strong>{" "}
                        {listing.availability_start_date} to{" "}
                        {listing.availability_end_date}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Lease term:</strong>{" "}
                        {listing.lease_term_min_months || "-"} to{" "}
                        {listing.lease_term_max_months || "-"} months
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={3}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2">
                        <strong>Utilities included:</strong>{" "}
                        {listing.utilities_included ? "Yes" : "No"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Pets allowed:</strong>{" "}
                        {listing.pets_allowed ? "Yes" : "No"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Smoking allowed:</strong>{" "}
                        {listing.smoking_allowed ? "Yes" : "No"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Parking:</strong>{" "}
                        {listing.parking_available
                          ? `Yes${listing.parking_details ? ` (${listing.parking_details})` : ""}`
                          : "No"}
                      </Typography>
                    </Stack>

                    <Divider />

                    <Stack
                      direction="row"
                      spacing={3}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2">
                        <strong>Building:</strong>{" "}
                        {listing.building_name || "-"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Unit:</strong> {listing.unit_number || "-"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Contact email:</strong>{" "}
                        {listing.contact_email || "-"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Contact phone:</strong>{" "}
                        {listing.contact_phone || "-"}
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={3}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2">
                        <strong>Virtual tour:</strong>{" "}
                        {listing.virtual_tour_url || "-"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Coordinates:</strong>{" "}
                        {listing.latitude && listing.longitude
                          ? `${listing.latitude}, ${listing.longitude}`
                          : "-"}
                      </Typography>
                    </Stack>

                    <Typography variant="body2">
                      <strong>Amenities:</strong>{" "}
                      {listing.amenities.length > 0
                        ? listing.amenities
                            .map((amenity) => amenity.label)
                            .join(", ")
                        : "None selected"}
                    </Typography>

                    {listing.media && listing.media.length > 0 && (
                      <>
                        <Divider />
                        <Typography variant="body2"><strong>Photos ({listing.media.length})</strong></Typography>
                        <Grid container spacing={1}>
                          {listing.media.map((m) => (
                            <Grid key={m.id} size={{ xs: 4, sm: 3, md: 2 }}>
                              <Box sx={{ position: "relative" }}>
                                <Box
                                  component="img"
                                  src={m.access_url || m.file_url || ""}
                                  alt={m.original_filename || "Photo"}
                                  sx={{
                                    width: "100%",
                                    height: 80,
                                    objectFit: "cover",
                                    borderRadius: 1,
                                    display: "block",
                                  }}
                                />
                                <Chip
                                  size="small"
                                  icon={m.is_private ? <LockIcon /> : <PublicIcon />}
                                  label={m.is_private ? "Private" : "Public"}
                                  sx={{
                                    position: "absolute",
                                    top: 4,
                                    left: 4,
                                    height: 20,
                                    fontSize: "0.65rem",
                                    opacity: 0.9,
                                  }}
                                  color={m.is_private ? "warning" : "default"}
                                />
                                {m.is_primary && (
                                  <Chip
                                    size="small"
                                    label="Primary"
                                    color="primary"
                                    sx={{
                                      position: "absolute",
                                      bottom: 4,
                                      left: 4,
                                      height: 20,
                                      fontSize: "0.65rem",
                                      opacity: 0.9,
                                    }}
                                  />
                                )}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delist Property?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delist{" "}
            <strong>{selectedListingTitle}</strong>? It will no longer be
            available to sublessees.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delist"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
