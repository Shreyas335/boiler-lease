import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  type ChipProps,
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
import {
  CalendarTodayOutlined,
  DeleteOutlined,
  EditOutlined,
  KingBedOutlined,
  LocationOnOutlined,
  PaymentsOutlined,
  ShowerOutlined,
  SquareFootOutlined,
} from "@mui/icons-material";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
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

function formatRentChip(value: string | null) {
  const formatted = formatMoney(value);
  return formatted === "-" ? "Rent -" : `${formatted}/mo`;
}

function formatDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function resolveStatusColor(value: string): ChipProps["color"] {
  const normalized = value.toLowerCase();
  if (normalized === "published") return "success";
  if (normalized === "draft") return "warning";
  if (normalized === "unpublished") return "default";
  if (normalized === "approved") return "success";
  if (normalized === "pending") return "warning";
  if (normalized === "rejected") return "error";
  if (normalized === "not_submitted") return "default";
  return "default";
}

function approvalStatusLabel(value: string): string {
  if (value === "not_submitted") return "Not Submitted";
  if (value === "pending") return "Pending Approval";
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  return value;
}

export default function MyListingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { successMessage?: string } | null)?.successMessage;
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

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}
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
              <Card
                key={listing.id}
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    sx={{ minHeight: 220 }}
                  >
                    <Box
                      sx={{
                        width: { xs: "100%", md: 260 },
                        minHeight: { xs: 180, md: "100%" },
                        backgroundColor: "grey.100",
                        borderRight: { md: "1px solid" },
                        borderColor: { md: "divider" },
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {listing.media?.length ? (
                        <Box
                          component="img"
                          src={
                            listing.media.find((media) => media.is_primary)
                              ?.file_url || listing.media[0].file_url
                          }
                          alt={listing.title}
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <Stack
                          alignItems="center"
                          justifyContent="center"
                          sx={{
                            height: "100%",
                            background:
                              "linear-gradient(135deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.02))",
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            No photo yet
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                    <Stack spacing={2} sx={{ flex: 1, p: 3 }}>
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
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mt: 0.5 }}
                        >
                          <LocationOnOutlined
                            fontSize="small"
                            color="action"
                          />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                          {listing.street_line_1}
                          {listing.street_line_2
                            ? `, ${listing.street_line_2}`
                            : ""}
                          , {listing.city}, {listing.state}{" "}
                          {listing.postal_code}
                        </Typography>
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1,
                            color: "text.secondary",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {listing.description}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            label={listing.status}
                            color={resolveStatusColor(listing.status)}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={approvalStatusLabel(listing.approval_status)}
                            color={resolveStatusColor(listing.approval_status)}
                            variant="outlined"
                          />
                          {(listing.approval_status === "not_submitted" || listing.approval_status === "rejected") && (
                            <Button
                              size="small"
                              variant="outlined"
                              color={listing.approval_status === "rejected" ? "error" : "primary"}
                              onClick={() => navigate(`/listings/${listing.id}/request-approval`)}
                            >
                              {listing.approval_status === "rejected" ? "Resubmit" : "Submit for Approval"}
                            </Button>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={0}>
                          <IconButton
                            size="small"
                            color="primary"
                            component={RouterLink}
                            to={`/listings/${listing.id}/deposits`}
                            title="Deposit payments"
                          >
                            <PaymentsOutlined fontSize="small" />
                          </IconButton>
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

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={formatRentChip(listing.monthly_rent)}
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Deposit ${formatMoney(listing.security_deposit)}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<KingBedOutlined />}
                        label={`${listing.bedrooms} beds`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<ShowerOutlined />}
                        label={`${listing.bathrooms} baths`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<SquareFootOutlined />}
                        label={`${listing.square_feet || "-"} sq ft`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<CalendarTodayOutlined />}
                        label={`${formatDate(
                          listing.availability_start_date,
                        )} → ${formatDate(listing.availability_end_date)}`}
                        variant="outlined"
                      />
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={2}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="body2">
                        <strong>Lease term:</strong>{" "}
                        {listing.lease_term_min_months || "-"} to{" "}
                        {listing.lease_term_max_months || "-"} months
                      </Typography>
                      <Typography variant="body2">
                        <strong>Furnished:</strong> {listing.furnished_status}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`Utilities ${listing.utilities_included ? "included" : "not included"}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Pets ${listing.pets_allowed ? "allowed" : "not allowed"}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Smoking ${listing.smoking_allowed ? "allowed" : "not allowed"}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Parking ${listing.parking_available ? "available" : "none"}`}
                        variant="outlined"
                      />
                    </Stack>

                    <Divider />

                    <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
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

                    <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
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
