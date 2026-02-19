import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
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