from django.core.exceptions import ValidationError
from django.db import models

from trips.models import Destination, Trip


class Flight(models.Model):
    flight_id = models.BigAutoField(primary_key=True)
    origin = models.CharField(max_length=100)
    destination = models.ForeignKey(
        Destination,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='flights',
    )
    airline = models.CharField(max_length=100)
    depart_at = models.DateTimeField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(price__gte=0),
                name='bookings_flight_price_gte_0',
            )
        ]

    def __str__(self):
        return f'{self.airline}: {self.origin} → {self.destination} @ {self.depart_at}'


class Hotel(models.Model):
    hotel_id = models.BigAutoField(primary_key=True)
    destination = models.ForeignKey(
        Destination,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hotels',
    )
    name = models.CharField(max_length=200)
    price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(price_per_night__gte=0),
                name='bookings_hotel_price_per_night_gte_0',
            )
        ]

    def __str__(self):
        return self.name


class Booking(models.Model):
    TYPE_FLIGHT = 'flight'
    TYPE_HOTEL = 'hotel'
    TYPE_ACTIVITY = 'activity'
    TYPE_CHOICES = [
        (TYPE_FLIGHT, 'Flight'),
        (TYPE_HOTEL, 'Hotel'),
        (TYPE_ACTIVITY, 'Activity'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    booking_id = models.BigAutoField(primary_key=True)
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name='bookings',
    )
    booking_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    flight = models.ForeignKey(
        Flight,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    hotel = models.ForeignKey(
        Hotel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    booked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Booking #{self.booking_id} ({self.booking_type}) for Trip #{self.trip_id}'
