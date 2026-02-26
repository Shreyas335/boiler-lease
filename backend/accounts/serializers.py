from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    FavoriteListing,
    FeedbackSubmission,
    ListingAmenity,
    ListingAmenityMap,
    ListingMedia,
    PropertyBooking,
    PropertyListing,
    User,
)


class UserSerializer(serializers.ModelSerializer):
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
        )


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
        if value and User.objects.exclude(pk=user.pk).filter(username=value).exists():
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

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm", "user_type", "first_name", "last_name")

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
        
        # Validate username uniqueness
        if User.objects.filter(username=data["username"]).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})
        
        # Validate user type
        valid_types = [choice[0] for choice in User.UserType.choices]
        if data["user_type"] not in valid_types:
            raise serializers.ValidationError({"user_type": f"Must be one of: {', '.join(valid_types)}"})
        
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            raise serializers.ValidationError("Email and password are required.")

        user = User.objects.filter(email=email).first()
        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

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
    class Meta:
        model = ListingMedia
        fields = ("id", "media_type", "file_url", "thumbnail_url", "display_order", "is_primary")


class ListingAmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingAmenity
        fields = ("id", "code", "label", "category")


class PropertyListingSerializer(serializers.ModelSerializer):
    amenities = serializers.SerializerMethodField()
    media = ListingMediaSerializer(many=True, read_only=True)

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
            "published_at",
            "created_at",
            "updated_at",
            "amenities",
            "media",
        )

    def get_amenities(self, obj):
        amenities = ListingAmenity.objects.filter(listing_links__listing=obj, is_active=True).distinct()
        return ListingAmenitySerializer(amenities, many=True).data


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
        primary = obj.media.filter(is_primary=True).first()
        if primary:
            return primary.file_url
        fallback = obj.media.first()
        return fallback.file_url if fallback else ""

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

    class Meta:
        model = PropertyBooking
        fields = (
            "id",
            "listing",
            "start_date",
            "end_date",
            "booked_at",
            "monthly_rent_snapshot",
            "price",
        )

    def get_price(self, obj):
        return obj.monthly_rent_snapshot or obj.listing.monthly_rent


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
