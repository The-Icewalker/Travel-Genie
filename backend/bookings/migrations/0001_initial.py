from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('trips', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Flight',
            fields=[
                ('flight_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('origin', models.CharField(max_length=100)),
                ('airline', models.CharField(max_length=100)),
                ('depart_at', models.DateTimeField()),
                ('price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('destination', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='flights',
                    to='trips.destination',
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='flight',
            constraint=models.CheckConstraint(
                check=models.Q(price__gte=0),
                name='bookings_flight_price_gte_0',
            ),
        ),
        migrations.CreateModel(
            name='Hotel',
            fields=[
                ('hotel_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('price_per_night', models.DecimalField(decimal_places=2, max_digits=10)),
                ('rating', models.DecimalField(blank=True, decimal_places=1, max_digits=3, null=True)),
                ('destination', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='hotels',
                    to='trips.destination',
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='hotel',
            constraint=models.CheckConstraint(
                check=models.Q(price_per_night__gte=0),
                name='bookings_hotel_price_per_night_gte_0',
            ),
        ),
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('booking_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('booking_type', models.CharField(
                    choices=[('flight', 'Flight'), ('hotel', 'Hotel'), ('activity', 'Activity')],
                    max_length=20,
                )),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('cancelled', 'Cancelled')],
                    default='pending',
                    max_length=20,
                )),
                ('booked_at', models.DateTimeField(auto_now_add=True)),
                ('trip', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='bookings',
                    to='trips.trip',
                )),
                ('flight', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='bookings',
                    to='bookings.flight',
                )),
                ('hotel', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='bookings',
                    to='bookings.hotel',
                )),
            ],
        ),
    ]
