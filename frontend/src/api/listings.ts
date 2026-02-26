import api from "./axios";

export interface ListingAmenity {
  id: number;
  code: string;
  label: string;
}

export interface ListingMedia {
  id: number;
  media_type: string;
  file_url: string;
  thumbnail_url: string;
  display_order: number;
  is_primary: boolean;
}

export interface PropertyListing {
  id: number;
  title: string;
  description: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  square_feet: number | null;
  furnished_status: string;
  monthly_rent: string;
  security_deposit: string | null;
  utilities_included: boolean;
  availability_start_date: string;
  availability_end_date: string;
  lease_term_min_months: number | null;
  lease_term_max_months: number | null;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  street_line_1: string;
  street_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  latitude: string | null;
  longitude: string | null;
  unit_number: string;
  building_name: string;
  parking_available: boolean;
  parking_details: string;
  contact_email: string;
  contact_phone: string;
  virtual_tour_url: string;
  status: string;
  approval_status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  amenities: ListingAmenity[];
  media: ListingMedia[];
  is_favorited?: boolean;
}

export interface PropertyListingSummary {
  id: number;
  title: string;
  city: string;
  state: string;
  monthly_rent: string;
  availability_start_date: string;
  availability_end_date: string;
  status: string;
  approval_status: string;
  created_at: string;
  primary_photo_url: string;
  is_favorited: boolean;
}

export interface BookingRecord {
  id: number;
  listing: PropertyListingSummary;
  start_date: string;
  end_date: string;
  booked_at: string;
  monthly_rent_snapshot: string | null;
  price: string;
}

export interface FavoriteRecord {
  id: number;
  created_at: string;
  listing: PropertyListingSummary;
}

export interface CreatePropertyListingPayload {
  title: string;
  description: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  square_feet?: number;
  furnished_status: string;
  monthly_rent: string;
  security_deposit?: string;
  utilities_included: boolean;
  availability_start_date: string;
  availability_end_date: string;
  lease_term_min_months?: number;
  lease_term_max_months?: number;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  street_line_1: string;
  street_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  latitude?: string;
  longitude?: string;
  unit_number?: string;
  building_name?: string;
  parking_available: boolean;
  parking_details?: string;
  contact_email?: string;
  contact_phone?: string;
  virtual_tour_url?: string;
  status: string;
  amenity_codes?: string[];
}

export async function createListing(payload: CreatePropertyListingPayload): Promise<PropertyListing> {
  const { data } = await api.post<PropertyListing>("/listings/", payload);
  return data;
}

export async function getMyListings(): Promise<PropertyListing[]> {
  const { data } = await api.get<PropertyListing[]>("/listings/mine/");
  return data;
}

export async function getListingAmenities(): Promise<ListingAmenity[]> {
  const { data } = await api.get<ListingAmenity[]>("/listings/amenities/");
  return data;
}

export type BookingSortBy = "date_booked" | "price" | "start_date" | "end_date";
export type FavoriteSortBy = "date_saved" | "price" | "date_listed";
export type ListingSortBy = "price" | "date_listed" | "availability_start" | "availability_end";
export type SortOrder = "asc" | "desc";

export async function getCurrentBookings(sortBy: BookingSortBy, order: SortOrder): Promise<BookingRecord[]> {
  const { data } = await api.get<BookingRecord[]>("/bookings/current/", {
    params: { sort_by: sortBy, order },
  });
  return data;
}

export async function getPastBookings(sortBy: BookingSortBy, order: SortOrder): Promise<BookingRecord[]> {
  const { data } = await api.get<BookingRecord[]>("/bookings/past/", {
    params: { sort_by: sortBy, order },
  });
  return data;
}

export async function getBrowseListings(sortBy: ListingSortBy, order: SortOrder): Promise<PropertyListingSummary[]> {
  const { data } = await api.get<PropertyListingSummary[]>("/listings/browse/", {
    params: { sort_by: sortBy, order },
  });
  return data;
}

export async function getPropertyListingDetail(id: number): Promise<PropertyListing> {
  const { data } = await api.get<PropertyListing>(`/listings/${id}/`);
  return data;
}

export async function addFavorite(listingId: number): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(`/favorites/${listingId}/`);
  return data;
}

export async function removeFavorite(listingId: number): Promise<{ detail: string }> {
  const { data } = await api.delete<{ detail: string }>(`/favorites/${listingId}/`);
  return data;
}

export async function getFavorites(sortBy: FavoriteSortBy, order: SortOrder): Promise<FavoriteRecord[]> {
  const { data } = await api.get<FavoriteRecord[]>("/favorites/", {
    params: { sort_by: sortBy, order },
  });
  return data;
}
