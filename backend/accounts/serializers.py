from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "user_type",
            "first_name",
            "last_name",
            "email_verified",
            "two_factor_enabled",
        )
        read_only_fields = (
            "id",
            "username",
            "email",
            "user_type",
            "first_name",
            "last_name",
            "email_verified",
            "two_factor_enabled",
        )


class AccountUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("username", "first_name", "last_name")
        extra_kwargs = {
            "username": {"required": False},
            "first_name": {"required": False},
            "last_name": {"required": False},
        }

    def validate_username(self, value):
        user = self.instance
        if value and User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        # Import here to avoid shadowing DRF's ValidationError with Django's.
        from django.core.exceptions import ValidationError as DjangoValidationError

        user = self.context["request"].user
        current_password = attrs["current_password"]
        new_password = attrs["new_password"]
        new_password_confirm = attrs["new_password_confirm"]

        if not user.check_password(current_password):
            raise serializers.ValidationError(
                {"current_password": ["Current password is incorrect."]}
            )

        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": ["New passwords do not match."]}
            )

        if new_password == current_password:
            raise serializers.ValidationError(
                {"new_password": ["New password must be different from current password."]}
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm", "user_type", "first_name", "last_name")

    def validate(self, data):
        # Validate required fields
        required_fields = ["username", "email", "password", "password_confirm", "user_type"]
        for field in required_fields:
            if not data.get(field):
                raise serializers.ValidationError({field: f"{field.replace('_', ' ').title()} is required."})
        
        # Validate password match
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        
        # Validate email uniqueness
        if User.objects.filter(email=data["email"]).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})
        
        # Validate username uniqueness
        if User.objects.filter(username=data["username"]).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})
        
        # Validate user type
        valid_types = [choice[0] for choice in User.UserType.choices]
        if data["user_type"] not in valid_types:
            raise serializers.ValidationError({"user_type": f"Must be one of: {', '.join(valid_types)}"})
        
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            raise serializers.ValidationError("Email and password are required.")

        user = User.objects.filter(email=email).first()
        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

        data["user"] = user
        return data


class TwoFactorSetupSerializer(serializers.Serializer):
    """Response: secret and qr_code_url for authenticator app."""

    secret = serializers.CharField(read_only=True)
    qr_code_url = serializers.CharField(read_only=True)


class TwoFactorConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=8, min_length=6)

    def validate_code(self, value):
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise serializers.ValidationError("Code must be 6 digits.")
        return value


class TwoFactorVerifyLoginSerializer(serializers.Serializer):
    temp_token = serializers.CharField()
    code = serializers.CharField(max_length=8, min_length=6)

    def validate_code(self, value):
        value = value.strip().replace(" ", "")
        if not value.isdigit():
            raise serializers.ValidationError("Code must be 6 digits.")
        return value
