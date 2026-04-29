from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_merge_20260427_0254"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BookingGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="created_booking_groups",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="propertybooking",
            name="group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="bookings",
                to="accounts.bookinggroup",
            ),
        ),
        migrations.AlterField(
            model_name="propertybooking",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("confirmed", "Confirmed"),
                    ("partially_paid", "Partially Paid"),
                    ("fully_paid", "Fully Paid"),
                    ("declined", "Declined"),
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="BookingGroupMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[("invited", "Invited"), ("confirmed", "Confirmed")],
                        db_index=True,
                        default="invited",
                        max_length=16,
                    ),
                ),
                ("invited_at", models.DateTimeField(auto_now_add=True)),
                ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="accounts.bookinggroup",
                    ),
                ),
                (
                    "invited_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sent_booking_group_invitations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="booking_group_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="BookingGroupConfirmation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("confirmed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "booking",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="group_confirmations",
                        to="accounts.propertybooking",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="booking_group_confirmations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="bookinggroup",
            index=models.Index(fields=["created_by", "-created_at"], name="grp_creator_created_idx"),
        ),
        migrations.AddConstraint(
            model_name="bookinggroupmembership",
            constraint=models.UniqueConstraint(fields=("group", "user"), name="group_unique_member"),
        ),
        migrations.AddIndex(
            model_name="bookinggroupmembership",
            index=models.Index(fields=["user", "status"], name="grp_member_user_status_idx"),
        ),
        migrations.AddConstraint(
            model_name="bookinggroupconfirmation",
            constraint=models.UniqueConstraint(
                fields=("booking", "user"),
                name="booking_unique_group_confirmation",
            ),
        ),
    ]
