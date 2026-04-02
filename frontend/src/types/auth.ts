export type UserType = "sublessee" | "subleaser" | "management";

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
}
