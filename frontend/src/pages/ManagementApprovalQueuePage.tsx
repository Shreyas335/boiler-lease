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
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { getApprovalRequests, type ApprovalRequestSummary } from "../api/company";
import { useAuth } from "../contexts/AuthContext";

function formatMoney(value: string) {
  const n = Number(value);
  return Number.isNaN(n) ? value : `$${n.toLocaleString()}`;
}

function statusColor(s: string): ChipProps["color"] {
  if (s === "approved") return "success";
  if (s === "rejected") return "error";
  return "warning";
}

function statusLabel(s: string) {
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

const TABS = ["all", "pending", "approved", "rejected"] as const;
type TabValue = (typeof TABS)[number];

export default function ManagementApprovalQueuePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabValue>("pending");
  const [requests, setRequests] = useState<ApprovalRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getApprovalRequests(tab === "all" ? undefined : tab);
        setRequests(data);
      } catch {
        setError("Unable to load approval requests.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [tab]);

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
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Approval Queue
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review listing approval requests submitted to your company.
        </Typography>

        <Tabs
          value={tab}
          onChange={(_, v: TabValue) => setTab(v)}
          sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
        >
          {TABS.map((t) => (
            <Tab key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} value={t} />
          ))}
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Typography>Loading…</Typography>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary">No {tab === "all" ? "" : tab} requests found.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    gap={2}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {req.listing_title}
                        </Typography>
                        <Chip
                          size="small"
                          label={statusLabel(req.status)}
                          color={statusColor(req.status)}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {req.listing_city} · {formatMoney(req.listing_rent)}/mo
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Guideline: {req.guideline_name ?? "—"} · Submitted{" "}
                        {new Date(req.created_at).toLocaleDateString()}
                      </Typography>
                      {req.subleaser_notes && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          <strong>Notes:</strong> {req.subleaser_notes}
                        </Typography>
                      )}
                    </Box>
                    {req.status === "pending" && (
                      <Button
                        component={RouterLink}
                        to={`/company/approvals/${req.id}`}
                        variant="contained"
                        size="small"
                      >
                        Review
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
