from django.db import migrations


def backfill_fee_snapshots(apps, schema_editor):
    """
    Best-effort backfill: any confirmed/paid booking without fee snapshots
    gets the current fee config from its listing's approved_by_company.

    This is a one-time fix for bookings that were confirmed before the
    snapshot code existed. Going forward, snapshots are written at
    confirmation time so fee changes never retroactively affect bookings.
    """
    PropertyBooking = apps.get_model("accounts", "PropertyBooking")

    eligible_statuses = ("confirmed", "partially_paid", "fully_paid")
    bookings = PropertyBooking.objects.filter(
        status__in=eligible_statuses,
        platform_fee_percentage_snapshot__isnull=True,
        platform_fee_flat_snapshot__isnull=True,
    ).select_related("listing__approved_by_company__fee_config")

    for b in bookings:
        if not b.listing.approved_by_company_id:
            continue
        try:
            cfg = b.listing.approved_by_company.fee_config
        except Exception:
            continue
        b.platform_fee_percentage_snapshot = cfg.platform_fee_percentage
        b.platform_fee_flat_snapshot = cfg.platform_fee_flat
        b.save(update_fields=[
            "platform_fee_percentage_snapshot",
            "platform_fee_flat_snapshot",
        ])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0025_merge_20260430_0634"),
    ]

    operations = [
        migrations.RunPython(backfill_fee_snapshots, noop_reverse),
    ]
