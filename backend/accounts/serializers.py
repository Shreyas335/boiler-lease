from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Avg, Q
from rest_framework import serializers

from .models import (
    Conversation,
    ConversationDeletion,
    ApprovalRequest,
    BookingGroup,
    BookingGroupConfirmation,
    BookingGroupMembership,
    CompanyDocument,
    FavoriteListing,
    FeedbackSubmission,
    Guideline,
    ListingAmenity,
    ListingAmenityMap,
    ListingMedia,
    Message,
    ManagementCompany,
    Notification,
    NotificationPreference,
    PriceOffer,
    PropertyBooking,
    PropertyListing,
    TransactionRecord,
    User,
    UserBlock,
    UserRating,
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
            "message_notifications_enabled",
            "company_name",
            "company_status",
            "identity_verification_status",
            "company_name",
            "company_status",
            "bio",
            "profile_picture_url",
            "contact_phone",
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
            "identity_verification_status",
            "company_name",
            "company_status",
            "bio",
            "profile_picture_url",
            "contact_phone",
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
        fields = ("username", "first_name", "last_name", "message_notifications_enabled")
        extra_kwargs = {
            "username": {"required": False},
            "first_name": {"required": False},
            "last_name": {"required": False},
            "message_notifications_enabled": {"required": False},
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
    approved_by_company_user_id = serializers.SerializerMethodField()
    owner_id = serializers.IntegerField(source="owner.id", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    owner_first_name = serializers.CharField(source="owner.first_name", read_only=True)
    owner_last_name = serializers.CharField(source="owner.last_name", read_only=True)

    class Meta:
        model = PropertyListing
        fields = (
            "id",
            "owner",
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
            "approved_by_company_user_id",
            "owner_id",
            "owner_username",
            "owner_first_name",
            "owner_last_name",
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

    def get_approved_by_company_user_id(self, obj):
        if obj.approved_by_company_id:
            return obj.approved_by_company.user_id
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
            "security_deposit",
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
    group_id = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    group_confirmed_user_ids = serializers.SerializerMethodField()
    group_paid_user_ids = serializers.SerializerMethodField()

    class Meta:
        model = PropertyBooking
        fields = (
            "id",
            "listing",
            "start_date",
            "end_date",
            "booked_at",
            "monthly_rent_snapshot",
            "security_deposit_snapshot",
            "deposit_paid_at",
            "status",
            "status_label",
            "price",
            "is_cancelable",
            "group_id",
            "group_name",
            "group_confirmed_user_ids",
            "group_paid_user_ids",
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

    def get_group_id(self, obj):
        return obj.group_id

    def get_group_name(self, obj):
        return obj.group.name if obj.group_id and obj.group else None

    def get_group_confirmed_user_ids(self, obj):
        if not obj.group_id:
            return []
        return list(obj.group_confirmations.values_list("user_id", flat=True))

    def get_group_paid_user_ids(self, obj):
        paid_user_ids_by_booking_id = self.context.get("paid_user_ids_by_booking_id")
        if paid_user_ids_by_booking_id is not None:
            return paid_user_ids_by_booking_id.get(obj.id, [])
        if not obj.group_id:
            return []
        return list(
            TransactionRecord.objects.filter(
                booking_reference=str(obj.id),
                status=TransactionRecord.Status.SUCCEEDED,
            )
            .values_list("user_id", flat=True)
            .distinct()
        )


class BookingGroupMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = BookingGroupMembership
        fields = ("id", "user_id", "username", "email", "display_name", "status", "invited_at", "confirmed_at")

    def get_display_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.username


class BookingGroupSerializer(serializers.ModelSerializer):
    memberships = BookingGroupMembershipSerializer(many=True, read_only=True)
    booking_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = BookingGroup
        fields = ("id", "name", "created_by", "created_at", "memberships", "booking_count")
        read_only_fields = ("id", "created_by", "created_at", "memberships", "booking_count")


class BookingGroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    invitees = serializers.ListField(
        child=serializers.CharField(max_length=254),
        required=False,
        allow_empty=True,
    )

    def _resolve_invitee(self, identifier):
        identifier = identifier.strip()
        if not identifier:
            return None
        return User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier),
            user_type=User.UserType.SUBLESSEE,
        ).first()

    def validate_invitees(self, value):
        users = []
        missing = []
        seen = set()
        for identifier in value:
            user = self._resolve_invitee(identifier)
            if not user:
                missing.append(identifier)
                continue
            if user.id in seen:
                continue
            seen.add(user.id)
            users.append(user)
        if missing:
            raise serializers.ValidationError(f"Could not find sublessee(s): {', '.join(missing)}")
        self.context["invitee_users"] = users
        return value


class BookingGroupInviteSerializer(serializers.Serializer):
    invitees = serializers.ListField(child=serializers.CharField(max_length=254), allow_empty=False)

    def validate_invitees(self, value):
        users = []
        missing = []
        seen = set()
        for identifier in value:
            identifier = identifier.strip()
            user = User.objects.filter(
                Q(email__iexact=identifier) | Q(username__iexact=identifier),
                user_type=User.UserType.SUBLESSEE,
            ).first()
            if not user:
                missing.append(identifier)
                continue
            if user.id in seen:
                continue
            seen.add(user.id)
            users.append(user)
        if missing:
            raise serializers.ValidationError(f"Could not find sublessee(s): {', '.join(missing)}")
        self.context["invitee_users"] = users
        return value


class ManagedPropertyBookingSerializer(PropertyBookingSerializer):
    sublessee_name = serializers.SerializerMethodField()
    sublessee_email = serializers.EmailField(source="sublessee.email", read_only=True)

    class Meta(PropertyBookingSerializer.Meta):
        fields = PropertyBookingSerializer.Meta.fields + (
            "sublessee_name",
            "sublessee_email",
        )

    def get_sublessee_name(self, obj):
        full_name = obj.sublessee.get_full_name().strip()
        return full_name or obj.sublessee.username


class PropertyBookingStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyBooking
        fields = ("status",)

    def validate_status(self, value):
        allowed_statuses = {
            PropertyBooking.Status.CONFIRMED,
            PropertyBooking.Status.DECLINED,
        }
        if value not in allowed_statuses:
            raise serializers.ValidationError(
                "Bookings can only be updated to Confirmed or Declined."
            )
        return value

    def validate(self, attrs):
        booking = self.instance
        if booking.status != PropertyBooking.Status.PENDING:
            raise serializers.ValidationError(
                {"status": ["Only pending bookings can be approved or declined."]}
            )
        return attrs


class PropertyBookingCreateSerializer(serializers.ModelSerializer):
    offer_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = PropertyBooking
        fields = ("id", "listing", "start_date", "end_date", "offer_id")
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
        offer_id = validated_data.pop("offer_id", None)
        monthly_rent = listing.monthly_rent
        if offer_id:
            offer = PriceOffer.objects.filter(
                pk=offer_id,
                listing=listing,
                sublessee=self.context["request"].user,
                status=PriceOffer.Status.ACCEPTED,
            ).first()
            if offer:
                monthly_rent = offer.offered_price
        return PropertyBooking.objects.create(
            sublessee=self.context["request"].user,
            listing=listing,
            start_date=validated_data["start_date"],
            end_date=validated_data["end_date"],
            monthly_rent_snapshot=monthly_rent,
            security_deposit_snapshot=listing.security_deposit,
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
        validated_data["status"] = PropertyListing.ListingStatus.DRAFT
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
    approved_by_company_user_id = serializers.SerializerMethodField()
    owner_id = serializers.IntegerField(source="owner.id", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    owner_first_name = serializers.CharField(source="owner.first_name", read_only=True)
    owner_last_name = serializers.CharField(source="owner.last_name", read_only=True)

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
            "approved_by_company_user_id",
            "owner_id",
            "owner_username",
            "owner_first_name",
            "owner_last_name",
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

    def get_approved_by_company_user_id(self, obj):
        if obj.approved_by_company_id:
            return obj.approved_by_company.user_id
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
    listing_title = serializers.SerializerMethodField()

    class Meta:
        model = TransactionRecord
        fields = (
            "id",
            "amount",
            "currency",
            "booking_reference",
            "listing_title",
            "status",
            "stripe_payment_intent_id",
            "stripe_checkout_session_id",
            "paid_at",
            "created_at",
        )
        read_only_fields = fields

    def get_listing_title(self, obj):
        ref = (obj.booking_reference or "").strip()
        if not ref:
            return None
        try:
            bid = int(ref)
        except ValueError:
            return None
        titles = self.context.get("listing_titles_by_booking_id")
        if titles is not None:
            return titles.get(bid)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return None
        booking = (
            PropertyBooking.objects.filter(pk=bid, sublessee=user)
            .select_related("listing")
            .first()
        )
        return booking.listing.title if booking else None


class OwnerListingTransactionSerializer(serializers.ModelSerializer):
    """Succeeded deposit charges for a listing, for the listing owner (subleaser)."""

    booking_id = serializers.SerializerMethodField()
    sublessee_display = serializers.SerializerMethodField()

    class Meta:
        model = TransactionRecord
        fields = (
            "id",
            "amount",
            "currency",
            "booking_id",
            "paid_at",
            "status",
            "sublessee_display",
        )
        read_only_fields = fields

    def get_booking_id(self, obj):
        ref = (obj.booking_reference or "").strip()
        try:
            return int(ref)
        except ValueError:
            return None

    def get_sublessee_display(self, obj):
        u = obj.user
        name = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return name or u.username


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


class UserProfileSerializer(serializers.ModelSerializer):
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    my_rating = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "user_type",
            "bio",
            "profile_picture_url",
            "contact_phone",
            "average_rating",
            "rating_count",
            "my_rating",
            "is_blocked",
        )
        read_only_fields = fields

    def get_average_rating(self, obj):
        result = obj.ratings_received.aggregate(avg=Avg("score"))["avg"]
        return round(result, 2) if result is not None else None

    def get_rating_count(self, obj):
        return obj.ratings_received.count()

    def get_my_rating(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        rating = UserRating.objects.filter(rater=request.user, rated_user=obj).first()
        return rating.score if rating else None

    def get_is_blocked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return UserBlock.objects.filter(blocker=request.user, blocked_user=obj).exists()


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("bio", "contact_phone", "first_name", "last_name")
        extra_kwargs = {
            "bio": {"required": False},
            "contact_phone": {"required": False},
            "first_name": {"required": False},
            "last_name": {"required": False},
        }

    def validate_bio(self, value):
        if len(value) > 500:
            raise serializers.ValidationError("Bio must be 500 characters or fewer.")
        return value


class UserRatingSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=1, max_value=5)


class BlockedUserSerializer(serializers.ModelSerializer):
    blocked_user_id = serializers.IntegerField(source="blocked_user.id", read_only=True)
    blocked_user_username = serializers.CharField(source="blocked_user.username", read_only=True)
    blocked_user_first_name = serializers.CharField(source="blocked_user.first_name", read_only=True)
    blocked_user_last_name = serializers.CharField(source="blocked_user.last_name", read_only=True)
    blocked_user_profile_picture_url = serializers.CharField(source="blocked_user.profile_picture_url", read_only=True)

    class Meta:
        model = UserBlock
        fields = (
            "id",
            "blocked_user_id",
            "blocked_user_username",
            "blocked_user_first_name",
            "blocked_user_last_name",
            "blocked_user_profile_picture_url",
            "created_at",
        )


# ─── Messaging serializers ────────────────────────────────────────────────────

class ConversationParticipantSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "full_name", "user_type")

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class PriceOfferSerializer(serializers.ModelSerializer):
    listing_id = serializers.IntegerField(source="listing.id", read_only=True)
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    sublessee_id = serializers.IntegerField(source="sublessee.id", read_only=True)
    sublessee_name = serializers.SerializerMethodField()

    class Meta:
        model = PriceOffer
        fields = (
            "id",
            "listing_id",
            "listing_title",
            "sublessee_id",
            "sublessee_name",
            "offered_price",
            "note",
            "status",
            "created_at",
            "responded_at",
        )

    def get_sublessee_name(self, obj):
        return obj.sublessee.get_full_name() or obj.sublessee.username


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source="sender.id", read_only=True)
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    offer = PriceOfferSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ("id", "conversation", "sender_id", "sender_username", "content", "offer", "created_at", "is_read")
        read_only_fields = ("id", "conversation", "sender_id", "sender_username", "offer", "created_at", "is_read")


class ConversationSerializer(serializers.ModelSerializer):
    other_participant = serializers.SerializerMethodField()
    listing_summary = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id",
            "other_participant",
            "listing_summary",
            "last_message",
            "unread_count",
            "created_at",
            "updated_at",
        )

    def get_other_participant(self, obj):
        user = self.context["request"].user
        other = obj.get_other_participant(user)
        return ConversationParticipantSerializer(other).data

    def get_listing_summary(self, obj):
        if not obj.listing_id:
            return None
        return {
            "id": obj.listing.id,
            "title": obj.listing.title,
            "city": obj.listing.city,
            "state": obj.listing.state,
        }

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if not msg:
            return None
        return {
            "content": msg.content[:100],
            "created_at": msg.created_at,
            "sender_id": msg.sender_id,
        }

    def get_unread_count(self, obj):
        user = self.context["request"].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class CreateConversationSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    listing_id = serializers.IntegerField(required=False, allow_null=True)
    initial_message = serializers.CharField(max_length=4000)

    def validate_recipient_id(self, value):
        user = self.context["request"].user
        if value == user.pk:
            raise serializers.ValidationError("You cannot message yourself.")
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("User not found.")
        return value

    def validate_listing_id(self, value):
        if value is not None and not PropertyListing.objects.filter(pk=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Listing not found.")
        return value


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=4000, allow_blank=False)

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message content cannot be blank.")
        return value.strip()


class UserBlockSerializer(serializers.ModelSerializer):
    blocked_user = ConversationParticipantSerializer(source="blocked_user", read_only=True)

    class Meta:
        model = UserBlock
        fields = ("id", "blocked_user", "created_at")
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "title",
            "body",
            "is_read",
            "created_at",
            "related_listing_id",
            "related_booking_id",
            "related_offer_id",
            "related_conversation_id",
        )
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = (
            "new_message",
            "booking_request",
            "booking_confirmed",
            "booking_declined",
            "offer_received",
            "offer_accepted",
            "offer_declined",
            "listing_approved",
            "listing_rejected",
            "broadcast",
        )
