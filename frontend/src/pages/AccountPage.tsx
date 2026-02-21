import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import {
  changePassword,
  getAccountProfile,
  updateAccountProfile,
  type ChangePasswordPayload,
  type UpdateAccountPayload,
} from "../api/auth";
import type { User } from "../types/auth";
import { useAuth } from "../contexts/AuthContext";

type FieldErrors = Partial<Record<keyof UpdateAccountPayload, string>>;
type PasswordFieldErrors = Partial<Record<keyof ChangePasswordPayload, string>>;

function getFieldError(
  errors: Record<string, string[] | string> | undefined,
  field: string
): string | undefined {
  const value = errors?.[field];
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function AccountPage() {
  const { refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [form, setForm] = useState<UpdateAccountPayload>({
    username: "",
    first_name: "",
    last_name: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pageMessage, setPageMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState<ChangePasswordPayload>({
    current_password: "",
    new_password: "",
    new_password_confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [reloginDialogOpen, setReloginDialogOpen] = useState(false);

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      form.username !== profile.username ||
      form.first_name !== profile.first_name ||
      form.last_name !== profile.last_name
    );
  }, [form, profile]);

  useEffect(() => {
    async function loadAccount() {
      try {
        const data = await getAccountProfile();
        setProfile(data);
        setForm({
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
        });
      } catch {
        setPageMessage({ type: "error", text: "Unable to load your account details." });
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  function handleChange(field: keyof UpdateAccountPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setPageMessage(null);
  }

  function handlePasswordChange(field: keyof ChangePasswordPayload, value: string) {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordErrors((prev) => ({ ...prev, [field]: undefined }));
    setPasswordMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setPageMessage(null);

    try {
      const updated = await updateAccountProfile(form);
      setProfile(updated);
      setForm({
        username: updated.username,
        first_name: updated.first_name,
        last_name: updated.last_name,
      });
      await refreshUser();
      setPageMessage({ type: "success", text: "Account details updated." });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, string[] | string>>;
      const data = axiosError.response?.data;
      const nextErrors: FieldErrors = {
        username: getFieldError(data, "username"),
        first_name: getFieldError(data, "first_name"),
        last_name: getFieldError(data, "last_name"),
      };
      setFieldErrors(nextErrors);
      setPageMessage({
        type: "error",
        text: "Please fix the highlighted fields and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordErrors({});

    if (!passwordForm.current_password.trim()) {
      setPasswordErrors({ current_password: "Current password is required." });
      setPasswordMessage({ type: "error", text: "Current password is required." });
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordErrors({ new_password: "Password must be at least 8 characters." });
      setPasswordMessage({ type: "error", text: "Please fix the highlighted fields and try again." });
      return;
    }
    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      setPasswordErrors({ new_password_confirm: "New passwords do not match." });
      setPasswordMessage({ type: "error", text: "Please fix the highlighted fields and try again." });
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwordForm);
      setPasswordForm({
        current_password: "",
        new_password: "",
        new_password_confirm: "",
      });
      setReloginDialogOpen(true);
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, string[] | string>>;
      const data = axiosError.response?.data;
      const currentPasswordError = getFieldError(data, "current_password");
      const newPasswordError = getFieldError(data, "new_password");
      const newPasswordConfirmError = getFieldError(data, "new_password_confirm");
      setPasswordErrors({
        current_password: currentPasswordError,
        new_password: newPasswordError,
        new_password_confirm: newPasswordConfirmError,
      });
      const message =
        currentPasswordError ||
        newPasswordError ||
        newPasswordConfirmError ||
        "Unable to update password. Please try again.";
      setPasswordMessage({
        type: "error",
        text: message,
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleReloginConfirm() {
    setReloginDialogOpen(false);
    await logout();
    navigate("/login");
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Typography>Loading account details...</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Review and update your profile information.
        </Typography>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2} component="form" onSubmit={handleSubmit}>
              {pageMessage && <Alert severity={pageMessage.type}>{pageMessage.text}</Alert>}

              <TextField
                label="Username"
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
                error={Boolean(fieldErrors.username)}
                helperText={fieldErrors.username}
                fullWidth
              />
              <TextField
                label="Email"
                value={profile?.email ?? ""}
                InputProps={{ readOnly: true }}
                sx={{
                  "& .MuiInputBase-input": {
                    color: "text.disabled",
                    userSelect: "none",
                  },
                }}
                fullWidth
              />
              <TextField
                label="First name"
                value={form.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
                error={Boolean(fieldErrors.first_name)}
                helperText={fieldErrors.first_name}
                fullWidth
              />
              <TextField
                label="Last name"
                value={form.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
                error={Boolean(fieldErrors.last_name)}
                helperText={fieldErrors.last_name}
                fullWidth
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button type="submit" variant="contained" disabled={saving || !dirty}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2} component="form" onSubmit={handlePasswordSubmit}>
              <Typography variant="h6">Change password</Typography>
              {passwordMessage && <Alert severity={passwordMessage.type}>{passwordMessage.text}</Alert>}
              <TextField
                label="Current password"
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => handlePasswordChange("current_password", e.target.value)}
                error={Boolean(passwordErrors.current_password)}
                helperText={passwordErrors.current_password}
                fullWidth
              />
              <TextField
                label="New password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => handlePasswordChange("new_password", e.target.value)}
                error={Boolean(passwordErrors.new_password)}
                helperText={passwordErrors.new_password}
                fullWidth
              />
              <TextField
                label="Confirm new password"
                type="password"
                value={passwordForm.new_password_confirm}
                onChange={(e) => handlePasswordChange("new_password_confirm", e.target.value)}
                error={Boolean(passwordErrors.new_password_confirm)}
                helperText={passwordErrors.new_password_confirm}
                fullWidth
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button type="submit" variant="contained" disabled={changingPassword}>
                  {changingPassword ? "Updating..." : "Update password"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Dialog open={reloginDialogOpen} onClose={() => setReloginDialogOpen(false)}>
          <DialogTitle>Password Updated</DialogTitle>
          <DialogContent>
            <Typography>
              Your password was changed successfully. Please log in again to continue.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleReloginConfirm} variant="contained">
              Re-login now
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
