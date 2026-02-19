from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "user_type", "first_name", "last_name")
        read_only_fields = ("id", "username", "email", "user_type", "first_name", "last_name")


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
