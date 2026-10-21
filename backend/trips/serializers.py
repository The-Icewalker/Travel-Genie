from rest_framework import serializers
from .models import Attraction, Destination, ItineraryDay, ItineraryItem, Trip


class AttractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attraction
        fields = [
            'attraction_id', 'destination', 'name', 'category',
            'avg_cost', 'lat', 'lng',
        ]
        read_only_fields = ['attraction_id']


class DestinationSerializer(serializers.ModelSerializer):
    attractions = AttractionSerializer(many=True, read_only=True)

    class Meta:
        model = Destination
        fields = [
            'destination_id', 'city', 'country', 'currency_code',
            'visa_info', 'best_season', 'attractions',
        ]
        read_only_fields = ['destination_id']


class ItineraryItemReadSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='item_id', read_only=True)
    time = serializers.SerializerMethodField()
    description = serializers.CharField(source='title', read_only=True)
    is_in_budget = serializers.SerializerMethodField()
    expense_id = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    attraction_name = serializers.CharField(source='attraction.name', read_only=True, default=None)
    attraction_detail = AttractionSerializer(source='attraction', read_only=True)

    class Meta:
        model = ItineraryItem
        fields = [
            'item_id', 'id', 'day', 'attraction', 'attraction_detail', 'attraction_name',
            'lat', 'lng', 'title', 'description', 'start_time', 'time', 'est_cost',
            'is_in_budget', 'expense_id',
        ]
        read_only_fields = ['item_id', 'id', 'is_in_budget', 'expense_id', 'lat', 'lng', 'attraction_name', 'attraction_detail']

    def get_lat(self, obj):
        if obj.attraction and obj.attraction.lat is not None:
            try:
                return float(obj.attraction.lat)
            except (ValueError, TypeError):
                return None
        return None

    def get_lng(self, obj):
        if obj.attraction and obj.attraction.lng is not None:
            try:
                return float(obj.attraction.lng)
            except (ValueError, TypeError):
                return None
        return None


    def get_time(self, obj):
        if obj.start_time:
            try:
                return obj.start_time.strftime('%I:%M %p').lstrip('0')
            except Exception:
                return str(obj.start_time)
        return ''

    def get_is_in_budget(self, obj):
        if hasattr(obj, 'expenses'):
            return obj.expenses.exists()
        return False

    def get_expense_id(self, obj):
        if hasattr(obj, 'expenses'):
            exp = obj.expenses.first()
            return exp.expense_id if exp else None
        return None


class ItineraryItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='item_id', read_only=True)

    class Meta:
        model = ItineraryItem
        fields = [
            'item_id', 'id', 'day', 'attraction', 'title', 'start_time', 'est_cost',
        ]
        read_only_fields = ['item_id', 'id']


class ItineraryItemWriteSerializer(serializers.ModelSerializer):
    """Used for writing items when nested in a day (day field is not required)."""

    class Meta:
        model = ItineraryItem
        fields = ['attraction', 'title', 'start_time', 'est_cost']


class ItineraryDaySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='day_id', read_only=True)
    items = ItineraryItemReadSerializer(many=True, read_only=True)
    date = serializers.SerializerMethodField()

    class Meta:
        model = ItineraryDay
        fields = ['id', 'day_id', 'trip', 'day_number', 'summary', 'date', 'items']
        read_only_fields = ['day_id', 'id']

    def get_date(self, obj):
        from datetime import timedelta
        if obj.trip and obj.trip.start_date:
            return str(obj.trip.start_date + timedelta(days=max(0, obj.day_number - 1)))
        return None

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        if 'items' in data:
            ret['items'] = data['items']
        return ret

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        day = ItineraryDay.objects.create(**validated_data)
        for item_data in items_data:
            ItineraryItem.objects.create(day=day, **item_data)
        return day

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                ItineraryItem.objects.create(day=instance, **item_data)
        return instance


class TripSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='trip_id', read_only=True)
    destination_detail = DestinationSerializer(source='destination', read_only=True)
    days = ItineraryDaySerializer(many=True, read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Trip
        fields = [
            'trip_id', 'id', 'user', 'destination', 'destination_detail', 'title', 'start_date',
            'end_date', 'status', 'prompt_text', 'days',
        ]
        read_only_fields = ['trip_id', 'id', 'user', 'destination_detail']

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        dest_val = mutable_data.get('destination')
        if dest_val is not None:
            if isinstance(dest_val, str) and dest_val.isdigit():
                mutable_data['destination'] = int(dest_val)
            elif isinstance(dest_val, str) and not dest_val.isdigit():
                dest_str = dest_val.strip()
                parts = [p.strip() for p in dest_str.split(',') if p.strip()]
                city = parts[0] if parts else dest_str
                country = parts[1] if len(parts) > 1 else 'Global'

                dest_obj = Destination.objects.filter(city__iexact=city).first()
                if not dest_obj:
                    dest_obj = Destination.objects.create(
                        city=city,
                        country=country,
                        currency_code='USD',
                    )
                mutable_data['destination'] = dest_obj.destination_id
        return super().to_internal_value(mutable_data)

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'end_date must be >= start_date.'})
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
