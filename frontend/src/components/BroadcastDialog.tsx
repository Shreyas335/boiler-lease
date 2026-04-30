import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import { sendBroadcast } from "../api/notifications";

interface BroadcastDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BroadcastDialog({ open, onClose }: BroadcastDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleClose() {
    if (busy) return;
    onClose();
    setTitle("");
    setBody("");
    setResult(null);
  }

  async function handleSend() {
    if (!title.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const { sent_to } = await sendBroadcast(title.trim(), body.trim());
      setResult(`Sent to ${sent_to} sublessee${sent_to !== 1 ? "s" : ""}.`);
      setTitle("");
      setBody("");
    } catch {
      setResult("Failed to send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Broadcast Notification</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {result && (
            <Alert severity={result.startsWith("Failed") ? "error" : "success"}>
              {result}
            </Alert>
          )}
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            autoFocus
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label="Message (optional)"
            multiline
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            inputProps={{ maxLength: 1000 }}
          />
          <Typography variant="caption" color="text.secondary">
            This will notify all sublessees with active bookings on your managed listings.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void handleSend()}
          disabled={busy || !title.trim()}
          startIcon={<CampaignRoundedIcon />}
        >
          {busy ? "Sending..." : "Send"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
