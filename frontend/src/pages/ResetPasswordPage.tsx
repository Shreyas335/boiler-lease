import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
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
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import type { AxiosError } from "axios";
import { confirmPasswordReset } from "../api/auth";

function useTokenFromQuery() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);
}

export default function ResetPasswordPage() {
  const token = useTokenFromQuery();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (!token) {
      setError("Invalid or expired reset link.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await confirmPasswordReset({
        token,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });
      setMessage(response.detail);
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err) {
      const axiosError = err as AxiosError<Record<string, string[] | string>>;
      const data = axiosError.response?.data;

      if (data?.detail) {
        setError(Array.isArray(data.detail) ? data.detail[0] : data.detail);
      } else if (data?.new_password) {
        setError(Array.isArray(data.new_password) ? data.new_password[0] : data.new_password);
      } else if (data?.new_password_confirm) {
        setError(
          Array.isArray(data.new_password_confirm)
            ? data.new_password_confirm[0]
            : data.new_password_confirm
        );
      } else {
        setError("Unable to reset password.");
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
            Reset password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set a new password for your account.
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
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={submitting}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm new password"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
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

            <Button type="submit" variant="contained" fullWidth size="large" disabled={submitting} sx={{ py: 1.5 }}>
              {submitting ? "Resetting..." : "Reset password"}
            </Button>
          </form>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
            <Link component={RouterLink} to="/login" sx={{ color: "primary.main", fontWeight: 600 }}>
              Back to login
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
