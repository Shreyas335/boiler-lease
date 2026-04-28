# Booking extension requests (User Story 6)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_merge_20260403_booking_deposit_and_user_profile"),
    ]

    operations = [
        migrations.CreateModel(
            name="BookingExtensionRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("requested_end_date", models.DateField()),
                ("sublessee_notes", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("approved", "Approved"), ("declined", "Declined")],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("reviewer_notes", models.TextField(blank=True, default="")),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "booking",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="extension_requests",
                        to="accounts.propertybooking",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="bookingextensionrequest",
            index=models.Index(fields=["booking", "status"], name="extreq_booking_status_idx"),
        ),
    ]
