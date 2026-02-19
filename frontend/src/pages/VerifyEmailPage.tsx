import { useState, useEffect } from "react";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { Box, Container, Paper, Typography, Button, Alert } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { verifyEmail } from "../api/auth";

const INVALID_LINK_MESSAGE =
  "This verification link is invalid or has expired. Check your email for the latest link, or open Account settings (gear icon) to resend it.";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");
  const verifiedParam = searchParams.get("verified");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (verifiedParam === "success") {
      setStatus("success");
      setMessage("Your email has been successfully verified.");
      return;
    }
    if (errorParam === "invalid") {
      setStatus("error");
      setMessage(INVALID_LINK_MESSAGE);
      return;
    }
    if (!token) {
      setStatus("error");
      setMessage("Verification link is missing. Please use the link from your email.");
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.detail || "Your email has been verified.");
      })
      .catch((err: { response?: { data?: { detail?: string | string[] } } }) => {
        setStatus("error");
        const detail = err.response?.data?.detail;
        const detailStr =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail[0]
              : null;
        setMessage(detailStr || INVALID_LINK_MESSAGE);
      });
  }, [token, errorParam, verifiedParam]);

  return (
    <Box sx={{ py: 8, px: 2 }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: 4, border: "1px solid", borderColor: "divider" }}>
          {status === "loading" && (
            <Typography variant="body1" color="text.secondary">
              Verifying your email…
            </Typography>
          )}
          {status === "success" && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <CheckCircleRoundedIcon color="success" sx={{ fontSize: 32 }} />
                <Typography variant="h5" fontWeight={600}>
                  Email verified
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {message}
              </Typography>
              <Button component={RouterLink} to="/dashboard" variant="contained">
                Go to dashboard
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <Typography variant="h6" fontWeight={600} color="error" sx={{ mb: 1 }}>
                Invalid email verification link
              </Typography>
              <Alert severity="error" sx={{ mb: 2 }}>
                {message}
              </Alert>
              <Button component={RouterLink} to="/login" variant="contained">
                Log in
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
