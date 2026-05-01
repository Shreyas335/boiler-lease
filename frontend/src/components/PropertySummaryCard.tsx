import { Box, Button, Card, CardContent, Chip, Stack, Typography, type ChipProps } from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { Link as RouterLink } from "react-router-dom";
import type { PropertyListingSummary } from "../api/listings";

function formatCurrency(value: string) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return `$${amount.toLocaleString()}`;
}

interface PropertySummaryCardProps {
  listing: PropertyListingSummary;
  onToggleFavorite?: (listing: PropertyListingSummary) => Promise<void> | void;
  favoriteLoading?: boolean;
  footerText?: string;
  statusLabel?: string;
  statusColor?: ChipProps["color"];
  actionButton?: {
    label: string;
    onClick: () => Promise<void> | void;
    disabled?: boolean;
    color?: "primary" | "error";
  };
  secondaryActionButton?: {
    label: string;
    onClick: () => Promise<void> | void;
    disabled?: boolean;
    color?: "primary" | "error";
  };
  extensionButton?: {
    label: string;
    onClick: () => Promise<void> | void;
    disabled?: boolean;
    color?: "primary" | "error";
  };
  extraStatusChip?: { label: string; color: ChipProps["color"] };
  bookingDetails?: { label: string; value: string }[];
}

export default function PropertySummaryCard({
  listing,
  onToggleFavorite,
  favoriteLoading = false,
  footerText,
  statusLabel,
  statusColor = "default",
  actionButton,
  secondaryActionButton,
  extensionButton,
  extraStatusChip,
  bookingDetails,
}: PropertySummaryCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
            <Box>
              <Typography
                variant="h6"
                component={RouterLink}
                to={`/properties/${listing.id}`}
                sx={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}
              >
                {listing.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {listing.city}, {listing.state}
              </Typography>
              {listing.tags && listing.tags.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.5} useFlexGap sx={{ mt: 0.75 }}>
                  {listing.tags.slice(0, 6).map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                  {listing.tags.length > 6 && (
                    <Chip label={`+${listing.tags.length - 6}`} size="small" variant="outlined" />
                  )}
                </Stack>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`${formatCurrency(listing.monthly_rent)}/mo`} />
              {onToggleFavorite && (
                <Button
                  variant="outlined"
                  color={listing.is_favorited ? "error" : "primary"}
                  size="small"
                  startIcon={listing.is_favorited ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
                  onClick={() => onToggleFavorite(listing)}
                  disabled={favoriteLoading}
                >
                  {listing.is_favorited ? "Saved" : "Save"}
                </Button>
              )}
            </Stack>
          </Stack>

          {listing.primary_photo_url ? (
            <Box component={RouterLink} to={`/properties/${listing.id}`} sx={{ lineHeight: 0 }}>
              <Box
                component="img"
                src={listing.primary_photo_url}
                alt={listing.title}
                sx={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                width: "100%",
                height: 140,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                border: "1px dashed",
                borderColor: "divider",
                color: "text.secondary",
              }}
            >
              <Typography variant="body2">No photo available</Typography>
            </Box>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">
                Available {listing.availability_start_date} to {listing.availability_end_date}
              </Typography>
              {statusLabel && <Chip size="small" label={statusLabel} color={statusColor} variant="outlined" />}
              {extraStatusChip && <Chip size="small" label={extraStatusChip.label} color={extraStatusChip.color} variant="outlined" />}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {actionButton && (
                <Button
                  variant="outlined"
                  size="small"
                  color={actionButton.color || "primary"}
                  onClick={actionButton.onClick}
                  disabled={actionButton.disabled}
                >
                  {actionButton.label}
                </Button>
              )}
              {secondaryActionButton && (
                <Button
                  variant="outlined"
                  size="small"
                  color={secondaryActionButton.color || "primary"}
                  onClick={secondaryActionButton.onClick}
                  disabled={secondaryActionButton.disabled}
                >
                  {secondaryActionButton.label}
                </Button>
              )}
              {extensionButton && (
                <Button
                  variant="outlined"
                  size="small"
                  color={extensionButton.color || "primary"}
                  onClick={extensionButton.onClick}
                  disabled={extensionButton.disabled}
                >
                  {extensionButton.label}
                </Button>
              )}
              <Button component={RouterLink} to={`/properties/${listing.id}`} variant="text" size="small">
                View Property
              </Button>
            </Stack>
          </Stack>

          {listing.approved_by_company_name && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <VerifiedIcon fontSize="small" color="success" />
              <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                Approved by {listing.approved_by_company_name}
              </Typography>
            </Stack>
          )}

          {bookingDetails && bookingDetails.length > 0 && (
            <Box sx={{ pt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
              <Stack spacing={0.5}>
                {bookingDetails.map(({ label, value }) => (
                  <Stack key={label} direction="row" justifyContent="space-between" gap={2}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ textAlign: "right" }}>{value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {footerText && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
              {footerText}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
