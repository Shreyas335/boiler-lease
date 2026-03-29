import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { useNavigate, useParams } from "react-router-dom";
import {
  getApprovalRequestDetail,
  reviewApprovalRequest,
  type ApprovalRequestDetail,
  type ComplianceResult,
} from "../api/company";
import { useAuth } from "../contexts/AuthContext";

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

export default function ApprovalRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [request, setRequest] = useState<ApprovalRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getApprovalRequestDetail(Number(id));
        setRequest(data);
      } catch {
        setLoadError("Could not load approval request.");
      } finally {
        setLoading(false);
      }
    }
    void load();
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
      navigate("/company/approvals");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to submit review.";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.user_type !== "management") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only management company users can access this page.</Alert>
        </Container>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !request) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">{loadError || "Request not found."}</Alert>
        </Container>
      </Box>
    );
  }

  const { listing, guideline, compliance_results } = request;
  const allPassed = compliance_results.length > 0 && compliance_results.every((r) => r.passed);

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Button variant="text" onClick={() => navigate("/company/approvals")} sx={{ mb: 2, pl: 0 }}>
          ← Back to queue
        </Button>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Review: {listing.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Submitted by {request.subleaser_email} on {new Date(request.created_at).toLocaleDateString()}
        </Typography>

        {/* Listing details */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Listing Details
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Address:</strong> {listing.street_line_1}{listing.street_line_2 ? `, ${listing.street_line_2}` : ""}, {listing.city}, {listing.state} {listing.postal_code}
              </Typography>
              <Typography variant="body2">
                <strong>Rent:</strong> {formatMoney(listing.monthly_rent)}/mo · <strong>Deposit:</strong> {formatMoney(listing.security_deposit)}
              </Typography>
              <Typography variant="body2">
                <strong>Beds/Baths:</strong> {listing.bedrooms} bed / {listing.bathrooms} bath
              </Typography>
              <Typography variant="body2">
                <strong>Furnished:</strong> {listing.furnished_status} · <strong>Pets:</strong> {listing.pets_allowed ? "Allowed" : "Not allowed"} · <strong>Utilities:</strong> {listing.utilities_included ? "Included" : "Not included"}
              </Typography>
              <Typography variant="body2">
                <strong>Available:</strong> {listing.availability_start_date} → {listing.availability_end_date}
              </Typography>
              {listing.amenities.length > 0 && (
                <Typography variant="body2">
                  <strong>Amenities:</strong> {listing.amenities.map((a) => a.label).join(", ")}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Guideline compliance */}
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

        {/* Subleaser notes */}
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

        {/* Actions */}
        {request.status === "pending" && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Decision
              </Typography>

              {actionError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {actionError}
                </Alert>
              )}

              {!rejectOpen ? (
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={submitting}
                    onClick={() => handleAction("approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={submitting}
                    onClick={() => setRejectOpen(true)}
                  >
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
      </Container>
    </Box>
  );
}
