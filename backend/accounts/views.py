import random
import secrets
import hashlib
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
import stripe
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.core.cache import cache
from django.conf import settings
from django.db.models.functions import Coalesce
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.db.models import Q, Prefetch, Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .email_verification import (
    send_2fa_code_email,
    send_new_message_notification,
    send_offer_accepted_email,
    send_offer_declined_email,
    send_offer_received_email,
    send_password_reset_email,
    send_verification_email,
)

from .models import (
    Conversation,
    ConversationDeletion,
    ApprovalRequest,
    BookingGroup,
    BookingGroupConfirmation,
    BookingGroupMembership,
    CompanyDocument,
    FavoriteListing,
    Guideline,
    ListingAmenity,
    ListingAmenityMap,
    ListingMedia,
    Message,
    ManagementCompany,
    Notification,
    NotificationPreference,
    PasswordResetToken,
    PriceOffer,
    PropertyBooking,
    PropertyListing,
    TransactionRecord,
    User,
    UserBlock,
)
from .pagination import MessagePagination, PropertyListingPagination

from .guidelines import validate_guideline_data

from .serializers import (
    AccountUpdateSerializer,
    ApprovalRequestCreateSerializer,
    ApprovalRequestDetailSerializer,
    ApprovalRequestSummarySerializer,
    BookingGroupCreateSerializer,
    BookingGroupInviteSerializer,
    BookingGroupSerializer,
    CompanyDocumentSerializer,
    CompanyDocumentUploadSerializer,
    FavoriteListingSerializer,
    FeedbackSubmissionSerializer,
    GuidelineSerializer,
    LoginSerializer,
    MessageSerializer,
    ManagementCompanySerializer,
    ManagedPropertyBookingSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PriceOfferSerializer,
    PropertyBookingCreateSerializer,
    PropertyBookingStatusUpdateSerializer,
    PropertyListingBrowseSerializer,
    PropertyListingUpdateSerializer,
    PropertyBookingSerializer,
    PropertyListingCreateSerializer,
    PropertyListingSerializer,
    PropertyListingSummarySerializer,
    PublicManagementCompanySerializer,
    RegisterSerializer,
    ListingMediaSerializer,
    ListingMediaUploadSerializer,
    ConversationSerializer,
    ConversationParticipantSerializer,
    CreateConversationSerializer,
    SendMessageSerializer,
    OwnerListingTransactionSerializer,
    TransactionRecordSerializer,
    UserBlockSerializer,
    UserSerializer,
    TwoFactorVerifyLoginSerializer,
    BlockedUserSerializer,
    NotificationSerializer,
    NotificationPreferenceSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    UserRatingSerializer,
)


def create_notification(recipient, notification_type, title, body="", **related_ids):
    """Create a Notification, respecting user preferences, and push via WebSocket."""
    prefs, _ = NotificationPreference.objects.get_or_create(user=recipient)
    if not getattr(prefs, notification_type, True):
        return None
    n = Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        body=body,
        **related_ids,
    )
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{recipient.id}",
            {"type": "notification_new", "notification": NotificationSerializer(n).data},
        )
    except Exception:
        pass
    return n


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

def _user_for_identity_verification_session(obj):
    """Resolve User from Stripe VerificationSession (webhook payload or API object)."""
    if not obj:
        return None
    meta = getattr(obj, "metadata", None)
    if meta is None and isinstance(obj, dict):
        meta = obj.get("metadata")
    meta = meta or {}
    uid = None
    if isinstance(meta, dict):
        uid = meta.get("user_id")
    elif hasattr(meta, "get"):
        uid = meta.get("user_id")
    if uid is not None:
        try:
            return User.objects.filter(pk=int(uid)).first()
        except (ValueError, TypeError):
            return None
    session_id = getattr(obj, "id", None)
    if session_id is None and isinstance(obj, dict):
        session_id = obj.get("id")
    if session_id:
        return User.objects.filter(stripe_identity_session_id=session_id).first()
    return None


def _identity_verification_last_error_present(obj):
    err = getattr(obj, "last_error", None)
    if err is None and isinstance(obj, dict):
        err = obj.get("last_error")
    if not err:
        return False
    if isinstance(err, dict):
        return bool(err)
    return True


def _user_must_verify_identity(user):
    if user.user_type not in (User.UserType.SUBLESSEE, User.UserType.SUBLEASER):
        return False
    return user.identity_verification_status != User.IdentityVerificationStatus.VERIFIED


def _identity_verification_required_response():
    return Response(
        {
            "detail": "Identity verification is required before this action.",
            "code": "identity_verification_required",
        },
        status=status.HTTP_403_FORBIDDEN,
    )

def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _is_sublessee(request):
    return request.user.user_type == User.UserType.SUBLESSEE


def _email_verified(request):
    return request.user.email_verified


def _is_approved_management(request):
    if request.user.user_type != User.UserType.MANAGEMENT:
        return False
    try:
        return request.user.management_company.status == ManagementCompany.Status.APPROVED
    except ManagementCompany.DoesNotExist:
        return False


def _can_manage_booking_requests(request):
    return request.user.user_type == User.UserType.SUBLEASER


def _can_user_update_booking_status(request, booking):
    """Subleaser approves bookings on their own listings without a company; management approves for company-approved listings."""
    listing = booking.listing
    if listing.approved_by_company_id:
        if request.user.user_type != User.UserType.MANAGEMENT or not _is_approved_management(request):
            return False
        try:
            return listing.approved_by_company_id == request.user.management_company.pk
        except ManagementCompany.DoesNotExist:
            return False
    return request.user.user_type == User.UserType.SUBLEASER and listing.owner_id == request.user.pk


def _is_confirmed_group_member(user, group_id):
    return BookingGroupMembership.objects.filter(
        group_id=group_id,
        user=user,
        status=BookingGroupMembership.Status.CONFIRMED,
    ).exists()


def _group_member_count(group_id):
    return BookingGroupMembership.objects.filter(
        group_id=group_id,
        status=BookingGroupMembership.Status.CONFIRMED,
    ).count()


def _group_share_amount(booking):
    dep = booking.security_deposit_snapshot or booking.listing.security_deposit
    if dep is None or dep <= 0:
        return None
    member_count = _group_member_count(booking.group_id) if booking.group_id else 1
    member_count = max(member_count, 1)
    return (Decimal(dep) / Decimal(member_count)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _send_group_invitation_email(group, invitee, inviter):
    try:
        send_mail(
            subject=f"You were invited to join {group.name}",
            message=(
                f"Hi {invitee.first_name or invitee.username},\n\n"
                f"{inviter.get_full_name().strip() or inviter.username} invited you to join "
                f"the Boiler Lease group '{group.name}'.\n\n"
                f"Open your groups page to accept the invitation:\n"
                f"{settings.FRONTEND_URL}/groups\n\n"
                f"The Boiler Lease Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitee.email],
            fail_silently=True,
        )
    except Exception:
        pass


def _send_group_payment_reminders(booking):
    if not booking.group_id:
        return 0
    paid_user_ids = set(
        TransactionRecord.objects.filter(
            booking_reference=str(booking.id),
            status=TransactionRecord.Status.SUCCEEDED,
        ).values_list("user_id", flat=True)
    )
    outstanding = BookingGroupMembership.objects.filter(
        group=booking.group,
        status=BookingGroupMembership.Status.CONFIRMED,
    ).exclude(user_id__in=paid_user_ids).select_related("user")
    sent = 0
    for membership in outstanding:
        try:
            send_mail(
                subject=f"Payment reminder for {booking.listing.title}",
                message=(
                    f"Hi {membership.user.first_name or membership.user.username},\n\n"
                    f"Your group booking for '{booking.listing.title}' is waiting on your share of "
                    f"the security deposit.\n\n"
                    f"Open your groups page to pay:\n{settings.FRONTEND_URL}/groups\n\n"
                    f"The Boiler Lease Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[membership.user.email],
                fail_silently=True,
            )
            sent += 1
        except Exception:
            pass
    return sent


def _update_group_booking_payment_status(booking):
    if not booking.group_id:
        return
    member_ids = set(
        BookingGroupMembership.objects.filter(
            group=booking.group,
            status=BookingGroupMembership.Status.CONFIRMED,
        ).values_list("user_id", flat=True)
    )
    paid_user_ids = set(
        TransactionRecord.objects.filter(
            booking_reference=str(booking.id),
            status=TransactionRecord.Status.SUCCEEDED,
            user_id__in=member_ids,
        ).values_list("user_id", flat=True)
    )
    if member_ids and member_ids.issubset(paid_user_ids):
        booking.status = PropertyBooking.Status.FULLY_PAID
        booking.deposit_paid_at = booking.deposit_paid_at or timezone.now()
        booking.save(update_fields=["status", "deposit_paid_at"])
        try:
            send_mail(
                subject=f"Group booking fully paid: {booking.listing.title}",
                message=(
                    f"The group booking for '{booking.listing.title}' is now fully paid.\n\n"
                    f"Booking dates: {booking.start_date} to {booking.end_date}"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[booking.listing.owner.email],
                fail_silently=True,
            )
        except Exception:
            pass
    elif paid_user_ids and booking.status == PropertyBooking.Status.CONFIRMED:
        booking.status = PropertyBooking.Status.PARTIALLY_PAID
        booking.save(update_fields=["status"])
        _send_group_payment_reminders(booking)


def _get_blocked_user_ids(user):
    blocked_by_me = set(UserBlock.objects.filter(blocker=user).values_list('blocked_user_id', flat=True))
    blocked_me = set(UserBlock.objects.filter(blocked_user=user).values_list('blocker_id', flat=True))
    return blocked_by_me | blocked_me


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
        company_name = request.data.get("company_name", "")
        user = serializer.save()
        if user.user_type == User.UserType.MANAGEMENT:
            ManagementCompany.objects.create(user=user, company_name=company_name)
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
    if _user_must_verify_identity(request.user):
        return _identity_verification_required_response()

    serializer = PropertyListingCreateSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    listing = serializer.save()
    return Response(PropertyListingSerializer(listing).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_listing_media(request, listing_id):
    """Accept a file upload, store it in S3, and create a ListingMedia record."""
    from django.core.files.storage import storages

    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can upload media."},
            status=status.HTTP_403_FORBIDDEN,
        )

    listing = PropertyListing.objects.filter(id=listing_id, deleted_at__isnull=True).first()
    if not listing:
        return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)
    if listing.owner_id != request.user.pk:
        return Response(
            {"detail": "You can only upload media to your own listings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    file = request.FILES.get("file")
    display_order = int(request.data.get("display_order", 0))
    is_primary = str(request.data.get("is_primary", "false")).lower() in ("true", "1")

    if not file:
        return Response(
            {"detail": "file is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate file type and size
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        return Response(
            {"detail": f"Unsupported file type. Allowed: {', '.join(allowed_types)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    max_size = 10 * 1024 * 1024  # 10 MB
    if file.size > max_size:
        return Response(
            {"detail": "File too large. Maximum size is 10 MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Build a unique storage key and upload to S3
    ext = file.name.rsplit(".", 1)[-1] if "." in file.name else "bin"
    storage_key = f"{listing.pk}/{uuid.uuid4().hex}.{ext}"

    try:
        storage = storages["listing_media_public"]
    except KeyError:
        return Response(
            {"detail": "Storage backend not configured. Check AWS settings."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    saved_name = storage.save(storage_key, file)

    base = getattr(settings, "LISTING_MEDIA_PUBLIC_BASE_URL", "")
    if base:
        file_url = f"{base}/{saved_name}"
    else:
        file_url = storage.url(saved_name)

    if is_primary:
        ListingMedia.objects.filter(listing=listing, is_primary=True).update(is_primary=False)

    media = ListingMedia.objects.create(
        listing=listing,
        media_type=ListingMedia.MediaType.IMAGE,
        storage_key=saved_name,
        is_private=False,
        original_filename=file.name,
        content_type=content_type,
        file_size=file.size,
        file_url=file_url,
        upload_status=ListingMedia.UploadStatus.UPLOADED,
        display_order=display_order,
        is_primary=is_primary,
    )

    return Response(ListingMediaSerializer(media).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def set_listing_media_primary(request, listing_id, media_id):
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can update listing media."},
            status=status.HTTP_403_FORBIDDEN,
        )

    listing = PropertyListing.objects.filter(id=listing_id, deleted_at__isnull=True).first()
    if not listing:
        return Response({"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND)
    if listing.owner != request.user:
        return Response(
            {"detail": "You do not have permission to update this listing."},
            status=status.HTTP_403_FORBIDDEN,
        )

    media = ListingMedia.objects.filter(id=media_id, listing=listing).first()
    if not media:
        return Response({"detail": "Listing media not found."}, status=status.HTTP_404_NOT_FOUND)

    ListingMedia.objects.filter(listing=listing, is_primary=True).update(is_primary=False)
    media.is_primary = True
    media.save(update_fields=["is_primary"])
    return Response(PropertyListingSerializer(listing).data, status=status.HTTP_200_OK)


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
    if request.user.user_type not in (User.UserType.SUBLEASER, User.UserType.MANAGEMENT):
        return Response(
            {"detail": "Only subleasers and management companies can access listing amenities."},
            status=status.HTTP_403_FORBIDDEN,
        )
    amenities = ListingAmenity.objects.filter(is_active=True).order_by("label")
    return Response(
        [{"id": amenity.id, "code": amenity.code, "label": amenity.label} for amenity in amenities]
    )



@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_listing_media(request, media_id):
    """Delete a media record and its S3 object."""
    from django.core.files.storage import storages

    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can delete media."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        media = ListingMedia.objects.select_related("listing").get(pk=media_id)
    except ListingMedia.DoesNotExist:
        return Response({"detail": "Media not found."}, status=status.HTTP_404_NOT_FOUND)

    if media.listing.owner_id != request.user.pk:
        return Response(
            {"detail": "You can only delete media from your own listings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Delete from S3 if storage_key exists
    if media.storage_key:
        try:
            bucket_key = "listing_media_private" if media.is_private else "listing_media_public"
            storage = storages[bucket_key]
            storage.delete(media.storage_key)
        except Exception:
            pass  # Best-effort S3 cleanup

    media.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def reorder_listing_media(request):
    """Bulk-update display_order and is_primary for media items.

    Expects JSON body: { "listing_id": <int>, "order": [ { "id": <media_id>, "display_order": <int>, "is_primary": <bool> }, ... ] }
    """
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can reorder media."},
            status=status.HTTP_403_FORBIDDEN,
        )

    listing_id = request.data.get("listing_id")
    order = request.data.get("order")

    if not listing_id or not isinstance(order, list):
        return Response(
            {"detail": "listing_id and order[] are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        listing = PropertyListing.objects.get(pk=listing_id, deleted_at__isnull=True)
    except PropertyListing.DoesNotExist:
        return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)

    if listing.owner_id != request.user.pk:
        return Response(
            {"detail": "You can only reorder media on your own listings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    media_ids = [item["id"] for item in order if "id" in item]
    media_qs = ListingMedia.objects.filter(pk__in=media_ids, listing=listing)
    media_map = {m.pk: m for m in media_qs}

    for item in order:
        media = media_map.get(item.get("id"))
        if not media:
            continue
        media.display_order = int(item.get("display_order", media.display_order))
        media.is_primary = bool(item.get("is_primary", media.is_primary))

    ListingMedia.objects.bulk_update(media_map.values(), ["display_order", "is_primary"])

    from .serializers import ListingMediaSerializer
    updated = ListingMedia.objects.filter(listing=listing).order_by("display_order", "id")
    return Response(ListingMediaSerializer(updated, many=True).data)


# ----- Property Listing Browse (Public) -----


@api_view(["GET"])
@permission_classes([AllowAny])
def browse_property_listings(request):
    """
    Browse available sublease properties with filtering, sorting, and pagination.
    Query parameters: search, price_min, price_max, bedrooms_min, bedrooms_max,
    bathrooms_min, bathrooms_max, city, state, sort_by, page, page_size
    """
    # Base queryset: only published and approved listings
    queryset = PropertyListing.objects.filter(
        status=PropertyListing.ListingStatus.PUBLISHED,
        approval_status=PropertyListing.ApprovalStatus.APPROVED,
        deleted_at__isnull=True,
    )

    # Optimization: select_related and prefetch_related
    queryset = queryset.select_related('owner').prefetch_related(
        Prefetch('media'),
        Prefetch('amenity_links__amenity', queryset=ListingAmenity.objects.filter(is_active=True))
    )

    # Exclude listings from blocked users
    if request.user.is_authenticated:
        blocked_ids = _get_blocked_user_ids(request.user)
        if blocked_ids:
            queryset = queryset.exclude(owner_id__in=blocked_ids)

    # Apply search filter (search across title, description, city, state, postal_code)
    search_query = request.query_params.get('search', '').strip()
    if search_query:
        queryset = queryset.filter(
            Q(title__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(city__icontains=search_query) |
            Q(state__icontains=search_query) |
            Q(postal_code__icontains=search_query)
        )

    # Apply price range filter
    price_min = request.query_params.get('price_min')
    price_max = request.query_params.get('price_max')
    if price_min:
        try:
            queryset = queryset.filter(monthly_rent__gte=int(price_min))
        except (ValueError, TypeError):
            pass
    if price_max:
        try:
            queryset = queryset.filter(monthly_rent__lte=int(price_max))
        except (ValueError, TypeError):
            pass

    # Apply bedroom filter
    bedrooms_min = request.query_params.get('bedrooms_min')
    bedrooms_max = request.query_params.get('bedrooms_max')
    if bedrooms_min:
        try:
            queryset = queryset.filter(bedrooms__gte=float(bedrooms_min))
        except (ValueError, TypeError):
            pass
    if bedrooms_max:
        try:
            queryset = queryset.filter(bedrooms__lte=float(bedrooms_max))
        except (ValueError, TypeError):
            pass

    # Apply bathroom filter
    bathrooms_min = request.query_params.get('bathrooms_min')
    bathrooms_max = request.query_params.get('bathrooms_max')
    if bathrooms_min:
        try:
            queryset = queryset.filter(bathrooms__gte=float(bathrooms_min))
        except (ValueError, TypeError):
            pass
    if bathrooms_max:
        try:
            queryset = queryset.filter(bathrooms__lte=float(bathrooms_max))
        except (ValueError, TypeError):
            pass

    # Apply location filter (city)
    city = request.query_params.get('city', '').strip()
    if city:
        queryset = queryset.filter(city__iexact=city)

    # Apply location filter (state)
    state = request.query_params.get('state', '').strip()
    if state:
        queryset = queryset.filter(state__iexact=state)

    # Apply property type filter
    property_type = request.query_params.get('property_type', '').strip()
    if property_type:
        queryset = queryset.filter(property_type__iexact=property_type)

    # Apply furnished status filter
    furnished_status = request.query_params.get('furnished_status', '').strip()
    if furnished_status:
        queryset = queryset.filter(furnished_status__iexact=furnished_status)

    # Apply boolean filters
    utilities_included = request.query_params.get('utilities_included')
    if utilities_included is not None and utilities_included.lower() in ('true', '1'):
        queryset = queryset.filter(utilities_included=True)

    pets_allowed = request.query_params.get('pets_allowed')
    if pets_allowed is not None and pets_allowed.lower() in ('true', '1'):
        queryset = queryset.filter(pets_allowed=True)

    parking_available = request.query_params.get('parking_available')
    if parking_available is not None and parking_available.lower() in ('true', '1'):
        queryset = queryset.filter(parking_available=True)

    # Apply sorting
    sort_by = request.query_params.get('sort_by', 'availability_start_date')
    valid_sorts = ['availability_start_date', '-availability_start_date', 'monthly_rent', '-monthly_rent', 'created_at', '-created_at']
    if sort_by in valid_sorts:
        queryset = queryset.order_by(sort_by)
    else:
        queryset = queryset.order_by('availability_start_date')

    # Apply pagination
    paginator = PropertyListingPagination()
    paginated_queryset = paginator.paginate_queryset(queryset, request)
    serializer = PropertyListingBrowseSerializer(paginated_queryset, many=True)
    return paginator.get_paginated_response(serializer.data)


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
            Q(sublessee=request.user)
            | Q(
                group__memberships__user=request.user,
                group__memberships__status=BookingGroupMembership.Status.CONFIRMED,
            ),
            end_date__gte=today,
            status__in=[
                PropertyBooking.Status.PENDING,
                PropertyBooking.Status.CONFIRMED,
                PropertyBooking.Status.PARTIALLY_PAID,
                PropertyBooking.Status.FULLY_PAID,
            ],
            listing__deleted_at__isnull=True,
        )
        .select_related("listing")
        .prefetch_related("listing__media")
        .distinct()
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
def my_booking_history(request):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can view booking history."},
            status=status.HTTP_403_FORBIDDEN,
        )

    bookings = (
        PropertyBooking.objects.filter(
            Q(sublessee=request.user)
            | Q(
                group__memberships__user=request.user,
                group__memberships__status=BookingGroupMembership.Status.CONFIRMED,
            ),
            listing__deleted_at__isnull=True,
        )
        .select_related("listing")
        .prefetch_related("listing__media")
        .distinct()
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_booking(request):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can book properties."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if _user_must_verify_identity(request.user):
        return _identity_verification_required_response()

    serializer = PropertyBookingCreateSerializer(
        data=request.data,
        context={"request": request},
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    listing = serializer.validated_data['listing']
    blocked_ids = _get_blocked_user_ids(request.user)
    if listing.owner_id in blocked_ids:
        return Response({'detail': 'Cannot book this listing.'}, status=status.HTTP_403_FORBIDDEN)

    booking = serializer.save()
    try:
        sublessee_name = request.user.get_full_name() or request.user.username
        create_notification(
            listing.owner,
            "booking_request",
            f"New booking request from {sublessee_name}",
            body=f"{sublessee_name} requested to book '{listing.title}'.",
            related_listing_id=listing.id,
            related_booking_id=booking.id,
        )
    except Exception:
        pass
    if listing.approved_by_company_id:
        try:
            company = listing.approved_by_company
            create_notification(
                company.user,
                "booking_request",
                f"New booking on managed property '{listing.title}'",
                body=f"{sublessee_name} submitted a booking request for a property managed by {company.company_name}.",
                related_listing_id=listing.id,
                related_booking_id=booking.id,
            )
        except Exception:
            pass
    response_serializer = PropertyBookingSerializer(
        booking,
        context={"user": request.user},
    )
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def booking_groups(request):
    if not _is_sublessee(request):
        return Response({"detail": "Only sublessees can use booking groups."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        groups = (
            BookingGroup.objects.filter(memberships__user=request.user)
            .prefetch_related("memberships__user")
            .annotate(booking_count=Count("bookings", distinct=True))
            .order_by("-created_at")
            .distinct()
        )
        return Response(BookingGroupSerializer(groups, many=True).data)

    serializer = BookingGroupCreateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    group = BookingGroup.objects.create(name=serializer.validated_data["name"], created_by=request.user)
    BookingGroupMembership.objects.create(
        group=group,
        user=request.user,
        invited_by=request.user,
        status=BookingGroupMembership.Status.CONFIRMED,
        confirmed_at=timezone.now(),
    )
    for invitee in serializer.context.get("invitee_users", []):
        if invitee.id == request.user.id:
            continue
        membership, created = BookingGroupMembership.objects.get_or_create(
            group=group,
            user=invitee,
            defaults={"invited_by": request.user, "status": BookingGroupMembership.Status.INVITED},
        )
        if created:
            _send_group_invitation_email(group, invitee, request.user)
    group = BookingGroup.objects.prefetch_related("memberships__user").get(pk=group.pk)
    return Response(BookingGroupSerializer(group).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_group_detail(request, group_id):
    group = (
        BookingGroup.objects.filter(pk=group_id, memberships__user=request.user)
        .prefetch_related("memberships__user", "bookings__listing")
        .first()
    )
    if not group:
        return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)
    data = BookingGroupSerializer(group).data
    data["bookings"] = PropertyBookingSerializer(
        group.bookings.all().order_by("-booked_at"),
        many=True,
        context={"user": request.user},
    ).data
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invite_booking_group_members(request, group_id):
    group = BookingGroup.objects.filter(pk=group_id, memberships__user=request.user).first()
    if not group or not _is_confirmed_group_member(request.user, group_id):
        return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = BookingGroupInviteSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    for invitee in serializer.context.get("invitee_users", []):
        if invitee.id == request.user.id:
            continue
        membership, created = BookingGroupMembership.objects.get_or_create(
            group=group,
            user=invitee,
            defaults={"invited_by": request.user, "status": BookingGroupMembership.Status.INVITED},
        )
        if created:
            _send_group_invitation_email(group, invitee, request.user)
    group = BookingGroup.objects.prefetch_related("memberships__user").get(pk=group.pk)
    return Response(BookingGroupSerializer(group).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_booking_group_invitation(request, membership_id):
    membership = BookingGroupMembership.objects.filter(pk=membership_id, user=request.user).select_related("group").first()
    if not membership:
        return Response({"detail": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND)
    if membership.status != BookingGroupMembership.Status.CONFIRMED:
        membership.status = BookingGroupMembership.Status.CONFIRMED
        membership.confirmed_at = timezone.now()
        membership.save(update_fields=["status", "confirmed_at"])
    group = BookingGroup.objects.prefetch_related("memberships__user").get(pk=membership.group_id)
    return Response(BookingGroupSerializer(group).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_group_booking(request, group_id):
    if not _is_sublessee(request):
        return Response({"detail": "Only sublessees can create group bookings."}, status=status.HTTP_403_FORBIDDEN)
    if _user_must_verify_identity(request.user):
        return _identity_verification_required_response()
    if not _is_confirmed_group_member(request.user, group_id):
        return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = PropertyBookingCreateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    listing = serializer.validated_data["listing"]
    if listing.owner_id in _get_blocked_user_ids(request.user):
        return Response({"detail": "Cannot book this listing."}, status=status.HTTP_403_FORBIDDEN)
    booking = serializer.save()
    booking.group_id = group_id
    booking.save(update_fields=["group"])
    BookingGroupConfirmation.objects.get_or_create(booking=booking, user=request.user)
    response_serializer = PropertyBookingSerializer(booking, context={"user": request.user})
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_group_booking(request, booking_id):
    booking = PropertyBooking.objects.filter(pk=booking_id, group__isnull=False).select_related("group").first()
    if not booking or not _is_confirmed_group_member(request.user, booking.group_id):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
    BookingGroupConfirmation.objects.get_or_create(booking=booking, user=request.user)
    return Response(PropertyBookingSerializer(booking, context={"user": request.user}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_group_booking_reminders(request, booking_id):
    booking = PropertyBooking.objects.filter(pk=booking_id, group__isnull=False).select_related("group", "listing").first()
    if not booking or not _is_confirmed_group_member(request.user, booking.group_id):
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
    sent = _send_group_payment_reminders(booking)
    return Response({"detail": f"Reminder sent to {sent} outstanding member(s)."})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can cancel bookings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    booking = PropertyBooking.objects.filter(
        pk=booking_id,
        sublessee=request.user,
        listing__deleted_at__isnull=True,
    ).first()
    if not booking:
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

    if booking.status not in (
        PropertyBooking.Status.PENDING,
        PropertyBooking.Status.CONFIRMED,
    ):
        return Response(
            {"detail": "Only pending or confirmed bookings can be canceled."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    booking.status = PropertyBooking.Status.CANCELLED
    booking.save(update_fields=["status"])
    return Response({"detail": "Booking cancelled successfully."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def manageable_bookings(request):
    """Subleaser: bookings on their listings that are not tied to a management company booking-approval flow."""
    if not _can_manage_booking_requests(request):
        return Response(
            {"detail": "Only subleasers can manage booking requests."},
            status=status.HTTP_403_FORBIDDEN,
        )

    bookings = (
        PropertyBooking.objects.filter(
            listing__owner=request.user,
            listing__deleted_at__isnull=True,
        )
        .select_related("listing", "sublessee", "listing__approved_by_company")
        .prefetch_related("listing__media")
        .order_by("status", "-booked_at")
    )
    serializer = ManagedPropertyBookingSerializer(bookings, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def company_manageable_bookings(request):
    """Management company: bookings on listings this company approved (approve before sublessee can pay deposit)."""
    if not _is_approved_management(request):
        return Response(
            {"detail": "Only approved management companies can view these booking requests."},
            status=status.HTTP_403_FORBIDDEN,
        )
    company = request.user.management_company
    bookings = (
        PropertyBooking.objects.filter(
            listing__approved_by_company=company,
            listing__deleted_at__isnull=True,
        )
        .select_related("listing", "sublessee", "listing__owner")
        .prefetch_related("listing__media")
        .order_by("status", "-booked_at")
    )
    serializer = ManagedPropertyBookingSerializer(bookings, many=True)
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_booking_status(request, booking_id):
    booking = (
        PropertyBooking.objects.filter(pk=booking_id, listing__deleted_at__isnull=True)
        .select_related("listing", "sublessee")
        .first()
    )
    if not booking:
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

    if not _can_user_update_booking_status(request, booking):
        return Response(
            {"detail": "You do not have permission to update this booking."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = PropertyBookingStatusUpdateSerializer(instance=booking, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    old_status = booking.status
    serializer.save()
    new_status = booking.status

    if booking.sublessee and new_status != old_status:
        try:
            listing_title = booking.listing.title
            if new_status == PropertyBooking.Status.CONFIRMED:
                create_notification(
                    booking.sublessee,
                    "booking_confirmed",
                    f"Booking confirmed for '{listing_title}'",
                    body="Your booking request has been approved.",
                    related_listing_id=booking.listing_id,
                    related_booking_id=booking.id,
                )
            elif new_status == PropertyBooking.Status.DECLINED:
                create_notification(
                    booking.sublessee,
                    "booking_declined",
                    f"Booking declined for '{listing_title}'",
                    body="Your booking request was not approved.",
                    related_listing_id=booking.listing_id,
                    related_booking_id=booking.id,
                )
        except Exception:
            pass

    response_serializer = ManagedPropertyBookingSerializer(booking)
    return Response(response_serializer.data, status=status.HTTP_200_OK)


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
            Q(sublessee=request.user)
            | Q(
                group__memberships__user=request.user,
                group__memberships__status=BookingGroupMembership.Status.CONFIRMED,
            ),
            listing__deleted_at__isnull=True,
        )
        .select_related("listing")
        .prefetch_related("listing__media")
        .distinct()
    )
    bookings = bookings.filter(
        Q(end_date__lt=today)
        | Q(status__in=[PropertyBooking.Status.DECLINED, PropertyBooking.Status.CANCELLED])
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
def my_payment_history(request):
    """List completed (succeeded) payment transactions for the sublessee."""
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can view payment history."},
            status=status.HTTP_403_FORBIDDEN,
        )
    transactions = list(
        TransactionRecord.objects.filter(
            user=request.user,
            status=TransactionRecord.Status.SUCCEEDED,
        ).order_by("-paid_at", "-created_at")
    )
    booking_ids = []
    for txn in transactions:
        ref = (txn.booking_reference or "").strip()
        if not ref:
            continue
        try:
            booking_ids.append(int(ref))
        except ValueError:
            pass
    titles_by_booking_id = {}
    if booking_ids:
        for b in PropertyBooking.objects.filter(
            pk__in=booking_ids,
            sublessee=request.user,
        ).select_related("listing"):
            titles_by_booking_id[b.pk] = b.listing.title
    serializer = TransactionRecordSerializer(
        transactions,
        many=True,
        context={
            "request": request,
            "listing_titles_by_booking_id": titles_by_booking_id,
        },
    )
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listing_owner_transactions(request, listing_id):
    """Succeeded transactions linked to bookings on this listing (owner / subleaser only)."""
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response(
            {"detail": "Only subleasers can view listing transaction records."},
            status=status.HTTP_403_FORBIDDEN,
        )
    listing = get_object_or_404(
        PropertyListing,
        pk=listing_id,
        owner=request.user,
        deleted_at__isnull=True,
    )
    booking_ids = PropertyBooking.objects.filter(listing=listing).values_list("id", flat=True)
    ref_strings = {str(bid) for bid in booking_ids}
    if not ref_strings:
        return Response([])
    transactions = (
        TransactionRecord.objects.filter(
            status=TransactionRecord.Status.SUCCEEDED,
            booking_reference__in=ref_strings,
        )
        .select_related("user")
        .order_by("-paid_at", "-created_at")
    )
    serializer = OwnerListingTransactionSerializer(transactions, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_identity_verification_session(request):
    """Stripe Identity"""
    user = request.user
    if user.user_type not in (User.UserType.SUBLESSEE, User.UserType.SUBLEASER):
        return Response(
            {"detail": "Identity verification is not required for this account type."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if user.identity_verification_status == User.IdentityVerificationStatus.VERIFIED:
        return Response(
            {"detail": "Your identity is already verified."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not settings.STRIPE_SECRET_KEY:
        return Response(
            {"detail": "Stripe is not configured on the server."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY
    base = settings.FRONTEND_URL.rstrip("/")
    return_url = f"{base}/dashboard?identity_return=1"
    session = stripe.identity.VerificationSession.create(
        type="document",
        metadata={"user_id": str(user.id)},
        return_url=return_url,
    )
    user.stripe_identity_session_id = session.id
    user.identity_verification_status = User.IdentityVerificationStatus.PENDING
    user.save(update_fields=["stripe_identity_session_id", "identity_verification_status"])
    return Response({"url": session.url}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_identity_verification_status(request):
    """Pull latest VerificationSession status from Stripe (e.g. after user returns from hosted flow)."""
    user = request.user
    if user.user_type not in (User.UserType.SUBLESSEE, User.UserType.SUBLEASER):
        return Response(
            {"detail": "Identity verification is not used for this account type."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if user.identity_verification_status == User.IdentityVerificationStatus.VERIFIED:
        return Response(
            {
                "identity_verification_status": user.identity_verification_status,
                "synced": False,
            }
        )
    sid = (user.stripe_identity_session_id or "").strip()
    if not sid or not settings.STRIPE_SECRET_KEY:
        return Response(
            {
                "identity_verification_status": user.identity_verification_status,
                "synced": False,
            }
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        session = stripe.identity.VerificationSession.retrieve(sid)
    except stripe.error.StripeError:
        return Response(
            {"detail": "Could not load verification status from Stripe."},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    vs_status = getattr(session, "status", None) or ""
    last_error = getattr(session, "last_error", None)
    if vs_status == "verified":
        new_status = User.IdentityVerificationStatus.VERIFIED
    elif vs_status == "canceled":
        new_status = User.IdentityVerificationStatus.FAILED
    elif vs_status == "requires_input":
        new_status = (
            User.IdentityVerificationStatus.FAILED
            if last_error
            else User.IdentityVerificationStatus.PENDING
        )
    else:
        new_status = User.IdentityVerificationStatus.PENDING
    if new_status != user.identity_verification_status:
        user.identity_verification_status = new_status
        user.save(update_fields=["identity_verification_status"])
    return Response(
        {
            "identity_verification_status": user.identity_verification_status,
            "synced": True,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_deposit_checkout_session(request):
    """Stripe Checkout for security deposit; optional booking_id uses snapshotted listing deposit."""
    if not _is_sublessee(request):
        return Response(
            {"detail": "Only sublessees can start deposit payments."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not request.user.email_verified:
        return Response(
            {"detail": "Please verify your email before making a payment."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if _user_must_verify_identity(request.user):
        return _identity_verification_required_response()
    if not settings.STRIPE_SECRET_KEY:
        return Response(
            {"detail": "Stripe is not configured on the server."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    booking = None
    booking_ref = ""
    amount_cents = 5000
    raw_bid = request.data.get("booking_id")
    if raw_bid is not None:
        try:
            bid = int(raw_bid)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid booking_id."}, status=status.HTTP_400_BAD_REQUEST)
        booking = (
            PropertyBooking.objects.filter(pk=bid)
            .filter(
                Q(sublessee=request.user)
                | Q(
                    group__memberships__user=request.user,
                    group__memberships__status=BookingGroupMembership.Status.CONFIRMED,
                )
            )
            .select_related("listing", "group")
            .first()
        )
        if not booking:
            return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        if booking.status in (
            PropertyBooking.Status.DECLINED,
            PropertyBooking.Status.CANCELLED,
        ):
            return Response(
                {"detail": "Cannot pay a deposit for this booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not booking.group_id and booking.deposit_paid_at is not None:
            return Response(
                {"detail": "Security deposit for this booking has already been paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.group_id and TransactionRecord.objects.filter(
            booking_reference=str(booking.id),
            user=request.user,
            status=TransactionRecord.Status.SUCCEEDED,
        ).exists():
            return Response(
                {"detail": "Your share for this booking has already been paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.status not in (
            PropertyBooking.Status.CONFIRMED,
            PropertyBooking.Status.PARTIALLY_PAID,
        ):
            return Response(
                {
                    "detail": "You can pay the security deposit only after your booking has been approved.",
                    "code": "booking_not_approved_for_deposit",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        dep = _group_share_amount(booking) if booking.group_id else (booking.security_deposit_snapshot or booking.listing.security_deposit)
        if dep is None or dep <= 0:
            return Response(
                {"detail": "No security deposit amount for this booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        amount_cents = int(dep * 100)
        booking_ref = str(bid)

    txn = TransactionRecord.objects.create(
        user=request.user,
        amount=amount_cents / 100,
        currency="usd",
        booking_reference=booking_ref,
        status=TransactionRecord.Status.PENDING,
    )

    session_metadata = {
        "transaction_id": str(txn.id),
        "user_id": str(request.user.id),
    }
    if booking_ref:
        session_metadata["booking_id"] = booking_ref
        if booking and booking.group_id:
            session_metadata["group_id"] = str(booking.group_id)

    session = stripe.checkout.Session.create(
        mode="payment",
        customer_email=request.user.email,
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount_cents,
                    "product_data": {"name": "Security deposit"},
                },
                "quantity": 1,
            }
        ],
        metadata=session_metadata,
        success_url=f"{settings.FRONTEND_URL}/dashboard?deposit=success",
        cancel_url=f"{settings.FRONTEND_URL}/dashboard?deposit=canceled",
    )
    txn.stripe_checkout_session_id = session.id
    txn.save(update_fields=["stripe_checkout_session_id"])
    return Response({"checkout_url": session.url}, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    if not webhook_secret:
        return Response({"detail": "Webhook secret not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except Exception:
        return Response({"detail": "Invalid webhook payload/signature."}, status=status.HTTP_400_BAD_REQUEST)

    event_type = event.type
    obj = event.data.object

    if event_type == "checkout.session.completed":
        session_id = obj.id
        payment_intent_id = getattr(obj, "payment_intent", None) or ""
        amount_total = getattr(obj, "amount_total", None)

        txn = TransactionRecord.objects.filter(stripe_checkout_session_id=session_id).first()
        if txn:
            if isinstance(amount_total, int):
                txn.amount = amount_total / 100
            txn.status = TransactionRecord.Status.SUCCEEDED
            txn.paid_at = timezone.now()
            txn.stripe_payment_intent_id = payment_intent_id
            txn.save(update_fields=["amount", "status", "paid_at", "stripe_payment_intent_id"])
            ref = (txn.booking_reference or "").strip()
            if ref:
                try:
                    bid = int(ref)
                except ValueError:
                    bid = None
                if bid is not None:
                    booking = PropertyBooking.objects.filter(pk=bid).select_related("group", "listing").first()
                    if booking and booking.group_id:
                        _update_group_booking_payment_status(booking)
                    else:
                        PropertyBooking.objects.filter(
                            pk=bid,
                            sublessee_id=txn.user_id,
                            deposit_paid_at__isnull=True,
                            status=PropertyBooking.Status.CONFIRMED,
                        ).update(deposit_paid_at=timezone.now())

    elif event_type == "checkout.session.expired":
        session_id = obj.id
        txn = TransactionRecord.objects.filter(stripe_checkout_session_id=session_id).first()
        if txn and txn.status == TransactionRecord.Status.PENDING:
            txn.status = TransactionRecord.Status.CANCELED
            txn.save(update_fields=["status"])
    elif event_type == "identity.verification_session.verified":
        user = _user_for_identity_verification_session(obj)
        if user:
            user.identity_verification_status = User.IdentityVerificationStatus.VERIFIED
            user.save(update_fields=["identity_verification_status"])
    elif event_type == "identity.verification_session.canceled":
        user = _user_for_identity_verification_session(obj)
        if user:
            user.identity_verification_status = User.IdentityVerificationStatus.FAILED
            user.save(update_fields=["identity_verification_status"])
    elif event_type == "identity.verification_session.processing":
        user = _user_for_identity_verification_session(obj)
        if user:
            user.identity_verification_status = User.IdentityVerificationStatus.PENDING
            user.save(update_fields=["identity_verification_status"])
    elif event_type == "identity.verification_session.requires_input":
        user = _user_for_identity_verification_session(obj)
        if user:
            if _identity_verification_last_error_present(obj):
                user.identity_verification_status = User.IdentityVerificationStatus.FAILED
            else:
                user.identity_verification_status = User.IdentityVerificationStatus.PENDING
            user.save(update_fields=["identity_verification_status"])

    return Response({"received": True}, status=status.HTTP_200_OK)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([AllowAny])
def property_listing_detail(request, listing_id):
    """
    GET: Retrieve listing details (public or owner access)
    PATCH: Update listing (owner only)
    DELETE: Delete listing (owner only)
    """
    try:
        listing = PropertyListing.objects.get(id=listing_id, deleted_at__isnull=True)
    except PropertyListing.DoesNotExist:
        return Response(
            {"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND
        )

    if request.user.is_authenticated:
        blocked_ids = _get_blocked_user_ids(request.user)
        if listing.owner_id in blocked_ids:
            return Response({'detail': 'Property listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    # GET: Retrieve listing
    if request.method == "GET":
        # Check if sublessee can access this listing
        if _is_sublessee(request):
            if (
                listing.status != PropertyListing.ListingStatus.PUBLISHED
                or listing.approval_status != PropertyListing.ApprovalStatus.APPROVED
            ):
                return Response(
                    {"detail": "Property listing not found."}, status=status.HTTP_404_NOT_FOUND
                )

        data = PropertyListingSerializer(listing).data
        data["is_favorited"] = FavoriteListing.objects.filter(
            user=request.user, listing=listing
        ).exists()
        return Response(data)

    # PATCH: Update listing (owner only)
    elif request.method == "PATCH":
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if request.user.user_type != User.UserType.SUBLEASER:
            return Response(
                {"detail": "Only subleasers can update property listings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if listing.owner != request.user:
            return Response(
                {"detail": "You do not have permission to update this listing."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PropertyListingUpdateSerializer(
            listing, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response(PropertyListingSerializer(listing).data, status=status.HTTP_200_OK)

    # DELETE: Delete listing (owner only)
    elif request.method == "DELETE":
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if request.user.user_type != User.UserType.SUBLEASER:
            return Response(
                {"detail": "Only subleasers can delete property listings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if listing.owner != request.user:
            return Response(
                {"detail": "You do not have permission to delete this listing."},
                status=status.HTTP_403_FORBIDDEN,
            )

        listing.deleted_at = timezone.now()
        listing.save(update_fields=["deleted_at"])

        return Response(
            {"detail": "Listing deleted successfully."},
            status=status.HTTP_200_OK,
        )


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

    blocked_ids = _get_blocked_user_ids(request.user)
    if blocked_ids:
        favorites = favorites.exclude(listing__owner_id__in=blocked_ids)

    favorite_listing_ids = set(favorites.values_list("listing_id", flat=True))
    serializer = FavoriteListingSerializer(
        favorites,
        many=True,
        context={"user": request.user, "favorite_listing_ids": favorite_listing_ids},
    )
    return Response(serializer.data)


# ─── Messaging views ──────────────────────────────────────────────────────────

def _block_exists(user_a, user_b):
    """Return True if either user has blocked the other."""
    return UserBlock.objects.filter(
        Q(blocker=user_a, blocked_user=user_b) | Q(blocker=user_b, blocked_user=user_a)
    ).exists()


def _broadcast_new_message(msg, recipient):
    """Push new message to WebSocket clients via channel layer (best-effort)."""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        message_data = MessageSerializer(msg).data
        # Convert DRF ReturnDict / datetime objects to plain JSON-serialisable dict.
        import json
        from rest_framework.renderers import JSONRenderer
        message_json = json.loads(JSONRenderer().render(message_data))

        group = f"conversation_{msg.conversation_id}"
        async_to_sync(channel_layer.group_send)(
            group,
            {"type": "chat.message", "message": message_json},
        )

        # Also notify the recipient's personal group so their unread badge updates.
        unread_count = Message.objects.filter(
            is_read=False,
            conversation__in=Conversation.objects.filter(
                Q(participant_1=recipient) | Q(participant_2=recipient)
            ).exclude(
                pk__in=ConversationDeletion.objects.filter(user=recipient).values_list(
                    "conversation_id", flat=True
                )
            ),
        ).exclude(sender=recipient).count()

        async_to_sync(channel_layer.group_send)(
            f"user_{recipient.id}",
            {"type": "unread.update", "unread_count": unread_count},
        )
    except Exception:
        pass  # Never let broadcast failures break message delivery


def _get_conversation_for_user(conversation_id, user):
    """Return conversation if user is a participant, else None."""
    return Conversation.objects.filter(
        pk=conversation_id
    ).filter(
        Q(participant_1=user) | Q(participant_2=user)
    ).first()


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def list_conversations(request):
    user = request.user

    if request.method == "GET":
        conversations = (
            Conversation.objects.filter(Q(participant_1=user) | Q(participant_2=user))
            .exclude(deletions__user=user)
            .select_related("participant_1", "participant_2", "listing")
            .order_by("-updated_at")
        )
        serializer = ConversationSerializer(conversations, many=True, context={"request": request})
        return Response(serializer.data)

    # POST — create or retrieve a conversation and send an initial message
    serializer = CreateConversationSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    recipient_id = serializer.validated_data["recipient_id"]
    listing_id = serializer.validated_data.get("listing_id")
    initial_message = serializer.validated_data["initial_message"]

    recipient = User.objects.get(pk=recipient_id)

    if _block_exists(user, recipient):
        return Response({"detail": "You cannot message this user."}, status=status.HTTP_403_FORBIDDEN)

    # Normalize participant order so the UniqueConstraint fires correctly
    p1, p2 = (user, recipient) if user.pk < recipient.pk else (recipient, user)

    listing = None
    if listing_id:
        listing = PropertyListing.objects.filter(pk=listing_id, deleted_at__isnull=True).first()

    conversation, created = Conversation.objects.get_or_create(
        participant_1=p1,
        participant_2=p2,
        listing=listing,
    )

    # If the sender previously deleted this conversation, resurface it
    ConversationDeletion.objects.filter(conversation=conversation, user=user).delete()
    # Also resurface for recipient so it appears in their inbox
    ConversationDeletion.objects.filter(conversation=conversation, user=recipient).delete()

    msg = Message.objects.create(conversation=conversation, sender=user, content=initial_message)
    # Touch updated_at
    Conversation.objects.filter(pk=conversation.pk).update(updated_at=msg.created_at)
    conversation.refresh_from_db()

    _broadcast_new_message(msg, recipient)

    if recipient.message_notifications_enabled:
        try:
            send_new_message_notification(recipient, user, conversation, initial_message)
        except Exception:
            pass

    try:
        sender_name = user.get_full_name() or user.username
        create_notification(
            recipient,
            "new_message",
            f"New message from {sender_name}",
            body=initial_message[:200],
            related_conversation_id=conversation.id,
        )
    except Exception:
        pass

    out_serializer = ConversationSerializer(conversation, context={"request": request})
    return Response(out_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def conversation_detail(request, conversation_id):
    user = request.user
    conversation = _get_conversation_for_user(conversation_id, user)
    if not conversation:
        return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = ConversationSerializer(conversation, context={"request": request})
        return Response(serializer.data)

    # DELETE — soft-delete for this user only
    ConversationDeletion.objects.get_or_create(conversation=conversation, user=user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conversation_id):
    user = request.user
    conversation = _get_conversation_for_user(conversation_id, user)
    if not conversation:
        return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

    # Disallow access if current user has deleted the conversation (unless they're posting)
    if request.method == "GET":
        if ConversationDeletion.objects.filter(conversation=conversation, user=user).exists():
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

        paginator = MessagePagination()
        messages_qs = conversation.messages.select_related("sender").order_by("created_at")
        page = paginator.paginate_queryset(messages_qs, request)
        serializer = MessageSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    # POST — send a new message
    send_serializer = SendMessageSerializer(data=request.data)
    if not send_serializer.is_valid():
        return Response(send_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    recipient = conversation.get_other_participant(user)

    if _block_exists(user, recipient):
        return Response({"detail": "Cannot send message."}, status=status.HTTP_403_FORBIDDEN)

    msg = Message.objects.create(
        conversation=conversation,
        sender=user,
        content=send_serializer.validated_data["content"],
    )
    # Touch updated_at and resurface for both parties
    Conversation.objects.filter(pk=conversation.pk).update(updated_at=msg.created_at)
    ConversationDeletion.objects.filter(conversation=conversation, user__in=[user, recipient]).delete()

    _broadcast_new_message(msg, recipient)

    if recipient.message_notifications_enabled:
        try:
            send_new_message_notification(recipient, user, conversation, msg.content)
        except Exception:
            pass

    try:
        sender_name = user.get_full_name() or user.username
        create_notification(
            recipient,
            "new_message",
            f"New message from {sender_name}",
            body=msg.content[:200],
            related_conversation_id=conversation.id,
        )
    except Exception:
        pass

    return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_messages_read(request, conversation_id):
    user = request.user
    conversation = _get_conversation_for_user(conversation_id, user)
    if not conversation:
        return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

    count = Message.objects.filter(
        conversation=conversation, is_read=False
    ).exclude(sender=user).update(is_read=True)
    return Response({"marked_read": count})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_message_count(request):
    user = request.user
    deleted_conv_ids = ConversationDeletion.objects.filter(user=user).values_list("conversation_id", flat=True)
    count = Message.objects.filter(
        is_read=False,
        conversation__in=Conversation.objects.filter(
            Q(participant_1=user) | Q(participant_2=user)
        ).exclude(pk__in=deleted_conv_ids),
    ).exclude(sender=user).count()
    return Response({"unread_count": count})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def company_status(request):
    if request.user.user_type != User.UserType.MANAGEMENT:
        return Response({"detail": "Only management users can access this."}, status=status.HTTP_403_FORBIDDEN)
    if not _email_verified(request):
        return Response({"detail": "Email verification required."}, status=status.HTTP_403_FORBIDDEN)
    try:
        company = request.user.management_company
    except ManagementCompany.DoesNotExist:
        return Response({"detail": "No company found for this user."}, status=status.HTTP_404_NOT_FOUND)
    return Response(ManagementCompanySerializer(company).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def blocks(request):
    user = request.user

    if request.method == "GET":
        user_blocks = UserBlock.objects.filter(blocker=user).select_related("blocked")
        serializer = UserBlockSerializer(user_blocks, many=True)
        return Response(serializer.data)

    # POST — block a user
    blocked_user_id = request.data.get("blocked_user_id")
    if not blocked_user_id:
        return Response({"detail": "blocked_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    if blocked_user_id == user.pk:
        return Response({"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

    blocked_user = User.objects.filter(pk=blocked_user_id).first()
    if not blocked_user:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    _, created = UserBlock.objects.get_or_create(blocker=user, blocked_user=blocked_user)
    return Response({"detail": "User blocked."}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def block_detail(request, user_id):
    user = request.user

    if request.method == "GET":
        is_blocked = UserBlock.objects.filter(blocker=user, blocked_user__pk=user_id).exists()
        return Response({"is_blocked": is_blocked})

    # DELETE — unblock
    deleted, _ = UserBlock.objects.filter(blocker=user, blocked_user__pk=user_id).delete()
    if not deleted:
        return Response({"detail": "Block not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)
def company_documents(request):
    if request.user.user_type != User.UserType.MANAGEMENT:
        return Response({"detail": "Only management users can access this."}, status=status.HTTP_403_FORBIDDEN)
    if not _email_verified(request):
        return Response({"detail": "Email verification required."}, status=status.HTTP_403_FORBIDDEN)
    try:
        company = request.user.management_company
    except ManagementCompany.DoesNotExist:
        return Response({"detail": "No company found for this user."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        docs = company.documents.all().order_by("-uploaded_at")
        return Response(CompanyDocumentSerializer(docs, many=True).data)
    serializer = CompanyDocumentUploadSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    file = serializer.validated_data["file"]
    doc = CompanyDocument.objects.create(
        company=company,
        file=file,
        document_type=serializer.validated_data["document_type"],
        original_filename=file.name,
    )
    return Response(CompanyDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def company_document_delete(request, pk):
    if request.user.user_type != User.UserType.MANAGEMENT:
        return Response({"detail": "Only management users can access this."}, status=status.HTTP_403_FORBIDDEN)
    if not _email_verified(request):
        return Response({"detail": "Email verification required."}, status=status.HTTP_403_FORBIDDEN)
    try:
        company = request.user.management_company
    except ManagementCompany.DoesNotExist:
        return Response({"detail": "No company found for this user."}, status=status.HTTP_404_NOT_FOUND)
    try:
        doc = company.documents.get(pk=pk)
    except CompanyDocument.DoesNotExist:
        return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
    doc.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def company_guidelines(request):
    """List all guidelines for this company or create a new one."""
    if not _is_approved_management(request):
        return Response({"detail": "Only approved management companies can access this."}, status=status.HTTP_403_FORBIDDEN)
    company = request.user.management_company
    if request.method == "GET":
        guidelines = company.guidelines.all().order_by("name")
        return Response(GuidelineSerializer(guidelines, many=True).data)
    is_valid, error = validate_guideline_data(request.data)
    if not is_valid:
        return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
    serializer = GuidelineSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save(company=company)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def company_guideline_detail(request, pk):
    """Retrieve, update, or delete a single guideline."""
    if not _is_approved_management(request):
        return Response({"detail": "Only approved management companies can access this."}, status=status.HTTP_403_FORBIDDEN)
    company = request.user.management_company
    try:
        guideline = company.guidelines.get(pk=pk)
    except Guideline.DoesNotExist:
        return Response({"detail": "Guideline not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        return Response(GuidelineSerializer(guideline).data)
    if request.method == "DELETE":
        guideline.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    is_valid, error = validate_guideline_data(request.data)
    if not is_valid:
        return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
    serializer = GuidelineSerializer(guideline, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def browse_management_companies(request):
    """List approved management companies with their building guidelines. Supports ?search= on company name."""
    qs = ManagementCompany.objects.filter(status=ManagementCompany.Status.APPROVED).prefetch_related("guidelines")
    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(company_name__icontains=search)
    qs = qs.order_by("company_name")
    return Response(PublicManagementCompanySerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def management_company_detail(request, pk):
    """Retrieve a single approved management company with full guideline details."""
    # TODO: add company information here also
    try:
        company = ManagementCompany.objects.prefetch_related("guidelines").get(
            pk=pk, status=ManagementCompany.Status.APPROVED
        )
    except ManagementCompany.DoesNotExist:
        return Response({"detail": "Company not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(PublicManagementCompanySerializer(company).data)


def _check_guideline_compliance(listing, guideline):
    """Return a list of compliance result dicts for each non-null guideline criterion."""
    results = []

    def _add(field, label, required, actual, passed):
        results.append({"field": field, "label": label, "required": required, "actual": actual, "passed": passed})

    if guideline.min_rent is not None:
        _add("min_rent", "Minimum rent", str(guideline.min_rent), str(listing.monthly_rent),
             listing.monthly_rent >= guideline.min_rent)

    if guideline.max_rent is not None:
        _add("max_rent", "Maximum rent", str(guideline.max_rent), str(listing.monthly_rent),
             listing.monthly_rent <= guideline.max_rent)

    if guideline.min_deposit is not None and listing.security_deposit is not None:
        _add("min_deposit", "Minimum deposit", str(guideline.min_deposit), str(listing.security_deposit),
             listing.security_deposit >= guideline.min_deposit)

    if guideline.max_deposit is not None and listing.security_deposit is not None:
        _add("max_deposit", "Maximum deposit", str(guideline.max_deposit), str(listing.security_deposit),
             listing.security_deposit <= guideline.max_deposit)

    if guideline.min_availability_days is not None:
        from datetime import date
        availability_days = (listing.availability_end_date - listing.availability_start_date).days
        _add("min_availability_days", "Minimum availability (days)", guideline.min_availability_days,
             availability_days, availability_days >= guideline.min_availability_days)

    if guideline.utilities_included is not None:
        _add("utilities_included", "Utilities included", guideline.utilities_included,
             listing.utilities_included, listing.utilities_included == guideline.utilities_included)

    if guideline.pets_allowed is not None:
        _add("pets_allowed", "Pets allowed", guideline.pets_allowed,
             listing.pets_allowed, listing.pets_allowed == guideline.pets_allowed)

    if guideline.furnished_status:
        _add("furnished_status", "Furnished status", guideline.furnished_status,
             listing.furnished_status, listing.furnished_status == guideline.furnished_status)

    if guideline.required_amenities:
        listing_amenity_codes = set(
            listing.amenity_links.values_list("amenity__code", flat=True)
        )
        missing = [code for code in guideline.required_amenities if code not in listing_amenity_codes]
        _add("required_amenities", "Required amenities", guideline.required_amenities,
             list(listing_amenity_codes), len(missing) == 0)

    return results


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_approval_request(request, listing_id):
    """Subleaser submits a listing for approval by a management company."""
    if request.user.user_type != User.UserType.SUBLEASER:
        return Response({"detail": "Only subleasers can submit approval requests."}, status=status.HTTP_403_FORBIDDEN)
    if _user_must_verify_identity(request.user):
        return _identity_verification_required_response()

    try:
        listing = PropertyListing.objects.get(pk=listing_id, owner=request.user, deleted_at__isnull=True)
    except PropertyListing.DoesNotExist:
        return Response({"detail": "Listing not found."}, status=status.HTTP_404_NOT_FOUND)

    if ApprovalRequest.objects.filter(listing=listing, status=ApprovalRequest.Status.PENDING).exists():
        return Response({"detail": "This listing already has a pending approval request."}, status=status.HTTP_400_BAD_REQUEST)

    serializer = ApprovalRequestCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    company = ManagementCompany.objects.get(pk=data["management_company_id"])
    guideline = Guideline.objects.get(pk=data["guideline_id"])

    approval_request = ApprovalRequest.objects.create(
        listing=listing,
        management_company=company,
        guideline=guideline,
        subleaser_notes=data.get("subleaser_notes", ""),
        status=ApprovalRequest.Status.PENDING,
    )

    listing.approval_status = PropertyListing.ApprovalStatus.PENDING
    listing.save(update_fields=["approval_status", "updated_at"])

    return Response(ApprovalRequestSummarySerializer(approval_request).data, status=status.HTTP_201_CREATED)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def company_approval_request_list(request):
    """Management company views their queue of approval requests."""
    if not _is_approved_management(request):
        return Response({"detail": "Only approved management companies can access this."}, status=status.HTTP_403_FORBIDDEN)

    company = request.user.management_company
    qs = ApprovalRequest.objects.filter(management_company=company).select_related(
        "listing", "guideline", "management_company"
    )

    filter_status = request.query_params.get("status", "").strip()
    if filter_status:
        qs = qs.filter(status=filter_status)

    qs = qs.order_by("-created_at")
    return Response(ApprovalRequestSummarySerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def company_approval_request_detail(request, pk):
    """Management company views full detail of one request, including compliance check."""
    if not _is_approved_management(request):
        return Response({"detail": "Only approved management companies can access this."}, status=status.HTTP_403_FORBIDDEN)

    company = request.user.management_company
    try:
        approval_request = ApprovalRequest.objects.select_related(
            "listing__owner", "listing__approved_by_company", "guideline", "management_company"
        ).prefetch_related(
            "listing__amenity_links__amenity", "listing__media"
        ).get(pk=pk, management_company=company)
    except ApprovalRequest.DoesNotExist:
        return Response({"detail": "Approval request not found."}, status=status.HTTP_404_NOT_FOUND)

    serializer = ApprovalRequestDetailSerializer(
        approval_request,
        context={"check_compliance": _check_guideline_compliance},
    )
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def company_review_approval_request(request, pk):
    """Management company approves or rejects an approval request."""
    if not _is_approved_management(request):
        return Response({"detail": "Only approved management companies can access this."}, status=status.HTTP_403_FORBIDDEN)

    company = request.user.management_company
    try:
        approval_request = ApprovalRequest.objects.select_related("listing", "management_company").get(
            pk=pk, management_company=company
        )
    except ApprovalRequest.DoesNotExist:
        return Response({"detail": "Approval request not found."}, status=status.HTTP_404_NOT_FOUND)

    if approval_request.status != ApprovalRequest.Status.PENDING:
        return Response({"detail": "This request has already been reviewed."}, status=status.HTTP_400_BAD_REQUEST)

    action = request.data.get("action", "").strip()
    reviewer_notes = request.data.get("reviewer_notes", "").strip()

    if action not in ("approve", "reject"):
        return Response({"detail": "action must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

    if action == "reject" and not reviewer_notes:
        return Response({"detail": "reviewer_notes is required when rejecting."}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    listing = approval_request.listing

    if action == "approve":
        approval_request.status = ApprovalRequest.Status.APPROVED
        approval_request.reviewer_notes = reviewer_notes
        approval_request.reviewed_at = now
        approval_request.save(update_fields=["status", "reviewer_notes", "reviewed_at", "updated_at"])

        listing.approval_status = PropertyListing.ApprovalStatus.APPROVED
        listing.approved_by_company = company
        listing.status = PropertyListing.ListingStatus.PUBLISHED
        listing.published_at = now
        listing.save(update_fields=["approval_status", "approved_by_company", "status", "published_at", "updated_at"])

        try:
            create_notification(
                listing.owner,
                "listing_approved",
                f"Listing approved: '{listing.title}'",
                body=f"Your listing was approved by {company.company_name} and is now published.",
                related_listing_id=listing.id,
            )
        except Exception:
            pass

    else:  # reject
        approval_request.status = ApprovalRequest.Status.REJECTED
        approval_request.reviewer_notes = reviewer_notes
        approval_request.reviewed_at = now
        approval_request.save(update_fields=["status", "reviewer_notes", "reviewed_at", "updated_at"])

        listing.approval_status = PropertyListing.ApprovalStatus.REJECTED
        listing.save(update_fields=["approval_status", "updated_at"])

        try:
            listing_url = f"{settings.FRONTEND_URL}/my-listings"
            send_mail(
                subject="Your listing was not approved",
                message=(
                    f"Hi {listing.owner.first_name or listing.owner.username},\n\n"
                    f"Unfortunately, your listing '{listing.title}' was not approved by "
                    f"{company.company_name}.\n\n"
                    f"Reason: {reviewer_notes}\n\n"
                    f"You can view your listing and resubmit for approval here:\n{listing_url}\n\n"
                    f"— The BoilerLease Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[listing.owner.email],
                fail_silently=True,
            )
        except Exception:
            pass

        try:
            create_notification(
                listing.owner,
                "listing_rejected",
                f"Listing not approved: '{listing.title}'",
                body=f"Your listing was not approved by {company.company_name}. Reason: {reviewer_notes}",
                related_listing_id=listing.id,
            )
        except Exception:
            pass

    return Response(ApprovalRequestSummarySerializer(approval_request).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def my_profile(request):
    if request.method == "GET":
        serializer = UserProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data)
    serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(UserProfileSerializer(request.user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_profile_picture(request):
    from django.core.files.storage import storages

    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        return Response(
            {"detail": f"Unsupported file type. Allowed: {', '.join(allowed_types)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if file.size > 5 * 1024 * 1024:
        return Response({"detail": "File too large. Maximum size is 5 MB."}, status=status.HTTP_400_BAD_REQUEST)

    ext = file.name.rsplit(".", 1)[-1] if "." in file.name else "jpg"
    storage_key = f"profile-pictures/{request.user.pk}/{uuid.uuid4().hex}.{ext}"

    try:
        storage = storages["listing_media_public"]
    except KeyError:
        return Response({"detail": "Storage backend not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    saved_name = storage.save(storage_key, file)
    base = getattr(settings, "LISTING_MEDIA_PUBLIC_BASE_URL", "")
    file_url = f"{base}/{saved_name}" if base else storage.url(saved_name)

    request.user.profile_picture_url = file_url
    request.user.save(update_fields=["profile_picture_url"])
    return Response({"profile_picture_url": file_url})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_profile(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = UserProfileSerializer(user, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rate_user(request, user_id):
    if request.user.pk == user_id:
        return Response({"detail": "You cannot rate yourself."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rated_user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = UserRatingSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    UserRating.objects.update_or_create(
        rater=request.user,
        rated_user=rated_user,
        defaults={"score": serializer.validated_data["score"]},
    )
    return Response(UserProfileSerializer(rated_user, context={"request": request}).data)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def block_user_toggle(request, user_id):
    if request.user.pk == user_id:
        return Response({"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        UserBlock.objects.filter(blocker=request.user, blocked_user=target).delete()
        return Response({"blocked": False})
    UserBlock.objects.get_or_create(blocker=request.user, blocked_user=target)
    return Response({"blocked": True}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def blocked_users_list(request):
    blocks = UserBlock.objects.filter(blocker=request.user).select_related("blocked_user")
    serializer = BlockedUserSerializer(blocks, many=True)
    return Response(serializer.data)


# ─── Price offer views ────────────────────────────────────────────────────────

def _broadcast_offer_update(offer):
    """Push offer status change to both conversation participants via WebSocket."""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        import json
        from rest_framework.renderers import JSONRenderer

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        offer_data = json.loads(JSONRenderer().render(PriceOfferSerializer(offer).data))
        async_to_sync(channel_layer.group_send)(
            f"conversation_{offer.conversation_id}",
            {"type": "offer.update", "offer": offer_data},
        )
    except Exception:
        pass


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_offer(request, conversation_id):
    """Subleasee submits a price offer within an existing conversation."""
    if not _is_sublessee(request):
        return Response({"detail": "Only sublessees can make offers."}, status=status.HTTP_403_FORBIDDEN)

    conversation = _get_conversation_for_user(conversation_id, request.user)
    if not conversation:
        return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

    if not conversation.listing_id:
        return Response({"detail": "This conversation is not linked to a listing."}, status=status.HTTP_400_BAD_REQUEST)

    listing = PropertyListing.objects.filter(
        pk=conversation.listing_id,
        deleted_at__isnull=True,
        status=PropertyListing.ListingStatus.PUBLISHED,
        approval_status=PropertyListing.ApprovalStatus.APPROVED,
    ).first()
    if not listing:
        return Response({"detail": "Listing is not available for offers."}, status=status.HTTP_400_BAD_REQUEST)

    offered_price = request.data.get("offered_price")
    note = request.data.get("note", "").strip()
    start_date_raw = request.data.get("start_date")
    end_date_raw = request.data.get("end_date")

    try:
        offered_price = float(offered_price)
        if offered_price <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({"detail": "offered_price must be a positive number."}, status=status.HTTP_400_BAD_REQUEST)

    from datetime import date as date_type
    try:
        from datetime import datetime
        start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date() if start_date_raw else None
        end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date() if end_date_raw else None
    except (ValueError, TypeError):
        return Response({"detail": "start_date and end_date must be in YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)

    if not start_date or not end_date:
        return Response({"detail": "start_date and end_date are required."}, status=status.HTTP_400_BAD_REQUEST)
    if end_date < start_date:
        return Response({"detail": "end_date must be on or after start_date."}, status=status.HTTP_400_BAD_REQUEST)
    if start_date < listing.availability_start_date or end_date > listing.availability_end_date:
        return Response(
            {"detail": f"Dates must be within listing availability ({listing.availability_start_date} – {listing.availability_end_date})."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from django.db import transaction
    with transaction.atomic():
        offer = PriceOffer.objects.create(
            conversation=conversation,
            listing=listing,
            sublessee=request.user,
            offered_price=offered_price,
            start_date=start_date,
            end_date=end_date,
            note=note,
            status=PriceOffer.Status.PENDING,
        )
        msg = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=f"Sent a price offer: ${offered_price:,.2f}/mo",
            offer=offer,
        )
        conversation.save(update_fields=["updated_at"])

    recipient = conversation.get_other_participant(request.user)
    _broadcast_new_message(msg, recipient)
    send_offer_received_email(recipient, offer)

    try:
        sublessee_name = request.user.get_full_name() or request.user.username
        create_notification(
            recipient,
            "offer_received",
            f"Price offer from {sublessee_name}",
            body=f"{sublessee_name} offered ${offered_price:,.2f}/mo for '{listing.title}'.",
            related_listing_id=listing.id,
            related_offer_id=offer.id,
            related_conversation_id=conversation.id,
        )
    except Exception:
        pass

    return Response(PriceOfferSerializer(offer).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_offers(request):
    """List offers relevant to the current user, optionally filtered by status."""
    user = request.user
    status_filter = request.query_params.get("status")

    if user.user_type == User.UserType.SUBLESSEE:
        qs = PriceOffer.objects.filter(sublessee=user)
    else:
        qs = PriceOffer.objects.filter(listing__owner=user)

    if status_filter:
        qs = qs.filter(status=status_filter)

    qs = qs.select_related("listing", "sublessee").order_by("-created_at")
    return Response(PriceOfferSerializer(qs, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def respond_to_offer(request, offer_id):
    """Subleaser accepts or declines a pending offer."""
    offer = PriceOffer.objects.select_related("listing", "listing__approved_by_company", "listing__approved_by_company__user", "sublessee", "conversation").filter(pk=offer_id).first()
    if not offer:
        return Response({"detail": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

    if offer.listing.owner_id != request.user.id:
        return Response({"detail": "Only the listing owner can respond to offers."}, status=status.HTTP_403_FORBIDDEN)

    if offer.status != PriceOffer.Status.PENDING:
        return Response({"detail": "This offer has already been responded to."}, status=status.HTTP_400_BAD_REQUEST)

    action = request.data.get("action")
    if action not in ("accepted", "declined"):
        return Response({"detail": "action must be 'accepted' or 'declined'."}, status=status.HTTP_400_BAD_REQUEST)

    offer.status = action
    offer.responded_at = timezone.now()
    offer.save(update_fields=["status", "responded_at"])

    status_label = "accepted" if action == "accepted" else "declined"
    Message.objects.create(
        conversation=offer.conversation,
        sender=request.user,
        content=f"Offer of ${offer.offered_price:,.2f}/mo was {status_label}.",
    )
    offer.conversation.save(update_fields=["updated_at"])

    _broadcast_offer_update(offer)

    if action == "accepted":
        booking = None
        if offer.start_date and offer.end_date:
            booking = PropertyBooking.objects.create(
                listing=offer.listing,
                sublessee=offer.sublessee,
                start_date=offer.start_date,
                end_date=offer.end_date,
                monthly_rent_snapshot=offer.offered_price,
                security_deposit_snapshot=offer.listing.security_deposit,
                status=PropertyBooking.Status.PENDING,
            )
        send_offer_accepted_email(offer.sublessee, offer)
        try:
            create_notification(
                offer.sublessee,
                "offer_accepted",
                f"Your offer was accepted for '{offer.listing.title}'",
                body=f"Your offer of ${offer.offered_price:,.2f}/mo was accepted. A booking request has been created.",
                related_listing_id=offer.listing_id,
                related_booking_id=booking.id if booking else None,
                related_offer_id=offer.id,
                related_conversation_id=offer.conversation_id,
            )
        except Exception:
            pass
        if booking:
            sublessee_name = offer.sublessee.get_full_name() or offer.sublessee.username
            try:
                create_notification(
                    offer.listing.owner,
                    "booking_request",
                    f"New booking request for '{offer.listing.title}'",
                    body=f"{sublessee_name} submitted a booking request via an accepted offer.",
                    related_listing_id=offer.listing_id,
                    related_booking_id=booking.id,
                )
            except Exception:
                pass
            if offer.listing.approved_by_company_id:
                try:
                    company = offer.listing.approved_by_company
                    create_notification(
                        company.user,
                        "booking_request",
                        f"New booking on managed property '{offer.listing.title}'",
                        body=f"{sublessee_name} booked via an accepted offer of ${offer.offered_price:,.2f}/mo.",
                        related_listing_id=offer.listing_id,
                        related_booking_id=booking.id,
                    )
                except Exception:
                    pass
    else:
        send_offer_declined_email(offer.sublessee, offer)
        try:
            create_notification(
                offer.sublessee,
                "offer_declined",
                f"Your offer was declined for '{offer.listing.title}'",
                body=f"Your offer of ${offer.offered_price:,.2f}/mo was declined.",
                related_listing_id=offer.listing_id,
                related_offer_id=offer.id,
                related_conversation_id=offer.conversation_id,
            )
        except Exception:
            pass

    return Response(PriceOfferSerializer(offer).data)


# ── Notifications ──────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    qs = Notification.objects.filter(recipient=request.user).order_by("-created_at")[:50]
    return Response(NotificationSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications_unread_count(request):
    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({"unread_count": count})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    updated = Notification.objects.filter(pk=notification_id, recipient=request.user).update(is_read=True)
    if not updated:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({"ok": True})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def notification_preferences(request):
    prefs, _ = NotificationPreference.objects.get_or_create(user=request.user)
    if request.method == "GET":
        return Response(NotificationPreferenceSerializer(prefs).data)
    serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def company_broadcast(request):
    if not _is_approved_management(request):
        return Response({"detail": "Only approved management companies can broadcast."}, status=status.HTTP_403_FORBIDDEN)

    title = request.data.get("title", "").strip()
    body = request.data.get("body", "").strip()
    listing_id = request.data.get("listing_id")

    if not title:
        return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

    company = request.user.management_company

    listings_qs = PropertyListing.objects.filter(
        approved_by_company=company,
        deleted_at__isnull=True,
    )
    if listing_id:
        listings_qs = listings_qs.filter(id=listing_id)

    listing_ids = list(listings_qs.values_list("id", flat=True))

    # Subleasees with active bookings on managed listings
    bookings_qs = PropertyBooking.objects.filter(
        listing_id__in=listing_ids,
        status__in=[
            PropertyBooking.Status.CONFIRMED,
            PropertyBooking.Status.PARTIALLY_PAID,
            PropertyBooking.Status.FULLY_PAID,
        ],
    ).select_related("sublessee")

    # Subleasers who own managed listings
    subleaser_qs = User.objects.filter(
        property_listings__id__in=listing_ids,
        property_listings__deleted_at__isnull=True,
    ).distinct()

    seen_ids = set()
    count = 0

    for booking in bookings_qs:
        if booking.sublessee_id and booking.sublessee_id not in seen_ids:
            seen_ids.add(booking.sublessee_id)
            try:
                create_notification(booking.sublessee, "broadcast", title, body=body, related_listing_id=booking.listing_id)
                count += 1
            except Exception:
                pass

    for subleaser in subleaser_qs:
        if subleaser.id not in seen_ids:
            seen_ids.add(subleaser.id)
            try:
                create_notification(subleaser, "broadcast", title, body=body)
                count += 1
            except Exception:
                pass

    return Response({"sent_to": count})
