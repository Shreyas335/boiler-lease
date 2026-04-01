export type UserType = "sublessee" | "subleaser" | "management";

export type CompanyStatus = "pending" | "approved" | "rejected";

export interface User {
  id: number;
  username: string;
  email: string;
  user_type: UserType;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  company_name: string | null;
  company_status: CompanyStatus | null;
}
