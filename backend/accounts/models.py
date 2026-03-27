from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Custom user model with user type, email verification, and 2FA."""

    class UserType(models.TextChoices):
        SUBLESSEE = "sublessee", "Sublessee"
        SUBLEASER = "subleaser", "Subleaser"
        MANAGEMENT = "management", "Management Company"

    email = models.EmailField(unique=True)

    user_type = models.CharField(
        max_length=20,
        choices=UserType.choices,
        default=UserType.SUBLESSEE,
    )

    # Email verification
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=64, null=True, blank=True, unique=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    # Two-factor authentication (TOTP)
    two_factor_enabled = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=32, null=True, blank=True)

    class Meta:
        db_table = "accounts_user"


class FeedbackSubmission(models.Model):
    """Feedback message submitted from the Help page."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedback_submissions",
    )
    subject = models.CharField(max_length=120, blank=True)
    message = models.TextField()
    rating = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        if self.subject:
            return self.subject
        return f"Feedback #{self.pk}"


class PropertyListing(models.Model):
    class PropertyType(models.TextChoices):
        APARTMENT = "apartment", "Apartment"
        HOUSE = "house", "House"
        CONDO = "condo", "Condo"
        STUDIO = "studio", "Studio"
        OTHER = "other", "Other"

    class FurnishedStatus(models.TextChoices):
        FURNISHED = "furnished", "Furnished"
        UNFURNISHED = "unfurnished", "Unfurnished"
        PARTIALLY_FURNISHED = "partially_furnished", "Partially Furnished"

    class ListingStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        UNPUBLISHED = "unpublished", "Unpublished"
        ARCHIVED = "archived", "Archived"

    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="property_listings")
    title = models.CharField(max_length=200, db_index=True)
    description = models.TextField()
    property_type = models.CharField(
        max_length=20,
        choices=PropertyType.choices,
        default=PropertyType.APARTMENT,
    )
    bedrooms = models.DecimalField(max_digits=4, decimal_places=1, default=1)
    bathrooms = models.DecimalField(max_digits=4, decimal_places=1, default=1)
    square_feet = models.PositiveIntegerField(null=True, blank=True)
    furnished_status = models.CharField(
        max_length=24,
        choices=FurnishedStatus.choices,
        default=FurnishedStatus.UNFURNISHED,
    )
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2)
    security_deposit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    utilities_included = models.BooleanField(default=False)
    availability_start_date = models.DateField()
    availability_end_date = models.DateField()
    lease_term_min_months = models.PositiveIntegerField(null=True, blank=True)
    lease_term_max_months = models.PositiveIntegerField(null=True, blank=True)
    pets_allowed = models.BooleanField(default=False)
    smoking_allowed = models.BooleanField(default=False)
    street_line_1 = models.CharField(max_length=255)
    street_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, db_index=True)
    state = models.CharField(max_length=100, db_index=True)
    postal_code = models.CharField(max_length=20, db_index=True)
    country_code = models.CharField(max_length=2, default="US")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    unit_number = models.CharField(max_length=40, blank=True)
    building_name = models.CharField(max_length=140, blank=True)
    parking_available = models.BooleanField(default=False)
    parking_details = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    virtual_tour_url = models.URLField(blank=True)
    status = models.CharField(max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT)
    approval_status = models.CharField(
        max_length=16,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.APPROVED,
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(availability_start_date__lte=models.F("availability_end_date")),
                name="listing_dates_valid",
            ),
            models.CheckConstraint(
                check=models.Q(monthly_rent__gte=0),
                name="listing_monthly_rent_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(security_deposit__gte=0) | models.Q(security_deposit__isnull=True),
                name="listing_security_deposit_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(bedrooms__gte=0),
                name="listing_bedrooms_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(bathrooms__gte=0),
                name="listing_bathrooms_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["owner", "status", "-created_at"], name="listing_owner_status_idx"),
            models.Index(
                fields=["city", "state", "monthly_rent", "availability_start_date"],
                name="listing_search_idx",
            ),
        ]

    def __str__(self):
        return self.title


class ListingAmenity(models.Model):
    code = models.CharField(max_length=60, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    category = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("label",)

    def __str__(self):
        return self.label


class ListingAmenityMap(models.Model):
    listing = models.ForeignKey(PropertyListing, on_delete=models.CASCADE, related_name="amenity_links")
    amenity = models.ForeignKey(ListingAmenity, on_delete=models.CASCADE, related_name="listing_links")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "amenity"],
                name="listing_amenity_unique",
            )
        ]


class ListingMedia(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    class UploadStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        UPLOADED = "uploaded", "Uploaded"
        FAILED = "failed", "Failed"

    listing = models.ForeignKey(PropertyListing, on_delete=models.CASCADE, related_name="media")
    media_type = models.CharField(max_length=16, choices=MediaType.choices, default=MediaType.IMAGE)
    file_url = models.URLField(blank=True)
    file = models.FileField(upload_to="listing_media/", blank=True, null=True)
    thumbnail_url = models.URLField(blank=True)
    display_order = models.IntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # S3 storage location
    storage_key = models.CharField(max_length=512, blank=True, db_index=True)
    is_private = models.BooleanField(default=False)

    # File metadata
    original_filename = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveBigIntegerField(null=True, blank=True)

    # Upload state
    upload_status = models.CharField(
        max_length=16,
        choices=UploadStatus.choices,
        default=UploadStatus.PENDING,
    )

    class Meta:
        ordering = ("display_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["listing"],
                condition=models.Q(is_primary=True),
                name="listing_one_primary_media",
            )
        ]


class PropertyBooking(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        DECLINED = "declined", "Declined"
        CANCELLED = "cancelled", "Cancelled"

    sublessee = models.ForeignKey(User, on_delete=models.CASCADE, related_name="property_bookings")
    listing = models.ForeignKey(PropertyListing, on_delete=models.CASCADE, related_name="bookings")
    start_date = models.DateField()
    end_date = models.DateField()
    monthly_rent_snapshot = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    booked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(start_date__lte=models.F("end_date")),
                name="booking_dates_valid",
            ),
            models.UniqueConstraint(
                fields=["sublessee", "listing", "start_date", "end_date"],
                name="booking_unique_window",
            ),
        ]
        indexes = [
            models.Index(fields=["sublessee", "end_date"], name="booking_user_end_date_idx"),
            models.Index(fields=["sublessee", "-booked_at"], name="booking_user_booked_at_idx"),
        ]


class TransactionRecord(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=8, default="usd")
    booking_reference = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True)
    stripe_checkout_session_id = models.CharField(max_length=128, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-created_at"], name="txn_user_created_idx"),
            models.Index(fields=["status", "-created_at"], name="txn_status_created_idx"),
        ]


class FavoriteListing(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorite_listings")
    listing = models.ForeignKey(PropertyListing, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "listing"],
                name="favorite_listing_unique",
            )
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="favorite_user_created_idx"),
        ]


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-created_at"], name="pwreset_user_created_idx"),
        ]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_usable(self):
        return self.used_at is None and not self.is_expired
