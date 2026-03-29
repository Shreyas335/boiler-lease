import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PowerIcon from "@mui/icons-material/Power";
import PetsIcon from "@mui/icons-material/Pets";
import WeekendIcon from "@mui/icons-material/Weekend";
import StarIcon from "@mui/icons-material/Star";
import HomeIcon from "@mui/icons-material/Home";
import { getGuidelines, saveGuidelines } from "../api/company";
import { getListingAmenities } from "../api/listings";
import type { ListingAmenity } from "../api/listings";
import type {
  Guideline,
  GuidelineType,
  FurnishedStatus,
} from "../types/guidelines";
import { GUIDELINE_TYPE_LABELS, guidelineToHuman } from "../types/guidelines";

const GUIDELINE_TYPES: GuidelineType[] = [
  "rent_range",
  "deposit_range",
  "min_availability_days",
  "utilities_included",
  "pets_allowed",
  "furnished_status",
  "amenity_required",
];

const GUIDELINE_ICONS: Record<GuidelineType, React.ReactNode> = {
  rent_range: <AttachMoneyIcon fontSize="small" />,
  deposit_range: <AttachMoneyIcon fontSize="small" />,
  min_availability_days: <CalendarMonthIcon fontSize="small" />,
  utilities_included: <PowerIcon fontSize="small" />,
  pets_allowed: <PetsIcon fontSize="small" />,
  furnished_status: <WeekendIcon fontSize="small" />,
  amenity_required: <StarIcon fontSize="small" />,
};

function buildDefault(type: GuidelineType): Guideline {
  switch (type) {
    case "rent_range": return { type, min_rent: undefined, max_rent: undefined };
    case "deposit_range": return { type, min_deposit: undefined, max_deposit: undefined };
    case "min_availability_days": return { type, min_days: 30 };
    case "utilities_included": return { type, required: true };
    case "pets_allowed": return { type, required: false };
    case "furnished_status": return { type, value: "furnished" };
    case "amenity_required": return { type, amenity_code: "", amenity_label: "" };
  }
}

interface AddDialogProps {
  open: boolean;
  amenities: ListingAmenity[];
  onClose: () => void;
  onAdd: (g: Guideline) => void;
}

function AddGuidelineDialog({ open, amenities, onClose, onAdd }: AddDialogProps) {
  const [selectedType, setSelectedType] = useState<GuidelineType>("rent_range");
  const [draft, setDraft] = useState<Guideline>(buildDefault("rent_range"));
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(type: GuidelineType) {
    setSelectedType(type);
    setDraft(buildDefault(type));
    setError(null);
  }

  function handleAdd() {
    if (draft.type === "rent_range") {
      if (draft.min_rent == null && draft.max_rent == null) {
        setError("Enter at least one of min or max rent.");
        return;
      }
      if (draft.min_rent != null && draft.max_rent != null && draft.min_rent > draft.max_rent) {
        setError("Min rent cannot be greater than max rent.");
        return;
      }
    }
    if (draft.type === "deposit_range") {
      if (draft.min_deposit == null && draft.max_deposit == null) {
        setError("Enter at least one of min or max deposit.");
        return;
      }
      if (draft.min_deposit != null && draft.max_deposit != null && draft.min_deposit > draft.max_deposit) {
        setError("Min deposit cannot be greater than max deposit.");
        return;
      }
    }
    if (draft.type === "min_availability_days" && draft.min_days < 1) {
      setError("Minimum days must be at least 1.");
      return;
    }
    if (draft.type === "amenity_required" && !draft.amenity_code) {
      setError("Please select an amenity.");
      return;
    }
    onAdd(draft);
    setSelectedType("rent_range");
    setDraft(buildDefault("rent_range"));
    setError(null);
  }

  function renderFields() {
    switch (draft.type) {
      case "rent_range":
        return (
          <Stack direction="row" spacing={2}>
            <TextField
              label="Min rent ($)"
              type="number"
              fullWidth
              value={draft.min_rent ?? ""}
              onChange={(e) => setDraft({ ...draft, min_rent: e.target.value ? Number(e.target.value) : undefined })}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Max rent ($)"
              type="number"
              fullWidth
              value={draft.max_rent ?? ""}
              onChange={(e) => setDraft({ ...draft, max_rent: e.target.value ? Number(e.target.value) : undefined })}
              inputProps={{ min: 0 }}
            />
          </Stack>
        );
      case "deposit_range":
        return (
          <Stack direction="row" spacing={2}>
            <TextField
              label="Min deposit ($)"
              type="number"
              fullWidth
              value={draft.min_deposit ?? ""}
              onChange={(e) => setDraft({ ...draft, min_deposit: e.target.value ? Number(e.target.value) : undefined })}
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Max deposit ($)"
              type="number"
              fullWidth
              value={draft.max_deposit ?? ""}
              onChange={(e) => setDraft({ ...draft, max_deposit: e.target.value ? Number(e.target.value) : undefined })}
              inputProps={{ min: 0 }}
            />
          </Stack>
        );
      case "min_availability_days":
        return (
          <TextField
            label="Minimum days available"
            type="number"
            fullWidth
            value={draft.min_days}
            onChange={(e) => setDraft({ ...draft, min_days: Number(e.target.value) })}
            inputProps={{ min: 1 }}
            helperText="e.g. 30 = at least one month, 90 = at least one semester"
          />
        );
      case "utilities_included":
        return (
          <FormControlLabel
            control={
              <Switch
                checked={draft.required}
                onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              />
            }
            label={draft.required ? "Utilities must be included" : "Utilities must not be included"}
          />
        );
      case "pets_allowed":
        return (
          <FormControlLabel
            control={
              <Switch
                checked={draft.required}
                onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              />
            }
            label={draft.required ? "Must allow pets" : "Must not allow pets"}
          />
        );
      case "furnished_status":
        return (
          <FormControl fullWidth>
            <InputLabel>Furnished status</InputLabel>
            <Select
              value={draft.value}
              label="Furnished status"
              onChange={(e) => setDraft({ ...draft, value: e.target.value as FurnishedStatus })}
            >
              <MenuItem value="furnished">Furnished</MenuItem>
              <MenuItem value="unfurnished">Unfurnished</MenuItem>
              <MenuItem value="partially_furnished">Partially Furnished</MenuItem>
            </Select>
          </FormControl>
        );
      case "amenity_required":
        return (
          <FormControl fullWidth>
            <InputLabel>Amenity</InputLabel>
            <Select
              value={draft.amenity_code}
              label="Amenity"
              onChange={(e) => {
                const amenity = amenities.find((a) => a.code === e.target.value);
                if (amenity) setDraft({ ...draft, amenity_code: amenity.code, amenity_label: amenity.label });
              }}
            >
              {amenities.map((a) => (
                <MenuItem key={a.code} value={a.code}>{a.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Guideline</DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          <FormControl fullWidth>
            <InputLabel>Guideline type</InputLabel>
            <Select
              value={selectedType}
              label="Guideline type"
              onChange={(e) => handleTypeChange(e.target.value as GuidelineType)}
            >
              {GUIDELINE_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{GUIDELINE_TYPE_LABELS[t]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {renderFields()}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function GuidelineSettingsPage() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [amenities, setAmenities] = useState<ListingAmenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([getGuidelines(), getListingAmenities()])
      .then(([g, a]) => { setGuidelines(g); setAmenities(a); })
      .catch(() => setError("Failed to load guidelines."))
      .finally(() => setLoading(false));
  }, []);

  function handleAdd(g: Guideline) {
    setGuidelines((prev) => [...prev, g]);
    setDialogOpen(false);
    setSuccess(false);
  }

  function handleDelete(index: number) {
    setGuidelines((prev) => prev.filter((_, i) => i !== index));
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const saved = await saveGuidelines(guidelines);
      setGuidelines(saved);
      setSuccess(true);
    } catch {
      setError("Failed to save guidelines. Please try again.");
    } finally {
      setSaving(false);
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
        Guideline Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Set the requirements a listing must meet for your company to consider approving it.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Guidelines saved successfully.</Alert>}

      <Paper variant="outlined" sx={{ mb: 3 }}>
        {guidelines.length === 0 ? (
          <Box px={3} py={3}>
            <Typography color="text.secondary">No guidelines yet. Add one below.</Typography>
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {guidelines.map((g, index) => (
              <Box key={index} display="flex" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Chip
                    icon={GUIDELINE_ICONS[g.type] as React.ReactElement}
                    label={GUIDELINE_TYPE_LABELS[g.type]}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                  <Typography variant="body2">{guidelineToHuman(g)}</Typography>
                </Box>
                <Tooltip title="Remove">
                  <IconButton size="small" color="error" onClick={() => handleDelete(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add Guideline
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <HomeIcon />}
        >
          {saving ? "Saving…" : "Save Guidelines"}
        </Button>
      </Stack>

      <AddGuidelineDialog
        open={dialogOpen}
        amenities={amenities}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAdd}
      />
    </Container>
  );
}
