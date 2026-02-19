from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with user type for sublessee, subleaser, or management company."""

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

    class Meta:
        db_table = "accounts_user"
