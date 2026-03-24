import { useState } from "react";
import * as identityApi from "../api/identity";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useAuth } from "../contexts/AuthContext";

const USER_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  sublessee: {
    label: "Sublessee",
    icon: <HomeWorkRoundedIcon sx={{ fontSize: 40 }} />,
    description: "Find and manage your sublets",
  },
  subleaser: {
    label: "Subleaser",
    icon: <PersonSearchRoundedIcon sx={{ fontSize: 40 }} />,
    description: "List your space and find sublessees",
  },
  management: {
    label: "Management Company",
    icon: <BusinessRoundedIcon sx={{ fontSize: 40 }} />,
    description: "Oversee subleases across your properties",
  },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [identityBusy, setIdentityBusy] = useState(false);
  if (!user) return null;

  const config = USER_TYPE_CONFIG[user.user_type] || USER_TYPE_CONFIG.sublessee;

  const showIdentityCta =
    (user.user_type === "sublessee" || user.user_type === "subleaser") &&
    user.identity_verification_status !== "verified";
  const identityActionLabel =
    user.identity_verification_status === "failed"
      ? "Retry verification"
      : user.identity_verification_status === "pending"
        ? "Continue verification"
        : "Verify identity";

  const startIdentity = async () => {
    setIdentityBusy(true);
    try {
      const { url } = await identityApi.startIdentityVerificationSession();
      window.location.assign(url);
    } catch {
      setIdentityBusy(false);
    }
  };

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        {showIdentityCta && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                disabled={identityBusy}
                onClick={() => void startIdentity()}
              >
                {identityBusy ? "Starting…" : identityActionLabel}
              </Button>
            }
          >
            Verify your identity for trust before you list or
            book. You&apos;ll complete checks on Stripe&apos;s secure page (test mode
            uses sample documents).
          </Alert>
        )}
        {!user.email_verified && (
          <Alert
            severity="warning"
            icon={<WarningAmberRoundedIcon />}
            sx={{ mb: 3 }}
          >
            Your email hasn&apos;t been verified yet. Please check your inbox
            for the verification link, or open Account settings (gear icon) to
            resend it.
          </Alert>
        )}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Welcome back, {user.first_name || user.username}
          </Typography>
          <Chip
            label={config.label}
            color="primary"
            size="small"
            sx={{ mt: 1 }}
          />
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Box sx={{ color: "primary.main" }}>{config.icon}</Box>
              <Box>
                <Typography variant="h6">Your dashboard</Typography>
                <Typography variant="body2" color="text.secondary">
                  {config.description}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              More features are coming soon. You're all set up and ready to go.
            </Typography>
          </CardContent>
        </Card>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {user.user_type === "sublessee" && (
            <>
              <Button component={RouterLink} to="/browse" variant="outlined">
                Browse listings
              </Button>
              <Button
                component={RouterLink}
                to="/bookings/current"
                variant="outlined"
              >
                Current bookings
              </Button>
              <Button
                component={RouterLink}
                to="/bookings/past"
                variant="outlined"
              >
                Past bookings
              </Button>
              <Button component={RouterLink} to="/favorites" variant="outlined">
                Favorites
              </Button>
            </>
          )}
          {user.user_type === "subleaser" && (
            <>
              <Button
                component={RouterLink}
                to="/listings/new"
                variant="outlined"
              >
                Create listing
              </Button>
              <Button
                component={RouterLink}
                to="/my-listings"
                variant="outlined"
              >
                My listings
              </Button>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
