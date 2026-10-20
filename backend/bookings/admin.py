from django.contrib import admin
from .models import Booking, Flight, Hotel


@admin.register(Flight)
class FlightAdmin(admin.ModelAdmin):
    list_display = ['flight_id', 'airline', 'origin', 'destination', 'depart_at', 'price']
    search_fields = ['airline', 'origin']


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ['hotel_id', 'name', 'destination', 'price_per_night', 'rating']
    search_fields = ['name']


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['booking_id', 'trip', 'booking_type', 'amount', 'status', 'booked_at']
    list_filter = ['booking_type', 'status']
    date_hierarchy = 'booked_at'
