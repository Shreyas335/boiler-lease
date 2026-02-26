import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { submitFeedback } from "../api/help";

interface FormState {
  subject: string;
  message: string;
  rating: number | null;
}

interface FieldErrors {
  subject?: string;
  message?: string;
  rating?: string;
}

function getFieldError(
  errors: Record<string, string[] | string> | undefined,
  field: string
): string | undefined {
  const value = errors?.[field];
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function HelpPage() {
  const [form, setForm] = useState<FormState>({
    subject: "",
    message: "",
    rating: 0,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const nextErrors: FieldErrors = {};
    if (!form.message.trim()) {
      nextErrors.message = "Message is required.";
    }
    if (!form.rating || form.rating < 1) {
      nextErrors.rating = "Please provide a star rating.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setMessage({ type: "error", text: "Please fix the highlighted fields and try again." });
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        subject: form.subject,
        message: form.message,
        rating: form.rating || 1,
      });
      setForm({ subject: "", message: "", rating: 0 });
      setFieldErrors({});
      setMessage({ type: "success", text: "Thanks. Your feedback has been submitted." });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, string[] | string>>;
      const data = axiosError.response?.data;
      setFieldErrors({
        subject: getFieldError(data, "subject"),
        message: getFieldError(data, "message"),
        rating: getFieldError(data, "rating"),
      });
      setMessage({ type: "error", text: "Unable to submit feedback right now." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Feedback
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Share your feedback and rate your experience.
        </Typography>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              {message && <Alert severity={message.type}>{message.text}</Alert>}

              <TextField
                label="Subject (optional)"
                value={form.subject}
                onChange={(e) => handleChange("subject", e.target.value)}
                error={Boolean(fieldErrors.subject)}
                helperText={fieldErrors.subject}
                fullWidth
              />
              <TextField
                label="Feedback message"
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                error={Boolean(fieldErrors.message)}
                helperText={fieldErrors.message}
                multiline
                minRows={5}
                fullWidth
              />
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Rating
                </Typography>
                <Rating
                  name="feedback-rating"
                  value={form.rating}
                  onChange={(_, value) => {
                    setForm((prev) => ({ ...prev, rating: value }));
                    setFieldErrors((prev) => ({ ...prev, rating: undefined }));
                    setMessage(null);
                  }}
                />
                {fieldErrors.rating && (
                  <Typography color="error" variant="caption" sx={{ display: "block", mt: 0.5 }}>
                    {fieldErrors.rating}
                  </Typography>
                )}
              </Box>
              <Box>
                <Button type="submit" variant="contained" disabled={submitting}>
                  {submitting ? "Sending..." : "Send feedback"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
