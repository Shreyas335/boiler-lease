export interface UserProfile {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  user_type: string;
  bio: string;
  profile_picture_url: string;
  contact_phone: string;
  average_rating: number | null;
  rating_count: number;
  my_rating: number | null;
  is_blocked: boolean;
}

export interface BlockedUser {
  id: number;
  blocked_user_id: number;
  blocked_user_username: string;
  blocked_user_first_name: string;
  blocked_user_last_name: string;
  blocked_user_profile_picture_url: string;
  created_at: string;
}
