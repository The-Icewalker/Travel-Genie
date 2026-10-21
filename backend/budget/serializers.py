from rest_framework import serializers
from trips.models import Trip
from .models import Budget, Expense


class BudgetSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='budget_id', read_only=True)

    class Meta:
        model = Budget
        fields = ['budget_id', 'id', 'trip', 'total_amount', 'currency']
        read_only_fields = ['budget_id', 'id']


class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='expense_id', read_only=True)
    date = serializers.DateField(source='spent_on', required=False)
    itinerary_item = serializers.PrimaryKeyRelatedField(read_only=True)
    is_itinerary_item = serializers.SerializerMethodField()
    itinerary_day = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'expense_id', 'id', 'trip', 'category', 'amount', 'spent_on', 'date', 'description',
            'itinerary_item', 'is_itinerary_item', 'itinerary_day',
        ]
        read_only_fields = ['expense_id', 'id', 'itinerary_item', 'is_itinerary_item', 'itinerary_day']

    def get_is_itinerary_item(self, obj):
        return obj.itinerary_item_id is not None

    def get_itinerary_day(self, obj):
        if obj.itinerary_item and obj.itinerary_item.day:
            return obj.itinerary_item.day.day_number
        return None

    def to_internal_value(self, data):
        # Support both 'date' and 'spent_on'
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'spent_on' not in mutable_data and 'date' in mutable_data:
            mutable_data['spent_on'] = mutable_data['date']

        # Support string/integer/title for 'trip'
        trip_val = mutable_data.get('trip')
        if trip_val is not None:
            if isinstance(trip_val, str) and trip_val.isdigit():
                mutable_data['trip'] = int(trip_val)
            elif isinstance(trip_val, str) and not trip_val.isdigit():
                # Try finding trip by title for current user or globally
                trip_obj = Trip.objects.filter(title__iexact=trip_val.strip()).first()
                if trip_obj:
                    mutable_data['trip'] = trip_obj.pk

        # If category is 'other' or omitted, but description clearly states food/hotel/transport/etc., auto-classify
        cat = mutable_data.get('category', '').lower()
        desc = mutable_data.get('description', '').lower()
        if (not cat or cat == 'other') and desc:
            if any(w in desc for w in ['food', 'dining', 'lunch', 'dinner', 'breakfast', 'meal', 'restaurant', 'cafe', 'eat', 'coffee', 'snack']):
                mutable_data['category'] = 'food'
            elif any(w in desc for w in ['hotel', 'motel', 'airbnb', 'hostel', 'resort', 'stay', 'room', 'accommodation']):
                mutable_data['category'] = 'accommodation'
            elif any(w in desc for w in ['flight', 'airline', 'train', 'uber', 'taxi', 'bus', 'metro', 'transit', 'ticket', 'transport']):
                mutable_data['category'] = 'transport'
            elif any(w in desc for w in ['museum', 'tour', 'ticket', 'park', 'hike', 'activity', 'activities']):
                mutable_data['category'] = 'activities'
            elif any(w in desc for w in ['shopping', 'clothes', 'souvenir', 'gift', 'mall']):
                mutable_data['category'] = 'shopping'

        return super().to_internal_value(mutable_data)


class CategorySummarySerializer(serializers.Serializer):
    """Read-only serializer for per-category spend aggregation."""
    category = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
