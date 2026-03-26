from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_password_reset_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="PropertyBooking",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("monthly_rent_snapshot", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("booked_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "listing",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bookings", to="accounts.propertylisting"),
                ),
                (
                    "sublessee",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="property_bookings", to="accounts.user"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="FavoriteListing",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "listing",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorited_by", to="accounts.propertylisting"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorite_listings", to="accounts.user"),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="propertybooking",
            constraint=models.CheckConstraint(
                check=models.Q(start_date__lte=models.F("end_date")),
                name="booking_dates_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="propertybooking",
            constraint=models.UniqueConstraint(
                fields=("sublessee", "listing", "start_date", "end_date"),
                name="booking_unique_window",
            ),
        ),
        migrations.AddIndex(
            model_name="propertybooking",
            index=models.Index(fields=["sublessee", "end_date"], name="booking_user_end_date_idx"),
        ),
        migrations.AddIndex(
            model_name="propertybooking",
            index=models.Index(fields=["sublessee", "-booked_at"], name="booking_user_booked_at_idx"),
        ),
        migrations.AddConstraint(
            model_name="favoritelisting",
            constraint=models.UniqueConstraint(fields=("user", "listing"), name="favorite_listing_unique"),
        ),
        migrations.AddIndex(
            model_name="favoritelisting",
            index=models.Index(fields=["user", "-created_at"], name="favorite_user_created_idx"),
        ),
    ]
