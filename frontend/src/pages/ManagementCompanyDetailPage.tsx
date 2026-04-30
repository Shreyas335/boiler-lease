import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import { getManagementCompany, type PublicManagementCompany, type PublicGuideline } from "../api/company";
import { useAuth } from "../contexts/AuthContext";
import BroadcastDialog from "../components/BroadcastDialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function YesNo({ value }: { value: boolean | null }) {
  if (value === true)
    return (
      <Box display="flex" alignItems="center" gap={0.5} color="success.main">
        <CheckCircleOutlineIcon fontSize="small" />
        <Typography variant="body2">Yes</Typography>
      </Box>
    );
  if (value === false)
    return (
      <Box display="flex" alignItems="center" gap={0.5} color="error.main">
        <CancelOutlinedIcon fontSize="small" />
        <Typography variant="body2">No</Typography>
      </Box>
    );
  return (
    <Box display="flex" alignItems="center" gap={0.5} color="text.disabled">
      <RemoveIcon fontSize="small" />
      <Typography variant="body2">No requirement</Typography>
    </Box>
  );
}

function currency(val: string | null) {
  if (val == null) return null;
  return `$${Number(val).toLocaleString()}`;
}

function rangeLabel(min: string | null, max: string | null, unit = "") {
  const lo = currency(min);
  const hi = currency(max);
  if (lo && hi) return `${lo}${unit} – ${hi}${unit}`;
  if (lo) return `At least ${lo}${unit}`;
  if (hi) return `At most ${hi}${unit}`;
  return null;
}

// ─── Single guideline card ────────────────────────────────────────────────────

function GuidelineCard({ g }: { g: PublicGuideline }) {
  const rentRange = rangeLabel(g.min_rent, g.max_rent, " / mo");
  const depositRange = rangeLabel(g.min_deposit, g.max_deposit);

  return (
    <Paper variant="outlined" sx={{ px: 3, py: 2.5 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <HomeWorkIcon color="primary" fontSize="small" />
        <Typography variant="h6" fontWeight={600}>
          {g.name}
        </Typography>
      </Box>

      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell sx={{ color: "text.secondary", border: 0, pl: 0, width: 200 }}>
              Monthly rent
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              {rentRange ? (
                <Typography variant="body2">{rentRange}</Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">No requirement</Typography>
              )}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>
              Security deposit
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              {depositRange ? (
                <Typography variant="body2">{depositRange}</Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">No requirement</Typography>
              )}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>
              Min. availability
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              {g.min_availability_days != null ? (
                <Typography variant="body2">{g.min_availability_days} days</Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">No requirement</Typography>
              )}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>
              Utilities included
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              <YesNo value={g.utilities_included} />
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>
              Pets allowed
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              <YesNo value={g.pets_allowed} />
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>
              Furnished status
            </TableCell>
            <TableCell sx={{ border: 0 }}>
              {g.furnished_status ? (
                <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                  {g.furnished_status.replace(/_/g, " ")}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">No requirement</Typography>
              )}
            </TableCell>
          </TableRow>

          {(g.required_amenities ?? []).length > 0 && (
            <TableRow>
              <TableCell sx={{ color: "text.secondary", border: 0, pl: 0, verticalAlign: "top" }}>
                Required amenities
              </TableCell>
              <TableCell sx={{ border: 0 }}>
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {g.required_amenities.map((code) => (
                    <Chip key={code} label={code} size="small" />
                  ))}
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagementCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<PublicManagementCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getManagementCompany(Number(id))
      .then(setCompany)
      .catch(() => setError("Company not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const isCompanyOwner = user?.user_type === "management" && user.company_status === "approved";

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !company) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error ?? "Company not found."}</Alert>
        <Button startIcon={<ArrowBackIcon />} sx={{ mt: 2 }} onClick={() => navigate("/companies")}>
          Back to companies
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
        onClick={() => navigate("/companies")}
      >
        Back to companies
      </Button>

      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <HomeWorkIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={700}>
          {company.company_name}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
        <Chip label="Verified" color="success" size="small" />
        {isCompanyOwner && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<CampaignRoundedIcon />}
            onClick={() => { setBroadcastOpen(true); setBroadcastResult(null); }}
          >
            Send Broadcast
          </Button>
        )}
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Typography variant="h5" fontWeight={600} mb={2}>
        Building Guidelines
      </Typography>

      {company.guidelines.length === 0 ? (
        <Typography color="text.secondary">This company has not set any building guidelines yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {company.guidelines.map((g) => (
            <GuidelineCard key={g.id} g={g} />
          ))}
        </Stack>
      )}

      <BroadcastDialog open={broadcastOpen} onClose={() => setBroadcastOpen(false)} />
    </Container>
  );
}
