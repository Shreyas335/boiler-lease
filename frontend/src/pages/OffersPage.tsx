import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
  Button,
} from "@mui/material";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import { Link as RouterLink } from "react-router-dom";
import { listOffers, respondToOffer, type PriceOffer } from "../api/offers";
import { useAuth } from "../contexts/AuthContext";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  accepted: "success",
  declined: "error",
};

function formatPrice(price: string) {
  return `$${Number(price).toLocaleString()}/mo`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface OfferRowProps {
  offer: PriceOffer;
  isSublessee: boolean;
  onUpdated: (updated: PriceOffer) => void;
}

function OfferRow({ offer, isSublessee, onUpdated }: OfferRowProps) {
  const [busy, setBusy] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(action: "accepted" | "declined") {
    setBusy(action);
    setError(null);
    try {
      const updated = await respondToOffer(offer.id, action);
      onUpdated(updated);
    } catch {
      setError("Failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Box sx={{ py: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {offer.listing_title}
          </Typography>
          {!isSublessee && (
            <Typography variant="body2" color="text.secondary">
              From: {offer.sublessee_name}
            </Typography>
          )}
          <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
            {formatPrice(offer.offered_price)}
          </Typography>
          {offer.note && (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              "{offer.note}"
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {formatDate(offer.created_at)}
            {offer.responded_at && ` · Responded ${formatDate(offer.responded_at)}`}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
            size="small"
            color={STATUS_COLOR[offer.status] ?? "default"}
          />

          {!isSublessee && offer.status === "pending" && (
            <>
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
            </>
          )}

          {isSublessee && offer.status === "accepted" && (
            <Button
              component={RouterLink}
              to="/bookings/current"
              size="small"
              variant="contained"
            >
              View Booking
            </Button>
          )}

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export default function OffersPage() {
  const { user } = useAuth();
  const isSublessee = user?.user_type === "sublessee";
  const [tab, setTab] = useState(0);
  const [offers, setOffers] = useState<PriceOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusFilter = tab === 1 ? "pending" : tab === 2 ? "accepted" : tab === 3 ? "declined" : undefined;

  useEffect(() => {
    setLoading(true);
    setError(null);
    listOffers(statusFilter)
      .then(setOffers)
      .catch(() => setError("Unable to load offers."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  function handleUpdated(updated: PriceOffer) {
    setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Container maxWidth="md">
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
          <LocalOfferRoundedIcon color="action" />
          <Typography variant="h5" fontWeight={700}>
            {isSublessee ? "My Offers" : "Received Offers"}
          </Typography>
        </Stack>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="All" />
          <Tab label="Pending" />
          <Tab label="Accepted" />
          <Tab label="Declined" />
        </Tabs>

        {loading && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && offers.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No offers found.
          </Typography>
        )}

        {!loading && !error && offers.map((offer, i) => (
          <Box key={offer.id}>
            <OfferRow
              offer={offer}
              isSublessee={isSublessee}
              onUpdated={handleUpdated}
            />
            {i < offers.length - 1 && <Divider />}
          </Box>
        ))}
      </Container>
    </Box>
  );
}
