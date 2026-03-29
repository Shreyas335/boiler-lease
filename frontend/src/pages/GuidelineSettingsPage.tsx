import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { getGuidelines, saveGuidelines } from "../api/company";

export default function GuidelineSettingsPage() {
  const [guidelines, setGuidelines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getGuidelines()
      .then(setGuidelines)
      .catch(() => setError("Failed to load guidelines."))
      .finally(() => setLoading(false));
  }, []);

  function handleAdd() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setGuidelines((prev) => [...prev, trimmed]);
    setNewItem("");
    setSuccess(false);
  }

  function handleDelete(index: number) {
    setGuidelines((prev) => prev.filter((_, i) => i !== index));
    setSuccess(false);
  }

  function handleEdit(index: number, value: string) {
    setGuidelines((prev) => prev.map((g, i) => (i === index ? value : g)));
    setSuccess(false);
  }

  async function handleSave() {
    const cleaned = guidelines.filter((g) => g.trim());
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const saved = await saveGuidelines(cleaned);
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
        Set the requirements a subleaser must meet to receive your company's approval on a listing.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Guidelines saved successfully.</Alert>}

      <Paper variant="outlined" sx={{ mb: 3 }}>
        {guidelines.length === 0 ? (
          <Box px={3} py={2}>
            <Typography color="text.secondary">No guidelines yet. Add one below.</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {guidelines.map((guideline, index) => (
              <ListItem
                key={index}
                divider={index < guidelines.length - 1}
                sx={{ gap: 1 }}
                secondaryAction={
                  <IconButton edge="end" color="error" onClick={() => handleDelete(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <DragIndicatorIcon sx={{ color: "text.disabled", mr: 1, flexShrink: 0 }} />
                <ListItemText
                  primary={
                    <TextField
                      fullWidth
                      variant="standard"
                      value={guideline}
                      onChange={(e) => handleEdit(index, e.target.value)}
                      InputProps={{ disableUnderline: true }}
                      sx={{ "& input": { fontSize: "0.95rem" } }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <TextField
        fullWidth
        placeholder="Add a new guideline…"
        value={newItem}
        onChange={(e) => setNewItem(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        sx={{ mb: 2 }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={handleAdd} disabled={!newItem.trim()} color="primary">
                <AddIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Button
        variant="contained"
        size="large"
        onClick={handleSave}
        disabled={saving}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
      >
        {saving ? "Saving…" : "Save Guidelines"}
      </Button>
    </Container>
  );
}
