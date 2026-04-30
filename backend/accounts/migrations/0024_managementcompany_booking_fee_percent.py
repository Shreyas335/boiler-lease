from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0023_propertylisting_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="managementcompany",
            name="booking_fee_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Fee applied to the rent portion of a booking for listings approved by this company (0–100).",
                max_digits=5,
            ),
        ),
    ]
