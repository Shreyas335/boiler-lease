import { useState, useEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Link } from "@mui/material";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
} from "@mui/material";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { useAuth } from "../contexts/AuthContext";
import type { AxiosError } from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      const axiosError = err as AxiosError<{ email?: string[]; password?: string[]; detail?: string | string[] }>;
      if (!axiosError.response) {
        setError("Unable to connect to server. Please check if the backend is running.");
        return;
      }
      const msg = axiosError.response?.data;
      if (typeof msg === "string") {
        setError(msg);
      } else if (msg?.email) {
        setError(msg.email[0]);
      } else if (msg?.password) {
        setError(msg.password[0]);
      } else if (msg?.detail) {
        setError(Array.isArray(msg.detail) ? msg.detail[0] : msg.detail);
      } else if (axiosError.response?.status === 500) {
        setError("Server error. Please ensure database migrations have been run.");
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ py: 8, px: 2 }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: 4, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
            Log in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Welcome back. Sign in to your account.
          </Typography>
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={submitting}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              sx={{ py: 1.5 }}
            >
              {submitting ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
            Don't have an account?{" "}
            <Link component={RouterLink} to="/register" sx={{ color: "primary.main", fontWeight: 600 }}>
              Sign up
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
