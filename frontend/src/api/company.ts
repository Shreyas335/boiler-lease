import api from "./axios";
import type { CompanyStatus } from "../types/auth";
import type { GuidelineRecord, GuidelineFormData } from "../types/guidelines";
import type { PropertyListing } from "./listings";

export interface CompanyProfile {
  id: number;
  company_name: string;
  /** Booking fee % applied to prorated rent for listings this company approved (0–100). */
  booking_fee_percent: string;
  status: CompanyStatus;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface CompanyDocument {
  id: number;
  document_type: string;
  original_filename: string;
  uploaded_at: string;
}

export async function getCompanyStatus(): Promise<CompanyProfile> {
  const { data } = await api.get<CompanyProfile>("/company/status/");
  return data;
}

export async function updateCompanyBookingFee(booking_fee_percent: string): Promise<CompanyProfile> {
  const { data } = await api.patch<CompanyProfile>("/company/status/", { booking_fee_percent });
  return data;
}

export async function uploadDocument(file: File, documentType: string): Promise<CompanyDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  const { data } = await api.post<CompanyDocument>("/company/documents/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDocuments(): Promise<CompanyDocument[]> {
  const { data } = await api.get<CompanyDocument[]>("/company/documents/");
  return data;
}

export async function deleteDocument(id: number): Promise<void> {
  await api.delete(`/company/documents/${id}/`);
}

export async function getGuidelines(): Promise<GuidelineRecord[]> {
  const { data } = await api.get<GuidelineRecord[]>("/company/guidelines/");
  return data;
}

export async function createGuideline(form: GuidelineFormData): Promise<GuidelineRecord> {
  const { data } = await api.post<GuidelineRecord>("/company/guidelines/", formToPayload(form));
  return data;
}

export async function updateGuideline(id: number, form: GuidelineFormData): Promise<GuidelineRecord> {
  const { data } = await api.put<GuidelineRecord>(`/company/guidelines/${id}/`, formToPayload(form));
  return data;
}

export async function deleteGuideline(id: number): Promise<void> {
  await api.delete(`/company/guidelines/${id}/`);
}

export interface PublicGuideline {
  id: number;
  name: string;
  min_rent: string | null;
  max_rent: string | null;
  min_deposit: string | null;
  max_deposit: string | null;
  min_availability_days: number | null;
  utilities_included: boolean | null;
  pets_allowed: boolean | null;
  furnished_status: string | null;
  required_amenities: string[];
}

export interface PublicManagementCompany {
  id: number;
  company_name: string;
  guidelines: PublicGuideline[];
}

export async function getManagementCompanies(search?: string): Promise<PublicManagementCompany[]> {
  const params = search ? { search } : {};
  const { data } = await api.get<PublicManagementCompany[]>("/companies/", { params });
  return data;
}

export async function getManagementCompany(id: number): Promise<PublicManagementCompany> {
  const { data } = await api.get<PublicManagementCompany>(`/companies/${id}/`);
  return data;
}

export interface ComplianceResult {
  field: string;
  label: string;
  required: string | number | boolean | string[];
  actual: string | number | boolean | string[];
  passed: boolean;
}

export interface ApprovalRequestSummary {
  id: number;
  listing_id: number;
  listing_title: string;
  listing_rent: string;
  listing_city: string;
  management_company_id: number;
  management_company_name: string;
  guideline_name: string | null;
  status: "pending" | "approved" | "rejected";
  subleaser_notes: string;
  reviewer_notes: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface ApprovalRequestDetail {
  id: number;
  listing: PropertyListing;
  management_company_name: string;
  guideline: PublicGuideline | null;
  compliance_results: ComplianceResult[];
  subleaser_email: string;
  subleaser_notes: string;
  reviewer_notes: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
}

export async function getApprovalRequests(status?: string): Promise<ApprovalRequestSummary[]> {
  const params = status ? { status } : {};
  const { data } = await api.get<ApprovalRequestSummary[]>("/company/approval-requests/", { params });
  return data;
}

export async function getApprovalRequestDetail(id: number): Promise<ApprovalRequestDetail> {
  const { data } = await api.get<ApprovalRequestDetail>(`/company/approval-requests/${id}/`);
  return data;
}

export async function reviewApprovalRequest(
  id: number,
  action: "approve" | "reject",
  reviewer_notes: string,
): Promise<ApprovalRequestSummary> {
  const { data } = await api.patch<ApprovalRequestSummary>(
    `/company/approval-requests/${id}/review/`,
    { action, reviewer_notes },
  );
  return data;
}

export interface CompanyFeeConfig {
  platform_fee_percentage: string | null;
  platform_fee_flat: string | null;
  created_at: string;
  updated_at: string;
}

export async function getFeeConfig(): Promise<CompanyFeeConfig> {
  const { data } = await api.get<CompanyFeeConfig>('/company/fee-config/');
  return data;
}

export async function updateFeeConfig(
  config: { platform_fee_percentage?: string | null; platform_fee_flat?: string | null }
): Promise<CompanyFeeConfig> {
  const { data } = await api.put<CompanyFeeConfig>('/company/fee-config/', config);
  return data;
}

function formToPayload(form: GuidelineFormData) {
  return {
    name: form.name,
    min_rent: form.min_rent !== "" ? Number(form.min_rent) : null,
    max_rent: form.max_rent !== "" ? Number(form.max_rent) : null,
    min_deposit: form.min_deposit !== "" ? Number(form.min_deposit) : null,
    max_deposit: form.max_deposit !== "" ? Number(form.max_deposit) : null,
    min_availability_days: form.min_availability_days !== "" ? Number(form.min_availability_days) : null,
    utilities_included:
      form.utilities_included === "true" ? true : form.utilities_included === "false" ? false : null,
    pets_allowed:
      form.pets_allowed === "true" ? true : form.pets_allowed === "false" ? false : null,
    furnished_status: form.furnished_status !== "" ? form.furnished_status : null,
    required_amenities: form.required_amenities,
  };
}
