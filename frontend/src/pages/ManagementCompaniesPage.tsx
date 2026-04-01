import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getManagementCompanies, type PublicManagementCompany, type PublicGuideline } from "../api/company";

function guidelineChips(g: PublicGuideline): string[] {
  const chips: string[] = [];

  const minR = g.min_rent ? Number(g.min_rent) : null;
  const maxR = g.max_rent ? Number(g.max_rent) : null;
  if (minR != null && maxR != null) chips.push(`Rent $${minR.toLocaleString()}–$${maxR.toLocaleString()}`);
  else if (minR != null) chips.push(`Rent ≥ $${minR.toLocaleString()}`);
  else if (maxR != null) chips.push(`Rent ≤ $${maxR.toLocaleString()}`);

  const minD = g.min_deposit ? Number(g.min_deposit) : null;
  const maxD = g.max_deposit ? Number(g.max_deposit) : null;
  if (minD != null && maxD != null) chips.push(`Deposit $${minD.toLocaleString()}–$${maxD.toLocaleString()}`);
  else if (minD != null) chips.push(`Deposit ≥ $${minD.toLocaleString()}`);
  else if (maxD != null) chips.push(`Deposit ≤ $${maxD.toLocaleString()}`);

  if (g.min_availability_days != null) chips.push(`Available ≥ ${g.min_availability_days}d`);
  if (g.utilities_included === true) chips.push("Utilities included");
  else if (g.utilities_included === false) chips.push("No utilities");
  if (g.pets_allowed === true) chips.push("Pets OK");
  else if (g.pets_allowed === false) chips.push("No pets");
  if (g.furnished_status) chips.push(g.furnished_status.replace(/_/g, " "));
  for (const code of g.required_amenities ?? []) chips.push(code);

  return chips;
}

function CompanyCard({ company, onClick }: { company: PublicManagementCompany; onClick: () => void }) {
  return (
    <Paper
      variant="outlined"
      sx={{ px: 2.5, py: 2, cursor: "pointer", "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}
      onClick={onClick}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <HomeWorkIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            {company.company_name}
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: "text.disabled" }} />
      </Box>

      {company.guidelines.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No building guidelines set.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {company.guidelines.map((g) => {
            const chips = guidelineChips(g);
            return (
              <Box key={g.id}>
                <Typography variant="body2" fontWeight={500} mb={0.5}>
                  {g.name}
                </Typography>
                {chips.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">No requirements.</Typography>
                ) : (
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {chips.map((c) => (
                      <Chip key={c} label={c} size="small" variant="outlined" />
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

export default function ManagementCompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<PublicManagementCompany[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((q: string) => {
    setLoading(true);
    setError(null);
    getManagementCompanies(q || undefined)
      .then(setCompanies)
      .catch(() => setError("Failed to load management companies."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Management Companies
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Browse verified management companies and the building guidelines they require for listings.
      </Typography>

      <TextField
        fullWidth
        placeholder="Search by company name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress />
        </Box>
      ) : companies.length === 0 ? (
        <Typography color="text.secondary">
          {search ? "No companies match your search." : "No verified management companies yet."}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} onClick={() => navigate(`/companies/${c.id}`)} />
          ))}
        </Stack>
      )}
    </Container>
  );
}
