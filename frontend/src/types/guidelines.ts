export type FurnishedStatus = "furnished" | "unfurnished" | "partially_furnished";

export interface GuidelineRecord {
  id: number;
  name: string;
  min_rent: string | null;
  max_rent: string | null;
  min_deposit: string | null;
  max_deposit: string | null;
  min_availability_days: number | null;
  utilities_included: boolean | null;
  pets_allowed: boolean | null;
  furnished_status: FurnishedStatus | null;
  required_amenities: string[];
  created_at: string;
  updated_at: string;
}

export interface GuidelineFormData {
  name: string;
  min_rent: string;
  max_rent: string;
  min_deposit: string;
  max_deposit: string;
  min_availability_days: string;
  utilities_included: "" | "true" | "false";
  pets_allowed: "" | "true" | "false";
  furnished_status: FurnishedStatus | "";
  required_amenities: string[];
}

export function emptyForm(): GuidelineFormData {
  return {
    name: "",
    min_rent: "",
    max_rent: "",
    min_deposit: "",
    max_deposit: "",
    min_availability_days: "",
    utilities_included: "",
    pets_allowed: "",
    furnished_status: "",
    required_amenities: [],
  };
}

export function recordToForm(g: GuidelineRecord): GuidelineFormData {
  return {
    name: g.name,
    min_rent: g.min_rent ?? "",
    max_rent: g.max_rent ?? "",
    min_deposit: g.min_deposit ?? "",
    max_deposit: g.max_deposit ?? "",
    min_availability_days: g.min_availability_days != null ? String(g.min_availability_days) : "",
    utilities_included:
      g.utilities_included === true ? "true" : g.utilities_included === false ? "false" : "",
    pets_allowed:
      g.pets_allowed === true ? "true" : g.pets_allowed === false ? "false" : "",
    furnished_status: g.furnished_status ?? "",
    required_amenities: g.required_amenities ?? [],
  };
}
