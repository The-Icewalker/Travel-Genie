from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'role_name']


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.role_name', read_only=True, default='traveler')
    role = serializers.CharField(source='role.role_name', read_only=True, default='traveler')
    date_joined = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'role_name', 'is_active', 'created_at', 'date_joined']
        read_only_fields = ['id', 'email', 'is_active', 'created_at', 'date_joined', 'role', 'role_name']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['email', 'full_name', 'password', 'password2']

    def validate(self, attrs):
        initial = getattr(self, 'initial_data', {})
        p2 = attrs.get('password2') or initial.get('confirm_password') or initial.get('password_confirm')
        if p2 and attrs.get('password') != p2:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2', None)
        password = validated_data.pop('password')
        traveler_role, _ = Role.objects.get_or_create(role_name=Role.TRAVELER)
        user = User.objects.create_user(
            password=password,
            role=traveler_role,
            **validated_data,
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        from django.contrib.auth import authenticate
        user = authenticate(
            request=self.context.get('request'),
            username=attrs['email'],
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError('Invalid email or password.')
        if not user.is_active:
            raise serializers.ValidationError('This account is disabled.')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, write_only=True, label='Confirm new password')

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password': 'New passwords do not match.'})
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
