import axios from "axios";

function normalizeApiBaseUrl(rawBaseUrl?: string): string {
  const base = (rawBaseUrl || "").trim();
  if (!base) return "/api";
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return base.replace(/\/+$/, "");
  }
  // Ensure non-absolute values like "api" become root-relative "/api".
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}

function resolveApiBaseUrl(rawBaseUrl?: string): string {
  const normalized = normalizeApiBaseUrl(rawBaseUrl);
  // In local dev, always use Vite proxy instead of absolute localhost URLs.
  if (
    import.meta.env.DEV &&
    /^https?:\/\/localhost(?::\d+)?(?:\/|$)/i.test(normalized)
  ) {
    return "/api";
  }
  return normalized;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_URL),
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

// Interceptor to ensure CSRF token is sent with requests
api.interceptors.request.use(
  (config) => {
    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="))
      ?.split("=")[1];
    
    if (csrfToken && config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
      config.headers["X-CSRFToken"] = csrfToken;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
