export type UserType = "sublessee" | "subleaser" | "management";

export type CompanyStatus = "pending" | "approved" | "rejected";

export type IdentityVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed";

export interface User {
  id: number;
  username: string;
  email: string;
  user_type: UserType;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  message_notifications_enabled: boolean;
  identity_verification_status: IdentityVerificationStatus;
  company_name: string | null;
  company_status: CompanyStatus | null;
  bio: string;
  profile_picture_url: string;
  contact_phone: string;
}
