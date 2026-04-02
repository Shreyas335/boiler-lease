import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Paper,
  Divider,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import {
  getConversation,
  listMessages,
  sendMessage,
  markMessagesRead,
} from "../api/messaging";
import type { Conversation, Message } from "../api/messaging";
import { useAuth } from "../contexts/AuthContext";
import { useConversationSocket } from "../hooks/useConversationSocket";

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

  const convId = Number(id);

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
      if (messageIdsRef.current.has(msg.id)) return; // already in state
      messageIdsRef.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      // If recipient opened the conversation, mark the new message as read
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

  async function handleSend() {
    if (!content.trim() || !convId) return;
    setSending(true);
    try {
      const msg = await sendMessage(convId, content.trim());
      // Optimistically add our own message (the WS echo will be deduped)
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
    </Box>
  );
}
