import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Container, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import {
  getFavorites,
  removeFavorite,
  type FavoriteRecord,
  type FavoriteSortBy,
  type SortOrder,
} from "../api/listings";
import PropertySummaryCard from "../components/PropertySummaryCard";
import { useAuth } from "../contexts/AuthContext";

export default function FavoritesPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<FavoriteSortBy>("date_saved");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);

  useEffect(() => {
    async function loadFavorites() {
      try {
        setError(null);
        setLoading(true);
        const data = await getFavorites(sortBy, order);
        setFavorites(data);
      } catch {
        setError("Unable to load favorites.");
      } finally {
        setLoading(false);
      }
    }

    if (user?.user_type === "sublessee") {
      loadFavorites();
    } else {
      setLoading(false);
    }
  }, [user, sortBy, order]);

  const sortLabel = useMemo(() => {
    if (sortBy === "price") return "Price";
    if (sortBy === "date_listed") return "Date listed";
    return "Date saved";
  }, [sortBy]);

  async function removeFromFavorites(listingId: number) {
    try {
      setFavoriteBusyId(listingId);
      await removeFavorite(listingId);
      setFavorites((prev) => prev.filter((item) => item.listing.id !== listingId));
    } catch {
      setError("Unable to remove favorite. Please try again.");
    } finally {
      setFavoriteBusyId(null);
    }
  }

  if (!user || user.user_type !== "sublessee") {
    return (
      <Box sx={{ py: 6, px: 2 }}>
        <Container maxWidth="md">
          <Alert severity="error">Only sublessees can view this page.</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Favorites
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View your saved properties.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="favorites-sort-by">Sort by</InputLabel>
              <Select
                labelId="favorites-sort-by"
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value as FavoriteSortBy)}
              >
                <MenuItem value="date_saved">Date saved</MenuItem>
                <MenuItem value="price">Price</MenuItem>
                <MenuItem value="date_listed">Date listed</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="favorites-order">Order</InputLabel>
              <Select
                labelId="favorites-order"
                value={order}
                label="Order"
                onChange={(e) => setOrder(e.target.value as SortOrder)}
              >
                <MenuItem value="desc">Descending</MenuItem>
                <MenuItem value="asc">Ascending</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Typography>Loading favorites...</Typography>
        ) : favorites.length === 0 ? (
          <Alert severity="info">You have no saved favorites yet.</Alert>
        ) : (
          <Stack spacing={2}>
            {favorites.map((favorite) => (
              <PropertySummaryCard
                key={favorite.id}
                listing={favorite.listing}
                onToggleFavorite={() => removeFromFavorites(favorite.listing.id)}
                favoriteLoading={favoriteBusyId === favorite.listing.id}
                footerText={`Saved on ${new Date(favorite.created_at).toLocaleDateString()} | Sorted by ${sortLabel.toLowerCase()} (${order})`}
              />
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
