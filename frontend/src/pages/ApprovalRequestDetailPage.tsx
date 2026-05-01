import { Alert, Box, Container } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ApprovalRequestDetailView from "../components/ApprovalRequestDetailView";

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

  if (user?.user_type !== "management") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only management company users can access this page.</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <ApprovalRequestDetailView
          id={Number(id)}
          onBack={() => navigate("/company/approvals")}
        />
      </Container>
    </Box>
  );
}
