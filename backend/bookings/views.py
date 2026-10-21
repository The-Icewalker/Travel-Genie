from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.permissions import IsAdmin, IsOwnerOrAdmin
from budget.models import Expense
from .models import Booking, Flight, Hotel
from .serializers import BookingSerializer, FlightSerializer, HotelSerializer


class FlightViewSet(viewsets.ModelViewSet):
    """Flight catalogue — all authenticated users can read; admins can write."""

    queryset = Flight.objects.select_related('destination').all()
    serializer_class = FlightSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


class HotelViewSet(viewsets.ModelViewSet):
    """Hotel catalogue — all authenticated users can read; admins can write."""

    queryset = Hotel.objects.select_related('destination').all()
    serializer_class = HotelSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


class BookingViewSet(viewsets.ModelViewSet):
    """
    CRUD for bookings.
    Travellers see only bookings for their own trips.
    On create, an Expense row is automatically created in the same transaction.
    """

    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related('trip__user', 'flight', 'hotel')
        if user.role_name == 'admin':
            return qs.all()
        return qs.filter(trip__user=user)

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role_name != 'admin' and obj.trip.user != user:
            raise PermissionDenied('You do not have permission to access this booking.')
        return obj

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        trip = serializer.validated_data['trip']
        user = request.user
        if user.role_name != 'admin' and trip.user != user:
            raise PermissionDenied('You can only create bookings for your own trips.')

        booking = serializer.save()

        # Automatically record an expense for this booking
        category_map = {
            Booking.TYPE_FLIGHT: 'transport',
            Booking.TYPE_HOTEL: 'accommodation',
            Booking.TYPE_ACTIVITY: 'activities',
        }
        Expense.objects.create(
            trip=booking.trip,
            category=category_map.get(booking.booking_type, 'other'),
            amount=booking.amount,
            spent_on=booking.booked_at.date(),
        )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
