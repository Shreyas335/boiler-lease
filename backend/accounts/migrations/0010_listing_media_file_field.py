from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_feedbacksubmission_rating"),
    ]

    operations = [
        migrations.AddField(
            model_name="listingmedia",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to="listing_media/"),
        ),
        migrations.AlterField(
            model_name="listingmedia",
            name="file_url",
            field=models.URLField(blank=True),
        ),
    ]
