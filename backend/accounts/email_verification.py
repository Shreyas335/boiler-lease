"""Send email verification link."""
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


def send_verification_email(user):
    """Generate token, save on user, send email with link to frontend verify-email page."""
    from .models import User

    token = user.email_verification_token
    if not token:
        import secrets
        token = secrets.token_urlsafe(32)
        # Ensure uniqueness
        while User.objects.filter(email_verification_token=token).exists():
            token = secrets.token_urlsafe(32)
        user.email_verification_token = token
        user.email_verification_sent_at = timezone.now()
        user.save(update_fields=["email_verification_token", "email_verification_sent_at"])

    # Link goes to backend; backend verifies and redirects to frontend (avoids CORS when opening from email)
    verify_url = f"{settings.BACKEND_URL}/api/auth/verify-email/?token={token}"
    subject = "Verify your Boiler Lease email"
    message = (
        f"Hi {user.get_full_name() or user.username},\n\n"
        f"Please verify your email by clicking this link:\n{verify_url}\n\n"
        "If you didn't create an account, you can ignore this email.\n\n"
        "— Boiler Lease"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_2fa_code_email(user, code):
    """Send the 6-digit 2FA login code to the user's email."""
    subject = "Your Boiler Lease login code"
    message = (
        f"Hi {user.get_full_name() or user.username},\n\n"
        f"Your one-time login code is: {code}\n\n"
        "This code expires in 5 minutes. If you didn't request it, you can ignore this email.\n\n"
        "— Boiler Lease"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_password_reset_email(user, raw_token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    subject = "Reset your Boiler Lease password"
    message = (
        f"Hi {user.get_full_name() or user.username},\n\n"
        "We received a request to reset your password.\n"
        f"Reset it here: {reset_url}\n\n"
        "This link expires in 30 minutes. If you didn't request this, you can ignore this email.\n\n"
        "— Boiler Lease"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_new_message_notification(recipient, sender, conversation, message_content_preview):
    """Send email notification to recipient when they receive a new message."""
    inbox_url = f"{settings.FRONTEND_URL}/messages/{conversation.pk}"
    sender_display = sender.get_full_name() or sender.username
    preview = message_content_preview[:120]
    subject = f"New message from {sender_display} — Boiler Lease"
    message = (
        f"Hi {recipient.get_full_name() or recipient.username},\n\n"
        f"You have a new message from {sender_display}:\n\n"
        f'"{preview}"\n\n'
        f"View the conversation here: {inbox_url}\n\n"
        "To turn off these notifications, go to Account Settings.\n\n"
        "— Boiler Lease"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient.email],
        fail_silently=True,
    )
