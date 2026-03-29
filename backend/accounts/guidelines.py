"""
Guideline validation helpers.

A Guideline is a named set of listing requirements for a specific building
managed by a ManagementCompany. Each field is optional — null means no
requirement for that field.
"""

VALID_FURNISHED_STATUSES = ("furnished", "unfurnished", "partially_furnished")


def validate_guideline_data(data: dict) -> tuple[bool, str]:
    """
    Validate incoming guideline field data (used for create/update).
    Returns (is_valid, error_message).
    """
    if not isinstance(data, dict):
        return False, "Guideline data must be an object."

    name = data.get("name", "").strip()
    if not name:
        return False, "Guideline name is required."

    min_rent = data.get("min_rent")
    max_rent = data.get("max_rent")
    if min_rent is not None and (not isinstance(min_rent, (int, float)) or min_rent < 0):
        return False, "min_rent must be a non-negative number."
    if max_rent is not None and (not isinstance(max_rent, (int, float)) or max_rent < 0):
        return False, "max_rent must be a non-negative number."
    if min_rent is not None and max_rent is not None and min_rent > max_rent:
        return False, "min_rent cannot be greater than max_rent."

    min_deposit = data.get("min_deposit")
    max_deposit = data.get("max_deposit")
    if min_deposit is not None and (not isinstance(min_deposit, (int, float)) or min_deposit < 0):
        return False, "min_deposit must be a non-negative number."
    if max_deposit is not None and (not isinstance(max_deposit, (int, float)) or max_deposit < 0):
        return False, "max_deposit must be a non-negative number."
    if min_deposit is not None and max_deposit is not None and min_deposit > max_deposit:
        return False, "min_deposit cannot be greater than max_deposit."

    min_days = data.get("min_availability_days")
    if min_days is not None and (not isinstance(min_days, int) or min_days < 1):
        return False, "min_availability_days must be a positive integer."

    furnished_status = data.get("furnished_status")
    if furnished_status is not None and furnished_status not in VALID_FURNISHED_STATUSES:
        return False, f"furnished_status must be one of: {', '.join(VALID_FURNISHED_STATUSES)}."

    required_amenities = data.get("required_amenities")
    if required_amenities is not None:
        if not isinstance(required_amenities, list):
            return False, "required_amenities must be a list."
        if not all(isinstance(a, str) for a in required_amenities):
            return False, "Each amenity in required_amenities must be a string code."

    return True, ""


def guideline_to_human(guideline) -> list[str]:
    """
    Convert a Guideline model instance to a list of human-readable requirement strings.
    Only includes fields that have a value set.
    """
    lines = []

    if guideline.min_rent is not None and guideline.max_rent is not None:
        lines.append(f"Monthly rent between ${guideline.min_rent:,.0f} and ${guideline.max_rent:,.0f}")
    elif guideline.min_rent is not None:
        lines.append(f"Monthly rent at least ${guideline.min_rent:,.0f}")
    elif guideline.max_rent is not None:
        lines.append(f"Monthly rent at most ${guideline.max_rent:,.0f}")

    if guideline.min_deposit is not None and guideline.max_deposit is not None:
        lines.append(f"Security deposit between ${guideline.min_deposit:,.0f} and ${guideline.max_deposit:,.0f}")
    elif guideline.min_deposit is not None:
        lines.append(f"Security deposit at least ${guideline.min_deposit:,.0f}")
    elif guideline.max_deposit is not None:
        lines.append(f"Security deposit at most ${guideline.max_deposit:,.0f}")

    if guideline.min_availability_days is not None:
        lines.append(f"Available for at least {guideline.min_availability_days} days")

    if guideline.utilities_included is True:
        lines.append("Utilities must be included")
    elif guideline.utilities_included is False:
        lines.append("Utilities must not be included")

    if guideline.pets_allowed is True:
        lines.append("Must allow pets")
    elif guideline.pets_allowed is False:
        lines.append("Must not allow pets")

    if guideline.furnished_status:
        lines.append(f"Must be {guideline.furnished_status.replace('_', ' ')}")

    for code in (guideline.required_amenities or []):
        lines.append(f"Must include amenity: {code}")

    return lines
