import api from "./axios";

export interface ListingAmenity {
  id: number;
  code: string;
  label: string;
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

// --- S3 Upload helpers ---

export interface UploadInitRequest {
  listing_id: number;
  filename: string;
  content_type: string;
  file_size: number;
  is_private: boolean;
}

export interface UploadInitResponse {
  media_id: number;
  upload_url: string;
  upload_fields: Record<string, string>;
  storage_key: string;
}

export interface UploadFinalizeRequest {
  media_id: number;
  display_order?: number;
  is_primary?: boolean;
}

export interface ListingMedia {
  id: number;
  media_type: string;
  file_url: string;
  access_url: string | null;
  thumbnail_url: string;
  display_order: number;
  is_primary: boolean;
  is_private: boolean;
  original_filename: string;
  content_type: string;
  file_size: number | null;
  upload_status: string;
}

export async function requestUploadInit(payload: UploadInitRequest): Promise<UploadInitResponse> {
  const { data } = await api.post<UploadInitResponse>("/listings/media/upload-init/", payload);
  return data;
}

export async function uploadFileToS3(
  uploadUrl: string,
  uploadFields: Record<string, string>,
  file: File,
): Promise<void> {
  const formData = new FormData();
  Object.entries(uploadFields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append("file", file);

  await fetch(uploadUrl, { method: "POST", body: formData });
}

export async function finalizeUpload(payload: UploadFinalizeRequest): Promise<ListingMedia> {
  const { data } = await api.post<ListingMedia>("/listings/media/upload-finalize/", payload);
  return data;
}
