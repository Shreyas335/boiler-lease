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
  MenuItem,
  InputAdornment,
} from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { useAuth } from "../contexts/AuthContext";
import type { UserType } from "../types/auth";
import type { AxiosError } from "axios";

const USER_TYPES: { value: UserType; label: string }[] = [
  { value: "sublessee", label: "Sublessee" },
  { value: "subleaser", label: "Subleaser" },
  { value: "management", label: "Management Company" },
];

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [userType, setUserType] = useState<UserType>("sublessee");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { user, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await register({
        username,
        email,
        password,
        password_confirm: passwordConfirm,
        user_type: userType,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      navigate("/dashboard");
    } catch (err) {
      const axiosError = err as AxiosError<Record<string, string[]>>;
      if (!axiosError.response) {
        setError("Unable to connect to server. Please check if the backend is running.");
        return;
      }
      const data = axiosError.response?.data;
      if (data && typeof data === "object") {
        const errors: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value) && value[0]) {
            errors[key] = value[0];
          } else if (typeof value === "string") {
            errors[key] = value;
          }
        }
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setError(Object.values(errors)[0]);
          return;
        }
      }
      if (axiosError.response?.status === 500) {
        setError("Server error. Please ensure database migrations have been run.");
      } else {
        setError("Registration failed. Please try again.");
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
            Create account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Join Boiler Lease and get started in minutes.
          </Typography>
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              select
              fullWidth
              label="I am a"
              value={userType}
              onChange={(e) => setUserType(e.target.value as UserType)}
              required
              disabled={submitting}
              sx={{ mb: 2 }}
            >
              {USER_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={submitting}
              error={!!fieldErrors.username}
              helperText={fieldErrors.username}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                disabled={submitting}
              />
              <TextField
                fullWidth
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                disabled={submitting}
              />
            </Box>
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={submitting}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password}
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
              label="Confirm password"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={submitting}
              error={!!fieldErrors.password_confirm}
              helperText={fieldErrors.password_confirm}
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
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
            Already have an account?{" "}
            <Link component={RouterLink} to="/login" sx={{ color: "primary.main", fontWeight: 600 }}>
              Log in
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
