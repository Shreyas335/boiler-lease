import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Container, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import {
  addFavorite,
  getBrowseListings,
  removeFavorite,
  type ListingSortBy,
  type PropertyListingSummary,
  type SortOrder,
} from "../api/listings";
import PropertySummaryCard from "../components/PropertySummaryCard";
import { useAuth } from "../contexts/AuthContext";

export default function ExploreListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<PropertyListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ListingSortBy>("date_listed");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);

  useEffect(() => {
    async function loadListings() {
      try {
        setError(null);
        setLoading(true);
        const data = await getBrowseListings(sortBy, order);
        setListings(data);
      } catch {
        setError("Unable to load property listings.");
      } finally {
        setLoading(false);
      }
    }

    if (user?.user_type === "sublessee") {
      loadListings();
    } else {
      setLoading(false);
    }
  }, [user, sortBy, order]);

  const sortLabel = useMemo(() => {
    if (sortBy === "price") return "Price";
    if (sortBy === "availability_start") return "Availability start";
    if (sortBy === "availability_end") return "Availability end";
    return "Date listed";
  }, [sortBy]);

  async function toggleFavorite(listing: PropertyListingSummary) {
    try {
      setFavoriteBusyId(listing.id);
      if (listing.is_favorited) {
        await removeFavorite(listing.id);
      } else {
        await addFavorite(listing.id);
      }
      setListings((prev) =>
        prev.map((item) =>
          item.id === listing.id ? { ...item, is_favorited: !item.is_favorited } : item
        )
      );
    } catch {
      setError("Unable to update favorites. Please try again.");
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
              Explore Listings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Browse available properties and save your favorites.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="explore-sort-by">Sort by</InputLabel>
              <Select
                labelId="explore-sort-by"
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value as ListingSortBy)}
              >
                <MenuItem value="date_listed">Date listed</MenuItem>
                <MenuItem value="price">Price</MenuItem>
                <MenuItem value="availability_start">Availability start</MenuItem>
                <MenuItem value="availability_end">Availability end</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="explore-order">Order</InputLabel>
              <Select
                labelId="explore-order"
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
          <Typography>Loading listings...</Typography>
        ) : listings.length === 0 ? (
          <Alert severity="info">
            No property listings are available right now. Please check back later.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {listings.map((listing) => (
              <PropertySummaryCard
                key={listing.id}
                listing={listing}
                onToggleFavorite={toggleFavorite}
                favoriteLoading={favoriteBusyId === listing.id}
                footerText={`Sorted by ${sortLabel.toLowerCase()} (${order})`}
              />
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
