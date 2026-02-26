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
  thumbnail_url: string | null;
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

export async function createListing(
  payload: CreatePropertyListingPayload,
): Promise<PropertyListing> {
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

export async function updateListing(
  id: number,
  payload: Partial<CreatePropertyListingPayload>,
): Promise<PropertyListing> {
  const { data } = await api.patch<PropertyListing>(
    `/listings/${id}/`,
    payload,
  );
  return data;
}

export async function deleteListing(id: number): Promise<void> {
  await api.delete(`/listings/${id}/delete/`);
}

export interface BrowseFilters {
  search?: string;
  price_min?: number;
  price_max?: number;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  bathrooms_max?: number;
  city?: string;
  state?: string;
  property_type?: string;
  furnished_status?: string;
  utilities_included?: boolean;
  pets_allowed?: boolean;
  parking_available?: boolean;
  sort_by?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function browseListings(
  filters: BrowseFilters,
): Promise<PaginatedResponse<PropertyListing>> {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.price_min !== undefined)
    params.append("price_min", filters.price_min.toString());
  if (filters.price_max !== undefined)
    params.append("price_max", filters.price_max.toString());
  if (filters.bedrooms_min !== undefined)
    params.append("bedrooms_min", filters.bedrooms_min.toString());
  if (filters.bedrooms_max !== undefined)
    params.append("bedrooms_max", filters.bedrooms_max.toString());
  if (filters.bathrooms_min !== undefined)
    params.append("bathrooms_min", filters.bathrooms_min.toString());
  if (filters.bathrooms_max !== undefined)
    params.append("bathrooms_max", filters.bathrooms_max.toString());
  if (filters.city) params.append("city", filters.city);
  if (filters.state) params.append("state", filters.state);
  if (filters.property_type) params.append("property_type", filters.property_type);
  if (filters.furnished_status) params.append("furnished_status", filters.furnished_status);
  if (filters.utilities_included) params.append("utilities_included", "true");
  if (filters.pets_allowed) params.append("pets_allowed", "true");
  if (filters.parking_available) params.append("parking_available", "true");
  if (filters.sort_by) params.append("sort_by", filters.sort_by);
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.page_size)
    params.append("page_size", filters.page_size.toString());

  const queryString = params.toString();
  const url = queryString
    ? `/listings/browse/?${queryString}`
    : "/listings/browse/";
  const { data } = await api.get<PaginatedResponse<PropertyListing>>(url);
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
