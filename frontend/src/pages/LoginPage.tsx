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
import PinRoundedIcon from "@mui/icons-material/PinRounded";
import { useAuth } from "../contexts/AuthContext";
import type { AxiosError } from "axios";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, login: loginUser, verify2FA } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await loginUser(login, password);
      if (result.success) {
        navigate("/dashboard");
        return;
      }
      if (result.requires_2fa && result.temp_token) {
        setTwoFactorToken(result.temp_token);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ login?: string[]; password?: string[]; detail?: string | string[] }>;
      if (!axiosError.response) {
        setError("Unable to connect to server. Please check if the backend is running.");
        return;
      }
      const msg = axiosError.response?.data;
      if (typeof msg === "string") {
        setError(msg);
      } else if (msg?.login) {
        setError(Array.isArray(msg.login) ? msg.login[0] : msg.login);
      } else if (msg?.password) {
        setError(Array.isArray(msg.password) ? msg.password[0] : msg.password);
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

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!twoFactorToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await verify2FA(twoFactorToken, twoFactorCode);
      navigate("/dashboard");
    } catch (err) {
      const axiosError = err as AxiosError<{ code?: string[]; detail?: string }>;
      const msg = axiosError.response?.data;
      if (msg?.code?.[0]) {
        setError(msg.code[0]);
      } else if (msg?.detail) {
        setError(msg.detail);
      } else {
        setError("Invalid or expired code. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const show2FAStep = Boolean(twoFactorToken);

  return (
    <Box sx={{ py: 8, px: 2 }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: 4, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
            {show2FAStep ? "Two-factor authentication" : "Log in"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {show2FAStep
              ? "We sent a 6-digit code to your email. Enter it below."
              : "Welcome back. Sign in to your account."}
          </Typography>

          {show2FAStep ? (
            <form onSubmit={handle2FASubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                label="Verification code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputProps={{ maxLength: 6, pattern: "[0-9]*" }}
                disabled={submitting}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PinRoundedIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={submitting || twoFactorCode.length !== 6}
                sx={{ py: 1.5 }}
              >
                {submitting ? "Verifying…" : "Verify"}
              </Button>
              <Button
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => {
                  setTwoFactorToken(null);
                  setTwoFactorCode("");
                  setError(null);
                }}
              >
                Back to login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Email or username"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
              placeholder="Enter your email or username"
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
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <Link component={RouterLink} to="/forgot-password" sx={{ fontSize: "0.9rem" }}>
                Forgot password?
              </Link>
            </Box>
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
          )}

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
