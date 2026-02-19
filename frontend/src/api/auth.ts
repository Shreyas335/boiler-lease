import api from "./axios";
import type { User } from "../types/auth";

export async function fetchCsrfToken(): Promise<void> {
  await api.get("/auth/csrf/");
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<User>("/auth/me/");
    return data;
  } catch (error) {
    // Return null if not authenticated (401/403) or any other error
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  // Ensure CSRF token is fetched before login
  await fetchCsrfToken();
  const { data } = await api.post<User>("/auth/login/", { email, password });
  return data;
}

export async function register(params: {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  user_type: string;
  first_name?: string;
  last_name?: string;
}): Promise<User> {
  // Ensure CSRF token is fetched before register
  await fetchCsrfToken();
  const { data } = await api.post<User>("/auth/register/", params);
  return data;
}

export async function logout(): Promise<void> {
  // Ensure CSRF token is available before logout
  try {
    await api.get("/auth/csrf/");
  } catch {
    // If CSRF fetch fails, continue anyway
  }
  await api.post("/auth/logout/");
}
