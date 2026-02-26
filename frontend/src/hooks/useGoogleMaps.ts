import { useState, useEffect } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface UseGoogleMapsOptions {
  apiKey?: string;
}

interface UseGoogleMapsReturn {
  isLoaded: boolean;
  loadError: Error | null;
  google: typeof google | null;
}

let loaderPromise: Promise<typeof google> | null = null;
let cachedGoogle: typeof google | null = null;

export function useGoogleMaps(
  options: UseGoogleMapsOptions = {}
): UseGoogleMapsReturn {
  const [isLoaded, setIsLoaded] = useState(cachedGoogle !== null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [googleApi, setGoogleApi] = useState<typeof google | null>(cachedGoogle);

  const apiKey = options.apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (cachedGoogle) {
      setGoogleApi(cachedGoogle);
      setIsLoaded(true);
      return;
    }

    if (!apiKey) {
      setLoadError(new Error("Google Maps API key is not configured"));
      return;
    }

    if (!loaderPromise) {
      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["marker", "places"],
      });
      loaderPromise = loader.load();
    }

    loaderPromise
      .then((g) => {
        cachedGoogle = g;
        setGoogleApi(g);
        setIsLoaded(true);
      })
      .catch((err) => {
        setLoadError(err);
        loaderPromise = null;
      });
  }, [apiKey]);

  return { isLoaded, loadError, google: googleApi };
}

export default useGoogleMaps;
