import random
import secrets
import hashlib
import uuid
from datetime import timedelta
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.core.cache import cache
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .email_verification import send_2fa_code_email, send_password_reset_email, send_verification_email
from .models import ListingAmenity, ListingMedia, PasswordResetToken, PropertyListing, User
from .serializers import (
    AccountUpdateSerializer,
    FeedbackSubmissionSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PropertyListingCreateSerializer,
    PropertyListingSerializer,
    RegisterSerializer,
    UploadFinalizeSerializer,
    UploadInitSerializer,
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_init(request):
    """Return presigned S3 upload data so the browser can upload directly."""
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can upload media."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = UploadInitSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    listing = PropertyListing.objects.get(pk=data["listing_id"])
    is_private = data["is_private"]
    content_type = data["content_type"]
    filename = data["filename"]
    file_size = data["file_size"]

    # Build a unique storage key
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    storage_key = f"{listing.pk}/{uuid.uuid4().hex}.{ext}"

    # Pick the right storage backend and prefix
    from django.core.files.storage import storages

    if is_private:
        storage_name = "listing_media_private"
        prefix = getattr(settings, "LISTING_MEDIA_PRIVATE_PREFIX", "listing-media/private")
    else:
        storage_name = "listing_media_public"
        prefix = getattr(settings, "LISTING_MEDIA_PUBLIC_PREFIX", "listing-media/public")

    try:
        storage = storages[storage_name]
    except KeyError:
        return Response(
            {"detail": "Storage backend not configured. Check AWS settings."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Generate presigned POST data via boto3
    full_key = f"{prefix}/{storage_key}"
    try:
        client = storage.connection.meta.client
        presigned = client.generate_presigned_post(
            Bucket=storage.bucket_name,
            Key=full_key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, file_size],
            ],
            ExpiresIn=300,
        )
    except Exception as exc:
        return Response(
            {"detail": "Failed to generate upload URL."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Create a pending media record
    media = ListingMedia.objects.create(
        listing=listing,
        media_type=ListingMedia.MediaType.IMAGE,
        storage_key=storage_key,
        is_private=is_private,
        original_filename=filename,
        content_type=content_type,
        file_size=file_size,
        upload_status=ListingMedia.UploadStatus.PENDING,
    )

    return Response(
        {
            "media_id": media.pk,
            "upload_url": presigned["url"],
            "upload_fields": presigned["fields"],
            "storage_key": storage_key,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_finalize(request):
    """Mark a pending media record as uploaded after the browser finishes the S3 upload."""
    serializer = UploadFinalizeSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    media = ListingMedia.objects.select_related("listing").get(pk=data["media_id"])

    media.upload_status = ListingMedia.UploadStatus.UPLOADED
    media.display_order = data["display_order"]

    if data["is_primary"]:
        # Clear any existing primary flag on this listing
        ListingMedia.objects.filter(
            listing=media.listing, is_primary=True
        ).update(is_primary=False)
        media.is_primary = True

    media.save(update_fields=["upload_status", "display_order", "is_primary"])

    from .serializers import ListingMediaSerializer

    return Response(ListingMediaSerializer(media).data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def private_media_access(request, media_id):
    """Return a short-lived signed URL for a private photo."""
    try:
        media = ListingMedia.objects.select_related("listing").get(pk=media_id)
    except ListingMedia.DoesNotExist:
        return Response({"detail": "Media not found."}, status=status.HTTP_404_NOT_FOUND)

    if not media.is_private:
        return Response(
            {"detail": "This media is public. Use the public URL."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if media.upload_status != ListingMedia.UploadStatus.UPLOADED:
        return Response({"detail": "Media not available."}, status=status.HTTP_404_NOT_FOUND)

    # Only the listing owner can access private photos for now
    if media.listing.owner_id != request.user.pk:
        return Response(
            {"detail": "You do not have permission to access this media."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not media.storage_key:
        return Response({"detail": "No storage key for this media."}, status=status.HTTP_404_NOT_FOUND)

    from django.core.files.storage import storages

    try:
        private_storage = storages["listing_media_private"]
        signed_url = private_storage.url(media.storage_key)
    except (KeyError, Exception):
        return Response(
            {"detail": "Private storage not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"access_url": signed_url, "expires_in": settings.AWS_S3_PRIVATE_URL_EXPIRE_SECONDS})
