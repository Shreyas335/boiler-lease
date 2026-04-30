from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0021_priceoffer"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notification_type", models.CharField(
                    choices=[
                        ("new_message", "New Message"),
                        ("booking_request", "Booking Request"),
                        ("booking_confirmed", "Booking Confirmed"),
                        ("booking_declined", "Booking Declined"),
                        ("offer_received", "Offer Received"),
                        ("offer_accepted", "Offer Accepted"),
                        ("offer_declined", "Offer Declined"),
                        ("listing_approved", "Listing Approved"),
                        ("listing_rejected", "Listing Rejected"),
                        ("broadcast", "Broadcast"),
                    ],
                    db_index=True,
                    max_length=32,
                )),
                ("title", models.CharField(max_length=200)),
                ("body", models.TextField(blank=True)),
                ("is_read", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("related_listing_id", models.IntegerField(blank=True, null=True)),
                ("related_booking_id", models.IntegerField(blank=True, null=True)),
                ("related_offer_id", models.IntegerField(blank=True, null=True)),
                ("related_conversation_id", models.IntegerField(blank=True, null=True)),
                ("recipient", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="notifications",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="NotificationPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("new_message", models.BooleanField(default=True)),
                ("booking_request", models.BooleanField(default=True)),
                ("booking_confirmed", models.BooleanField(default=True)),
                ("booking_declined", models.BooleanField(default=True)),
                ("offer_received", models.BooleanField(default=True)),
                ("offer_accepted", models.BooleanField(default=True)),
                ("offer_declined", models.BooleanField(default=True)),
                ("listing_approved", models.BooleanField(default=True)),
                ("listing_rejected", models.BooleanField(default=True)),
                ("broadcast", models.BooleanField(default=True)),
                ("user", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="notification_preferences",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
