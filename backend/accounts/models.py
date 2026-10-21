from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.Model):
    TRAVELER = 'traveler'
    ADMIN = 'admin'
    ROLE_CHOICES = [
        (TRAVELER, 'Traveler'),
        (ADMIN, 'Admin'),
    ]

    role_name = models.CharField(max_length=20, choices=ROLE_CHOICES, unique=True)

    def __str__(self):
        return self.role_name


class UserManager(BaseUserManager):
    def create_user(self, email, password, **extra):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)

        if extra.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        role, _ = Role.objects.get_or_create(role_name=Role.ADMIN)
        extra.setdefault('role', role)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def role_name(self):
        return self.role.role_name if self.role else 'traveler'
