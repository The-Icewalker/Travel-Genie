from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import Attraction, Destination, ItineraryDay, ItineraryItem, Trip


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ['destination_id', 'city', 'country', 'currency_code', 'best_season', 'attraction_count']
    search_fields = ['city', 'country']
    list_filter = ['country']

    def attraction_count(self, obj):
        count = obj.attractions.count()
        return format_html(
            '<span class="tg-badge tg-badge-blue">{} spots</span>',
            count
        )
    attraction_count.short_description = 'Attractions'


@admin.register(Attraction)
class AttractionAdmin(admin.ModelAdmin):
    list_display = ['attraction_id', 'name', 'destination', 'category', 'cost_badge']
    list_filter = ['category', 'destination']
    search_fields = ['name', 'destination__city']

    def cost_badge(self, obj):
        val = float(obj.avg_cost or 0)
        cls_name = 'tg-badge-green' if val > 0 else 'tg-badge-slate'
        cost_str = f"${val:.2f}"
        return format_html(
            '<span class="tg-badge {}">{}</span>',
            cls_name,
            cost_str
        )
    cost_badge.short_description = 'Avg Cost'


class ItineraryDayInline(admin.TabularInline):
    model = ItineraryDay
    extra = 0
    fields = ['day_number', 'summary']
    ordering = ['day_number']


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['trip_id', 'title', 'user_link', 'destination_display', 'dates_display', 'status_badge', 'days_count', 'expenses_total']
    list_filter = ['status', 'destination__country', 'start_date']
    search_fields = ['title', 'user__email', 'destination__city']
    date_hierarchy = 'start_date'
    inlines = [ItineraryDayInline]

    def user_link(self, obj):
        return obj.user.email if obj.user else '—'
    user_link.short_description = 'Traveller'

    def destination_display(self, obj):
        if obj.destination:
            return f'{obj.destination.city}, {obj.destination.country}'
        return '—'
    destination_display.short_description = 'Destination'

    def dates_display(self, obj):
        return f"{obj.start_date.strftime('%b %d, %Y')} → {obj.end_date.strftime('%b %d, %Y')}"
    dates_display.short_description = 'Trip Dates'

    def status_badge(self, obj):
        colors = {
            'planned': 'tg-badge-blue',
            'active': 'tg-badge-green',
            'completed': 'tg-badge-slate',
            'cancelled': 'tg-badge-coral',
            'over_budget': 'tg-badge-coral',
        }
        badge_cls = colors.get(obj.status, 'tg-badge-slate')
        return format_html(
            '<span class="tg-badge {}">{}</span>',
            badge_cls,
            obj.status.replace('_', ' ').capitalize()
        )
    status_badge.short_description = 'Status'

    def days_count(self, obj):
        count = obj.days.count()
        return format_html('<span class="tg-badge tg-badge-slate">{} Days</span>', count)
    days_count.short_description = 'Duration'

    def expenses_total(self, obj):
        from django.db.models import Sum
        total = float(obj.expenses.aggregate(s=Sum('amount'))['s'] or 0)
        total_str = f"${total:.2f}"
        return format_html('<strong>{}</strong>', total_str)
    expenses_total.short_description = 'Total Spent'


class ItineraryItemInline(admin.TabularInline):
    model = ItineraryItem
    extra = 0
    fields = ['title', 'start_time', 'est_cost']


@admin.register(ItineraryDay)
class ItineraryDayAdmin(admin.ModelAdmin):
    list_display = ['day_id', 'day_number_badge', 'trip_link', 'summary_preview', 'items_count']
    list_filter = ['trip', 'day_number']
    search_fields = ['trip__title', 'summary']
    inlines = [ItineraryItemInline]

    def day_number_badge(self, obj):
        return format_html('<span class="tg-badge tg-badge-blue">Day {}</span>', obj.day_number)
    day_number_badge.short_description = 'Day'

    def trip_link(self, obj):
        url = reverse('admin:trips_trip_change', args=[obj.trip.pk])
        return format_html('<a href="{}" style="font-weight:700;">{}</a>', url, obj.trip.title)
    trip_link.short_description = 'Trip'

    def summary_preview(self, obj):
        return (obj.summary[:50] + '…') if len(obj.summary) > 50 else (obj.summary or '—')
    summary_preview.short_description = 'Highlights'

    def items_count(self, obj):
        count = obj.items.count()
        return format_html('<span class="tg-badge tg-badge-slate">{} activities</span>', count)
    items_count.short_description = 'Activities'


@admin.register(ItineraryItem)
class ItineraryItemAdmin(admin.ModelAdmin):
    list_display = ['item_id', 'title', 'trip_name', 'day_badge', 'time_display', 'cost_badge', 'budget_status']
    list_filter = ['day__trip', 'day__day_number']
    search_fields = ['title', 'day__trip__title']
    list_per_page = 30

    def trip_name(self, obj):
        if obj.day and obj.day.trip:
            url = reverse('admin:trips_trip_change', args=[obj.day.trip.pk])
            return format_html('<a href="{}" style="font-weight:600;">{}</a>', url, obj.day.trip.title)
        return '—'
    trip_name.short_description = 'Trip'

    def day_badge(self, obj):
        if obj.day:
            return format_html('<span class="tg-badge tg-badge-slate">Day {}</span>', obj.day.day_number)
        return '—'
    day_badge.short_description = 'Schedule'

    def time_display(self, obj):
        if obj.start_time:
            return format_html('<code class="tg-time">{}</code>', obj.start_time.strftime('%I:%M %p').lstrip('0'))
        return '—'
    time_display.short_description = 'Time'

    def cost_badge(self, obj):
        val = float(obj.est_cost or 0)
        cost_str = f"${val:.2f}"
        if val > 0:
            return format_html('<span class="tg-badge tg-badge-coral">{}</span>', cost_str)
        return format_html('<span class="tg-badge tg-badge-slate">$0.00</span>')
    cost_badge.short_description = 'Est. Cost'

    def budget_status(self, obj):
        if obj.expenses.exists():
            return format_html('<span class="tg-badge tg-badge-green">✓ In Budget</span>')
        return format_html('<span class="tg-muted-text">Not Added</span>')
    budget_status.short_description = 'Budget Sync'
