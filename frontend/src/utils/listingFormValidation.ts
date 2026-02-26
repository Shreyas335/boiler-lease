import type { CreatePropertyListingPayload } from "../api/listings";

export type ListingFieldMessages = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isHalfStep(value: number): boolean {
  return Math.round(value * 2) === value * 2;
}

export function getListingWarnings(
  form: CreatePropertyListingPayload,
): ListingFieldMessages {
  const warnings: ListingFieldMessages = {};
  const rent = toNumber(form.monthly_rent);
  const deposit = toNumber(form.security_deposit);

  if (rent && deposit && deposit > rent * 3) {
    warnings.security_deposit =
      "Warning: Security deposit is more than 3x monthly rent.";
  }

  return warnings;
}

export function validateListingForm(
  form: CreatePropertyListingPayload,
  isAddressVerified: boolean,
): ListingFieldMessages {
  const errors: ListingFieldMessages = {};

  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.description.trim()) errors.description = "Description is required.";

  if (!form.monthly_rent.trim()) {
    errors.monthly_rent = "Monthly rent is required.";
  } else {
    const rent = toNumber(form.monthly_rent);
    if (rent === null || rent <= 0) {
      errors.monthly_rent = "Monthly rent must be a positive number.";
    }
  }

  if (!form.bedrooms.trim()) {
    errors.bedrooms = "Beds are required.";
  } else {
    const beds = toNumber(form.bedrooms);
    if (beds === null || !Number.isInteger(beds) || beds < 0) {
      errors.bedrooms = "Beds must be a whole number.";
    }
  }

  if (!form.bathrooms.trim()) {
    errors.bathrooms = "Baths are required.";
  } else {
    const baths = toNumber(form.bathrooms);
    if (baths === null || baths < 0 || !isHalfStep(baths)) {
      errors.bathrooms = "Baths must be in 0.5 increments.";
    }
  }

  const sqftProvided = form.square_feet !== undefined;
  if (sqftProvided) {
    const sqft = toNumber(form.square_feet);
    if (sqft === null || sqft <= 0) {
      errors.square_feet = "Square feet must be a positive number.";
    } else if (sqft > 30000) {
      errors.square_feet = "Square feet must be 30,000 or less.";
    }
  }

  if (form.security_deposit?.trim()) {
    const deposit = toNumber(form.security_deposit);
    if (deposit === null || deposit < 0) {
      errors.security_deposit =
        "Security deposit must be a non-negative number.";
    }
  }

  if (!form.availability_start_date) {
    errors.availability_start_date = "Start date is required.";
  }
  if (!form.availability_end_date) {
    errors.availability_end_date = "End date is required.";
  }

  if (
    form.availability_start_date &&
    form.availability_end_date &&
    form.availability_start_date > form.availability_end_date
  ) {
    errors.availability_end_date = "End date must be on or after start date.";
  }

  if (form.lease_term_min_months !== undefined) {
    const minLease = toNumber(form.lease_term_min_months);
    if (minLease === null || !Number.isInteger(minLease) || minLease < 1) {
      errors.lease_term_min_months =
        "Min lease must be a whole number of months.";
    }
  }

  if (form.lease_term_max_months !== undefined) {
    const maxLease = toNumber(form.lease_term_max_months);
    if (maxLease === null || !Number.isInteger(maxLease) || maxLease < 1) {
      errors.lease_term_max_months =
        "Max lease must be a whole number of months.";
    }
  }

  if (
    form.lease_term_min_months !== undefined &&
    form.lease_term_max_months !== undefined
  ) {
    const minLease = toNumber(form.lease_term_min_months);
    const maxLease = toNumber(form.lease_term_max_months);
    if (
      minLease !== null &&
      maxLease !== null &&
      minLease > maxLease
    ) {
      errors.lease_term_max_months =
        "Max lease must be greater than or equal to min lease.";
    }
  }

  if (form.contact_email?.trim() && !EMAIL_RE.test(form.contact_email)) {
    errors.contact_email = "Enter a valid email address.";
  }

  if (form.contact_phone?.trim()) {
    const digits = form.contact_phone.replace(/\D/g, "");
    if (digits.length < 7) {
      errors.contact_phone = "Enter a valid phone number.";
    }
  }

  if (form.virtual_tour_url?.trim()) {
    try {
      const url = new URL(form.virtual_tour_url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.virtual_tour_url = "URL must start with http:// or https://.";
      }
    } catch {
      errors.virtual_tour_url = "Enter a valid URL.";
    }
  }

  if (!isAddressVerified || !form.latitude || !form.longitude) {
    errors.address = "Please select an address from the Google suggestions.";
  }

  if (!form.parking_available && form.parking_details?.trim()) {
    errors.parking_details =
      "Parking details should be empty unless parking is available.";
  }

  return errors;
}
