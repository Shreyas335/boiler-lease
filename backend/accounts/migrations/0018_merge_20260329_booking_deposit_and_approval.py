# Merge migration: parallel branches (booking deposit vs management/approval listing fields).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_propertybooking_deposit_paid_at"),
        ("accounts", "0017_alter_propertylisting_approval_status"),
    ]

    operations = []
