import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, Link as RouterLink } from "react-router-dom";
import {
  Avatar,
  Box,
  Container,
  Grid,
  Paper,
  Card,
  CardMedia,
  CardContent,
  Typography,
  TextField,
  Stack,
  Button,
  Chip,
  Skeleton,
  Alert,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
  Pagination,
} from "@mui/material";
import { Menu as MenuIcon, Close as CloseIcon, ImageNotSupported, Person as PersonIcon } from "@mui/icons-material";
import {
  browseListings,
  type PropertyListing,
  type BrowseFilters,
} from "../api/listings";
import MapContainer from "../components/MapContainer";

const SORT_OPTIONS = [
  { value: "availability_start_date", label: "Closest Availability" },
  { value: "-availability_start_date", label: "Latest Availability" },
  { value: "monthly_rent", label: "Price: Low to High" },
  { value: "-monthly_rent", label: "Price: High to Low" },
  { value: "-created_at", label: "Newest First" },
];

const PROPERTY_TYPES = [
  { value: "", label: "Any" },
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "condo", label: "Condo" },
  { value: "studio", label: "Studio" },
  { value: "other", label: "Other" },
];

const FURNISHED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "furnished", label: "Furnished" },
  { value: "unfurnished", label: "Unfurnished" },
  { value: "partially_furnished", label: "Partially Furnished" },
];

const BEDROOM_OPTIONS = [
  { value: null, label: "Any" },
  { value: 0, label: "Studio" },
  { value: 1, label: "1+" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
];

const BATHROOM_OPTIONS = [
  { value: null, label: "Any" },
  { value: 1, label: "1+" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
];

interface FilterState {
  search: string;
  priceMin: number | null;
  priceMax: number | null;
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  bathroomsMin: number | null;
  bathroomsMax: number | null;
  city: string;
  state: string;
  propertyType: string;
  furnishedStatus: string;
  utilitiesIncluded: boolean;
  petsAllowed: boolean;
  parkingAvailable: boolean;
  sortBy: string;
  page: number;
}

function parseFiltersFromURL(searchParams: URLSearchParams): FilterState {
  return {
    search: searchParams.get("search") || "",
    priceMin: searchParams.get("price_min")
      ? parseInt(searchParams.get("price_min")!)
      : null,
    priceMax: searchParams.get("price_max")
      ? parseInt(searchParams.get("price_max")!)
      : null,
    bedroomsMin: searchParams.get("bedrooms_min")
      ? parseFloat(searchParams.get("bedrooms_min")!)
      : null,
    bedroomsMax: searchParams.get("bedrooms_max")
      ? parseFloat(searchParams.get("bedrooms_max")!)
      : null,
    bathroomsMin: searchParams.get("bathrooms_min")
      ? parseFloat(searchParams.get("bathrooms_min")!)
      : null,
    bathroomsMax: searchParams.get("bathrooms_max")
      ? parseFloat(searchParams.get("bathrooms_max")!)
      : null,
    city: searchParams.get("city") || "",
    state: searchParams.get("state") || "",
    propertyType: searchParams.get("property_type") || "",
    furnishedStatus: searchParams.get("furnished_status") || "",
    utilitiesIncluded: searchParams.get("utilities_included") === "true",
    petsAllowed: searchParams.get("pets_allowed") === "true",
    parkingAvailable: searchParams.get("parking_available") === "true",
    sortBy: searchParams.get("sort_by") || "availability_start_date",
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
  };
}

function filterStateToBrowseFilters(filters: FilterState): BrowseFilters {
  return {
    search: filters.search || undefined,
    price_min: filters.priceMin ?? undefined,
    price_max: filters.priceMax ?? undefined,
    bedrooms_min: filters.bedroomsMin ?? undefined,
    bedrooms_max: filters.bedroomsMax ?? undefined,
    bathrooms_min: filters.bathroomsMin ?? undefined,
    bathrooms_max: filters.bathroomsMax ?? undefined,
    city: filters.city || undefined,
    state: filters.state || undefined,
    property_type: filters.propertyType || undefined,
    furnished_status: filters.furnishedStatus || undefined,
    utilities_included: filters.utilitiesIncluded || undefined,
    pets_allowed: filters.petsAllowed || undefined,
    parking_available: filters.parkingAvailable || undefined,
    sort_by: filters.sortBy,
    page: filters.page,
    page_size: 20,
  };
}

interface PropertyCardProps {
  listing: PropertyListing;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

function PropertyCard({
  listing,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
  onClick,
  cardRef,
}: PropertyCardProps) {
  const primaryImage = listing.media?.find((m) => m.is_primary);
  const price = parseFloat(listing.monthly_rent || "0");
  const bedrooms = parseFloat(listing.bedrooms || "0");
  const bathrooms = parseFloat(listing.bathrooms || "0");

  return (
    <Card
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s ease",
        cursor: "pointer",
        border: isHighlighted ? "2px solid" : "1px solid",
        borderColor: isHighlighted ? "primary.main" : "divider",
        transform: isHighlighted ? "scale(1.02)" : "scale(1)",
        boxShadow: isHighlighted ? 4 : 1,
      }}
    >
      <CardMedia
        component="div"
        sx={{
          height: 200,
          bgcolor: "grey.200",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {primaryImage?.file_url ? (
          <img
            src={primaryImage.file_url}
            alt={listing.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <ImageNotSupported sx={{ color: "grey.400", fontSize: 60 }} />
        )}
      </CardMedia>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" sx={{ mb: 1 }}>
          {listing.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {listing.street_line_1}
          {listing.street_line_2 && <>, {listing.street_line_2}</>}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {listing.city}, {listing.state} {listing.postal_code}
        </Typography>

        <Stack spacing={1}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: "primary.main", fontWeight: "bold" }}
            >
              ${price.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              /month
            </Typography>
          </Box>

          <Box
            sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}
          >
            <Chip
              label={
                bedrooms % 1 === 0
                  ? `${Math.floor(bedrooms)} bed`
                  : `${bedrooms} bed`
              }
              size="small"
              variant="outlined"
            />
            <Chip
              label={
                bathrooms % 1 === 0
                  ? `${Math.floor(bathrooms)} bath`
                  : `${bathrooms} bath`
              }
              size="small"
              variant="outlined"
            />
          </Box>

          <Typography variant="caption" color="text.secondary">
            Available:{" "}
            {new Date(listing.availability_start_date).toLocaleDateString()}
          </Typography>

          {listing.utilities_included && (
            <Chip
              label="Utilities Included"
              size="small"
              color="success"
              variant="outlined"
            />
          )}

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            component={RouterLink}
            to={`/profile/${listing.owner_id}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{ textDecoration: "none", color: "text.secondary", mt: 0.5, "&:hover": { color: "primary.main" } }}
          >
            <Avatar sx={{ width: 20, height: 20, bgcolor: "grey.400" }}>
              <PersonIcon sx={{ fontSize: 14 }} />
            </Avatar>
            <Typography variant="caption">
              {listing.owner_first_name && listing.owner_last_name
                ? `${listing.owner_first_name} ${listing.owner_last_name}`
                : listing.owner_username}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function FilterSidebar({
  filters,
  onFilterChange,
  open,
  onClose,
}: {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  open: boolean;
  onClose: () => void;
}) {
  const handleClearFilters = () => {
    onFilterChange({
      search: "",
      priceMin: null,
      priceMax: null,
      bedroomsMin: null,
      bedroomsMax: null,
      bathroomsMin: null,
      bathroomsMax: null,
      city: "",
      state: "",
      propertyType: "",
      furnishedStatus: "",
      utilitiesIncluded: false,
      petsAllowed: false,
      parkingAvailable: false,
      sortBy: "availability_start_date",
      page: 1,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.bedroomsMin !== null ||
    filters.bathroomsMin !== null ||
    filters.city ||
    filters.state ||
    filters.propertyType ||
    filters.furnishedStatus ||
    filters.utilitiesIncluded ||
    filters.petsAllowed ||
    filters.parkingAvailable;

  const content = (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2.5}>
        {/* Search */}
        <TextField
          fullWidth
          label="Search"
          placeholder="Title, description, location..."
          value={filters.search}
          onChange={(e) =>
            onFilterChange({ ...filters, search: e.target.value, page: 1 })
          }
          size="small"
        />

        {/* Price Range */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Price Range ($/month)
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              type="number"
              label="Min"
              placeholder="0"
              value={filters.priceMin ?? ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  priceMin: e.target.value ? parseInt(e.target.value) : null,
                  page: 1,
                })
              }
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              size="small"
              type="number"
              label="Max"
              placeholder="Any"
              value={filters.priceMax ?? ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  priceMax: e.target.value ? parseInt(e.target.value) : null,
                  page: 1,
                })
              }
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Box>
        </Box>

        {/* Property Type */}
        <TextField
          select
          fullWidth
          size="small"
          label="Property Type"
          value={filters.propertyType}
          onChange={(e) =>
            onFilterChange({ ...filters, propertyType: e.target.value, page: 1 })
          }
        >
          {PROPERTY_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Bedrooms */}
        <TextField
          select
          fullWidth
          size="small"
          label="Bedrooms"
          value={filters.bedroomsMin ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              bedroomsMin: e.target.value === "" ? null : Number(e.target.value),
              page: 1,
            })
          }
        >
          {BEDROOM_OPTIONS.map((opt) => (
            <MenuItem key={opt.label} value={opt.value ?? ""}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Bathrooms */}
        <TextField
          select
          fullWidth
          size="small"
          label="Bathrooms"
          value={filters.bathroomsMin ?? ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              bathroomsMin: e.target.value === "" ? null : Number(e.target.value),
              page: 1,
            })
          }
        >
          {BATHROOM_OPTIONS.map((opt) => (
            <MenuItem key={opt.label} value={opt.value ?? ""}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Furnished Status */}
        <TextField
          select
          fullWidth
          size="small"
          label="Furnished"
          value={filters.furnishedStatus}
          onChange={(e) =>
            onFilterChange({ ...filters, furnishedStatus: e.target.value, page: 1 })
          }
        >
          {FURNISHED_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Location */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Location
          </Typography>
          <Stack spacing={1}>
            <TextField
              fullWidth
              label="City"
              size="small"
              value={filters.city}
              onChange={(e) =>
                onFilterChange({ ...filters, city: e.target.value, page: 1 })
              }
            />
            <TextField
              fullWidth
              label="State"
              size="small"
              placeholder="e.g. IN, CA"
              value={filters.state}
              onChange={(e) =>
                onFilterChange({ ...filters, state: e.target.value, page: 1 })
              }
            />
          </Stack>
        </Box>

        {/* Amenities / Features */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Features
          </Typography>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={filters.utilitiesIncluded}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      utilitiesIncluded: e.target.checked,
                      page: 1,
                    })
                  }
                />
              }
              label="Utilities Included"
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={filters.petsAllowed}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      petsAllowed: e.target.checked,
                      page: 1,
                    })
                  }
                />
              }
              label="Pets Allowed"
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={filters.parkingAvailable}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      parkingAvailable: e.target.checked,
                      page: 1,
                    })
                  }
                />
              }
              label="Parking Available"
            />
          </Stack>
        </Box>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="outlined" fullWidth onClick={handleClearFilters}>
            Clear Filters
          </Button>
        )}
      </Stack>
    </Box>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <Paper
        sx={{
          display: { xs: "none", md: "block" },
          width: 280,
          flexShrink: 0,
          p: 2,
          height: "fit-content",
          position: "sticky",
          top: 80,
        }}
      >
        {content}
      </Paper>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{ display: { xs: "block", md: "none" } }}
      >
        <Box sx={{ width: 300 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 2,
            }}
          >
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          {content}
        </Box>
      </Drawer>
    </>
  );
}

export default function BrowseListingsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromURL(searchParams),
  );
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(filters);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [highlightedListingId, setHighlightedListingId] = useState<number | null>(null);

  // Debounce filter changes (500ms delay)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const totalPages = Math.ceil(totalCount / 20);

  const handleMarkerClick = useCallback((listingId: number) => {
    setHighlightedListingId(listingId);
    const cardEl = cardRefs.current.get(listingId);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleMarkerHover = useCallback((listingId: number | null) => {
    setHighlightedListingId(listingId);
  }, []);

  const setCardRef = useCallback((listingId: number) => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(listingId, el);
      } else {
        cardRefs.current.delete(listingId);
      }
    };
  }, []);

  // Update URL when debounced filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (debouncedFilters.search) newParams.append("search", debouncedFilters.search);
    if (debouncedFilters.priceMin !== null)
      newParams.append("price_min", debouncedFilters.priceMin.toString());
    if (debouncedFilters.priceMax !== null)
      newParams.append("price_max", debouncedFilters.priceMax.toString());
    if (debouncedFilters.bedroomsMin !== null)
      newParams.append("bedrooms_min", debouncedFilters.bedroomsMin.toString());
    if (debouncedFilters.bedroomsMax !== null)
      newParams.append("bedrooms_max", debouncedFilters.bedroomsMax.toString());
    if (debouncedFilters.bathroomsMin !== null)
      newParams.append("bathrooms_min", debouncedFilters.bathroomsMin.toString());
    if (debouncedFilters.bathroomsMax !== null)
      newParams.append("bathrooms_max", debouncedFilters.bathroomsMax.toString());
    if (debouncedFilters.city) newParams.append("city", debouncedFilters.city);
    if (debouncedFilters.state) newParams.append("state", debouncedFilters.state);
    if (debouncedFilters.propertyType) newParams.append("property_type", debouncedFilters.propertyType);
    if (debouncedFilters.furnishedStatus) newParams.append("furnished_status", debouncedFilters.furnishedStatus);
    if (debouncedFilters.utilitiesIncluded) newParams.append("utilities_included", "true");
    if (debouncedFilters.petsAllowed) newParams.append("pets_allowed", "true");
    if (debouncedFilters.parkingAvailable) newParams.append("parking_available", "true");
    if (debouncedFilters.sortBy !== "availability_start_date")
      newParams.append("sort_by", debouncedFilters.sortBy);
    if (debouncedFilters.page !== 1) newParams.append("page", debouncedFilters.page.toString());

    setSearchParams(newParams);
  }, [debouncedFilters, setSearchParams]);

  // Fetch listings when debounced filters change
  useEffect(() => {
    async function fetchListings() {
      try {
        setLoading(true);
        const browseFilters = filterStateToBrowseFilters(debouncedFilters);
        const data = await browseListings(browseFilters);
        setListings(data.results);
        setTotalCount(data.count);
        setError(null);
      } catch (err) {
        setError("Failed to load listings. Please try again.");
        setListings([]);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [debouncedFilters]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo(0, 0);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
          Available Sublet Properties
        </Typography>
        {isMobile && (
          <IconButton onClick={() => setFilterDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        )}
      </Box>

      {/* Sort and Controls */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={filters.sortBy}
            label="Sort By"
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                sortBy: e.target.value,
                page: 1,
              }))
            }
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          {totalCount} properties found
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ display: "flex", gap: 3 }}>
        {/* Filter Sidebar (handles both desktop and mobile internally) */}
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
        />

        {/* Listings Grid */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <Grid container spacing={2}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Grid size={{ xs: 12, sm: 6, lg: isLargeScreen ? 6 : 4 }} key={i}>
                  <Skeleton variant="rectangular" height={300} />
                </Grid>
              ))}
            </Grid>
          ) : listings.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                No listings found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your filters or search criteria
              </Typography>
            </Paper>
          ) : (
            <>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {listings.map((listing) => (
                  <Grid size={{ xs: 12, sm: 6, lg: isLargeScreen ? 6 : 4 }} key={listing.id}>
                    <PropertyCard
                      listing={listing}
                      isHighlighted={highlightedListingId === listing.id}
                      onMouseEnter={() => setHighlightedListingId(listing.id)}
                      onMouseLeave={() => setHighlightedListingId(null)}
                      onClick={() => navigate(`/properties/${listing.id}`)}
                      cardRef={setCardRef(listing.id)}
                    />
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={filters.page}
                    onChange={handlePageChange}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Map (Large screens only) */}
        {isLargeScreen && (
          <Box
            sx={{
              width: "40%",
              flexShrink: 0,
              height: "calc(100vh - 180px)",
              position: "sticky",
              top: 100,
            }}
          >
            <MapContainer
              listings={listings}
              highlightedListingId={highlightedListingId}
              onMarkerClick={handleMarkerClick}
              onMarkerHover={handleMarkerHover}
              isLoading={loading}
            />
          </Box>
        )}
      </Box>
    </Container>
  );
}
