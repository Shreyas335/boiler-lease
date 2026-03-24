from django.db import migrations, models
class Migration(migrations.Migration):
dependencies = [
  ("accounts", "0011_transaction_record"),
]
operations = [
  migrations.AddField(
      model_name="user",
      name="identity_verification_status",
      field=models.CharField(
          choices=[
              ("unverified", "Unverified"),
              ("pending", "Pending"),
              ("verified", "Verified"),
              ("failed", "Failed"),
          ],
          default="unverified",
          max_length=20,
      ),
  ),
  migrations.AddField(
      model_name="user",
      name="stripe_identity_session_id",
      field=models.CharField(blank=True, max_length=255),
  ),
]