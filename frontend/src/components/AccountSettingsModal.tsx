import { useState } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  Paper,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { useAuth } from "../contexts/AuthContext";
import {
  sendVerificationEmail,
  twoFactorEnable,
  twoFactorDisable,
} from "../api/auth";
import type { AxiosError } from "axios";

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AccountSettingsModal({ open, onClose }: AccountSettingsModalProps) {
  const { user, refreshUser } = useAuth();
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [twoFactorMessage, setTwoFactorMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  async function handleResendVerification() {
    if (!user || user.email_verified) return;
    setEmailMessage(null);
    setEmailLoading(true);
    try {
      await sendVerificationEmail();
      setEmailMessage({ type: "success", text: "Verification email sent. Check your inbox." });
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setEmailMessage({
        type: "error",
        text: axiosError.response?.data?.detail || "Failed to send email. Try again later.",
      });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handle2FAToggle(_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) {
    setTwoFactorMessage(null);
    setTwoFactorLoading(true);
    try {
      if (checked) {
        await twoFactorEnable();
        setTwoFactorMessage({
          type: "success",
          text: "Two-factor authentication enabled. Next time you log in, we'll email you a code.",
        });
      } else {
        await twoFactorDisable();
        setTwoFactorMessage({
          type: "success",
          text: "Two-factor authentication disabled. You'll only need your password to log in.",
        });
      }
      await refreshUser();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setTwoFactorMessage({
        type: "error",
        text: axiosError.response?.data?.detail || "Something went wrong. Try again.",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: "hidden",
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(4px)",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      }}
      TransitionProps={{ timeout: 200 }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1,
          py: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Account settings
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ color: "text.secondary" }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 3, pt: 0 }}>
        <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <EmailRoundedIcon color="action" />
            <Typography variant="subtitle1" fontWeight={600}>
              Email verification
            </Typography>
          </Box>
          {user.email_verified ? (
            <Typography variant="body2" color="text.secondary">
              Your email is verified.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your email is not verified. Click the link in the verification email, or resend it below.
              </Typography>
              {emailMessage && (
                <Alert severity={emailMessage.type} sx={{ mb: 2 }}>
                  {emailMessage.text}
                </Alert>
              )}
              <Button
                variant="outlined"
                onClick={handleResendVerification}
                disabled={emailLoading}
              >
                {emailLoading ? "Sending…" : "Resend verification email"}
              </Button>
            </>
          )}
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <LockRoundedIcon color="action" />
            <Typography variant="subtitle1" fontWeight={600}>
              Two-factor authentication
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            When enabled, we'll send a one-time code to your email each time you log in.
          </Typography>
          {twoFactorMessage && (
            <Alert severity={twoFactorMessage.type} sx={{ mb: 2 }}>
              {twoFactorMessage.text}
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={user.two_factor_enabled}
                onChange={handle2FAToggle}
                disabled={twoFactorLoading}
              />
            }
            label={user.two_factor_enabled ? "2FA is on" : "2FA is off"}
          />
        </Paper>
      </DialogContent>
    </Dialog>
  );
}
