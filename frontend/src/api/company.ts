import api from "./axios";
import type { CompanyStatus } from "../types/auth";
import type { Guideline } from "../types/guidelines";

export interface CompanyProfile {
  id: number;
  company_name: string;
  status: CompanyStatus;
  rejection_reason: string;
  guidelines: Guideline[];
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

export async function getGuidelines(): Promise<Guideline[]> {
  const { data } = await api.get<{ guidelines: Guideline[] }>("/company/guidelines/");
  return data.guidelines;
}

export async function saveGuidelines(guidelines: Guideline[]): Promise<Guideline[]> {
  const { data } = await api.put<{ guidelines: Guideline[] }>("/company/guidelines/", { guidelines });
  return data.guidelines;
}
