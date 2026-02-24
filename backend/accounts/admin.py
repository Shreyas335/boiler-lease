from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    FeedbackSubmission,
    ListingAmenity,
    ListingAmenityMap,
    ListingMedia,
    PasswordResetToken,
    PropertyListing,
    User,
)


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


@admin.register(PropertyListing)
class PropertyListingAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "city", "state", "monthly_rent", "status", "created_at")
    list_filter = ("status", "property_type", "approval_status", "city", "state")
    search_fields = ("title", "description", "owner__email", "owner__username", "city", "state", "postal_code")


@admin.register(ListingAmenity)
class ListingAmenityAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "category", "is_active")
    list_filter = ("is_active", "category")
    search_fields = ("code", "label", "category")


@admin.register(ListingAmenityMap)
class ListingAmenityMapAdmin(admin.ModelAdmin):
    list_display = ("listing", "amenity", "created_at")
    list_filter = ("amenity",)
    search_fields = ("listing__title", "amenity__label")


@admin.register(ListingMedia)
class ListingMediaAdmin(admin.ModelAdmin):
    list_display = ("listing", "media_type", "is_primary", "display_order", "created_at")
    list_filter = ("media_type", "is_primary")
    search_fields = ("listing__title", "file_url", "thumbnail_url")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "used_at", "created_at")
    search_fields = ("user__email", "user__username")
    readonly_fields = ("user", "token_hash", "expires_at", "used_at", "created_at")

    def has_add_permission(self, request):
        return False
