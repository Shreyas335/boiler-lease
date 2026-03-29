export type GuidelineType =
  | "rent_range"
  | "deposit_range"
  | "min_availability_days"
  | "utilities_included"
  | "pets_allowed"
  | "furnished_status"
  | "amenity_required";

export type FurnishedStatus = "furnished" | "unfurnished" | "partially_furnished";

export interface RentRangeGuideline {
  type: "rent_range";
  min_rent?: number;
  max_rent?: number;
}

export interface DepositRangeGuideline {
  type: "deposit_range";
  min_deposit?: number;
  max_deposit?: number;
}

export interface MinAvailabilityDaysGuideline {
  type: "min_availability_days";
  min_days: number;
}

export interface UtilitiesIncludedGuideline {
  type: "utilities_included";
  required: boolean;
}

export interface PetsAllowedGuideline {
  type: "pets_allowed";
  required: boolean;
}

export interface FurnishedStatusGuideline {
  type: "furnished_status";
  value: FurnishedStatus;
}

export interface AmenityRequiredGuideline {
  type: "amenity_required";
  amenity_code: string;
  amenity_label: string;
}

export type Guideline =
  | RentRangeGuideline
  | DepositRangeGuideline
  | MinAvailabilityDaysGuideline
  | UtilitiesIncludedGuideline
  | PetsAllowedGuideline
  | FurnishedStatusGuideline
  | AmenityRequiredGuideline;

export const GUIDELINE_TYPE_LABELS: Record<GuidelineType, string> = {
  rent_range: "Monthly Rent Range",
  deposit_range: "Security Deposit Range",
  min_availability_days: "Minimum Availability",
  utilities_included: "Utilities Included",
  pets_allowed: "Pets Allowed",
  furnished_status: "Furnished Status",
  amenity_required: "Required Amenity",
};

export function guidelineToHuman(g: Guideline): string {
  switch (g.type) {
    case "rent_range": {
      const { min_rent, max_rent } = g;
      if (min_rent != null && max_rent != null)
        return `Monthly rent between $${min_rent.toLocaleString()} and $${max_rent.toLocaleString()}`;
      if (min_rent != null) return `Monthly rent at least $${min_rent.toLocaleString()}`;
      if (max_rent != null) return `Monthly rent at most $${max_rent.toLocaleString()}`;
      return "Monthly rent range";
    }
    case "deposit_range": {
      const { min_deposit, max_deposit } = g;
      if (min_deposit != null && max_deposit != null)
        return `Security deposit between $${min_deposit.toLocaleString()} and $${max_deposit.toLocaleString()}`;
      if (min_deposit != null) return `Security deposit at least $${min_deposit.toLocaleString()}`;
      if (max_deposit != null) return `Security deposit at most $${max_deposit.toLocaleString()}`;
      return "Security deposit range";
    }
    case "min_availability_days":
      return `Available for at least ${g.min_days} day${g.min_days === 1 ? "" : "s"}`;
    case "utilities_included":
      return g.required ? "Utilities must be included" : "Utilities must not be included";
    case "pets_allowed":
      return g.required ? "Must allow pets" : "Must not allow pets";
    case "furnished_status":
      return `Must be ${g.value.replace(/_/g, " ")}`;
    case "amenity_required":
      return `Must include: ${g.amenity_label}`;
  }
}
