from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf/", views.csrf_cookie),
    path("auth/register/", views.register),
    path("auth/login/", views.login_view),
    path("auth/logout/", views.logout_view),
    path("auth/password-reset/request/", views.password_reset_request),
    path("auth/password-reset/confirm/", views.password_reset_confirm),
    path("auth/me/", views.current_user),
    path("account/", views.current_user),
    path("account/password/", views.change_password),
    path("auth/2fa/", views.verify_2fa_login),
    path("auth/send-verification-email/", views.send_verification_email_view),
    path("auth/verify-email/", views.verify_email_view),
    path("account/settings/", views.account_settings),
    path("account/2fa/enable/", views.two_factor_enable),
    path("account/2fa/disable/", views.two_factor_disable),
    path("help/feedback/", views.submit_help_feedback),
    path("listings/browse/", views.browse_property_listings),
    path("listings/", views.create_property_listing),
    path("listings/mine/", views.my_property_listings),
    path("listings/amenities/", views.listing_amenities),
    path("listings/<int:listing_id>/delete/", views.delete_property_listing),
    path("listings/<int:listing_id>/", views.update_property_listing),
]
