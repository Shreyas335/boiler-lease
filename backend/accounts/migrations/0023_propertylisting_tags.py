from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0022_merge_booking_groups_and_extension_amount"),
    ]

    operations = [
        migrations.AddField(
            model_name="propertylisting",
            name="tags",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
