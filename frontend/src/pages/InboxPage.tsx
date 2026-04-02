import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Divider,
  IconButton,
  Alert,
  Tooltip,
  Chip,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MessageRoundedIcon from "@mui/icons-material/MessageRounded";
import { listConversations, deleteConversation } from "../api/messaging";
import type { Conversation } from "../api/messaging";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function InboxPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await listConversations();
        setConversations(data);
      } catch {
        setError("Unable to load conversations.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDelete(e: React.MouseEvent, convId: number) {
    e.stopPropagation();
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Typography>Loading messages...</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Container maxWidth="md">
        <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
          Messages
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {conversations.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <MessageRoundedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
            <Typography variant="body1">No conversations yet.</Typography>
            <Typography variant="body2">
              Message a subleaser from any property listing to get started.
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
            {conversations.map((conv, idx) => (
              <Box key={conv.id}>
                {idx > 0 && <Divider />}
                <ListItemButton
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  sx={{ py: 1.5 }}
                >
                  <ListItemAvatar>
                    <Badge
                      badgeContent={conv.unread_count || 0}
                      color="error"
                      max={99}
                    >
                      <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
                        {conv.other_participant.full_name.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          variant="body1"
                          fontWeight={conv.unread_count > 0 ? 700 : 400}
                          noWrap
                        >
                          {conv.other_participant.full_name}
                        </Typography>
                        {conv.listing_summary && (
                          <Chip
                            label={conv.listing_summary.title}
                            size="small"
                            variant="outlined"
                            sx={{ maxWidth: 160, fontSize: "0.7rem" }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ fontWeight: conv.unread_count > 0 ? 600 : 400 }}
                      >
                        {conv.last_message?.content || "No messages yet"}
                      </Typography>
                    }
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5, ml: 1 }}>
                    {conv.last_message && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {formatRelativeTime(conv.last_message.created_at)}
                      </Typography>
                    )}
                    <Tooltip title="Delete conversation">
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(e, conv.id)}
                        sx={{ color: "text.disabled" }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
}
