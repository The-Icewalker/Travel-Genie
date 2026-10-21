from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsAdmin
from accounts.serializers import UserSerializer
from bookings.models import Booking, Hotel
from budget.models import Expense
from trips.models import Trip

User = get_user_model()


class UserListView(APIView):
    """
    GET /api/admin/users/
    Returns list of all registered users with their details.
    """

    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        users = User.objects.select_related('role').order_by('-created_at')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserDetailView(APIView):
    """
    PATCH /api/admin/users/<int:pk>/
    DELETE /api/admin/users/<int:pk>/
    """

    permission_classes = [IsAdmin]

    def patch(self, request, pk=None, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_role = request.data.get('role') or request.data.get('role_name')
        if new_role:
            role_str = 'traveler' if new_role.lower() in ('user', 'traveler') else 'admin'
            target_role, _ = Role.objects.get_or_create(role_name=role_str)
            user.role = target_role

        if 'is_active' in request.data:
            user.is_active = bool(request.data['is_active'])

        if 'full_name' in request.data:
            user.full_name = request.data['full_name']

        user.save()
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

    def delete(self, request, pk=None, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.id == request.user.id:
            return Response({'detail': 'Cannot delete your own admin account.'}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response({'detail': 'User deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


class TripsPerUserAnalyticsView(APIView):
    """GET /api/admin/analytics/trips-per-user/"""

    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        data = (
            Trip.objects.values('user__id', 'user__email', 'user__full_name')
            .annotate(trip_count=Count('trip_id'))
            .order_by('-trip_count')
        )
        return Response(
            [
                {
                    'user_id': row['user__id'],
                    'email': row['user__email'],
                    'user': row['user__full_name'] or row['user__email'],
                    'trip_count': row['trip_count'],
                }
                for row in data
            ],
            status=status.HTTP_200_OK,
        )


class AvgHotelPriceAnalyticsView(APIView):
    """GET /api/admin/analytics/avg-hotel-price/"""

    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        data = (
            Hotel.objects.select_related('destination')
            .values('destination__city')
            .annotate(avg_price=Avg('price_per_night'))
            .order_by('destination__city')
        )
        return Response(
            [
                {
                    'city': row['destination__city'] or 'Unknown',
                    'avg_price': round(float(row['avg_price']), 2) if row['avg_price'] else 0.0,
                }
                for row in data
            ],
            status=status.HTTP_200_OK,
        )


class SiteStatsView(APIView):
    """GET /api/admin/analytics/stats/"""

    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        total_users = User.objects.count()
        total_trips = Trip.objects.count()
        total_bookings = Booking.objects.count()
        total_revenue = Booking.objects.aggregate(s=Sum('amount'))['s'] or 0.0
        total_spend = Expense.objects.aggregate(s=Sum('amount'))['s'] or 0.0

        return Response(
            {
                'total_users': total_users,
                'total_trips': total_trips,
                'total_bookings': total_bookings,
                'total_revenue': float(total_revenue) if total_revenue else float(total_spend),
            },
            status=status.HTTP_200_OK,
        )


class AnalyticsView(APIView):
    """GET /api/admin/analytics/ (combined)"""

    permission_classes = [IsAdmin]

    def get(self, request, *args, **kwargs):
        trips_per_user = (
            Trip.objects.values('user__id', 'user__email')
            .annotate(trip_count=Count('trip_id'))
            .order_by('-trip_count')
        )
        avg_hotel_price = (
            Hotel.objects.select_related('destination')
            .values('destination__city')
            .annotate(avg_price_per_night=Avg('price_per_night'))
            .order_by('destination__city')
        )
        spend_per_category = (
            Expense.objects.values('category')
            .annotate(total_spent=Sum('amount'))
            .order_by('category')
        )

        return Response(
            {
                'trips_per_user': [
                    {'user_id': r['user__id'], 'email': r['user__email'], 'trip_count': r['trip_count']}
                    for r in trips_per_user
                ],
                'avg_hotel_price_per_city': [
                    {
                        'city': r['destination__city'],
                        'avg_price_per_night': (
                            round(float(r['avg_price_per_night']), 2)
                            if r['avg_price_per_night']
                            else None
                        ),
                    }
                    for r in avg_hotel_price
                ],
                'spend_per_category': [
                    {
                        'category': r['category'],
                        'total_spent': float(r['total_spent']) if r['total_spent'] else 0,
                    }
                    for r in spend_per_category
                ],
            },
            status=status.HTTP_200_OK,
        )
