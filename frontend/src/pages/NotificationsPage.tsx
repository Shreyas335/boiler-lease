import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../api/notifications";
import { notifDestination } from "../utils/notifDestination";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => setError("Unable to load notifications."))
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    const dest = notifDestination(n);
    if (dest) navigate(dest);
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Container maxWidth="md">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <NotificationsRoundedIcon color="action" />
            <Typography variant="h5" fontWeight={700}>
              Notifications
            </Typography>
          </Stack>
          {hasUnread && (
            <Button size="small" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </Stack>

        {loading && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && notifications.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
            You're all caught up!
          </Typography>
        )}

        {!loading && !error && notifications.map((n, i) => (
          <Box key={n.id}>
            <Box
              onClick={() => handleClick(n)}
              sx={{
                py: 1.5,
                px: 1,
                cursor: "pointer",
                borderRadius: 1,
                bgcolor: n.is_read ? "transparent" : "action.hover",
                "&:hover": { bgcolor: "action.selected" },
                display: "flex",
                gap: 1.5,
                alignItems: "flex-start",
              }}
            >
              {!n.is_read && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    mt: 0.75,
                    flexShrink: 0,
                  }}
                />
              )}
              {n.is_read && <Box sx={{ width: 8, flexShrink: 0 }} />}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={n.is_read ? 400 : 600}>
                  {n.title}
                </Typography>
                {n.body && (
                  <Typography variant="caption" color="text.secondary">
                    {n.body}
                  </Typography>
                )}
                <Typography variant="caption" color="text.disabled" display="block">
                  {new Date(n.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Box>
            {i < notifications.length - 1 && <Divider />}
          </Box>
        ))}
      </Container>
    </Box>
  );
}
