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

const USER_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
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

  if (!user) return null;

  const config = USER_TYPE_CONFIG[user.user_type] || USER_TYPE_CONFIG.sublessee;

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        {!user.email_verified && (
          <Alert
            severity="warning"
            icon={<WarningAmberRoundedIcon />}
            sx={{ mb: 3 }}
          >
            Your email hasn&apos;t been verified yet. Please check your inbox for the verification link, or open Account settings (gear icon) to resend it.
          </Alert>
        )}

        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Welcome back, {user.first_name || user.username}
          </Typography>
          <Chip label={config.label} color="primary" size="small" sx={{ mt: 1 }} />
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
              <Button component={RouterLink} to="/bookings/current" variant="outlined">
                Current bookings
              </Button>
              <Button component={RouterLink} to="/bookings/past" variant="outlined">
                Past bookings
              </Button>
              <Button component={RouterLink} to="/favorites" variant="outlined">
                Favorites
              </Button>
            </>
          )}
          {user.user_type === "subleaser" && (
            <>
              <Button component={RouterLink} to="/listings/new" variant="outlined">
                Create listing
              </Button>
              <Button component={RouterLink} to="/my-listings" variant="outlined">
                My listings
              </Button>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
