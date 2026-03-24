import api from "./axios";
export async function startIdentityVerificationSession(): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>(
    "/identity/verification-session/",
    {}
  );
  return data;
}