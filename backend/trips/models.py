from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Destination(models.Model):
    destination_id = models.BigAutoField(primary_key=True)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    currency_code = models.CharField(max_length=10)
    visa_info = models.TextField(blank=True, default='')
    best_season = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        return f'{self.city}, {self.country}'


class Attraction(models.Model):
    attraction_id = models.BigAutoField(primary_key=True)
    destination = models.ForeignKey(
        Destination,
        on_delete=models.CASCADE,
        related_name='attractions',
    )
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    avg_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    def __str__(self):
        return self.name


class Trip(models.Model):
    STATUS_PLANNED = 'planned'
    STATUS_ACTIVE = 'active'
    STATUS_ONGOING = 'ongoing'
    STATUS_COMPLETED = 'completed'
    STATUS_OVER_BUDGET = 'over_budget'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_PLANNED, 'Planned'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_ONGOING, 'Ongoing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_OVER_BUDGET, 'Over Budget'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    trip_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trips',
    )
    destination = models.ForeignKey(
        Destination,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trips',
    )
    title = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PLANNED)
    prompt_text = models.TextField(blank=True, default='')

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_date__gte=models.F('start_date')),
                name='trips_trip_end_date_gte_start_date',
            )
        ]

    def __str__(self):
        return self.title

    def clean(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError('end_date must be >= start_date.')


class ItineraryDay(models.Model):
    day_id = models.BigAutoField(primary_key=True)
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name='days',
    )
    day_number = models.PositiveIntegerField()
    summary = models.TextField(blank=True, default='')

    class Meta:
        unique_together = [('trip', 'day_number')]
        ordering = ['day_number']

    def __str__(self):
        return f'Day {self.day_number} of {self.trip}'


class ItineraryItem(models.Model):
    item_id = models.BigAutoField(primary_key=True)
    day = models.ForeignKey(
        ItineraryDay,
        on_delete=models.CASCADE,
        related_name='items',
    )
    attraction = models.ForeignKey(
        Attraction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='itinerary_items',
    )
    title = models.CharField(max_length=255)
    start_time = models.TimeField(null=True, blank=True)
    est_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return self.title
