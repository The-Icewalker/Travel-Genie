from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied
from django.db import transaction

from accounts.permissions import IsAdmin, IsOwnerOrAdmin
from .models import Attraction, Destination, ItineraryDay, ItineraryItem, Trip
from .serializers import (
    AttractionSerializer,
    DestinationSerializer,
    ItineraryDaySerializer,
    ItineraryItemSerializer,
    TripSerializer,
)


class DestinationViewSet(viewsets.ModelViewSet):
    """
    List/retrieve for authenticated users.
    Create/update/delete restricted to admin.
    """

    queryset = Destination.objects.prefetch_related('attractions').all()
    serializer_class = DestinationSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


class AttractionViewSet(viewsets.ModelViewSet):
    """
    List/retrieve for authenticated users.
    Create/update/delete restricted to admin.
    """

    queryset = Attraction.objects.select_related('destination').all()
    serializer_class = AttractionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]


from rest_framework.decorators import action
from rest_framework.response import Response

def detect_expense_category(title):
    t = (title or '').lower()
    if any(k in t for k in ['hotel', 'motel', 'check-in', 'airbnb', 'hostel', 'resort', 'stay', 'lodging']):
        return 'accommodation'
    if any(k in t for k in ['lunch', 'dinner', 'breakfast', 'bistro', 'food', 'restaurant', 'cafe', 'tasting', 'meal', 'brunch', 'snack', 'bar', 'wine', 'fondue', 'bakery', 'patisserie']):
        return 'food'
    if any(k in t for k in ['flight', 'train', 'uber', 'taxi', 'metro', 'transit', 'subway', 'bus', 'ferry', 'rail', 'drive', 'car', 'transport', 'transfer']):
        return 'transport'
    if any(k in t for k in ['shopping', 'market', 'mall', 'boutique', 'souvenir', 'store', 'shop']):
        return 'shopping'
    return 'activities'

class TripViewSet(viewsets.ModelViewSet):
    """
    CRUD for trips.
    Travellers see only their own trips; admins see all.
    """

    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Trip.objects.select_related('destination', 'user').prefetch_related('days__items__expenses')
        if user.role_name == 'admin':
            return qs.all()
        return qs.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role_name != 'admin' and obj.user != user:
            raise PermissionDenied('You do not have permission to access this trip.')
        return obj

    @action(detail=True, methods=['get'])
    def itinerary(self, request, pk=None):
        trip = self.get_object()
        days = trip.days.prefetch_related('items__expenses').all().order_by('day_number')
        serializer = ItineraryDaySerializer(days, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def bookings(self, request, pk=None):
        trip = self.get_object()
        from bookings.models import Booking
        from bookings.serializers import BookingSerializer
        bookings_qs = Booking.objects.filter(trip=trip)
        serializer = BookingSerializer(bookings_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='cost-summary')
    def cost_summary(self, request, pk=None):
        trip = self.get_object()
        from bookings.models import Booking
        from budget.models import Expense
        from django.db.models import Sum

        flights_total = Booking.objects.filter(trip=trip, booking_type='flight').aggregate(s=Sum('amount'))['s'] or 0
        hotels_total = Booking.objects.filter(trip=trip, booking_type='hotel').aggregate(s=Sum('amount'))['s'] or 0
        activities_total = Booking.objects.filter(trip=trip, booking_type='activity').aggregate(s=Sum('amount'))['s'] or 0
        expenses_total = Expense.objects.filter(trip=trip).aggregate(s=Sum('amount'))['s'] or 0
        grand_total = float(flights_total) + float(hotels_total) + float(activities_total) + float(expenses_total)

        return Response({
            'trip_id': trip.trip_id,
            'flights_total': float(flights_total),
            'hotels_total': float(hotels_total),
            'activities_total': float(activities_total),
            'expenses_total': float(expenses_total),
            'grand_total': grand_total,
        })

    @action(detail=True, methods=['post'], url_path='add-day')
    def add_day(self, request, pk=None):
        trip = self.get_object()
        from datetime import timedelta
        from ai_planner.views import generate_day_content

        current_days = list(trip.days.order_by('day_number'))
        new_day_number = len(current_days) + 1

        # Adjust end_date if needed to accommodate new day
        new_end_date = trip.start_date + timedelta(days=new_day_number - 1)
        if trip.end_date < new_end_date:
            trip.end_date = new_end_date
            trip.save(update_fields=['end_date'])

        # Generate sensible default content
        city = trip.destination.city if trip.destination else trip.title
        country = trip.destination.country if trip.destination else ''
        exclude_names = set()
        for other_day in trip.days.all():
            for it in other_day.items.all():
                if it.attraction and it.attraction.name:
                    exclude_names.add(it.attraction.name)
                elif it.title:
                    exclude_names.add(it.title)

        day_content = generate_day_content(
            city, country, new_day_number, custom_prompt,
            destination=trip.destination, exclude_names=exclude_names
        )

        with transaction.atomic():
            day_obj = ItineraryDay.objects.create(
                trip=trip,
                day_number=new_day_number,
                summary=day_content.get('summary', f'Day {new_day_number} in {city}'),
            )
            for item in day_content.get('items', []):
                ItineraryItem.objects.create(
                    day=day_obj,
                    title=item.get('title', 'Activity'),
                    start_time=item.get('start_time') or None,
                    est_cost=float(item.get('est_cost', 0)),
                    attraction=item.get('attraction'),
                )

        days_qs = trip.days.prefetch_related('items').all().order_by('day_number')
        return Response({
            'trip': TripSerializer(trip).data,
            'days': ItineraryDaySerializer(days_qs, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='remove-day')
    def remove_day(self, request, pk=None):
        trip = self.get_object()
        from datetime import timedelta

        day_num = request.data.get('day_number')
        day_id = request.data.get('day_id')

        with transaction.atomic():
            if day_id:
                ItineraryDay.objects.filter(trip=trip, day_id=day_id).delete()
            elif day_num:
                ItineraryDay.objects.filter(trip=trip, day_number=int(day_num)).delete()
            else:
                last_day = trip.days.order_by('-day_number').first()
                if last_day:
                    last_day.delete()

            # Re-index remaining days 1..N cleanly
            remaining = list(trip.days.order_by('day_number'))
            # 1. offset to prevent unique collision
            for i, d in enumerate(remaining):
                d.day_number = 1000 + i + 1
                d.save(update_fields=['day_number'])
            # 2. assign 1..N
            for i, d in enumerate(remaining):
                d.day_number = i + 1
                d.save(update_fields=['day_number'])

            # Adjust trip end_date to match remaining days count
            if len(remaining) > 0:
                new_end_date = trip.start_date + timedelta(days=len(remaining) - 1)
                trip.end_date = new_end_date
                trip.save(update_fields=['end_date'])

        days_qs = trip.days.prefetch_related('items').all().order_by('day_number')
        return Response({
            'trip': TripSerializer(trip).data,
            'days': ItineraryDaySerializer(days_qs, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='reset-itinerary')
    def reset_itinerary(self, request, pk=None):
        trip = self.get_object()
        with transaction.atomic():
            trip.days.all().delete()
            trip.prompt_text = ''
            trip.save(update_fields=['prompt_text'])

        return Response({
            'trip': TripSerializer(trip).data,
            'days': [],
            'detail': 'Itinerary cleared from scratch.',
        })

    @action(detail=True, methods=['post'], url_path='add-cost')
    def add_cost(self, request, pk=None):
        trip = self.get_object()
        from budget.models import Expense
        from datetime import timedelta

        item_id = request.data.get('item_id')
        day_id = request.data.get('day_id')
        day_number = request.data.get('day_number')

        items_to_add = []
        if item_id:
            items_to_add = list(ItineraryItem.objects.filter(day__trip=trip, pk=item_id).select_related('day'))
        elif day_id:
            items_to_add = list(ItineraryItem.objects.filter(day__trip=trip, day__day_id=day_id).select_related('day'))
        elif day_number:
            items_to_add = list(ItineraryItem.objects.filter(day__trip=trip, day__day_number=int(day_number)).select_related('day'))
        else:
            items_to_add = list(ItineraryItem.objects.filter(day__trip=trip).select_related('day'))

        added_count = 0
        with transaction.atomic():
            for item in items_to_add:
                if item.est_cost and float(item.est_cost) > 0:
                    if not Expense.objects.filter(itinerary_item=item).exists():
                        day_num = item.day.day_number if item.day else 1
                        spent_date = trip.start_date + timedelta(days=max(0, day_num - 1))
                        cat = detect_expense_category(item.title)
                        Expense.objects.create(
                            trip=trip,
                            itinerary_item=item,
                            category=cat,
                            amount=item.est_cost,
                            spent_on=spent_date,
                            description=item.title,
                        )
                        added_count += 1

        days_qs = trip.days.prefetch_related('items__expenses').all().order_by('day_number')
        return Response({
            'detail': f'Added {added_count} activity cost(s) to budget.',
            'days': ItineraryDaySerializer(days_qs, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='remove-cost')
    def remove_cost(self, request, pk=None):
        trip = self.get_object()
        from budget.models import Expense

        item_id = request.data.get('item_id')
        day_id = request.data.get('day_id')
        day_number = request.data.get('day_number')

        if item_id:
            Expense.objects.filter(trip=trip, itinerary_item_id=item_id).delete()
        elif day_id:
            Expense.objects.filter(trip=trip, itinerary_item__day__day_id=day_id).delete()
        elif day_number:
            Expense.objects.filter(trip=trip, itinerary_item__day__day_number=int(day_number)).delete()

        days_qs = trip.days.prefetch_related('items__expenses').all().order_by('day_number')
        return Response({
            'detail': 'Removed cost from budget.',
            'days': ItineraryDaySerializer(days_qs, many=True).data,
        })

    @action(detail=True, methods=['get'])
    def weather(self, request, pk=None):
        """Queries Open-Meteo for atmospheric conditions at the trip destination."""
        import requests
        trip = self.get_object()
        city = trip.destination.city if trip.destination else trip.title
        country = trip.destination.country if trip.destination else ''

        lat, lng = None, None
        if trip.destination:
            first_attraction = trip.destination.attractions.exclude(lat__isnull=True).exclude(lng__isnull=True).first()
            if first_attraction:
                lat, lng = float(first_attraction.lat), float(first_attraction.lng)

        if lat is None or lng is None:
            try:
                geo_resp = requests.get(
                    'https://geocoding-api.open-meteo.com/v1/search',
                    params={'name': city, 'count': 1, 'language': 'en', 'format': 'json'},
                    timeout=5,
                )
                if geo_resp.status_code == 200:
                    geo_data = geo_resp.json()
                    results = geo_data.get('results', [])
                    if results:
                        lat = results[0]['latitude']
                        lng = results[0]['longitude']
                        if not country and results[0].get('country'):
                            country = results[0]['country']
            except Exception:
                pass

        if lat is None or lng is None:
            return Response(
                {'error': f'Unable to geocode coordinates for {city}.', 'city': city},
                status=404,
            )

        try:
            weather_resp = requests.get(
                'https://api.open-meteo.com/v1/forecast',
                params={
                    'latitude': lat,
                    'longitude': lng,
                    'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m',
                    'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
                    'timezone': 'auto',
                },
                timeout=5,
            )
            if weather_resp.status_code == 200:
                data = weather_resp.json()
                return Response({
                    'trip_id': trip.trip_id,
                    'city': city,
                    'country': country,
                    'latitude': lat,
                    'longitude': lng,
                    'current': data.get('current', {}),
                    'daily': data.get('daily', {}),
                    'daily_units': data.get('daily_units', {}),
                    'current_units': data.get('current_units', {}),
                })
            return Response(
                {'error': 'Weather service temporarily unavailable.', 'status': weather_resp.status_code},
                status=502,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=502)



class ItineraryDayViewSet(viewsets.ModelViewSet):
    """
    Manage itinerary days.
    Accessible only to the trip owner or admins.
    """

    serializer_class = ItineraryDaySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ItineraryDay.objects.select_related('trip__user').prefetch_related('items')
        if user.role_name == 'admin':
            return qs.all()
        return qs.filter(trip__user=user)

    def perform_create(self, serializer):
        day = serializer.validated_data.get('trip') or serializer.validated_data.get('trip_id')
        trip = serializer.validated_data['trip']
        user = self.request.user
        if user.role_name != 'admin' and trip.user != user:
            raise PermissionDenied('You do not own this trip.')
        serializer.save()


class ItineraryItemViewSet(viewsets.ModelViewSet):
    """
    Manage itinerary items.
    Accessible only to the trip owner or admins.
    """

    serializer_class = ItineraryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ItineraryItem.objects.select_related('day__trip__user', 'attraction')
        if user.role_name == 'admin':
            return qs.all()
        return qs.filter(day__trip__user=user)

    def perform_create(self, serializer):
        day = serializer.validated_data['day']
        user = self.request.user
        if user.role_name != 'admin' and day.trip.user != user:
            raise PermissionDenied('You do not own this trip.')
        serializer.save()
