from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf/", views.csrf_cookie),
    path("auth/register/", views.register),
    path("auth/login/", views.login_view),
    path("auth/logout/", views.logout_view),
    path("auth/me/", views.current_user),
    path("auth/2fa/", views.verify_2fa_login),
    path("auth/send-verification-email/", views.send_verification_email_view),
    path("auth/verify-email/", views.verify_email_view),
    path("account/settings/", views.account_settings),
    path("account/2fa/enable/", views.two_factor_enable),
    path("account/2fa/disable/", views.two_factor_disable),
]
