from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import Budget, Expense


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['budget_id', 'trip_link', 'amount_display', 'currency', 'expenses_spent']
    search_fields = ['trip__title']

    def trip_link(self, obj):
        url = reverse('admin:trips_trip_change', args=[obj.trip.pk])
        return format_html('<a href="{}" style="font-weight:700;">{}</a>', url, obj.trip.title)
    trip_link.short_description = 'Trip'

    def amount_display(self, obj):
        val_str = f"${float(obj.total_amount):.2f}"
        return format_html('<strong>{}</strong>', val_str)
    amount_display.short_description = 'Target Budget'

    def expenses_spent(self, obj):
        from django.db.models import Sum
        spent = float(obj.trip.expenses.aggregate(s=Sum('amount'))['s'] or 0)
        spent_str = f"${spent:.2f} spent"
        return format_html('<span class="tg-badge tg-badge-coral">{}</span>', spent_str)
    expenses_spent.short_description = 'Actual Spent'


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['expense_id', 'description', 'trip_link', 'category_badge', 'amount_badge', 'spent_on', 'source_badge']
    list_filter = ['category', 'trip', 'spent_on']
    search_fields = ['description', 'trip__title']
    date_hierarchy = 'spent_on'
    list_per_page = 30

    def trip_link(self, obj):
        url = reverse('admin:trips_trip_change', args=[obj.trip.pk])
        return format_html('<a href="{}" style="font-weight:600;">{}</a>', url, obj.trip.title)
    trip_link.short_description = 'Trip'

    def category_badge(self, obj):
        icons = {
            'food': ('🍜 Food', 'tg-badge-coral'),
            'accommodation': ('🏨 Stay', 'tg-badge-blue'),
            'transport': ('✈️ Transit', 'tg-badge-slate'),
            'activities': ('🎟️ Activity', 'tg-badge-green'),
            'shopping': ('🛍️ Shopping', 'tg-badge-slate'),
            'other': ('📦 Other', 'tg-badge-slate'),
        }
        label, cls_name = icons.get(obj.category, (obj.category.capitalize(), 'tg-badge-slate'))
        return format_html('<span class="tg-badge {}">{}</span>', cls_name, label)
    category_badge.short_description = 'Category'

    def amount_badge(self, obj):
        val_str = f"${float(obj.amount):.2f}"
        return format_html('<strong class="tg-mono">{}</strong>', val_str)
    amount_badge.short_description = 'Amount'

    def source_badge(self, obj):
        if obj.itinerary_item:
            day_num = obj.itinerary_item.day.day_number if obj.itinerary_item.day else '?'
            return format_html('<span class="tg-badge tg-badge-blue">🗓️ Itinerary (Day {})</span>', day_num)
        return format_html('<span class="tg-muted-text">Manual Entry</span>')
    source_badge.short_description = 'Source'
