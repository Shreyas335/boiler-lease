from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    ApprovalRequest,
    CompanyDocument,
    FavoriteListing,
    FeedbackSubmission,
    Guideline,
    ListingAmenity,
    ListingAmenityMap,
    ListingMedia,
    ManagementCompany,
    PropertyBooking,
    PropertyListing,
    TransactionRecord,
    User,
)


class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()
    company_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "user_type",
            "first_name",
            "last_name",
            "email_verified",
            "two_factor_enabled",
            "company_name",
            "company_status",
        )
        read_only_fields = (
            "id",
            "username",
            "email",
            "user_type",
            "first_name",
            "last_name",
            "email_verified",
            "two_factor_enabled",
            "company_name",
            "company_status",
        )

    def get_company_name(self, obj):
        if obj.user_type == User.UserType.MANAGEMENT:
            try:
                return obj.management_company.company_name
            except Exception:
                return None
        return None

    def get_company_status(self, obj):
        if obj.user_type == User.UserType.MANAGEMENT:
            try:
                return obj.management_company.status
            except Exception:
                return None
        return None


class AccountUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("username", "first_name", "last_name")
        extra_kwargs = {
            "username": {"required": False},
            "first_name": {"required": False},
            "last_name": {"required": False},
        }

    def validate_username(self, value):
        user = self.instance
        value = value.lower()
        if value and User.objects.exclude(pk=user.pk).filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        # Import here to avoid shadowing DRF's ValidationError with Django's.
        from django.core.exceptions import ValidationError as DjangoValidationError

        user = self.context["request"].user
        current_password = attrs["current_password"]
        new_password = attrs["new_password"]
        new_password_confirm = attrs["new_password_confirm"]

        if not user.check_password(current_password):
            raise serializers.ValidationError(
                {"current_password": ["Current password is incorrect."]}
            )

        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": ["New passwords do not match."]}
            )

        if new_password == current_password:
            raise serializers.ValidationError(
                {"new_password": ["New password must be different from current password."]}
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    company_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm", "user_type", "first_name", "last_name", "company_name")

    def validate(self, data):
        # Validate required fields
        required_fields = ["username", "email", "password", "password_confirm", "user_type"]
        for field in required_fields:
            if not data.get(field):
                raise serializers.ValidationError({field: f"{field.replace('_', ' ').title()} is required."})

        # Validate password match
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        # Validate email uniqueness
        if User.objects.filter(email=data["email"]).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})

        # Normalize username to lowercase
        data["username"] = data["username"].lower()

        # Validate username uniqueness (case-insensitive)
        if User.objects.filter(username__iexact=data["username"]).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})

        # Validate user type
        valid_types = [choice[0] for choice in User.UserType.choices]
        if data["user_type"] not in valid_types:
            raise serializers.ValidationError({"user_type": f"Must be one of: {', '.join(valid_types)}"})

        # company_name required for management users
        if data["user_type"] == User.UserType.MANAGEMENT and not data.get("company_name"):
            raise serializers.ValidationError({"company_name": "Company name is required for management accounts."})

        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        validated_data.pop("company_name", None)
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """Accept login as either email or username (optional which one the user provides)."""
    login = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        login = (data.get("login") or "").strip()
        password = data.get("password")

        if not password:
            raise serializers.ValidationError({"password": ["Password is required."]})

        if not login:
            raise serializers.ValidationError({"login": ["Email or username is required."]})

        # Look up by email if input contains '@' or '.' , otherwise by username
        if "@" and "." in login:
            user = User.objects.filter(email__iexact=login).first()
        else:
            user = User.objects.filter(username__iexact=login).first()

        if not user or not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid email or password."})

        data["user"] = user
        return data


class TwoFactorSetupSerializer(serializers.Serializer):
    """Response: secret and qr_code_url for authenticator app."""

    secret = serializers.CharField(read_only=True)
    qr_code_url = serializers.CharField(read_only=True)


class TwoFactorConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=8, min_length=6)

    def validate_code(self, value):
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise serializers.ValidationError("Code must be 6 digits.")
        return value


class TwoFactorVerifyLoginSerializer(serializers.Serializer):
    temp_token = serializers.CharField()
    code = serializers.CharField(max_length=8, min_length=6)

    def validate_code(self, value):
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise serializers.ValidationError("Code must be 6 digits.")
        return value


class FeedbackSubmissionSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = FeedbackSubmission
        fields = ("id", "subject", "message", "rating", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_subject(self, value):
        return value.strip()

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Message is required.")
        return value


class ListingMediaSerializer(serializers.ModelSerializer):
    access_url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingMedia
        fields = (
            "id",
            "media_type",
            "file_url",
            "access_url",
            "thumbnail_url",
            "display_order",
            "is_primary",
            "is_private",
            "original_filename",
            "content_type",
            "file_size",
            "upload_status",
        )
        read_only_fields = ("id", "access_url", "upload_status")

    def get_access_url(self, obj):
        """Return the resolved access URL based on storage_key and privacy.

        - Public media: stable public URL built from settings.
        - Private media: short-lived signed URL via the private storage backend.
        - Fallback: the legacy file_url field for old rows without a storage_key.
        """
        if not obj.storage_key:
            return obj.file_url or None

        if obj.is_private:
            return self._get_private_url(obj.storage_key)
        return self._get_public_url(obj.storage_key)

    @staticmethod
    def _get_public_url(storage_key):
        from django.conf import settings

        base = getattr(settings, "LISTING_MEDIA_PUBLIC_BASE_URL", "")
        if base:
            return f"{base}/{storage_key}"
        return None

    @staticmethod
    def _get_private_url(storage_key):
        from django.core.files.storage import storages

        try:
            private_storage = storages["listing_media_private"]
            return private_storage.url(storage_key)
        except (KeyError, Exception):
            return None

    def _build_url(self, url: str) -> str:
        if not url:
            return ""
        if url.startswith("http://") or url.startswith("https://"):
            return url
        base = settings.BACKEND_URL.rstrip("/")
        return f"{base}{url}"

    def get_file_url(self, obj):
        if obj.file:
            return self._build_url(obj.file.url)
        return self._build_url(obj.file_url or "")

    def get_thumbnail_url(self, obj):
        if obj.thumbnail_url:
            return self._build_url(obj.thumbnail_url)
        return ""


class ListingMediaUploadSerializer(serializers.Serializer):
    file = serializers.FileField(write_only=True)
    is_primary = serializers.BooleanField(required=False, default=False)
    display_order = serializers.IntegerField(required=False, min_value=0, default=0)

    def validate_file(self, value):
        content_type = getattr(value, "content_type", "")
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError("Only image files are allowed.")
        return value


class ListingAmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingAmenity
        fields = ("id", "code", "label", "category")


class PropertyListingSerializer(serializers.ModelSerializer):
    amenities = serializers.SerializerMethodField()
    media = serializers.SerializerMethodField()
    approved_by_company_name = serializers.SerializerMethodField()

    class Meta:
        model = PropertyListing
        fields = (
            "id",
            "title",
            "description",
            "property_type",
            "bedrooms",
            "bathrooms",
            "square_feet",
            "furnished_status",
            "monthly_rent",
            "security_deposit",
            "utilities_included",
            "availability_start_date",
            "availability_end_date",
            "lease_term_min_months",
            "lease_term_max_months",
            "pets_allowed",
            "smoking_allowed",
            "street_line_1",
            "street_line_2",
            "city",
            "state",
            "postal_code",
            "country_code",
            "latitude",
            "longitude",
            "unit_number",
            "building_name",
            "parking_available",
            "parking_details",
            "contact_email",
            "contact_phone",
            "virtual_tour_url",
            "status",
            "approval_status",
            "approved_by_company_name",
            "published_at",
            "created_at",
            "updated_at",
            "amenities",
            "media",
        )

    def get_amenities(self, obj):
        amenities = ListingAmenity.objects.filter(listing_links__listing=obj, is_active=True).distinct()
        return ListingAmenitySerializer(amenities, many=True).data

    def get_media(self, obj):
        finalized = obj.media.filter(upload_status=ListingMedia.UploadStatus.UPLOADED)
        return ListingMediaSerializer(finalized, many=True).data

    def get_approved_by_company_name(self, obj):
        if obj.approved_by_company_id:
            return obj.approved_by_company.company_name
        return None


class PropertyListingSummarySerializer(serializers.ModelSerializer):
    primary_photo_url = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = PropertyListing
        fields = (
            "id",
            "title",
            "city",
            "state",
            "monthly_rent",
            "availability_start_date",
            "availability_end_date",
            "status",
            "approval_status",
            "created_at",
            "primary_photo_url",
            "is_favorited",
        )

    def get_primary_photo_url(self, obj):
        media = (
            ListingMedia.objects.filter(listing_id=obj.id)
            .order_by("-is_primary", "display_order", "id")
            .first()
        )
        if not media:
            return ""

        if media.file:
            return ListingMediaSerializer()._build_url(media.file.url)
        return ListingMediaSerializer()._build_url(media.file_url or "")

    def get_is_favorited(self, obj):
        user = self.context.get("user")
        favorite_listing_ids = self.context.get("favorite_listing_ids")
        if not user or not user.is_authenticated:
            return False
        if favorite_listing_ids is not None:
            return obj.id in favorite_listing_ids
        return FavoriteListing.objects.filter(user=user, listing=obj).exists()


class PropertyBookingSerializer(serializers.ModelSerializer):
    listing = PropertyListingSummarySerializer(read_only=True)
    price = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    is_cancelable = serializers.SerializerMethodField()

    class Meta:
        model = PropertyBooking
        fields = (
            "id",
            "listing",
            "start_date",
            "end_date",
            "booked_at",
            "monthly_rent_snapshot",
            "status",
            "status_label",
            "price",
            "is_cancelable",
        )

    def get_price(self, obj):
        return obj.monthly_rent_snapshot or obj.listing.monthly_rent

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_is_cancelable(self, obj):
        return obj.status in (
            PropertyBooking.Status.PENDING,
            PropertyBooking.Status.CONFIRMED,
        )


class PropertyBookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyBooking
        fields = ("id", "listing", "start_date", "end_date")
        read_only_fields = ("id",)

    def validate(self, attrs):
        listing = attrs["listing"]
        start_date = attrs["start_date"]
        end_date = attrs["end_date"]

        if listing.deleted_at is not None:
            raise serializers.ValidationError({"listing": ["Property listing not found."]})

        if (
            listing.status != PropertyListing.ListingStatus.PUBLISHED
            or listing.approval_status != PropertyListing.ApprovalStatus.APPROVED
        ):
            raise serializers.ValidationError({"listing": ["This property is not available for booking."]})

        if start_date > end_date:
            raise serializers.ValidationError({"end_date": ["End date must be on or after start date."]})

        if start_date < listing.availability_start_date or end_date > listing.availability_end_date:
            raise serializers.ValidationError(
                {
                    "start_date": [
                        "Booking dates must fall within the property's listed availability window."
                    ]
                }
            )

        overlapping_booking_exists = PropertyBooking.objects.filter(
            listing=listing,
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).exclude(
            status__in=[
                PropertyBooking.Status.DECLINED,
                PropertyBooking.Status.CANCELLED,
            ],
        ).exists()
        if overlapping_booking_exists:
            raise serializers.ValidationError(
                {"listing": ["These dates are no longer available for this property."]}
            )

        request = self.context.get("request")
        if request and listing.owner_id == request.user.id:
            raise serializers.ValidationError(
                {"listing": ["You cannot book your own property listing."]}
            )

        return attrs

    def create(self, validated_data):
        listing = validated_data["listing"]
        return PropertyBooking.objects.create(
            sublessee=self.context["request"].user,
            listing=listing,
            start_date=validated_data["start_date"],
            end_date=validated_data["end_date"],
            monthly_rent_snapshot=listing.monthly_rent,
            status=PropertyBooking.Status.PENDING,
        )


class FavoriteListingSerializer(serializers.ModelSerializer):
    listing = PropertyListingSummarySerializer(read_only=True)

    class Meta:
        model = FavoriteListing
        fields = ("id", "created_at", "listing")


class PropertyListingCreateSerializer(serializers.ModelSerializer):
    amenity_codes = serializers.ListField(
        child=serializers.CharField(max_length=60),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = PropertyListing
        fields = (
            "title",
            "description",
            "property_type",
            "bedrooms",
            "bathrooms",
            "square_feet",
            "furnished_status",
            "monthly_rent",
            "security_deposit",
            "utilities_included",
            "availability_start_date",
            "availability_end_date",
            "lease_term_min_months",
            "lease_term_max_months",
            "pets_allowed",
            "smoking_allowed",
            "street_line_1",
            "street_line_2",
            "city",
            "state",
            "postal_code",
            "country_code",
            "latitude",
            "longitude",
            "unit_number",
            "building_name",
            "parking_available",
            "parking_details",
            "contact_email",
            "contact_phone",
            "virtual_tour_url",
            "status",
            "amenity_codes",
        )
        extra_kwargs = {
            "title": {"required": True},
            "description": {"required": True},
            "monthly_rent": {"required": True},
            "availability_start_date": {"required": True},
            "availability_end_date": {"required": True},
            "street_line_1": {"required": True},
            "city": {"required": True},
            "state": {"required": True},
            "postal_code": {"required": True},
        }

    def validate(self, attrs):
        start_date = attrs.get("availability_start_date")
        end_date = attrs.get("availability_end_date")
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError(
                {"availability_end_date": ["End date must be on or after start date."]}
            )

        lease_term_min = attrs.get("lease_term_min_months")
        lease_term_max = attrs.get("lease_term_max_months")
        if (
            lease_term_min is not None
            and lease_term_max is not None
            and lease_term_min > lease_term_max
        ):
            raise serializers.ValidationError(
                {"lease_term_max_months": ["Max lease term must be greater than or equal to min lease term."]}
            )

        if attrs.get("parking_available") is False and attrs.get("parking_details"):
            raise serializers.ValidationError(
                {"parking_details": ["Parking details are only allowed when parking is available."]}
            )

        return attrs

    def create(self, validated_data):
        amenity_codes = validated_data.pop("amenity_codes", [])
        owner = self.context["request"].user
        if not validated_data.get("contact_email"):
            validated_data["contact_email"] = owner.email
        listing = PropertyListing.objects.create(owner=owner, **validated_data)

        if amenity_codes:
            amenities = ListingAmenity.objects.filter(code__in=amenity_codes, is_active=True)
            ListingAmenityMap.objects.bulk_create(
                [ListingAmenityMap(listing=listing, amenity=amenity) for amenity in amenities],
                ignore_conflicts=True,
            )
        return listing


class PropertyListingUpdateSerializer(serializers.ModelSerializer):
    amenity_codes = serializers.ListField(
        child=serializers.CharField(max_length=60),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = PropertyListing
        fields = (
            "title",
            "description",
            "property_type",
            "bedrooms",
            "bathrooms",
            "square_feet",
            "furnished_status",
            "monthly_rent",
            "security_deposit",
            "utilities_included",
            "availability_start_date",
            "availability_end_date",
            "lease_term_min_months",
            "lease_term_max_months",
            "pets_allowed",
            "smoking_allowed",
            "street_line_1",
            "street_line_2",
            "city",
            "state",
            "postal_code",
            "country_code",
            "latitude",
            "longitude",
            "unit_number",
            "building_name",
            "parking_available",
            "parking_details",
            "contact_email",
            "contact_phone",
            "virtual_tour_url",
            "status",
            "amenity_codes",
        )
        extra_kwargs = {
            "title": {"required": False},
            "description": {"required": False},
            "monthly_rent": {"required": False},
            "availability_start_date": {"required": False},
            "availability_end_date": {"required": False},
            "street_line_1": {"required": False},
            "city": {"required": False},
            "state": {"required": False},
            "postal_code": {"required": False},
        }

    def validate(self, attrs):
        start_date = attrs.get("availability_start_date") or self.instance.availability_start_date
        end_date = attrs.get("availability_end_date") or self.instance.availability_end_date
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError(
                {"availability_end_date": ["End date must be on or after start date."]}
            )

        lease_term_min = attrs.get("lease_term_min_months") or self.instance.lease_term_min_months
        lease_term_max = attrs.get("lease_term_max_months") or self.instance.lease_term_max_months
        if (
            lease_term_min is not None
            and lease_term_max is not None
            and lease_term_min > lease_term_max
        ):
            raise serializers.ValidationError(
                {"lease_term_max_months": ["Max lease term must be greater than or equal to min lease term."]}
            )

        parking_available = attrs.get("parking_available", self.instance.parking_available)
        parking_details = attrs.get("parking_details", self.instance.parking_details)
        if parking_available is False and parking_details:
            raise serializers.ValidationError(
                {"parking_details": ["Parking details are only allowed when parking is available."]}
            )

        return attrs

    def update(self, instance, validated_data):
        amenity_codes = validated_data.pop("amenity_codes", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if amenity_codes is not None:
            instance.amenity_links.all().delete()
            if amenity_codes:
                amenities = ListingAmenity.objects.filter(code__in=amenity_codes, is_active=True)
                ListingAmenityMap.objects.bulk_create(
                    [ListingAmenityMap(listing=instance, amenity=amenity) for amenity in amenities],
                    ignore_conflicts=True,
                )

        return instance


class PropertyListingBrowseSerializer(serializers.ModelSerializer):
    """Read-only serializer for browsing properties. Optimized for list view with nested media and amenities."""
    amenities = serializers.SerializerMethodField()
    media = ListingMediaSerializer(many=True, read_only=True)
    approved_by_company_name = serializers.SerializerMethodField()

    class Meta:
        model = PropertyListing
        fields = (
            "id",
            "title",
            "description",
            "bedrooms",
            "bathrooms",
            "monthly_rent",
            "property_type",
            "furnished_status",
            "utilities_included",
            "pets_allowed",
            "parking_available",
            "street_line_1",
            "street_line_2",
            "city",
            "state",
            "postal_code",
            "latitude",
            "longitude",
            "availability_start_date",
            "availability_end_date",
            "lease_term_min_months",
            "lease_term_max_months",
            "approved_by_company_name",
            "amenities",
            "media",
        )
        read_only_fields = fields

    def get_amenities(self, obj):
        amenities = ListingAmenity.objects.filter(listing_links__listing=obj, is_active=True).distinct()
        return ListingAmenitySerializer(amenities, many=True).data

    def get_approved_by_company_name(self, obj):
        if obj.approved_by_company_id:
            return obj.approved_by_company.company_name
        return None


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        new_password = attrs["new_password"]
        new_password_confirm = attrs["new_password_confirm"]

        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": ["New passwords do not match."]}
            )

        user = self.context.get("user")
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class TransactionRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionRecord
        fields = (
            "id",
            "amount",
            "currency",
            "booking_reference",
            "status",
            "stripe_payment_intent_id",
            "stripe_checkout_session_id",
            "paid_at",
            "created_at",
        )
        read_only_fields = fields


class ManagementCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = ManagementCompany
        fields = ("id", "company_name", "status", "rejection_reason", "reviewed_at", "created_at")
        read_only_fields = ("id", "status", "rejection_reason", "reviewed_at", "created_at")


class PublicGuidelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guideline
        fields = (
            "id", "name",
            "min_rent", "max_rent",
            "min_deposit", "max_deposit",
            "min_availability_days",
            "utilities_included", "pets_allowed",
            "furnished_status", "required_amenities",
        )


class PublicManagementCompanySerializer(serializers.ModelSerializer):
    guidelines = PublicGuidelineSerializer(many=True, read_only=True)

    class Meta:
        model = ManagementCompany
        fields = ("id", "company_name", "guidelines")


class GuidelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guideline
        fields = (
            "id", "name",
            "min_rent", "max_rent",
            "min_deposit", "max_deposit",
            "min_availability_days",
            "utilities_included", "pets_allowed",
            "furnished_status", "required_amenities",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CompanyDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyDocument
        fields = ("id", "document_type", "original_filename", "uploaded_at")
        read_only_fields = fields


class CompanyDocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    document_type = serializers.ChoiceField(choices=CompanyDocument.DocumentType.choices)


class ApprovalRequestCreateSerializer(serializers.Serializer):
    management_company_id = serializers.IntegerField()
    guideline_id = serializers.IntegerField()
    subleaser_notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_management_company_id(self, value):
        if not ManagementCompany.objects.filter(pk=value, status=ManagementCompany.Status.APPROVED).exists():
            raise serializers.ValidationError("Management company not found or not approved.")
        return value

    def validate(self, attrs):
        company_id = attrs["management_company_id"]
        guideline_id = attrs["guideline_id"]
        if not Guideline.objects.filter(pk=guideline_id, company_id=company_id).exists():
            raise serializers.ValidationError({"guideline_id": "Guideline not found for this company."})
        return attrs


class ApprovalRequestSummarySerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    listing_rent = serializers.DecimalField(source="listing.monthly_rent", max_digits=10, decimal_places=2, read_only=True)
    listing_city = serializers.CharField(source="listing.city", read_only=True)
    management_company_name = serializers.CharField(source="management_company.company_name", read_only=True)
    guideline_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = (
            "id",
            "listing_id",
            "listing_title",
            "listing_rent",
            "listing_city",
            "management_company_id",
            "management_company_name",
            "guideline_name",
            "status",
            "subleaser_notes",
            "reviewer_notes",
            "reviewed_at",
            "created_at",
        )

    def get_guideline_name(self, obj):
        return obj.guideline.name if obj.guideline else None


class ApprovalRequestDetailSerializer(serializers.ModelSerializer):
    listing = PropertyListingSerializer(read_only=True)
    management_company_name = serializers.CharField(source="management_company.company_name", read_only=True)
    guideline = PublicGuidelineSerializer(read_only=True)
    compliance_results = serializers.SerializerMethodField()
    subleaser_email = serializers.EmailField(source="listing.owner.email", read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = (
            "id",
            "listing",
            "management_company_name",
            "guideline",
            "compliance_results",
            "subleaser_email",
            "subleaser_notes",
            "reviewer_notes",
            "status",
            "reviewed_at",
            "created_at",
        )

    def get_compliance_results(self, obj):
        check_fn = self.context.get("check_compliance")
        if check_fn and obj.guideline:
            return check_fn(obj.listing, obj.guideline)
        return []
