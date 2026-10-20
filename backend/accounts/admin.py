from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['id', 'role_name', 'users_count']

    def users_count(self, obj):
        count = User.objects.filter(role=obj).count()
        return format_html('<span class="tg-badge tg-badge-blue">{} users</span>', count)
    users_count.short_description = 'Assigned Users'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role_badge', 'status_badge', 'access_badge', 'created_at']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['email', 'full_name']
    ordering = ['-created_at']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'password1', 'password2', 'role'),
        }),
    )

    def role_badge(self, obj):
        r = obj.role.role_name if obj.role else 'traveler'
        cls_name = 'tg-badge-coral' if r == 'admin' else 'tg-badge-blue'
        return format_html('<span class="tg-badge {}">{}</span>', cls_name, r.upper())
    role_badge.short_description = 'Role'

    def status_badge(self, obj):
        return format_html(
            '<span class="tg-badge {}">{}</span>',
            'tg-badge-green' if obj.is_active else 'tg-badge-slate',
            'Active' if obj.is_active else 'Inactive'
        )
    status_badge.short_description = 'Status'

    def access_badge(self, obj):
        return format_html(
            '<span class="tg-badge {}">{}</span>',
            'tg-badge-coral' if obj.is_superuser else ('tg-badge-blue' if obj.is_staff else 'tg-badge-slate'),
            'Superuser' if obj.is_superuser else ('Staff' if obj.is_staff else 'Traveller')
        )
    access_badge.short_description = 'Access Tier'
