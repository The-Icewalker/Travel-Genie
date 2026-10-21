from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Destination',
            fields=[
                ('destination_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('city', models.CharField(max_length=100)),
                ('country', models.CharField(max_length=100)),
                ('currency_code', models.CharField(max_length=10)),
                ('visa_info', models.TextField(blank=True, default='')),
                ('best_season', models.CharField(blank=True, default='', max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='Attraction',
            fields=[
                ('attraction_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('category', models.CharField(max_length=100)),
                ('avg_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('lat', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('lng', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('destination', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attractions',
                    to='trips.destination',
                )),
            ],
        ),
        migrations.CreateModel(
            name='Trip',
            fields=[
                ('trip_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('status', models.CharField(
                    choices=[
                        ('planned', 'Planned'),
                        ('ongoing', 'Ongoing'),
                        ('completed', 'Completed'),
                        ('over_budget', 'Over Budget'),
                        ('cancelled', 'Cancelled'),
                    ],
                    default='planned',
                    max_length=20,
                )),
                ('prompt_text', models.TextField(blank=True, default='')),
                ('destination', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='trips',
                    to='trips.destination',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='trips',
                    to='accounts.user',
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='trip',
            constraint=models.CheckConstraint(
                check=models.Q(end_date__gte=models.F('start_date')),
                name='trips_trip_end_date_gte_start_date',
            ),
        ),
        migrations.CreateModel(
            name='ItineraryDay',
            fields=[
                ('day_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('day_number', models.PositiveIntegerField()),
                ('summary', models.TextField(blank=True, default='')),
                ('trip', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='days',
                    to='trips.trip',
                )),
            ],
            options={
                'ordering': ['day_number'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='itineraryday',
            unique_together={('trip', 'day_number')},
        ),
        migrations.CreateModel(
            name='ItineraryItem',
            fields=[
                ('item_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('start_time', models.TimeField(blank=True, null=True)),
                ('est_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('attraction', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='itinerary_items',
                    to='trips.attraction',
                )),
                ('day', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='trips.itineraryday',
                )),
            ],
        ),
    ]
