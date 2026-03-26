from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0010_alter_propertylisting_approval_status"),
        ("accounts", "0010_listing_media_file_field"),
    ]

    operations = [
        migrations.AddField(
            model_name="propertybooking",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("confirmed", "Confirmed"),
                    ("declined", "Declined"),
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="pending",
                max_length=16,
            ),
        ),
    ]
