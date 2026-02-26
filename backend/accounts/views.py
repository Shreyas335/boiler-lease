import random
import secrets
import hashlib
from datetime import timedelta
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.core.cache import cache
from django.conf import settings
from django.db.models.functions import Coalesce
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .email_verification import send_2fa_code_email, send_password_reset_email, send_verification_email
from .models import FavoriteListing, ListingAmenity, PasswordResetToken, PropertyBooking, PropertyListing, User
from .serializers import (
    AccountUpdateSerializer,
    FavoriteListingSerializer,
    FeedbackSubmissionSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PropertyBookingSerializer,
    PropertyListingCreateSerializer,
    PropertyListingSerializer,
    PropertyListingSummarySerializer,
    RegisterSerializer,
    UserSerializer,
    TwoFactorVerifyLoginSerializer,
)


def _make_2fa_temp_token(user):
    """Create temp token and store (user_pk, 6-digit code); send code by email. Returns token."""
    token = secrets.token_urlsafe(32)
    code = "".join(random.choices("0123456789", k=6))
    cache.set(f"2fa_login:{token}", (user.pk, code), timeout=300)  # 5 min
    try:
        send_2fa_code_email(user, code)
    except Exception:
        cache.delete(f"2fa_login:{token}")
        raise
    return token


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _is_sublessee(request):
    return request.user.user_type == User.UserType.SUBLESSEE


def _sort_order_prefix(order):
    return "" if str(order).lower() == "asc" else "-"


def _sort_bookings(queryset, sort_by, order):
    sort_map = {
        "date_booked": "booked_at",
        "price": "monthly_rent_snapshot",
        "start_date": "start_date",
        "end_date": "end_date",
    }
    selected = sort_map.get(sort_by, "booked_at")
    if selected == "monthly_rent_snapshot":
        queryset = queryset.annotate(effective_price=Coalesce("monthly_rent_snapshot", "listing__monthly_rent"))
        return queryset.order_by(f"{_sort_order_prefix(order)}effective_price", "-booked_at")
    return queryset.order_by(f"{_sort_order_prefix(order)}{selected}")


def _sort_favorites(queryset, sort_by, order):
    sort_map = {
        "date_saved": "created_at",
        "price": "listing__monthly_rent",
        "date_listed": "listing__created_at",
    }
    selected = sort_map.get(sort_by, "created_at")
    return queryset.order_by(f"{_sort_order_prefix(order)}{selected}")


def _sort_property_listings(queryset, sort_by, order):
    sort_map = {
        "price": "monthly_rent",
        "date_listed": "created_at",
        "availability_start": "availability_start_date",
        "availability_end": "availability_end_date",
    }
    selected = sort_map.get(sort_by, "created_at")
    return queryset.order_by(f"{_sort_order_prefix(order)}{selected}")


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        try:
            send_verification_email(user)
        except Exception:
            pass  # Don't fail registration if email fails
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.validated_data["user"]
    if user.two_factor_enabled:
        temp_token = _make_2fa_temp_token(user)
        return Response(
            {"requires_2fa": True, "temp_token": temp_token},
            status=status.HTTP_200_OK,
        )
    login(request, user)
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_2fa_login(request):
    """Complete login after 2FA code (emailed). Body: { temp_token, code }."""
    serializer = TwoFactorVerifyLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    temp_token = serializer.validated_data["temp_token"]
    code = serializer.validated_data["code"]
    cached = cache.get(f"2fa_login:{temp_token}")
    if not cached:
        return Response(
            {"code": ["Invalid or expired code. Please log in again."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user_pk, expected_code = cached
    if code != expected_code:
        return Response(
            {"code": ["Invalid or expired code."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        cache.delete(f"2fa_login:{temp_token}")
        return Response(
            {"code": ["Invalid or expired code. Please log in again."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    cache.delete(f"2fa_login:{temp_token}")
    login(request, user)
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def current_user(request):
    if request.method == "PATCH":
        serializer = AccountUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])
    return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data["email"]
    user = User.objects.filter(email__iexact=email).first()

    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        while PasswordResetToken.objects.filter(token_hash=token_hash).exists():
            raw_token = secrets.token_urlsafe(32)
            token_hash = _hash_token(raw_token)

        PasswordResetToken.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        try:
            send_password_reset_email(user, raw_token)
        except Exception:
            pass

    # Generic success response to prevent email enumeration.
    return Response(
        {"detail": "If an account exists for that email, a reset link has been sent."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    token = request.data.get("token")
    if not token:
        return Response({"token": ["Token is required."]}, status=status.HTTP_400_BAD_REQUEST)

    token_hash = _hash_token(token)
    reset_token = PasswordResetToken.objects.select_related("user").filter(token_hash=token_hash).first()
    if not reset_token or not reset_token.is_usable:
        return Response(
            {"detail": "Invalid or expired reset link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = PasswordResetConfirmSerializer(
        data=request.data,
        context={"user": reset_token.user},
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = reset_token.user
    user.set_password(serializer.validated_data["new_password"])
    user.save(update_fields=["password"])

    now = timezone.now()
    reset_token.used_at = now
    reset_token.save(update_fields=["used_at"])
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)

    return Response({"detail": "Password reset successful."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_cookie(request):
    """Ensure CSRF cookie is set for SPA (call before login/register)."""
    return Response({"detail": "CSRF cookie set"})


# ----- Email verification -----


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_verification_email_view(request):
    """Resend verification email for current user."""
    user = request.user
    if user.email_verified:
        return Response(
            {"detail": "Email is already verified."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        send_verification_email(user)
        return Response({"detail": "Verification email sent."})
    except Exception as e:
        return Response(
            {"detail": "Failed to send email. Try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def verify_email_view(request):
    """Verify email. GET with ?token= from email link: verify and redirect to frontend. POST: JSON body { token }."""
    token = request.query_params.get("token") or (request.data.get("token") if request.method == "POST" else None)
    if not token:
        if request.method == "GET":
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/verify-email?error=invalid")
        return Response(
            {"detail": "Verification token is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user = User.objects.filter(email_verification_token=token).first()
    if not user:
        if request.method == "GET":
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/verify-email?error=invalid")
        return Response(
            {"detail": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_sent_at = None
    user.save(update_fields=["email_verified", "email_verification_token", "email_verification_sent_at"])
    if request.method == "GET":
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/verify-email?verified=success")
    return Response({"detail": "Email verified successfully.", "user": UserSerializer(user).data})


# ----- Account settings & 2FA -----


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def account_settings(request):
    """Get current user settings (email_verified, two_factor_enabled)."""
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def two_factor_enable(request):
    """Enable email-based 2FA. No QR or code; next login will email a code."""
    user = request.user
    if user.two_factor_enabled:
        return Response(
            {"detail": "Two-factor is already enabled."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.two_factor_enabled = True
    user.totp_secret = None  # Not used for email 2FA
    user.save(update_fields=["two_factor_enabled", "totp_secret"])
    return Response({"detail": "Two-factor authentication enabled."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def two_factor_disable(request):
    """Disable 2FA. Afterwards login is password-only."""
    user = request.user
    if not user.two_factor_enabled:
        return Response(
            {"detail": "Two-factor is not enabled."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.totp_secret = None
    user.two_factor_enabled = False
    user.save(update_fields=["totp_secret", "two_factor_enabled"])
    return Response({"detail": "Two-factor authentication disabled."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_help_feedback(request):
    serializer = FeedbackSubmissionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    feedback = serializer.save(user=request.user)

    # Best-effort email notification for admins; failures should not block submit.
    try:
        send_mail(
            subject=f"[Boiler Lease Feedback] {feedback.subject or 'No subject'}",
            message=(
                f"From: {request.user.email} ({request.user.username})\n\n"
                f"Rating: {feedback.rating}/5\n\n"
                f"{feedback.message}\n\n"
                f"Submission ID: {feedback.id}"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email for _, email in settings.ADMINS] if settings.ADMINS else [],
            fail_silently=True,
        )
    except Exception:
        pass

    return Response(
        {"detail": "Feedback submitted successfully."},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_property_listing(request):
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can create property listings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = PropertyListingCreateSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    listing = serializer.save()
    return Response(PropertyListingSerializer(listing).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_property_listings(request):
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can view property listings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    listings = request.user.property_listings.filter(deleted_at__isnull=True).order_by("-created_at")
    return Response(PropertyListingSerializer(listings, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listing_amenities(request):
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can access listing amenities."},
            status=status.HTTP_403_FORBIDDEN,
        )
    amenities = ListingAmenity.objects.filter(is_active=True).order_by("label")
    return Response(
        [{"id": amenity.id, "code": amenity.code, "label": amenity.label} for amenity in amenities]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def browse_property_listings(request):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can browse property listings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    listings = (
        PropertyListing.objects.filter(
            deleted_at__isnull=True,
            status=PropertyListing.ListingStatus.PUBLISHED,
            approval_status=PropertyListing.ApprovalStatus.APPROVED,
        )
        .select_related("owner")
        .prefetch_related("media")
    )
    sort_by = request.query_params.get("sort_by", "date_listed")
    order = request.query_params.get("order", "desc")
    listings = _sort_property_listings(listings, sort_by, order)

    favorite_listing_ids = set(
        FavoriteListing.objects.filter(user=request.user).values_list("listing_id", flat=True)
    )
    serializer = PropertyListingSummarySerializer(
        listings,
        many=True,
        context={"user": request.user, "favorite_listing_ids": favorite_listing_ids},
    )
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_current_bookings(request):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can view current bookings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    today = timezone.localdate()
    bookings = (
        PropertyBooking.objects.filter(
            sublessee=request.user,
            end_date__gte=today,
            listing__deleted_at__isnull=True,
        )
        .select_related("listing")
        .prefetch_related("listing__media")
    )
    sort_by = request.query_params.get("sort_by", "date_booked")
    order = request.query_params.get("order", "desc")
    bookings = _sort_bookings(bookings, sort_by, order)

    favorite_listing_ids = set(
        FavoriteListing.objects.filter(user=request.user).values_list("listing_id", flat=True)
    )
    serializer = PropertyBookingSerializer(
        bookings,
        many=True,
        context={"user": request.user, "favorite_listing_ids": favorite_listing_ids},
    )
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_past_bookings(request):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can view past bookings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    today = timezone.localdate()
    bookings = (
        PropertyBooking.objects.filter(
            sublessee=request.user,
            end_date__lt=today,
            listing__deleted_at__isnull=True,
        )
        .select_related("listing")
        .prefetch_related("listing__media")
    )
    sort_by = request.query_params.get("sort_by", "date_booked")
    order = request.query_params.get("order", "desc")
    bookings = _sort_bookings(bookings, sort_by, order)

    favorite_listing_ids = set(
        FavoriteListing.objects.filter(user=request.user).values_list("listing_id", flat=True)
    )
    serializer = PropertyBookingSerializer(
        bookings,
        many=True,
        context={"user": request.user, "favorite_listing_ids": favorite_listing_ids},
    )
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def property_listing_detail(request, listing_id):
    listing = (
        PropertyListing.objects.filter(deleted_at__isnull=True)
        .prefetch_related("media", "amenity_links__amenity")
        .filter(pk=listing_id)
        .first()
    )
    if not listing:
        return Response({"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND)

    if _is_sublessee(request):
        if (
            listing.status != PropertyListing.ListingStatus.PUBLISHED
            or listing.approval_status != PropertyListing.ApprovalStatus.APPROVED
        ):
            return Response({"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND)

    data = PropertyListingSerializer(listing).data
    data["is_favorited"] = FavoriteListing.objects.filter(user=request.user, listing=listing).exists()
    return Response(data)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def favorite_listing_toggle(request, listing_id):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can manage favorites."},
            status=status.HTTP_403_FORBIDDEN,
        )

    listing = PropertyListing.objects.filter(pk=listing_id, deleted_at__isnull=True).first()
    if not listing:
        return Response({"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND)
    if (
        listing.status != PropertyListing.ListingStatus.PUBLISHED
        or listing.approval_status != PropertyListing.ApprovalStatus.APPROVED
    ):
        return Response({"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND)

    favorite = FavoriteListing.objects.filter(user=request.user, listing=listing).first()

    if request.method == "POST":
        if favorite:
            return Response({"detail": "Property already in favorites."}, status=status.HTTP_200_OK)
        FavoriteListing.objects.create(user=request.user, listing=listing)
        return Response({"detail": "Property added to favorites."}, status=status.HTTP_201_CREATED)

    if not favorite:
        return Response({"detail": "Property is not in favorites."}, status=status.HTTP_200_OK)
    favorite.delete()
    return Response({"detail": "Property removed from favorites."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_favorite_listings(request):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can view favorites."},
            status=status.HTTP_403_FORBIDDEN,
        )

    favorites = (
        FavoriteListing.objects.filter(user=request.user, listing__deleted_at__isnull=True)
        .select_related("listing")
        .prefetch_related("listing__media")
    )
    sort_by = request.query_params.get("sort_by", "date_saved")
    order = request.query_params.get("order", "desc")
    favorites = _sort_favorites(favorites, sort_by, order)

    favorite_listing_ids = set(favorites.values_list("listing_id", flat=True))
    serializer = FavoriteListingSerializer(
        favorites,
        many=True,
        context={"user": request.user, "favorite_listing_ids": favorite_listing_ids},
    )
    return Response(serializer.data)
