import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import {
  createListing,
  getListingAmenities,
  uploadListingMedia,
  type CreatePropertyListingPayload,
  type ListingAmenity,
  type ListingMedia,
} from "../api/listings";
import { useAuth } from "../contexts/AuthContext";
import AddressAutocomplete, { type AddressComponents } from "../components/AddressAutocomplete";
import PhotoManager, { type PendingPhoto } from "../components/PhotoManager";
import { getListingWarnings, validateListingForm } from "../utils/listingFormValidation";


const PROPERTY_TYPES = ["apartment", "house", "condo", "studio", "other"];
const FURNISHED_OPTIONS = ["furnished", "unfurnished", "partially_furnished"];
const STATUS_OPTIONS = ["draft", "published", "unpublished"];

const INITIAL_FORM: CreatePropertyListingPayload = {
  title: "",
  description: "",
  property_type: "apartment",
  bedrooms: "1.0",
  bathrooms: "1.0",
  furnished_status: "unfurnished",
  monthly_rent: "",
  utilities_included: false,
  availability_start_date: "",
  availability_end_date: "",
  pets_allowed: false,
  smoking_allowed: false,
  street_line_1: "",
  city: "",
  state: "",
  postal_code: "",
  country_code: "US",
  parking_available: false,
  status: "draft",
  amenity_codes: [],
};

function extractFirstError(value: unknown): string | undefined {
  if (Array.isArray(value) && value[0]) return String(value[0]);
  if (typeof value === "string") return value;
  return undefined;
}

export default function CreateListingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<CreatePropertyListingPayload>(INITIAL_FORM);
  const [amenities, setAmenities] = useState<ListingAmenity[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pageMessage, setPageMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addressInput, setAddressInput] = useState("");
  const [isAddressVerified, setIsAddressVerified] = useState(false);
  // Photo state — for create, there's no listingId yet and no existing media
  const [existingMedia, setExistingMedia] = useState<ListingMedia[]>([]);
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadAmenities() {
      try {
        const data = await getListingAmenities();
        setAmenities(data);
      } catch {
        setAmenities([]);
      }
    }

    if (user?.user_type === "subleaser") {
      loadAmenities();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      newPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(INITIAL_FORM) || newPhotos.length > 0,
    [form, newPhotos],
  );
  const warnings = useMemo(() => getListingWarnings(form), [form]);

  if (!user || user.user_type !== "subleaser") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only subleasers can create property listings.</Alert>
        </Container>
      </Box>
    );
  }

  function handleChange<K extends keyof CreatePropertyListingPayload>(key: K, value: CreatePropertyListingPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key as string]: "" }));
    setPageMessage(null);
  }

  function toggleAmenity(code: string) {
    const set = new Set(form.amenity_codes || []);
    if (set.has(code)) {
      set.delete(code);
    } else {
      set.add(code);
    }
    handleChange("amenity_codes", Array.from(set));
  }

  function handleAddressInputChange(value: string) {
    setAddressInput(value);
    setIsAddressVerified(false);
    setFieldErrors((prev) => ({ ...prev, address: "" }));
  }

  function handleAddressSelect(address: AddressComponents) {
    setForm((prev) => ({
      ...prev,
      street_line_1: address.street_line_1,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country_code: address.country_code,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
    setIsAddressVerified(true);
    setFieldErrors((prev) => ({ ...prev, address: "", street_line_1: "", city: "", state: "", postal_code: "" }));
  }

  function validateForm(): boolean {
    const nextErrors = validateListingForm(form, isAddressVerified);
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageMessage(null);

    if (!validateForm()) {
      setPageMessage({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }

    setSubmitting(true);
    try {
      const listing = await createListing(form);

      // Upload photos if any were selected
      const toUpload = newPhotos.filter((p) => p.status === "queued" || p.status === "error");
      if (toUpload.length > 0) {
        setUploading(true);
        let uploadFailures = 0;

        for (let i = 0; i < toUpload.length; i++) {
          const photo = toUpload[i];
          try {
            await uploadListingMedia(listing.id, photo.file, i, i === 0);
          } catch {
            uploadFailures += 1;
          }
        }

        setUploading(false);

        if (uploadFailures > 0) {
          setPageMessage({
            type: "error",
            text: "Listing created, but some photos failed to upload. You can retry in Edit Listing.",
          });
          navigate(`/listings/${listing.id}/edit`, { state: { listing } });
          return;
        }
      }

      navigate("/my-listings");
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      const data = axiosError.response?.data || {};
      const nextErrors: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        const maybe = extractFirstError(value);
        if (maybe) nextErrors[key] = maybe;
      }
      setFieldErrors(nextErrors);
      setPageMessage({ type: "error", text: nextErrors.detail || "Unable to create listing." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    if (isDirty && !window.confirm("Discard your listing draft?")) {
      return;
    }
    navigate("/my-listings");
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Create Property Listing
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Add complete listing details so sublessees can evaluate your unit clearly.
        </Typography>

        <Card>
          <CardContent>
            <Stack component="form" spacing={3} onSubmit={handleSubmit}>
              {pageMessage && <Alert severity={pageMessage.type}>{pageMessage.text}</Alert>}

              <Typography variant="h6">Basics</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={form.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    error={Boolean(fieldErrors.title)}
                    helperText={fieldErrors.title}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    label="Property type"
                    value={form.property_type}
                    onChange={(e) => handleChange("property_type", e.target.value)}
                  >
                    {PROPERTY_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Description"
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    error={Boolean(fieldErrors.description)}
                    helperText={fieldErrors.description}
                  />
                </Grid>
              </Grid>

              <Typography variant="h6">Pricing and Lease</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Monthly rent"
                    value={form.monthly_rent}
                    onChange={(e) => handleChange("monthly_rent", e.target.value)}
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    error={Boolean(fieldErrors.monthly_rent)}
                    helperText={fieldErrors.monthly_rent}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Security deposit"
                    value={form.security_deposit || ""}
                    onChange={(e) => handleChange("security_deposit", e.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    error={Boolean(fieldErrors.security_deposit)}
                    helperText={fieldErrors.security_deposit || warnings.security_deposit}
                    FormHelperTextProps={{
                      sx: {
                        color: fieldErrors.security_deposit
                          ? "error.main"
                          : warnings.security_deposit
                          ? "warning.main"
                          : "text.secondary",
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Beds"
                    value={form.bedrooms}
                    onChange={(e) => handleChange("bedrooms", e.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    error={Boolean(fieldErrors.bedrooms)}
                    helperText={fieldErrors.bedrooms}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Baths"
                    value={form.bathrooms}
                    onChange={(e) => handleChange("bathrooms", e.target.value)}
                    type="number"
                    inputProps={{ min: 0, step: 0.5 }}
                    error={Boolean(fieldErrors.bathrooms)}
                    helperText={fieldErrors.bathrooms}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Sq ft"
                    value={form.square_feet || ""}
                    onChange={(e) => handleChange("square_feet", Number(e.target.value) || undefined)}
                    type="number"
                    inputProps={{ min: 1, max: 30000, step: 1 }}
                    error={Boolean(fieldErrors.square_feet)}
                    helperText={fieldErrors.square_feet}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    label="Furnished"
                    value={form.furnished_status}
                    onChange={(e) => handleChange("furnished_status", e.target.value)}
                  >
                    {FURNISHED_OPTIONS.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Available from"
                    InputLabelProps={{ shrink: true }}
                    value={form.availability_start_date}
                    onChange={(e) => handleChange("availability_start_date", e.target.value)}
                    error={Boolean(fieldErrors.availability_start_date)}
                    helperText={fieldErrors.availability_start_date}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Available until"
                    InputLabelProps={{ shrink: true }}
                    value={form.availability_end_date}
                    onChange={(e) => handleChange("availability_end_date", e.target.value)}
                    error={Boolean(fieldErrors.availability_end_date)}
                    helperText={fieldErrors.availability_end_date}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Min lease (months)"
                    value={form.lease_term_min_months || ""}
                    onChange={(e) => handleChange("lease_term_min_months", Number(e.target.value) || undefined)}
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    error={Boolean(fieldErrors.lease_term_min_months)}
                    helperText={fieldErrors.lease_term_min_months}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Max lease (months)"
                    value={form.lease_term_max_months || ""}
                    onChange={(e) => handleChange("lease_term_max_months", Number(e.target.value) || undefined)}
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    error={Boolean(fieldErrors.lease_term_max_months)}
                    helperText={fieldErrors.lease_term_max_months}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    fullWidth
                    label="Status"
                    value={form.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Typography variant="h6">Location and Contact</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <AddressAutocomplete
                    value={addressInput}
                    onChange={handleAddressInputChange}
                    onAddressSelect={handleAddressSelect}
                    error={Boolean(fieldErrors.address)}
                    helperText={fieldErrors.address}
                    isAddressVerified={isAddressVerified}
                  />
                </Grid>

                {isAddressVerified && (
                  <>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Street"
                        value={form.street_line_1}
                        slotProps={{ input: { readOnly: true } }}
                        variant="filled"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Unit/Apt (optional)"
                        value={form.street_line_2 || ""}
                        onChange={(e) => handleChange("street_line_2", e.target.value)}
                        placeholder="Apt 4B, Unit 101, etc."
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <TextField
                        fullWidth
                        label="City"
                        value={form.city}
                        slotProps={{ input: { readOnly: true } }}
                        variant="filled"
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <TextField
                        fullWidth
                        label="State"
                        value={form.state}
                        slotProps={{ input: { readOnly: true } }}
                        variant="filled"
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Postal Code"
                        value={form.postal_code}
                        slotProps={{ input: { readOnly: true } }}
                        variant="filled"
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Country"
                        value={form.country_code}
                        slotProps={{ input: { readOnly: true } }}
                        variant="filled"
                      />
                    </Grid>
                  </>
                )}

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Building name (optional)"
                    value={form.building_name || ""}
                    onChange={(e) => handleChange("building_name", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Contact email"
                    value={form.contact_email || ""}
                    onChange={(e) => handleChange("contact_email", e.target.value)}
                    error={Boolean(fieldErrors.contact_email)}
                    helperText={fieldErrors.contact_email}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Contact phone"
                    value={form.contact_phone || ""}
                    onChange={(e) => handleChange("contact_phone", e.target.value)}
                    error={Boolean(fieldErrors.contact_phone)}
                    helperText={fieldErrors.contact_phone}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Virtual tour URL (optional)"
                    value={form.virtual_tour_url || ""}
                    onChange={(e) => handleChange("virtual_tour_url", e.target.value)}
                    error={Boolean(fieldErrors.virtual_tour_url)}
                    helperText={fieldErrors.virtual_tour_url}
                  />
                </Grid>
              </Grid>

              <Typography variant="h6">Policies and Amenities</Typography>
              <Grid container spacing={1}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.utilities_included}
                        onChange={(e) => handleChange("utilities_included", e.target.checked)}
                      />
                    }
                    label="Utilities included"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.pets_allowed}
                        onChange={(e) => handleChange("pets_allowed", e.target.checked)}
                      />
                    }
                    label="Pets allowed"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.smoking_allowed}
                        onChange={(e) => handleChange("smoking_allowed", e.target.checked)}
                      />
                    }
                    label="Smoking allowed"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.parking_available}
                        onChange={(e) => handleChange("parking_available", e.target.checked)}
                      />
                    }
                    label="Parking available"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    fullWidth
                    label="Parking details"
                    value={form.parking_details || ""}
                    onChange={(e) => handleChange("parking_details", e.target.value)}
                    error={Boolean(fieldErrors.parking_details)}
                    helperText={fieldErrors.parking_details}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle1">Amenities</Typography>
              <Grid container spacing={1}>
                {amenities.map((amenity) => (
                  <Grid key={amenity.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(form.amenity_codes?.includes(amenity.code))}
                          onChange={() => toggleAmenity(amenity.code)}
                        />
                      }
                      label={amenity.label}
                    />
                  </Grid>
                ))}
              </Grid>

              {/* Photos */}
              <PhotoManager
                listingId={null}
                existingMedia={existingMedia}
                onExistingMediaChange={setExistingMedia}
                newPhotos={newPhotos}
                onNewPhotosChange={setNewPhotos}
                uploading={uploading}
                onUploadingChange={setUploading}
                onError={(msg) => setPageMessage({ type: "error", text: msg })}
              />

              <Stack direction="row" spacing={2}>
                <Button type="submit" variant="contained" disabled={submitting || uploading}>
                  {submitting ? "Saving..." : "Create listing"}
                </Button>
                <Button type="button" variant="outlined" color="inherit" onClick={handleCancel}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
