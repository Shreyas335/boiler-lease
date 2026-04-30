import { useState } from "react";
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import { Link as RouterLink } from "react-router-dom";
import type { PriceOffer } from "../api/offers";
import { respondToOffer } from "../api/offers";

interface OfferCardProps {
  offer: PriceOffer;
  viewerIsSublessee: boolean;
  onOfferUpdated: (updated: PriceOffer) => void;
}

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  accepted: "success",
  declined: "error",
};

function formatPrice(price: string) {
  return `$${Number(price).toLocaleString()}/mo`;
}

export default function OfferCard({ offer, viewerIsSublessee, onOfferUpdated }: OfferCardProps) {
  const [busy, setBusy] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(action: "accepted" | "declined") {
    setBusy(action);
    setError(null);
    try {
      const updated = await respondToOffer(offer.id, action);
      onOfferUpdated(updated);
    } catch {
      setError("Failed to respond. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        bgcolor: "background.paper",
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <LocalOfferRoundedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Price Offer
        </Typography>
        <Chip
          label={offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
          size="small"
          color={STATUS_COLOR[offer.status] ?? "default"}
          sx={{ ml: "auto" }}
        />
      </Stack>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
        {formatPrice(offer.offered_price)}
      </Typography>

      {offer.note && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: "italic" }}>
          "{offer.note}"
        </Typography>
      )}

      {error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mb: 0.5 }}>
          {error}
        </Typography>
      )}

      {!viewerIsSublessee && offer.status === "pending" && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            color="success"
            disabled={busy !== null}
            onClick={() => handleRespond("accepted")}
            startIcon={busy === "accepted" ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Accept
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={busy !== null}
            onClick={() => handleRespond("declined")}
            startIcon={busy === "declined" ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Decline
          </Button>
        </Stack>
      )}

      {viewerIsSublessee && offer.status === "accepted" && (
        <Button
          component={RouterLink}
          to="/bookings/current"
          size="small"
          variant="contained"
          sx={{ mt: 1 }}
        >
          View Booking
        </Button>
      )}
    </Box>
  );
}
