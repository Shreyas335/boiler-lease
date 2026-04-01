import api from "./axios";
import type { IdentityVerificationStatus } from "../types/auth";

export async function startIdentityVerificationSession(): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>(
    "/identity/verification-session/",
    {}
  );
  return data;
}

export async function syncIdentityVerificationStatus(): Promise<{
  identity_verification_status: IdentityVerificationStatus;
  synced: boolean;
}> {
  const { data } = await api.post<{
    identity_verification_status: IdentityVerificationStatus;
    synced: boolean;
  }>("/identity/sync/", {});
  return data;
}