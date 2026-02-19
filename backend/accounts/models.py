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
