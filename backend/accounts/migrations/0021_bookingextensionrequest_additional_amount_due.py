from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0020_booking_extension_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookingextensionrequest",
            name="additional_amount_due",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
