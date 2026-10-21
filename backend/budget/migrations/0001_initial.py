from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('trips', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Budget',
            fields=[
                ('budget_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('currency', models.CharField(default='USD', max_length=10)),
                ('trip', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='budget',
                    to='trips.trip',
                )),
            ],
        ),
        migrations.CreateModel(
            name='Expense',
            fields=[
                ('expense_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('category', models.CharField(
                    choices=[
                        ('transport', 'Transport'),
                        ('accommodation', 'Accommodation'),
                        ('food', 'Food'),
                        ('activities', 'Activities'),
                        ('shopping', 'Shopping'),
                        ('other', 'Other'),
                    ],
                    max_length=30,
                )),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('spent_on', models.DateField()),
                ('trip', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='expenses',
                    to='trips.trip',
                )),
            ],
        ),
    ]
