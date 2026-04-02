import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import type { BlockedUser } from "../types/profile";
import { getBlockedUsers, unblockUser } from "../api/profiles";

export default function PrivacySettingsPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getBlockedUsers();
        setBlockedUsers(data);
      } catch {
        setError("Failed to load blocked users.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUnblock(userId: number) {
    setUnblockingId(userId);
    try {
      await unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_user_id !== userId));
    } catch {
      setError("Failed to unblock user.");
    } finally {
      setUnblockingId(null);
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Typography>Loading...</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          Privacy Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Manage users you have blocked.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {blockedUsers.length === 0 ? (
          <Typography color="text.secondary">You haven&apos;t blocked anyone.</Typography>
        ) : (
          <Stack spacing={2}>
            {blockedUsers.map((entry) => {
              const displayName =
                entry.blocked_user_first_name || entry.blocked_user_last_name
                  ? `${entry.blocked_user_first_name} ${entry.blocked_user_last_name}`.trim()
                  : entry.blocked_user_username;
              const avatarLetter = (
                entry.blocked_user_first_name?.[0] || entry.blocked_user_username[0]
              ).toUpperCase();

              return (
                <Card key={entry.id}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        src={entry.blocked_user_profile_picture_url || undefined}
                        sx={{ bgcolor: "primary.main" }}
                      >
                        {!entry.blocked_user_profile_picture_url && avatarLetter}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600}>{displayName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{entry.blocked_user_username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Blocked {new Date(entry.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleUnblock(entry.blocked_user_id)}
                        disabled={unblockingId === entry.blocked_user_id}
                      >
                        {unblockingId === entry.blocked_user_id ? "Unblocking..." : "Unblock"}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
