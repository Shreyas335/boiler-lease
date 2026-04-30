import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "../api/notifications";

const PREF_LABELS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: "new_message", label: "New messages" },
  { key: "booking_request", label: "Booking requests" },
  { key: "booking_confirmed", label: "Booking confirmed" },
  { key: "booking_declined", label: "Booking declined" },
  { key: "offer_received", label: "Price offers received" },
  { key: "offer_accepted", label: "Offer accepted" },
  { key: "offer_declined", label: "Offer declined" },
  { key: "listing_approved", label: "Listing approved" },
  { key: "listing_rejected", label: "Listing not approved" },
  { key: "broadcast", label: "Management company broadcasts" },
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => setError("Unable to load preferences."))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: keyof NotificationPreferences) {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs((prev) => prev ? { ...prev, [key]: newValue } : prev);
    try {
      await updateNotificationPreferences({ [key]: newValue });
    } catch {
      setPrefs((prev) => prev ? { ...prev, [key]: !newValue } : prev);
      setError("Failed to save preference. Please try again.");
    }
  }

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Container maxWidth="sm">
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
          <NotificationsRoundedIcon color="action" />
          <Typography variant="h5" fontWeight={700}>
            Notification Settings
          </Typography>
        </Stack>

        {loading && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && prefs && (
          <Card>
            <CardContent sx={{ px: 3, py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose which in-app notifications you want to receive.
              </Typography>
              {PREF_LABELS.map(({ key, label }, i) => (
                <Box key={key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={prefs[key]}
                        onChange={() => handleToggle(key)}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{label}</Typography>}
                    labelPlacement="start"
                    sx={{ width: "100%", justifyContent: "space-between", ml: 0, py: 0.5 }}
                  />
                  {i < PREF_LABELS.length - 1 && <Divider />}
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  );
}
