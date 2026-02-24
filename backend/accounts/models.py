from django.contrib.auth.models import AbstractUser
from django.db import models


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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        if self.subject:
            return self.subject
        return f"Feedback #{self.pk}"
