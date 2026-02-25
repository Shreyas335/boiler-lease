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
import { createListing, getListingAmenities, type CreatePropertyListingPayload, type ListingAmenity } from "../api/listings";
import { useAuth } from "../contexts/AuthContext";

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

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(INITIAL_FORM), [form]);

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

  function validateForm(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "Title is required.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    if (!form.monthly_rent.trim()) nextErrors.monthly_rent = "Monthly rent is required.";
    if (!form.availability_start_date) nextErrors.availability_start_date = "Start date is required.";
    if (!form.availability_end_date) nextErrors.availability_end_date = "End date is required.";
    if (!form.street_line_1.trim()) nextErrors.street_line_1 = "Street address is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.state.trim()) nextErrors.state = "State is required.";
    if (!form.postal_code.trim()) nextErrors.postal_code = "Postal code is required.";

    if (
      form.availability_start_date &&
      form.availability_end_date &&
      form.availability_start_date > form.availability_end_date
    ) {
      nextErrors.availability_end_date = "End date must be on or after start date.";
    }

    if (!form.parking_available && form.parking_details?.trim()) {
      nextErrors.parking_details = "Parking details should be empty unless parking is available.";
    }

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
      await createListing(form);
      setPageMessage({ type: "success", text: "Listing created successfully." });
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
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Beds"
                    value={form.bedrooms}
                    onChange={(e) => handleChange("bedrooms", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Baths"
                    value={form.bathrooms}
                    onChange={(e) => handleChange("bathrooms", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="Sq ft"
                    value={form.square_feet || ""}
                    onChange={(e) => handleChange("square_feet", Number(e.target.value) || undefined)}
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
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Max lease (months)"
                    value={form.lease_term_max_months || ""}
                    onChange={(e) => handleChange("lease_term_max_months", Number(e.target.value) || undefined)}
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
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Street line 1"
                    value={form.street_line_1}
                    onChange={(e) => handleChange("street_line_1", e.target.value)}
                    error={Boolean(fieldErrors.street_line_1)}
                    helperText={fieldErrors.street_line_1}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Street line 2"
                    value={form.street_line_2 || ""}
                    onChange={(e) => handleChange("street_line_2", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="City"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    error={Boolean(fieldErrors.city)}
                    helperText={fieldErrors.city}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="State"
                    value={form.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    error={Boolean(fieldErrors.state)}
                    helperText={fieldErrors.state}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Postal code"
                    value={form.postal_code}
                    onChange={(e) => handleChange("postal_code", e.target.value)}
                    error={Boolean(fieldErrors.postal_code)}
                    helperText={fieldErrors.postal_code}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Country code"
                    value={form.country_code}
                    onChange={(e) => handleChange("country_code", e.target.value.toUpperCase())}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Unit number"
                    value={form.unit_number || ""}
                    onChange={(e) => handleChange("unit_number", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Building name"
                    value={form.building_name || ""}
                    onChange={(e) => handleChange("building_name", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Latitude"
                    value={form.latitude || ""}
                    onChange={(e) => handleChange("latitude", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Longitude"
                    value={form.longitude || ""}
                    onChange={(e) => handleChange("longitude", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Contact email"
                    value={form.contact_email || ""}
                    onChange={(e) => handleChange("contact_email", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Contact phone"
                    value={form.contact_phone || ""}
                    onChange={(e) => handleChange("contact_phone", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Virtual tour URL"
                    value={form.virtual_tour_url || ""}
                    onChange={(e) => handleChange("virtual_tour_url", e.target.value)}
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

              <Stack direction="row" spacing={2}>
                <Button type="submit" variant="contained" disabled={submitting}>
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
