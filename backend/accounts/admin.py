from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import FeedbackSubmission, User


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


@admin.register(FeedbackSubmission)
class FeedbackSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "subject", "created_at")
    search_fields = ("subject", "message", "user__email", "user__username")
    list_filter = ("created_at",)
    readonly_fields = ("user", "subject", "message", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.is_staff
