import { useEffect, useRef, useCallback } from "react";
import { Box, Paper, Typography, Alert, Skeleton } from "@mui/material";
import { MapRounded } from "@mui/icons-material";
import useGoogleMaps from "../hooks/useGoogleMaps";
import type { PropertyListing } from "../api/listings";

interface MapContainerProps {
  listings: PropertyListing[];
  highlightedListingId: number | null;
  onMarkerClick: (listingId: number) => void;
  onMarkerHover: (listingId: number | null) => void;
}

const DEFAULT_CENTER = { lat: 40.4237, lng: -86.9212 }; // West Lafayette, IN
const DEFAULT_ZOOM = 12;

export default function MapContainer({
  listings,
  highlightedListingId,
  onMarkerClick,
  onMarkerHover,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const { isLoaded, loadError, google } = useGoogleMaps();

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !google || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapId: "boiler-lease-map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [isLoaded, google]);

  // Create marker element
  const createMarkerElement = useCallback(
    (listing: PropertyListing, isHighlighted: boolean) => {
      const price = parseFloat(listing.monthly_rent || "0");
      const markerEl = document.createElement("div");
      markerEl.className = "property-marker";
      markerEl.innerHTML = `$${price >= 1000 ? Math.round(price / 100) / 10 + "k" : price}`;
      markerEl.style.cssText = `
        background: ${isHighlighted ? "#1976d2" : "#ffffff"};
        color: ${isHighlighted ? "#ffffff" : "#1976d2"};
        padding: 6px 10px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid #1976d2;
        white-space: nowrap;
      `;
      return markerEl;
    },
    []
  );

  // Update markers when listings change
  useEffect(() => {
    if (!isLoaded || !google || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentMarkers = markersRef.current;

    // Remove markers for listings that no longer exist
    const listingIds = new Set(listings.map((l) => l.id));
    currentMarkers.forEach((marker, id) => {
      if (!listingIds.has(id)) {
        marker.map = null;
        currentMarkers.delete(id);
      }
    });

    // Add or update markers
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    listings.forEach((listing) => {
      const lat = parseFloat(listing.latitude || "");
      const lng = parseFloat(listing.longitude || "");

      if (isNaN(lat) || isNaN(lng)) return;

      hasValidCoords = true;
      const position = { lat, lng };
      bounds.extend(position);

      let marker = currentMarkers.get(listing.id);

      if (!marker) {
        // Create new marker
        const markerEl = createMarkerElement(
          listing,
          listing.id === highlightedListingId
        );

        marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position,
          content: markerEl,
          title: listing.title,
        });

        marker.addListener("click", () => onMarkerClick(listing.id));

        markerEl.addEventListener("mouseenter", () =>
          onMarkerHover(listing.id)
        );
        markerEl.addEventListener("mouseleave", () => onMarkerHover(null));

        currentMarkers.set(listing.id, marker);
      } else {
        // Update existing marker position
        marker.position = position;
      }
    });

    // Fit bounds if we have valid coordinates
    if (hasValidCoords && listings.length > 0) {
      if (listings.length === 1) {
        const lat = parseFloat(listings[0].latitude || "");
        const lng = parseFloat(listings[0].longitude || "");
        if (!isNaN(lat) && !isNaN(lng)) {
          map.setCenter({ lat, lng });
          map.setZoom(15);
        }
      } else {
        map.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [
    isLoaded,
    google,
    listings,
    highlightedListingId,
    onMarkerClick,
    onMarkerHover,
    createMarkerElement,
  ]);

  // Update marker styles when highlighted listing changes
  useEffect(() => {
    if (!isLoaded || !google) return;

    markersRef.current.forEach((marker, id) => {
      const listing = listings.find((l) => l.id === id);
      if (listing && marker.content) {
        const newContent = createMarkerElement(
          listing,
          id === highlightedListingId
        );
        marker.content = newContent;

        // Re-attach event listeners
        newContent.addEventListener("mouseenter", () => onMarkerHover(id));
        newContent.addEventListener("mouseleave", () => onMarkerHover(null));
      }
    });
  }, [
    isLoaded,
    google,
    highlightedListingId,
    listings,
    createMarkerElement,
    onMarkerHover,
  ]);

  if (loadError) {
    return (
      <Paper sx={{ p: 3, height: "100%", minHeight: 400 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Unable to load map
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {loadError.message.includes("API key")
            ? "Google Maps API key is not configured. Set VITE_GOOGLE_MAPS_API_KEY in your environment."
            : "There was an error loading Google Maps. Please try again later."}
        </Typography>
      </Paper>
    );
  }

  if (!isLoaded) {
    return (
      <Paper sx={{ height: "100%", minHeight: 400, overflow: "hidden" }}>
        <Skeleton variant="rectangular" height="100%" />
      </Paper>
    );
  }

  if (listings.length === 0) {
    return (
      <Paper
        sx={{
          p: 3,
          height: "100%",
          minHeight: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MapRounded sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No properties to display on map
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        height: "100%",
        minHeight: 400,
        overflow: "hidden",
        position: "sticky",
        top: 80,
      }}
    >
      <Box ref={mapRef} sx={{ width: "100%", height: "100%", minHeight: 400 }} />
    </Paper>
  );
}
