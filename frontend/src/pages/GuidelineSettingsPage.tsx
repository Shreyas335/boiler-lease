import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import {
  getGuidelines,
  createGuideline,
  updateGuideline,
  deleteGuideline,
  getCompanyStatus,
  updateCompanyBookingFee,
  type CompanyProfile,
} from "../api/company";
import { getListingAmenities } from "../api/listings";
import type { ListingAmenity } from "../api/listings";
import type { GuidelineRecord, GuidelineFormData } from "../types/guidelines";
import { emptyForm, recordToForm } from "../types/guidelines";
import FeeConfigSection from '../components/FeeConfigSection';

// ─── Guideline form dialog ────────────────────────────────────────────────────

interface GuidelineDialogProps {
  open: boolean;
  initial: GuidelineFormData;
  amenities: ListingAmenity[];
  title: string;
  onClose: () => void;
  onSave: (form: GuidelineFormData) => Promise<void>;
}

function GuidelineDialog({ open, initial, amenities, title, onClose, onSave }: GuidelineDialogProps) {
  const [form, setForm] = useState<GuidelineFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
    setError(null);
  }, [initial, open]);

  function set<K extends keyof GuidelineFormData>(key: K, value: GuidelineFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(code: string) {
    setForm((prev) => {
      const has = prev.required_amenities.includes(code);
      return {
        ...prev,
        required_amenities: has
          ? prev.required_amenities.filter((c) => c !== code)
          : [...prev.required_amenities, code],
      };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Building name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to save guideline.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} mt={1}>
          <TextField
            label="Building name"
            placeholder="e.g. Verve Apartments"
            fullWidth
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Min monthly rent ($)"
              type="number"
              fullWidth
              value={form.min_rent}
              onChange={(e) => set("min_rent", e.target.value)}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Max monthly rent ($)"
              type="number"
              fullWidth
              value={form.max_rent}
              onChange={(e) => set("max_rent", e.target.value)}
              inputProps={{ min: 0 }}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Min security deposit ($)"
              type="number"
              fullWidth
              value={form.min_deposit}
              onChange={(e) => set("min_deposit", e.target.value)}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Max security deposit ($)"
              type="number"
              fullWidth
              value={form.max_deposit}
              onChange={(e) => set("max_deposit", e.target.value)}
              inputProps={{ min: 0 }}
            />
          </Stack>

          <TextField
            label="Minimum availability (days)"
            type="number"
            fullWidth
            value={form.min_availability_days}
            onChange={(e) => set("min_availability_days", e.target.value)}
            inputProps={{ min: 1 }}
            helperText="e.g. 30 = one month, 120 = one semester"
          />

          <FormControl fullWidth>
            <InputLabel>Utilities included</InputLabel>
            <Select
              value={form.utilities_included}
              label="Utilities included"
              onChange={(e) => set("utilities_included", e.target.value as GuidelineFormData["utilities_included"])}
            >
              <MenuItem value="">No requirement</MenuItem>
              <MenuItem value="true">Must be included</MenuItem>
              <MenuItem value="false">Must not be included</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Pets allowed</InputLabel>
            <Select
              value={form.pets_allowed}
              label="Pets allowed"
              onChange={(e) => set("pets_allowed", e.target.value as GuidelineFormData["pets_allowed"])}
            >
              <MenuItem value="">No requirement</MenuItem>
              <MenuItem value="true">Must allow pets</MenuItem>
              <MenuItem value="false">Must not allow pets</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Furnished status</InputLabel>
            <Select
              value={form.furnished_status}
              label="Furnished status"
              onChange={(e) => set("furnished_status", e.target.value as GuidelineFormData["furnished_status"])}
            >
              <MenuItem value="">No requirement</MenuItem>
              <MenuItem value="furnished">Furnished</MenuItem>
              <MenuItem value="unfurnished">Unfurnished</MenuItem>
              <MenuItem value="partially_furnished">Partially Furnished</MenuItem>
            </Select>
          </FormControl>

          {amenities.length > 0 && (
            <FormControl component="fieldset">
              <FormLabel component="legend">Required amenities</FormLabel>
              <FormGroup row>
                {amenities.map((a) => (
                  <FormControlLabel
                    key={a.code}
                    control={
                      <Checkbox
                        size="small"
                        checked={form.required_amenities.includes(a.code)}
                        onChange={() => toggleAmenity(a.code)}
                      />
                    }
                    label={a.label}
                  />
                ))}
              </FormGroup>
            </FormControl>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={16} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Human-readable summary of a guideline ───────────────────────────────────

function GuidelineSummary({ g, amenities }: { g: GuidelineRecord; amenities: ListingAmenity[] }) {
  const chips: string[] = [];

  const minR = g.min_rent ? Number(g.min_rent) : null;
  const maxR = g.max_rent ? Number(g.max_rent) : null;
  if (minR != null && maxR != null)
    chips.push(`Rent $${minR.toLocaleString()}–$${maxR.toLocaleString()}`);
  else if (minR != null) chips.push(`Rent ≥ $${minR.toLocaleString()}`);
  else if (maxR != null) chips.push(`Rent ≤ $${maxR.toLocaleString()}`);

  const minD = g.min_deposit ? Number(g.min_deposit) : null;
  const maxD = g.max_deposit ? Number(g.max_deposit) : null;
  if (minD != null && maxD != null)
    chips.push(`Deposit $${minD.toLocaleString()}–$${maxD.toLocaleString()}`);
  else if (minD != null) chips.push(`Deposit ≥ $${minD.toLocaleString()}`);
  else if (maxD != null) chips.push(`Deposit ≤ $${maxD.toLocaleString()}`);

  if (g.min_availability_days != null)
    chips.push(`Available ≥ ${g.min_availability_days}d`);

  if (g.utilities_included === true) chips.push("Utilities included");
  else if (g.utilities_included === false) chips.push("No utilities");

  if (g.pets_allowed === true) chips.push("Pets OK");
  else if (g.pets_allowed === false) chips.push("No pets");

  if (g.furnished_status) chips.push(g.furnished_status.replace(/_/g, " "));

  for (const code of g.required_amenities ?? []) {
    const label = amenities.find((a) => a.code === code)?.label ?? code;
    chips.push(label);
  }

  if (chips.length === 0) return <Typography variant="body2" color="text.secondary">No requirements set.</Typography>;

  return (
    <Box display="flex" flexWrap="wrap" gap={0.75}>
      {chips.map((c) => (
        <Chip key={c} label={c} size="small" variant="outlined" />
      ))}
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GuidelineSettingsPage() {
  const [guidelines, setGuidelines] = useState<GuidelineRecord[]>([]);
  const [amenities, setAmenities] = useState<ListingAmenity[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [bookingFeeDraft, setBookingFeeDraft] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMessage, setFeeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GuidelineRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuidelineRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [g, a] = await Promise.all([getGuidelines(), getListingAmenities()]);
        if (!cancelled) {
          setGuidelines(g);
          setAmenities(a);
        }
      } catch {
        if (!cancelled) setError("Failed to load guidelines.");
      }
      try {
        const c = await getCompanyStatus();
        if (!cancelled) {
          setCompanyProfile(c);
          setBookingFeeDraft(c.booking_fee_percent ?? "0");
        }
      } catch {
        /* non-management or missing company — ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveBookingFee() {
    setFeeMessage(null);
    setFeeSaving(true);
    try {
      const next = await updateCompanyBookingFee(bookingFeeDraft.trim());
      setCompanyProfile(next);
      setBookingFeeDraft(next.booking_fee_percent);
      setFeeMessage({ type: "success", text: "Booking fee saved." });
    } catch {
      setFeeMessage({ type: "error", text: "Could not save booking fee. Use a number from 0 to 100." });
    } finally {
      setFeeSaving(false);
    }
  }

  async function handleCreate(form: GuidelineFormData) {
    const created = await createGuideline(form);
    setGuidelines((prev) => [...prev, created]);
    setDialogOpen(false);
  }

  async function handleUpdate(form: GuidelineFormData) {
    if (!editTarget) return;
    const updated = await updateGuideline(editTarget.id, form);
    setGuidelines((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGuideline(deleteTarget.id);
      setGuidelines((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Failed to delete guideline.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Guidelines / Fees
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Define listing requirements per building. Each guideline represents a building your
        company manages (e.g. Verve Apartments, The Hub).
      </Typography>

      <FeeConfigSection />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {companyProfile?.status === "approved" && (
        <Paper variant="outlined" sx={{ px: 2.5, py: 2, mb: 3 }}>
          <Typography fontWeight={600} gutterBottom>
            Listing booking fee
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Percent applied to prorated rent in the sublessee price breakdown for listings your company has approved.
          </Typography>
          {feeMessage && (
            <Alert severity={feeMessage.type} sx={{ mb: 2 }} onClose={() => setFeeMessage(null)}>
              {feeMessage.text}
            </Alert>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
            <TextField
              label="Fee (% of base rent)"
              type="number"
              size="small"
              value={bookingFeeDraft}
              onChange={(e) => setBookingFeeDraft(e.target.value)}
              inputProps={{ min: 0, max: 100, step: 0.25 }}
              sx={{ maxWidth: 220 }}
            />
            <Button variant="contained" onClick={() => void handleSaveBookingFee()} disabled={feeSaving}>
              {feeSaving ? "Saving…" : "Save fee"}
            </Button>
          </Stack>
        </Paper>
      )}

      <Stack spacing={2} mb={3}>
        {guidelines.length === 0 ? (
          <Paper variant="outlined" sx={{ px: 3, py: 3 }}>
            <Typography color="text.secondary">No guidelines yet. Add one below.</Typography>
          </Paper>
        ) : (
          guidelines.map((g) => (
            <Paper key={g.id} variant="outlined" sx={{ px: 2.5, py: 2 }}>
              <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <HomeWorkIcon fontSize="small" color="primary" />
                    <Typography fontWeight={600}>{g.name}</Typography>
                  </Box>
                  <GuidelineSummary g={g} amenities={amenities} />
                </Box>
                <Box display="flex" gap={0.5}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditTarget(g)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(g)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          ))
        )}
      </Stack>

      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
        Add Building Guideline
      </Button>

      {/* Create dialog */}
      <GuidelineDialog
        open={dialogOpen}
        initial={emptyForm()}
        amenities={amenities}
        title="Add Building Guideline"
        onClose={() => setDialogOpen(false)}
        onSave={handleCreate}
      />

      {/* Edit dialog */}
      <GuidelineDialog
        open={editTarget !== null}
        initial={editTarget ? recordToForm(editTarget) : emptyForm()}
        amenities={amenities}
        title="Edit Building Guideline"
        onClose={() => setEditTarget(null)}
        onSave={handleUpdate}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete guideline?</DialogTitle>
        <DialogContent>
          <Typography>
            Remove guidelines for <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={16} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
