from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_alter_propertylisting_approval_status"),
        ("accounts", "0010_listing_media_file_field"),
    ]

    operations = [
        migrations.CreateModel(
            name="TransactionRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("currency", models.CharField(default="usd", max_length=8)),
                ("booking_reference", models.CharField(blank=True, max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("succeeded", "Succeeded"),
                            ("failed", "Failed"),
                            ("canceled", "Canceled"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("stripe_payment_intent_id", models.CharField(blank=True, max_length=128)),
                ("stripe_checkout_session_id", models.CharField(blank=True, max_length=128)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="transactions",
                        to="accounts.user",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="transactionrecord",
            index=models.Index(fields=["user", "-created_at"], name="txn_user_created_idx"),
        ),
        migrations.AddIndex(
            model_name="transactionrecord",
            index=models.Index(fields=["status", "-created_at"], name="txn_status_created_idx"),
        ),
    ]
