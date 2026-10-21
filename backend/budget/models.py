from django.db import models
from trips.models import Trip


class Budget(models.Model):
    budget_id = models.BigAutoField(primary_key=True)
    trip = models.OneToOneField(
        Trip,
        on_delete=models.CASCADE,
        related_name='budget',
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')

    def __str__(self):
        return f'Budget for {self.trip} ({self.currency} {self.total_amount})'


class Expense(models.Model):
    CATEGORY_TRANSPORT = 'transport'
    CATEGORY_ACCOMMODATION = 'accommodation'
    CATEGORY_FOOD = 'food'
    CATEGORY_ACTIVITIES = 'activities'
    CATEGORY_SHOPPING = 'shopping'
    CATEGORY_OTHER = 'other'

    CATEGORY_CHOICES = [
        (CATEGORY_TRANSPORT, 'Transport'),
        (CATEGORY_ACCOMMODATION, 'Accommodation'),
        (CATEGORY_FOOD, 'Food'),
        (CATEGORY_ACTIVITIES, 'Activities'),
        (CATEGORY_SHOPPING, 'Shopping'),
        (CATEGORY_OTHER, 'Other'),
    ]

    expense_id = models.BigAutoField(primary_key=True)
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name='expenses',
    )
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    spent_on = models.DateField()
    description = models.CharField(max_length=255, blank=True, default='')
    itinerary_item = models.ForeignKey(
        'trips.ItineraryItem',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='expenses',
    )

    def __str__(self):
        return f'{self.category} — {self.amount} on {self.spent_on}'
