from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "user_type", "is_staff")
    list_filter = ("user_type", "is_staff", "is_superuser")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("User Type", {"fields": ("user_type",)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("User Type", {"fields": ("user_type",)}),
    )
