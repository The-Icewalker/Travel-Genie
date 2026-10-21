from rest_framework import serializers
from .models import Booking, Flight, Hotel


class FlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flight
        fields = ['flight_id', 'origin', 'destination', 'airline', 'depart_at', 'price']
        read_only_fields = ['flight_id']


class HotelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hotel
        fields = ['hotel_id', 'destination', 'name', 'price_per_night', 'rating']
        read_only_fields = ['hotel_id']


class BookingSerializer(serializers.ModelSerializer):
    flight_detail = FlightSerializer(source='flight', read_only=True)
    hotel_detail = HotelSerializer(source='hotel', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'booking_id', 'trip', 'booking_type',
            'flight', 'flight_detail',
            'hotel', 'hotel_detail',
            'amount', 'status', 'booked_at',
        ]
        read_only_fields = ['booking_id', 'booked_at']

    def validate(self, attrs):
        booking_type = attrs.get('booking_type')
        if booking_type == Booking.TYPE_FLIGHT and not attrs.get('flight'):
            raise serializers.ValidationError({'flight': 'Flight is required for flight bookings.'})
        if booking_type == Booking.TYPE_HOTEL and not attrs.get('hotel'):
            raise serializers.ValidationError({'hotel': 'Hotel is required for hotel bookings.'})
        return attrs
