# Merge migration: parallel 0018 heads (booking/deposit merge vs user profile fields).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0018_merge_20260329_booking_deposit_and_approval"),
        ("accounts", "0018_user_bio_user_contact_phone_user_profile_picture_url_and_more"),
    ]

    operations = []
