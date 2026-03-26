import hashlib
from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import FeedbackSubmission, PasswordResetToken, PropertyListing, User


class AccountEndpointTests(APITestCase):
    def _create_user(self, **overrides):
        payload = {
            "username": "alice",
            "email": "alice@example.com",
            "password": "StrongPassword123!",
            "user_type": User.UserType.SUBLESSEE,
            "first_name": "Alice",
            "last_name": "Tester",
        }
        payload.update(overrides)
        return User.objects.create_user(**payload)

    def test_get_account_returns_authenticated_users_profile_data(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.get("/api/account/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], user.id)
        self.assertEqual(response.data["email"], user.email)
        self.assertEqual(response.data["username"], user.username)
        self.assertEqual(response.data["first_name"], user.first_name)
        self.assertEqual(response.data["last_name"], user.last_name)

    def test_patch_account_with_invalid_data_returns_400_and_errors(self):
        user = self._create_user()
        self._create_user(username="taken_username", email="taken@example.com")
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/account/",
            {"username": "taken_username"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_patch_account_updates_profile_fields(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/account/",
            {
                "first_name": "Alicia",
                "last_name": "Updated",
                "username": "alice_updated",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Alicia")
        self.assertEqual(user.last_name, "Updated")
        self.assertEqual(user.username, "alice_updated")

    def test_patch_account_does_not_allow_email_changes(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/account/",
            {
                "email": "alice.new@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.email, "alice@example.com")

    def test_post_account_password_weak_password_returns_400(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/account/password/",
            {
                "current_password": "StrongPassword123!",
                "new_password": "123",
                "new_password_confirm": "123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_post_account_password_wrong_current_password_returns_400(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/account/password/",
            {
                "current_password": "WrongPassword123!",
                "new_password": "EvenStrongerPassword456!",
                "new_password_confirm": "EvenStrongerPassword456!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_password_change_invalidates_old_password_and_allows_new_password(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        change_response = self.client.post(
            "/api/account/password/",
            {
                "current_password": "StrongPassword123!",
                "new_password": "EvenStrongerPassword456!",
                "new_password_confirm": "EvenStrongerPassword456!",
            },
            format="json",
        )
        self.assertEqual(change_response.status_code, status.HTTP_200_OK)

        old_login_response = self.client.post(
            "/api/auth/login/",
            {"email": user.email, "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(old_login_response.status_code, status.HTTP_400_BAD_REQUEST)

        new_login_response = self.client.post(
            "/api/auth/login/",
            {"email": user.email, "password": "EvenStrongerPassword456!"},
            format="json",
        )
        self.assertEqual(new_login_response.status_code, status.HTTP_200_OK)

    def test_help_feedback_requires_authentication(self):
        response = self.client.post(
            "/api/help/feedback/",
            {"subject": "UI feedback", "message": "Looks good."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_help_feedback_blank_message_returns_validation_error(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/help/feedback/",
            {"subject": "Subject", "message": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.data)

    def test_help_feedback_creates_submission(self):
        user = self._create_user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/help/feedback/",
            {"subject": "Missing filters", "message": "Please add more filters in search."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["detail"], "Feedback submitted successfully.")
        feedback = FeedbackSubmission.objects.get()
        self.assertEqual(feedback.user, user)
        self.assertEqual(feedback.subject, "Missing filters")

    def test_non_staff_user_cannot_access_django_admin_feedback_list(self):
        user = self._create_user(is_staff=False, is_superuser=False)
        self.client.force_login(user)

        response = self.client.get("/admin/accounts/feedbacksubmission/")

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)

    def test_staff_user_can_access_django_admin_feedback_list(self):
        user = self._create_user(
            username="admin_user",
            email="admin@example.com",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_login(user)

        response = self.client.get("/admin/accounts/feedbacksubmission/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def _valid_listing_payload(self):
        return {
            "title": "2BR Near Campus",
            "description": "Spacious unit near Purdue with in-unit laundry and parking.",
            "property_type": "apartment",
            "bedrooms": "2.0",
            "bathrooms": "1.5",
            "square_feet": 920,
            "furnished_status": "partially_furnished",
            "monthly_rent": "1450.00",
            "security_deposit": "700.00",
            "utilities_included": True,
            "availability_start_date": "2026-06-01",
            "availability_end_date": "2026-12-31",
            "lease_term_min_months": 3,
            "lease_term_max_months": 12,
            "pets_allowed": True,
            "smoking_allowed": False,
            "street_line_1": "123 Main St",
            "street_line_2": "Unit 4B",
            "city": "West Lafayette",
            "state": "IN",
            "postal_code": "47906",
            "country_code": "US",
            "latitude": "40.4259",
            "longitude": "-86.9081",
            "unit_number": "4B",
            "building_name": "Boiler Towers",
            "parking_available": True,
            "parking_details": "1 covered spot included",
            "contact_email": "owner@example.com",
            "contact_phone": "765-555-1212",
            "virtual_tour_url": "https://example.com/tour",
            "status": "published",
            "amenity_codes": ["wifi", "parking"],
        }

    def test_subleaser_can_create_listing(self):
        user = self._create_user(
            username="subleaser1",
            email="subleaser1@example.com",
            user_type=User.UserType.SUBLEASER,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post("/api/listings/", self._valid_listing_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "2BR Near Campus")
        self.assertEqual(PropertyListing.objects.count(), 1)
        listing = PropertyListing.objects.get()
        self.assertEqual(listing.owner, user)
        self.assertEqual(listing.city, "West Lafayette")

    def test_non_subleaser_cannot_create_listing(self):
        user = self._create_user(
            username="sublessee1",
            email="sublessee1@example.com",
            user_type=User.UserType.SUBLESSEE,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post("/api/listings/", self._valid_listing_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(PropertyListing.objects.count(), 0)

    def test_create_listing_with_incomplete_details_returns_errors(self):
        user = self._create_user(
            username="subleaser2",
            email="subleaser2@example.com",
            user_type=User.UserType.SUBLEASER,
        )
        self.client.force_authenticate(user=user)
        payload = self._valid_listing_payload()
        payload["title"] = ""
        payload["description"] = ""
        payload.pop("street_line_1")

        response = self.client.post("/api/listings/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)
        self.assertIn("description", response.data)
        self.assertIn("street_line_1", response.data)

    def test_create_listing_with_invalid_date_order_returns_error(self):
        user = self._create_user(
            username="subleaser3",
            email="subleaser3@example.com",
            user_type=User.UserType.SUBLEASER,
        )
        self.client.force_authenticate(user=user)
        payload = self._valid_listing_payload()
        payload["availability_start_date"] = "2026-12-31"
        payload["availability_end_date"] = "2026-06-01"

        response = self.client.post("/api/listings/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("availability_end_date", response.data)

    def test_my_listings_returns_only_current_subleasers_listings(self):
        owner = self._create_user(
            username="subleaser4",
            email="subleaser4@example.com",
            user_type=User.UserType.SUBLEASER,
        )
        other_owner = self._create_user(
            username="subleaser5",
            email="subleaser5@example.com",
            user_type=User.UserType.SUBLEASER,
        )
        PropertyListing.objects.create(
            owner=owner,
            title="Owner Listing",
            description="Owner listing description",
            monthly_rent="1200.00",
            availability_start_date="2026-05-01",
            availability_end_date="2026-08-01",
            street_line_1="111 State St",
            city="West Lafayette",
            state="IN",
            postal_code="47906",
        )
        PropertyListing.objects.create(
            owner=other_owner,
            title="Other Listing",
            description="Other listing description",
            monthly_rent="1300.00",
            availability_start_date="2026-05-01",
            availability_end_date="2026-08-01",
            street_line_1="222 State St",
            city="West Lafayette",
            state="IN",
            postal_code="47906",
        )
        self.client.force_authenticate(user=owner)

        response = self.client.get("/api/listings/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Owner Listing")

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_request_registered_email_sends_message_and_creates_token(self):
        user = self._create_user(
            username="reset_user",
            email="reset_user@example.com",
            user_type=User.UserType.SUBLESSEE,
        )

        response = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertEqual(PasswordResetToken.objects.filter(user=user).count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_password_reset_request_unknown_email_returns_generic_response(self):
        response = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": "unknown@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertEqual(PasswordResetToken.objects.count(), 0)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_confirm_valid_token_changes_password(self):
        user = self._create_user(
            username="reset_confirm_user",
            email="reset_confirm_user@example.com",
            password="StrongPassword123!",
            user_type=User.UserType.SUBLESSEE,
        )
        request_response = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": user.email},
            format="json",
        )
        self.assertEqual(request_response.status_code, status.HTTP_200_OK)

        self.assertEqual(len(mail.outbox), 1)
        email_body = mail.outbox[0].body
        token = email_body.split("token=")[1].splitlines()[0]

        confirm_response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": token,
                "new_password": "EvenStrongerPassword456!",
                "new_password_confirm": "EvenStrongerPassword456!",
            },
            format="json",
        )
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)

        old_login = self.client.post(
            "/api/auth/login/",
            {"email": user.email, "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_400_BAD_REQUEST)

        new_login = self.client.post(
            "/api/auth/login/",
            {"email": user.email, "password": "EvenStrongerPassword456!"},
            format="json",
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm_invalid_token_fails(self):
        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": "invalid-token",
                "new_password": "EvenStrongerPassword456!",
                "new_password_confirm": "EvenStrongerPassword456!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_password_reset_confirm_expired_token_fails(self):
        user = self._create_user(
            username="expired_reset_user",
            email="expired_reset_user@example.com",
            user_type=User.UserType.SUBLESSEE,
        )
        raw_token = "expired-token"
        PasswordResetToken.objects.create(
            user=user,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": raw_token,
                "new_password": "EvenStrongerPassword456!",
                "new_password_confirm": "EvenStrongerPassword456!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
