import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { getPropertyListingDetail, submitApprovalRequest, type PropertyListing } from "../api/listings";
import { getManagementCompanies, getManagementCompany, type PublicManagementCompany, type PublicGuideline } from "../api/company";
import { useAuth } from "../contexts/AuthContext";

function formatMoney(value: string | null) {
  if (!value) return "-";
  const n = Number(value);
  return Number.isNaN(n) ? value : `$${n.toLocaleString()}`;
}

export default function SubmitApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [listingError, setListingError] = useState<string | null>(null);

  const [companySearch, setCompanySearch] = useState("");
  const [companies, setCompanies] = useState<PublicManagementCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<PublicManagementCompany | null>(null);
  const [selectedGuideline, setSelectedGuideline] = useState<PublicGuideline | null>(null);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadListing() {
      if (!id) return;
      try {
        const data = await getPropertyListingDetail(Number(id));
        setListing(data);
      } catch {
        setListingError("Could not load listing details.");
      } finally {
        setListingLoading(false);
      }
    }
    void loadListing();
  }, [id]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setCompaniesLoading(true);
      try {
        const results = await getManagementCompanies(companySearch || undefined);
        setCompanies(results);
      } catch {
        setCompanies([]);
      } finally {
        setCompaniesLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [companySearch]);

  async function handleSelectCompany(company: PublicManagementCompany) {
    try {
      const full = await getManagementCompany(company.id);
      setSelectedCompany(full);
      setSelectedGuideline(null);
    } catch {
      setSelectedCompany(company);
      setSelectedGuideline(null);
    }
  }

  async function handleSubmit() {
    if (!listing || !selectedCompany || !selectedGuideline) return;
    if (user?.identity_verification_status !== "verified") {
      setSubmitError("Identity verification is required before submitting for approval.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitApprovalRequest(listing.id, {
        management_company_id: selectedCompany.id,
        guideline_id: selectedGuideline.id,
        subleaser_notes: notes,
      });
      navigate("/my-listings");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: string } } })?.response?.data;
      const msg =
        typeof data?.detail === "string"
          ? data.detail
          : "Failed to submit approval request.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (listingLoading) {
    return (
      <Box sx={{ py: 6, px: 2, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (listingError || !listing) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">{listingError || "Listing not found."}</Alert>
        </Container>
      </Box>
    );
  }

  const identityBlocked = user?.identity_verification_status !== "verified";

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Submit for Approval
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Select a management company and a guideline, then submit your listing for review.
        </Typography>

        {identityBlocked && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Verify your identity before submitting for approval.{" "}
            <RouterLink to="/dashboard" style={{ fontWeight: 600 }}>
              Go to Dashboard
            </RouterLink>
            .
          </Alert>
        )}

        {/* Listing summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Listing
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {listing.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {listing.city}, {listing.state} · {formatMoney(listing.monthly_rent)}/mo
            </Typography>
          </CardContent>
        </Card>

        {/* Company search */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              1. Select a Management Company
            </Typography>
            <TextField
              fullWidth
              placeholder="Search by company name…"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} /> }}
              sx={{ mb: 2 }}
            />
            {companiesLoading ? (
              <CircularProgress size={20} />
            ) : companies.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No approved companies found.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {companies.map((company) => (
                  <Box
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: selectedCompany?.id === company.id ? "primary.main" : "divider",
                      bgcolor: selectedCompany?.id === company.id ? "primary.50" : "transparent",
                      cursor: "pointer",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {company.company_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {company.guidelines.length} guideline{company.guidelines.length !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Guideline select */}
        {selectedCompany && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                2. Select a Guideline
              </Typography>
              {selectedCompany.guidelines.length === 0 ? (
                <Alert severity="warning">This company has no guidelines configured.</Alert>
              ) : (
                <TextField
                  select
                  fullWidth
                  label="Guideline"
                  value={selectedGuideline?.id ?? ""}
                  onChange={(e) => {
                    const g = selectedCompany.guidelines.find((gl) => gl.id === Number(e.target.value));
                    setSelectedGuideline(g ?? null);
                  }}
                >
                  <MenuItem value="">-- Select a guideline --</MenuItem>
                  {selectedCompany.guidelines.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      {g.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {selectedGuideline && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Guideline requirements
                  </Typography>
                  <Stack spacing={0.5}>
                    {selectedGuideline.min_rent && (
                      <Typography variant="body2">Min rent: {formatMoney(selectedGuideline.min_rent)}</Typography>
                    )}
                    {selectedGuideline.max_rent && (
                      <Typography variant="body2">Max rent: {formatMoney(selectedGuideline.max_rent)}</Typography>
                    )}
                    {selectedGuideline.min_deposit && (
                      <Typography variant="body2">Min deposit: {formatMoney(selectedGuideline.min_deposit)}</Typography>
                    )}
                    {selectedGuideline.max_deposit && (
                      <Typography variant="body2">Max deposit: {formatMoney(selectedGuideline.max_deposit)}</Typography>
                    )}
                    {selectedGuideline.min_availability_days != null && (
                      <Typography variant="body2">Min availability: {selectedGuideline.min_availability_days} days</Typography>
                    )}
                    {selectedGuideline.utilities_included != null && (
                      <Typography variant="body2">
                        Utilities: {selectedGuideline.utilities_included ? "must be included" : "not required"}
                      </Typography>
                    )}
                    {selectedGuideline.pets_allowed != null && (
                      <Typography variant="body2">
                        Pets: {selectedGuideline.pets_allowed ? "must be allowed" : "not allowed"}
                      </Typography>
                    )}
                    {selectedGuideline.furnished_status && (
                      <Typography variant="body2">Furnished status: {selectedGuideline.furnished_status}</Typography>
                    )}
                    {selectedGuideline.required_amenities.length > 0 && (
                      <Typography variant="body2">
                        Required amenities: {selectedGuideline.required_amenities.join(", ")}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {selectedGuideline && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                3. Additional Notes (optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder="Any additional context for the management company…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            disabled={!selectedCompany || !selectedGuideline || submitting || identityBlocked}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Submit for Approval"}
          </Button>
          <Button variant="outlined" onClick={() => navigate("/my-listings")}>
            Cancel
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
