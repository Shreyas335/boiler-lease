import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
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
}

export default function PropertySummaryCard({
  listing,
  onToggleFavorite,
  favoriteLoading = false,
  footerText,
}: PropertySummaryCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {listing.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {listing.city}, {listing.state}
              </Typography>
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
            <Box
              component="img"
              src={listing.primary_photo_url}
              alt={listing.title}
              sx={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }}
            />
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
            <Typography variant="body2" color="text.secondary">
              Available {listing.availability_start_date} to {listing.availability_end_date}
            </Typography>
            <Button component={RouterLink} to={`/properties/${listing.id}`} variant="text" size="small">
              View details
            </Button>
          </Stack>

          {footerText && (
            <Typography variant="body2" color="text.secondary">
              {footerText}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
