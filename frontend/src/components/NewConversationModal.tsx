import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  IconButton,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { createOrGetConversation } from "../api/messaging";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  recipientId: number;
  recipientName: string;
  listingId?: number;
  listingTitle?: string;
}

export default function NewConversationModal({
  open,
  onClose,
  recipientId,
  recipientName,
  listingId,
  listingTitle,
}: NewConversationModalProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const conversation = await createOrGetConversation(
        recipientId,
        listingId ?? null,
        message.trim()
      );
      onClose();
      setMessage("");
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setMessage("");
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pr: 1 }}>
        <span>Message {recipientName}</span>
        <IconButton onClick={handleClose} size="small" aria-label="Close">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {listingTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Re: {listingTitle}
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label="Message"
          multiline
          rows={4}
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
          inputProps={{ maxLength: 4000 }}
          autoFocus
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          {message.length}/4000
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={loading || !message.trim()}
        >
          {loading ? "Sending…" : "Send"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
