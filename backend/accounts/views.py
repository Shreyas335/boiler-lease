import random
import secrets
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.core.cache import cache
from django.conf import settings
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .email_verification import send_2fa_code_email, send_verification_email
from .models import User
from .serializers import (
    AccountUpdateSerializer,
    FeedbackSubmissionSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
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
