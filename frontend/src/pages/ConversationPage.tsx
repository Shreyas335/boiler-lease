import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import {
  getConversation,
  listMessages,
  sendMessage,
  markMessagesRead,
} from "../api/messaging";
import type { Conversation, Message } from "../api/messaging";
import type { PriceOffer } from "../api/offers";
import { submitOffer } from "../api/offers";
import { useAuth } from "../contexts/AuthContext";
import { useConversationSocket } from "../hooks/useConversationSocket";
import OfferCard from "../components/OfferCard";

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<number>>(new Set());

  // Offer modal state
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerEndDate, setOfferEndDate] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  const convId = Number(id);
  const isSublessee = user?.user_type === "sublessee";

  // Initial load
  useEffect(() => {
    async function load() {
      if (!convId) return;
      try {
        const [conv, paged] = await Promise.all([
          getConversation(convId),
          listMessages(convId),
        ]);
        setConversation(conv);
        setMessages(paged.results);
        messageIdsRef.current = new Set(paged.results.map((m) => m.id));
        await markMessagesRead(convId);
      } catch {
        setError("Unable to load conversation.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [convId]);

  // WebSocket handler — called when the server pushes a new message
  const handleSocketMessage = useCallback(
    (msg: Message) => {
      if (messageIdsRef.current.has(msg.id)) return;
      messageIdsRef.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      if (msg.sender_id !== user?.id) {
        markMessagesRead(convId).catch(() => {});
      }
    },
    [convId, user?.id]
  );

  useConversationSocket(convId, handleSocketMessage);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update an offer in-place when subleaser accepts/declines from within the chat
  function handleOfferUpdated(updated: PriceOffer) {
    setMessages((prev) =>
      prev.map((m) =>
        m.offer?.id === updated.id ? { ...m, offer: updated } : m
      )
    );
  }

  async function handleSend() {
    if (!content.trim() || !convId) return;
    setSending(true);
    try {
      const msg = await sendMessage(convId, content.trim());
      if (!messageIdsRef.current.has(msg.id)) {
        messageIdsRef.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
      }
      setContent("");
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : null;
      setError(detail || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSubmitOffer() {
    const price = Number(offerPrice);
    if (!price || price <= 0) {
      setOfferError("Please enter a valid price greater than 0.");
      return;
    }
    if (!offerStartDate || !offerEndDate) {
      setOfferError("Please select both a start date and an end date.");
      return;
    }
    if (offerEndDate < offerStartDate) {
      setOfferError("End date must be on or after the start date.");
      return;
    }
    setOfferSubmitting(true);
    setOfferError(null);
    try {
      const offer = await submitOffer(convId, price, offerStartDate, offerEndDate, offerNote.trim());
      // The backend also creates a message; it arrives via WebSocket, but optimistically add it
      const optimisticMsg: Message = {
        id: Date.now(), // temporary id; WS echo deduplication keeps the real one
        conversation: convId,
        sender_id: user!.id,
        sender_username: user!.username,
        content: `Sent a price offer: $${price.toLocaleString()}/mo`,
        offer,
        created_at: new Date().toISOString(),
        is_read: true,
      };
      messageIdsRef.current.add(optimisticMsg.id);
      setMessages((prev) => [...prev, optimisticMsg]);
      setOfferModalOpen(false);
      setOfferPrice("");
      setOfferStartDate("");
      setOfferEndDate("");
      setOfferNote("");
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : null;
      setOfferError(detail || "Failed to submit offer.");
    } finally {
      setOfferSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Typography>Loading conversation...</Typography>
        </Container>
      </Box>
    );
  }

  if (error && !conversation) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  const other = conversation?.other_participant;

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Button
            component={RouterLink}
            to="/messages"
            startIcon={<ArrowBackRoundedIcon />}
            variant="text"
            size="small"
            sx={{ color: "text.secondary" }}
          >
            Back
          </Button>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {other?.full_name}
            </Typography>
            {conversation?.listing_summary && (
              <Typography variant="body2" color="text.secondary">
                Re:{" "}
                <RouterLink
                  to={`/properties/${conversation.listing_summary.id}`}
                  style={{ color: "inherit" }}
                >
                  {conversation.listing_summary.title}
                </RouterLink>{" "}
                · {conversation.listing_summary.city},{" "}
                {conversation.listing_summary.state}
              </Typography>
            )}
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Messages */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            minHeight: 320,
            maxHeight: 480,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {messages.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", mt: 4 }}
            >
              No messages yet. Start the conversation!
            </Typography>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;

            if (msg.offer) {
              return (
                <Box
                  key={msg.id}
                  sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}
                >
                  <OfferCard
                    offer={msg.offer}
                    viewerIsSublessee={isSublessee}
                    onOfferUpdated={handleOfferUpdated}
                  />
                </Box>
              );
            }

            return (
              <Box
                key={msg.id}
                sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}
              >
                <Box
                  sx={{
                    maxWidth: "70%",
                    bgcolor: isMe ? "primary.main" : "grey.100",
                    color: isMe ? "primary.contrastText" : "text.primary",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {msg.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", textAlign: "right", opacity: 0.7, mt: 0.25 }}
                  >
                    {formatTime(msg.created_at)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          <div ref={bottomRef} />
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Compose */}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            multiline
            maxRows={4}
            fullWidth
            placeholder="Type a message… (Enter to send)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            inputProps={{ maxLength: 4000 }}
            size="small"
          />
          {isSublessee && conversation?.listing_summary && (
            <Button
              variant="outlined"
              onClick={() => setOfferModalOpen(true)}
              startIcon={<LocalOfferRoundedIcon />}
              sx={{ whiteSpace: "nowrap" }}
            >
              Make Offer
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={sending || !content.trim()}
            endIcon={<SendRoundedIcon />}
          >
            {sending ? "…" : "Send"}
          </Button>
        </Stack>
      </Container>

      {/* Make Offer Modal */}
      <Dialog
        open={offerModalOpen}
        onClose={() => !offerSubmitting && setOfferModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Make a Price Offer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {offerError && <Alert severity="error">{offerError}</Alert>}
            <TextField
              label="Your offered price (monthly)"
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ min: 1, step: "0.01" }}
              fullWidth
              autoFocus
            />
            <TextField
              label="Start date"
              type="date"
              value={offerStartDate}
              onChange={(e) => setOfferStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: conversation?.listing_summary?.availability_start_date,
                max: conversation?.listing_summary?.availability_end_date,
              }}
              fullWidth
            />
            <TextField
              label="End date"
              type="date"
              value={offerEndDate}
              onChange={(e) => setOfferEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: offerStartDate || conversation?.listing_summary?.availability_start_date,
                max: conversation?.listing_summary?.availability_end_date,
              }}
              fullWidth
            />
            {conversation?.listing_summary && (
              <Typography variant="caption" color="text.secondary">
                Available {conversation.listing_summary.availability_start_date} – {conversation.listing_summary.availability_end_date}
              </Typography>
            )}
            <TextField
              label="Note (optional)"
              multiline
              rows={3}
              value={offerNote}
              onChange={(e) => setOfferNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
              placeholder="E.g. I'm a quiet grad student, flexible on move-in date."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferModalOpen(false)} disabled={offerSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitOffer}
            disabled={offerSubmitting || !offerPrice}
            startIcon={offerSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Send Offer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
