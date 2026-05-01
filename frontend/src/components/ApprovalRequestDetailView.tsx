import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import {
  getApprovalRequestDetail,
  reviewApprovalRequest,
  type ApprovalRequestDetail,
  type ComplianceResult,
} from "../api/company";

function formatMoney(value: string | null) {
  if (!value) return "-";
  const n = Number(value);
  return Number.isNaN(n) ? value : `$${n.toLocaleString()}`;
}

function formatValue(v: string | number | boolean | string[]): string {
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "none";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function ComplianceRow({ result }: { result: ComplianceResult }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 0.75 }}>
      {result.passed ? (
        <CheckCircleOutlineIcon color="success" fontSize="small" />
      ) : (
        <CancelOutlinedIcon color="error" fontSize="small" />
      )}
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {result.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Required: {formatValue(result.required)} · Actual: {formatValue(result.actual)}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={result.passed ? "Pass" : "Fail"}
        color={result.passed ? "success" : "error"}
        variant="outlined"
      />
    </Stack>
  );
}

interface Props {
  id: number;
  onBack: () => void;
  onReviewed?: () => void;
}

export default function ApprovalRequestDetailView({ id, onBack, onReviewed }: Props) {
  const [request, setRequest] = useState<ApprovalRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setRequest(null);
    getApprovalRequestDetail(id)
      .then(setRequest)
      .catch(() => setLoadError("Could not load approval request."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAction(action: "approve" | "reject") {
    if (!request) return;
    if (action === "reject" && !reviewerNotes.trim()) {
      setActionError("A note is required when rejecting.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await reviewApprovalRequest(request.id, action, reviewerNotes);
      onReviewed?.();
      onBack();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to submit review.";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !request) {
    return <Alert severity="error">{loadError || "Request not found."}</Alert>;
  }

  const { listing, guideline, compliance_results } = request;
  const allPassed = compliance_results.length > 0 && compliance_results.every((r) => r.passed);

  return (
    <Box>
      <Button variant="text" onClick={onBack} sx={{ mb: 2, pl: 0 }}>
        ← Back to queue
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Review: {listing.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Submitted by {request.subleaser_email} on {new Date(request.created_at).toLocaleDateString()}
      </Typography>

      {listing.media.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Photos ({listing.media.length})
            </Typography>
            <Grid container spacing={1}>
              {listing.media.map((m) => (
                <Grid key={m.id} size={{ xs: 6, sm: 4, md: 3 }}>
                  <CardMedia
                    component="img"
                    image={m.access_url ?? m.file_url}
                    alt="listing photo"
                    sx={{ borderRadius: 1, aspectRatio: "4/3", objectFit: "cover", width: "100%" }}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Listing Details
          </Typography>
          {listing.description && (
            <Typography variant="body2" sx={{ mb: 2 }}>{listing.description}</Typography>
          )}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2">
                <strong>Address:</strong> {listing.street_line_1}{listing.street_line_2 ? `, ${listing.street_line_2}` : ""}, {listing.city}, {listing.state} {listing.postal_code}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Rent</strong></Typography>
              <Typography variant="body2">{formatMoney(listing.monthly_rent)}/mo</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Deposit</strong></Typography>
              <Typography variant="body2">{formatMoney(listing.security_deposit)}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Beds / Baths</strong></Typography>
              <Typography variant="body2">{listing.bedrooms} bed / {listing.bathrooms} bath</Typography>
            </Grid>
            {listing.square_feet && (
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="body2"><strong>Sq ft</strong></Typography>
                <Typography variant="body2">{listing.square_feet.toLocaleString()}</Typography>
              </Grid>
            )}
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Type</strong></Typography>
              <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{listing.property_type}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Furnished</strong></Typography>
              <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{listing.furnished_status.replace("_", " ")}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Pets</strong></Typography>
              <Typography variant="body2">{listing.pets_allowed ? "Allowed" : "Not allowed"}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Smoking</strong></Typography>
              <Typography variant="body2">{listing.smoking_allowed ? "Allowed" : "Not allowed"}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Utilities</strong></Typography>
              <Typography variant="body2">{listing.utilities_included ? "Included" : "Not included"}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2"><strong>Parking</strong></Typography>
              <Typography variant="body2">{listing.parking_available ? "Available" : "Not available"}</Typography>
            </Grid>
            {listing.parking_details && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2"><strong>Parking details:</strong> {listing.parking_details}</Typography>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2">
                <strong>Available:</strong> {listing.availability_start_date} → {listing.availability_end_date}
              </Typography>
            </Grid>
            {(listing.lease_term_min_months || listing.lease_term_max_months) && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2">
                  <strong>Lease term:</strong>{" "}
                  {listing.lease_term_min_months && `${listing.lease_term_min_months} mo min`}
                  {listing.lease_term_min_months && listing.lease_term_max_months && " · "}
                  {listing.lease_term_max_months && `${listing.lease_term_max_months} mo max`}
                </Typography>
              </Grid>
            )}
            {listing.amenities.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Amenities</strong></Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {listing.amenities.map((a) => (
                    <Chip key={a.id} label={a.label} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Grid>
            )}
            {listing.contact_email && (
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant="body2"><strong>Contact email</strong></Typography>
                <Typography variant="body2">{listing.contact_email}</Typography>
              </Grid>
            )}
            {listing.contact_phone && (
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant="body2"><strong>Contact phone</strong></Typography>
                <Typography variant="body2">{listing.contact_phone}</Typography>
              </Grid>
            )}
            {listing.virtual_tour_url && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2">
                  <strong>Virtual tour:</strong>{" "}
                  <a href={listing.virtual_tour_url} target="_blank" rel="noopener noreferrer">
                    {listing.virtual_tour_url}
                  </a>
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {guideline && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Guideline: {guideline.name}
              </Typography>
              {compliance_results.length > 0 && (
                <Chip
                  size="small"
                  label={allPassed ? "All criteria met" : "Some criteria failed"}
                  color={allPassed ? "success" : "error"}
                />
              )}
            </Stack>
            {compliance_results.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No criteria to check for this guideline.
              </Typography>
            ) : (
              <Stack divider={<Divider />}>
                {compliance_results.map((r) => (
                  <ComplianceRow key={r.field} result={r} />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {request.subleaser_notes && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Subleaser Notes
            </Typography>
            <Typography variant="body2">{request.subleaser_notes}</Typography>
          </CardContent>
        </Card>
      )}

      {request.status === "pending" && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Decision
            </Typography>
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
            {!rejectOpen ? (
              <Stack direction="row" spacing={2}>
                <Button variant="contained" color="success" disabled={submitting} onClick={() => handleAction("approve")}>
                  {submitting ? "Submitting…" : "Approve"}
                </Button>
                <Button variant="outlined" color="error" disabled={submitting} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Rejection reason (required)"
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  error={Boolean(actionError && !reviewerNotes.trim())}
                />
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={submitting || !reviewerNotes.trim()}
                    onClick={() => handleAction("reject")}
                  >
                    {submitting ? "Submitting…" : "Confirm Rejection"}
                  </Button>
                  <Button variant="outlined" onClick={() => { setRejectOpen(false); setActionError(null); }}>
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {request.status !== "pending" && (
        <Alert severity={request.status === "approved" ? "success" : "error"}>
          This request was <strong>{request.status}</strong>
          {request.reviewed_at ? ` on ${new Date(request.reviewed_at).toLocaleDateString()}` : ""}.
          {request.reviewer_notes && ` Reason: ${request.reviewer_notes}`}
        </Alert>
      )}
    </Box>
  );
}
