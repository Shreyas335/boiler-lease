import { useEffect, useRef, useState } from "react";
import {
  TextField,
  Box,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { LocationOn } from "@mui/icons-material";
import useGoogleMaps from "../hooks/useGoogleMaps";

export interface AddressComponents {
  street_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  latitude: string;
  longitude: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: AddressComponents) => void;
  error?: boolean;
  helperText?: string;
  isAddressVerified: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  error,
  helperText,
  isAddressVerified,
}: AddressAutocompleteProps) {
  const { isLoaded, loadError, google } = useGoogleMaps();
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize services when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && google) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      // PlacesService requires a DOM element or map
      const dummyDiv = document.createElement("div");
      placesService.current = new google.maps.places.PlacesService(dummyDiv);
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, [isLoaded, google]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch predictions when input changes
  useEffect(() => {
    if (!value || value.length < 3 || !autocompleteService.current || !google) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      autocompleteService.current!.getPlacePredictions(
        {
          input: value,
          sessionToken: sessionToken.current!,
          componentRestrictions: { country: "us" },
          types: ["address"],
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setShowDropdown(true);
          } else {
            setPredictions([]);
          }
        }
      );
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, google]);

  function handleSelect(prediction: google.maps.places.AutocompletePrediction) {
    if (!placesService.current || !google) return;

    setLoading(true);
    setShowDropdown(false);

    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["address_components", "geometry", "formatted_address"],
        sessionToken: sessionToken.current!,
      },
      (place, status) => {
        setLoading(false);
        // Reset session token after place details request
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          return;
        }

        const addressComponents = parseAddressComponents(place);
        onChange(place.formatted_address || prediction.description);
        onAddressSelect(addressComponents);
        setPredictions([]);
      }
    );
  }

  function parseAddressComponents(place: google.maps.places.PlaceResult): AddressComponents {
    const components = place.address_components || [];

    let streetNumber = "";
    let route = "";
    let city = "";
    let state = "";
    let postalCode = "";
    let countryCode = "US";

    for (const component of components) {
      const types = component.types;
      if (types.includes("street_number")) {
        streetNumber = component.long_name;
      } else if (types.includes("route")) {
        route = component.long_name;
      } else if (types.includes("locality")) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        state = component.short_name;
      } else if (types.includes("postal_code")) {
        postalCode = component.long_name;
      } else if (types.includes("country")) {
        countryCode = component.short_name;
      }
    }

    // Round to 6 decimal places (matches database field: max_digits=9, decimal_places=6)
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();
    const latitude = lat !== undefined ? lat.toFixed(6) : "";
    const longitude = lng !== undefined ? lng.toFixed(6) : "";

    return {
      street_line_1: streetNumber ? `${streetNumber} ${route}` : route,
      city,
      state,
      postal_code: postalCode,
      country_code: countryCode,
      latitude,
      longitude,
    };
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  if (loadError) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Address autocomplete unavailable. Please enter address manually.
      </Alert>
    );
  }

  return (
    <Box ref={containerRef} sx={{ position: "relative" }}>
      <TextField
        fullWidth
        label="Property Address"
        placeholder="Start typing an address..."
        value={value}
        onChange={handleInputChange}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        inputRef={inputRef}
        error={error}
        helperText={
          helperText ||
          (isAddressVerified
            ? "Address verified via Google"
            : "Please select an address from the dropdown")
        }
        slotProps={{
          input: {
            endAdornment: loading ? <CircularProgress size={20} /> : null,
          },
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderColor: isAddressVerified ? "success.main" : undefined,
          },
        }}
        color={isAddressVerified ? "success" : undefined}
        focused={isAddressVerified ? true : undefined}
      />

      {showDropdown && predictions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 300,
            overflow: "auto",
            mt: 0.5,
          }}
        >
          <List dense>
            {predictions.map((prediction) => (
              <ListItemButton
                key={prediction.place_id}
                onClick={() => handleSelect(prediction)}
              >
                <LocationOn sx={{ mr: 1, color: "text.secondary" }} />
                <ListItemText
                  primary={prediction.structured_formatting.main_text}
                  secondary={prediction.structured_formatting.secondary_text}
                />
              </ListItemButton>
            ))}
          </List>
          <Typography
            variant="caption"
            sx={{ display: "block", p: 1, textAlign: "right", color: "text.disabled" }}
          >
            Powered by Google
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
