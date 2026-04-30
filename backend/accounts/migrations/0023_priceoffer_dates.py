from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0022_notification_notificationpreference"),
    ]

    operations = [
        migrations.AddField(
            model_name="priceoffer",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="priceoffer",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
