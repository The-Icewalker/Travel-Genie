from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with the 'admin' role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == 'admin'
        )


class IsOwnerOrAdmin(BasePermission):
    """Allow object-level access to the owner or an admin."""

    def has_object_permission(self, request, view, obj):
        if request.user.role and request.user.role.role_name == 'admin':
            return True
        return obj.user == request.user
