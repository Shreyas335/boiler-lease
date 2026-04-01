from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0014_propertybooking_security_deposit_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="propertybooking",
            name="deposit_paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
