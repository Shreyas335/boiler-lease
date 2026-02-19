import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  if (user) return null;

  return (
    <Box>
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          px: 2,
          background: "linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)",
          color: "white",
          borderBottom: "4px solid #CFB991",
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h1" sx={{ fontSize: { xs: "2.5rem", md: "3.5rem" }, mb: 2, fontWeight: 700 }}>
            Sublease management, simplified
          </Typography>
          <Typography variant="h5" sx={{ mb: 4, opacity: 0.95, fontWeight: 400 }}>
            Whether you're subletting, finding a sublessee, or managing properties—Boiler Lease connects everyone in one place.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                bgcolor: "secondary.main",
                color: "primary.main",
                px: 3,
                py: 1.5,
                fontWeight: 700,
                "&:hover": { bgcolor: "secondary.dark" },
              }}
            >
              Get started
            </Button>
            <Button
              component={Link}
              to="/login"
              variant="outlined"
              size="large"
              sx={{
                borderColor: "white",
                color: "white",
                px: 3,
                py: 1.5,
                "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              Log in
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h2" sx={{ textAlign: "center", mb: 6, fontSize: { xs: "1.75rem", md: "2rem" } }}>
          Built for everyone in the sublease process
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ color: "primary.main", mb: 2 }}>
                  <HomeWorkRoundedIcon sx={{ fontSize: 48 }} />
                </Box>
                <Typography variant="h6" gutterBottom>
                  Sublessees
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Find and secure sublets with verified listings. Manage your agreements and stay organized.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ color: "primary.main", mb: 2 }}>
                  <PersonSearchRoundedIcon sx={{ fontSize: 48 }} />
                </Box>
                <Typography variant="h6" gutterBottom>
                  Subleasers
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  List your space and connect with qualified sublessees. Handle applications in one place.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ color: "primary.main", mb: 2 }}>
                  <BusinessRoundedIcon sx={{ fontSize: 48 }} />
                </Box>
                <Typography variant="h6" gutterBottom>
                  Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Oversee subleases across your properties. Approve, track, and manage with full visibility.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ textAlign: "center", mt: 10 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Ready to get started?
          </Typography>
          <Button
            component={Link}
            to="/register"
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ px: 4, py: 1.5 }}
          >
            Create your account
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
