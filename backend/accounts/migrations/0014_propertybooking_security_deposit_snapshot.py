from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_merge_20260324_2300"),
    ]

    operations = [
        migrations.AddField(
            model_name="propertybooking",
            name="security_deposit_snapshot",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
            ),
        ),
    ]
