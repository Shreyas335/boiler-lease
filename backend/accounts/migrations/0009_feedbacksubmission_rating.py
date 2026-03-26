from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_property_booking_and_favorites"),
    ]

    operations = [
        migrations.AddField(
            model_name="feedbacksubmission",
            name="rating",
            field=models.PositiveSmallIntegerField(
                default=5,
                validators=[MinValueValidator(1), MaxValueValidator(5)],
            ),
        ),
    ]
