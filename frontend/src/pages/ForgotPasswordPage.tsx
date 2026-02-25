import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Link } from "@mui/material";
import {
  Alert,
  Box,
  Button,
  Container,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import type { AxiosError } from "axios";
import { requestPasswordReset } from "../api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await requestPasswordReset({ email });
      setMessage(response.detail);
    } catch (err) {
      const axiosError = err as AxiosError<{ email?: string[]; detail?: string }>;
      const data = axiosError.response?.data;
      if (data?.email?.[0]) {
        setError(data.email[0]);
      } else if (data?.detail) {
        setError(data.detail);
      } else {
        setError("Unable to process password reset request.");
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
            Forgot password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your email and we&apos;ll send you a reset link.
          </Typography>

          <form onSubmit={handleSubmit}>
            {message && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {message}
              </Alert>
            )}
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
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Button type="submit" variant="contained" fullWidth size="large" disabled={submitting} sx={{ py: 1.5 }}>
              {submitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
            Remembered your password?{" "}
            <Link component={RouterLink} to="/login" sx={{ color: "primary.main", fontWeight: 600 }}>
              Back to login
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
