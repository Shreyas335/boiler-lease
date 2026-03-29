"""
Structured guideline types for management company listing requirements.

Each Guideline is a typed rule that a property listing must satisfy
for a management company to consider approving it.

Guidelines are stored as a JSON list on ManagementCompany.guidelines.
Each entry is a dict with at minimum a "type" key.
"""

from dataclasses import dataclass, asdict
from enum import Enum
from typing import Optional


class GuidelineType(str, Enum):
    RENT_RANGE = "rent_range"
    DEPOSIT_RANGE = "deposit_range"
    MIN_AVAILABILITY_DAYS = "min_availability_days"
    UTILITIES_INCLUDED = "utilities_included"
    PETS_ALLOWED = "pets_allowed"
    FURNISHED_STATUS = "furnished_status"
    AMENITY_REQUIRED = "amenity_required"


class FurnishedStatus(str, Enum):
    FURNISHED = "furnished"
    UNFURNISHED = "unfurnished"
    PARTIALLY_FURNISHED = "partially_furnished"


@dataclass
class RentRangeGuideline:
    """Monthly rent must be within [min_rent, max_rent]."""
    type: str = GuidelineType.RENT_RANGE
    min_rent: Optional[float] = None
    max_rent: Optional[float] = None


@dataclass
class DepositRangeGuideline:
    """Security deposit must be within [min_deposit, max_deposit]."""
    type: str = GuidelineType.DEPOSIT_RANGE
    min_deposit: Optional[float] = None
    max_deposit: Optional[float] = None


@dataclass
class MinAvailabilityDaysGuideline:
    """Listing availability window must span at least min_days days."""
    type: str = GuidelineType.MIN_AVAILABILITY_DAYS
    min_days: int = 30


@dataclass
class UtilitiesIncludedGuideline:
    """Listing must have utilities included (or not)."""
    type: str = GuidelineType.UTILITIES_INCLUDED
    required: bool = True


@dataclass
class PetsAllowedGuideline:
    """Listing must allow pets (or not)."""
    type: str = GuidelineType.PETS_ALLOWED
    required: bool = True


@dataclass
class FurnishedStatusGuideline:
    """Listing must have a specific furnished status."""
    type: str = GuidelineType.FURNISHED_STATUS
    value: str = FurnishedStatus.FURNISHED


@dataclass
class AmenityRequiredGuideline:
    """Listing must include a specific amenity."""
    type: str = GuidelineType.AMENITY_REQUIRED
    amenity_code: str = ""
    amenity_label: str = ""


# Maps type string → dataclass for validation
GUIDELINE_TYPE_MAP = {
    GuidelineType.RENT_RANGE: RentRangeGuideline,
    GuidelineType.DEPOSIT_RANGE: DepositRangeGuideline,
    GuidelineType.MIN_AVAILABILITY_DAYS: MinAvailabilityDaysGuideline,
    GuidelineType.UTILITIES_INCLUDED: UtilitiesIncludedGuideline,
    GuidelineType.PETS_ALLOWED: PetsAllowedGuideline,
    GuidelineType.FURNISHED_STATUS: FurnishedStatusGuideline,
    GuidelineType.AMENITY_REQUIRED: AmenityRequiredGuideline,
}

VALID_TYPES = [t.value for t in GuidelineType]


def validate_guideline(data: dict) -> tuple[bool, str]:
    """
    Validate a single guideline dict.
    Returns (is_valid, error_message).
    """
    if not isinstance(data, dict):
        return False, "Each guideline must be an object."

    g_type = data.get("type")
    if g_type not in VALID_TYPES:
        return False, f"Invalid guideline type '{g_type}'. Must be one of: {', '.join(VALID_TYPES)}."

    if g_type == GuidelineType.RENT_RANGE:
        min_r = data.get("min_rent")
        max_r = data.get("max_rent")
        if min_r is None and max_r is None:
            return False, "rent_range requires at least one of min_rent or max_rent."
        if min_r is not None and (not isinstance(min_r, (int, float)) or min_r < 0):
            return False, "min_rent must be a non-negative number."
        if max_r is not None and (not isinstance(max_r, (int, float)) or max_r < 0):
            return False, "max_rent must be a non-negative number."
        if min_r is not None and max_r is not None and min_r > max_r:
            return False, "min_rent cannot be greater than max_rent."

    elif g_type == GuidelineType.DEPOSIT_RANGE:
        min_d = data.get("min_deposit")
        max_d = data.get("max_deposit")
        if min_d is None and max_d is None:
            return False, "deposit_range requires at least one of min_deposit or max_deposit."
        if min_d is not None and (not isinstance(min_d, (int, float)) or min_d < 0):
            return False, "min_deposit must be a non-negative number."
        if max_d is not None and (not isinstance(max_d, (int, float)) or max_d < 0):
            return False, "max_deposit must be a non-negative number."
        if min_d is not None and max_d is not None and min_d > max_d:
            return False, "min_deposit cannot be greater than max_deposit."

    elif g_type == GuidelineType.MIN_AVAILABILITY_DAYS:
        min_days = data.get("min_days")
        if not isinstance(min_days, int) or min_days < 1:
            return False, "min_days must be a positive integer."

    elif g_type == GuidelineType.UTILITIES_INCLUDED:
        if not isinstance(data.get("required"), bool):
            return False, "utilities_included requires a boolean 'required' field."

    elif g_type == GuidelineType.PETS_ALLOWED:
        if not isinstance(data.get("required"), bool):
            return False, "pets_allowed requires a boolean 'required' field."

    elif g_type == GuidelineType.FURNISHED_STATUS:
        valid_statuses = [s.value for s in FurnishedStatus]
        if data.get("value") not in valid_statuses:
            return False, f"furnished_status value must be one of: {', '.join(valid_statuses)}."

    elif g_type == GuidelineType.AMENITY_REQUIRED:
        if not data.get("amenity_code") or not data.get("amenity_label"):
            return False, "amenity_required needs both amenity_code and amenity_label."

    return True, ""


def validate_guidelines(guidelines: list) -> tuple[bool, str]:
    """Validate a full list of guidelines. Returns (is_valid, error_message)."""
    if not isinstance(guidelines, list):
        return False, "Guidelines must be a list."
    for i, g in enumerate(guidelines):
        valid, msg = validate_guideline(g)
        if not valid:
            return False, f"Guideline #{i + 1}: {msg}"
    return True, ""


def guideline_to_human(g: dict) -> str:
    """Convert a guideline dict to a human-readable string."""
    g_type = g.get("type")
    if g_type == GuidelineType.RENT_RANGE:
        min_r, max_r = g.get("min_rent"), g.get("max_rent")
        if min_r and max_r:
            return f"Monthly rent between ${min_r:,.0f} and ${max_r:,.0f}"
        if min_r:
            return f"Monthly rent at least ${min_r:,.0f}"
        return f"Monthly rent at most ${max_r:,.0f}"
    if g_type == GuidelineType.DEPOSIT_RANGE:
        min_d, max_d = g.get("min_deposit"), g.get("max_deposit")
        if min_d and max_d:
            return f"Security deposit between ${min_d:,.0f} and ${max_d:,.0f}"
        if min_d:
            return f"Security deposit at least ${min_d:,.0f}"
        return f"Security deposit at most ${max_d:,.0f}"
    if g_type == GuidelineType.MIN_AVAILABILITY_DAYS:
        return f"Available for at least {g.get('min_days')} days"
    if g_type == GuidelineType.UTILITIES_INCLUDED:
        return "Utilities must be included" if g.get("required") else "Utilities must not be included"
    if g_type == GuidelineType.PETS_ALLOWED:
        return "Must allow pets" if g.get("required") else "Must not allow pets"
    if g_type == GuidelineType.FURNISHED_STATUS:
        return f"Must be {g.get('value', '').replace('_', ' ')}"
    if g_type == GuidelineType.AMENITY_REQUIRED:
        return f"Must include amenity: {g.get('amenity_label')}"
    return "Unknown guideline"
