# Generated manually for Subleaser Listing Creation story

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_listing_amenities(apps, schema_editor):
    ListingAmenity = apps.get_model("accounts", "ListingAmenity")
    seed_data = [
        ("wifi", "Wi-Fi", "utilities"),
        ("laundry", "Laundry", "building"),
        ("parking", "Parking", "building"),
        ("ac", "Air Conditioning", "comfort"),
        ("heating", "Heating", "comfort"),
        ("furnished", "Furnished", "interior"),
        ("pets_allowed", "Pets Allowed", "policy"),
        ("gym", "Gym", "building"),
        ("elevator", "Elevator", "building"),
    ]
    for code, label, category in seed_data:
        ListingAmenity.objects.get_or_create(
            code=code,
            defaults={"label": label, "category": category, "is_active": True},
        )


def unseed_listing_amenities(apps, schema_editor):
    ListingAmenity = apps.get_model("accounts", "ListingAmenity")
    ListingAmenity.objects.filter(
        code__in=[
            "wifi",
            "laundry",
            "parking",
            "ac",
            "heating",
            "furnished",
            "pets_allowed",
            "gym",
            "elevator",
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_feedbacksubmission"),
    ]

    operations = [
        migrations.CreateModel(
            name="ListingAmenity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=60, unique=True)),
                ("label", models.CharField(max_length=100)),
                ("category", models.CharField(blank=True, max_length=80)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ("label",)},
        ),
        migrations.CreateModel(
            name="PropertyListing",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(db_index=True, max_length=200)),
                ("description", models.TextField()),
                (
                    "property_type",
                    models.CharField(
                        choices=[
                            ("apartment", "Apartment"),
                            ("house", "House"),
                            ("condo", "Condo"),
                            ("studio", "Studio"),
                            ("other", "Other"),
                        ],
                        default="apartment",
                        max_length=20,
                    ),
                ),
                ("bedrooms", models.DecimalField(decimal_places=1, default=1, max_digits=4)),
                ("bathrooms", models.DecimalField(decimal_places=1, default=1, max_digits=4)),
                ("square_feet", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "furnished_status",
                    models.CharField(
                        choices=[
                            ("furnished", "Furnished"),
                            ("unfurnished", "Unfurnished"),
                            ("partially_furnished", "Partially Furnished"),
                        ],
                        default="unfurnished",
                        max_length=24,
                    ),
                ),
                ("monthly_rent", models.DecimalField(decimal_places=2, max_digits=10)),
                ("security_deposit", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("utilities_included", models.BooleanField(default=False)),
                ("availability_start_date", models.DateField()),
                ("availability_end_date", models.DateField()),
                ("lease_term_min_months", models.PositiveIntegerField(blank=True, null=True)),
                ("lease_term_max_months", models.PositiveIntegerField(blank=True, null=True)),
                ("pets_allowed", models.BooleanField(default=False)),
                ("smoking_allowed", models.BooleanField(default=False)),
                ("street_line_1", models.CharField(max_length=255)),
                ("street_line_2", models.CharField(blank=True, max_length=255)),
                ("city", models.CharField(db_index=True, max_length=100)),
                ("state", models.CharField(db_index=True, max_length=100)),
                ("postal_code", models.CharField(db_index=True, max_length=20)),
                ("country_code", models.CharField(default="US", max_length=2)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("unit_number", models.CharField(blank=True, max_length=40)),
                ("building_name", models.CharField(blank=True, max_length=140)),
                ("parking_available", models.BooleanField(default=False)),
                ("parking_details", models.CharField(blank=True, max_length=255)),
                ("contact_email", models.EmailField(blank=True, max_length=254)),
                ("contact_phone", models.CharField(blank=True, max_length=30)),
                ("virtual_tour_url", models.URLField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("published", "Published"),
                            ("unpublished", "Unpublished"),
                            ("archived", "Archived"),
                        ],
                        default="draft",
                        max_length=16,
                    ),
                ),
                (
                    "approval_status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="property_listings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["owner", "status", "-created_at"], name="listing_owner_status_idx"),
                    models.Index(
                        fields=["city", "state", "monthly_rent", "availability_start_date"],
                        name="listing_search_idx",
                    ),
                ]
            },
        ),
        migrations.CreateModel(
            name="ListingMedia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "media_type",
                    models.CharField(
                        choices=[("image", "Image"), ("video", "Video")],
                        default="image",
                        max_length=16,
                    ),
                ),
                ("file_url", models.URLField()),
                ("thumbnail_url", models.URLField(blank=True)),
                ("display_order", models.IntegerField(default=0)),
                ("is_primary", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "listing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="media",
                        to="accounts.propertylisting",
                    ),
                ),
            ],
            options={"ordering": ("display_order", "id")},
        ),
        migrations.CreateModel(
            name="ListingAmenityMap",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "amenity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="listing_links",
                        to="accounts.listingamenity",
                    ),
                ),
                (
                    "listing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="amenity_links",
                        to="accounts.propertylisting",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="propertylisting",
            constraint=models.CheckConstraint(
                check=models.Q(availability_start_date__lte=models.F("availability_end_date")),
                name="listing_dates_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="propertylisting",
            constraint=models.CheckConstraint(
                check=models.Q(monthly_rent__gte=0),
                name="listing_monthly_rent_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="propertylisting",
            constraint=models.CheckConstraint(
                check=models.Q(security_deposit__gte=0) | models.Q(security_deposit__isnull=True),
                name="listing_security_deposit_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="propertylisting",
            constraint=models.CheckConstraint(
                check=models.Q(bedrooms__gte=0),
                name="listing_bedrooms_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="propertylisting",
            constraint=models.CheckConstraint(
                check=models.Q(bathrooms__gte=0),
                name="listing_bathrooms_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="listingamenitymap",
            constraint=models.UniqueConstraint(fields=("listing", "amenity"), name="listing_amenity_unique"),
        ),
        migrations.AddConstraint(
            model_name="listingmedia",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_primary=True),
                fields=("listing",),
                name="listing_one_primary_media",
            ),
        ),
        migrations.RunPython(seed_listing_amenities, unseed_listing_amenities),
    ]
