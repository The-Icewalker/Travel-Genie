"""
Django management command: seed_data
=====================================
Populates the database with initial development/demo data:

  • Roles          : traveler, admin
  • Users          : admin@travelgenie.com / Admin@123
                     traveler@travelgenie.com / Travel@123
  • Destinations   : Paris/France, Tokyo/Japan, New York/USA
  • Attractions    : 2 per destination with lat/lng coordinates
  • Trip           : 1 sample trip for the traveler user (Paris)
  • Budget         : 1 budget for the sample trip  (if Budget model exists)
  • Expenses       : 2 sample expenses              (if Expense model exists)

Usage
-----
    python manage.py seed_data            # idempotent – safe to run multiple times
    python manage.py seed_data --flush    # delete existing seed data first
"""

import datetime
import decimal
import importlib

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Role, User
from trips.models import Attraction, Destination, Trip


def _import_model(app_label: str, model_name: str):
    """Return a model class from an installed app, or None if unavailable."""
    try:
        module = importlib.import_module(f"{app_label}.models")
        return getattr(module, model_name, None)
    except ModuleNotFoundError:
        return None


class Command(BaseCommand):
    help = "Seed the database with initial demo data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing seed data before inserting.",
        )

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()

        try:
            with transaction.atomic():
                self._seed_roles()
                self._seed_users()
                self._seed_destinations()
                self._seed_trips()
                self._seed_budget_and_expenses()
        except Exception as exc:  # pragma: no cover
            raise CommandError(f"Seeding failed: {exc}") from exc

        self.stdout.write(self.style.SUCCESS("✓ Database seeded successfully."))

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------

    def _flush(self):
        self.stdout.write("  Flushing existing seed data …")
        Trip.objects.filter(title="My Paris Adventure").delete()
        Destination.objects.filter(city__in=["Paris", "Tokyo", "New York"]).delete()
        User.objects.filter(
            email__in=["admin@travelgenie.com", "traveler@travelgenie.com"]
        ).delete()
        Role.objects.filter(role_name__in=[Role.TRAVELER, Role.ADMIN]).delete()
        self.stdout.write("  Done.\n")

    # ------------------------------------------------------------------
    # Roles
    # ------------------------------------------------------------------

    def _seed_roles(self):
        self.stdout.write("  Creating roles …")
        for role_name in [Role.TRAVELER, Role.ADMIN]:
            role, created = Role.objects.get_or_create(role_name=role_name)
            status = "created" if created else "already exists"
            self.stdout.write(f"    Role '{role_name}' {status}.")

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def _seed_users(self):
        self.stdout.write("  Creating users …")

        admin_role = Role.objects.get(role_name=Role.ADMIN)
        traveler_role = Role.objects.get(role_name=Role.TRAVELER)

        # Admin user
        admin_user, created = User.objects.get_or_create(
            email="admin@travelgenie.com",
            defaults={
                "full_name": "TravelGenie Admin",
                "role": admin_role,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        if created:
            admin_user.set_password("Admin@123")
            admin_user.save()
            self.stdout.write("    Admin user created.")
        else:
            self.stdout.write("    Admin user already exists.")

        # Traveler user
        traveler_user, created = User.objects.get_or_create(
            email="traveler@travelgenie.com",
            defaults={
                "full_name": "Demo Traveler",
                "role": traveler_role,
                "is_staff": False,
                "is_superuser": False,
                "is_active": True,
            },
        )
        if created:
            traveler_user.set_password("Travel@123")
            traveler_user.save()
            self.stdout.write("    Traveler user created.")
        else:
            self.stdout.write("    Traveler user already exists.")

        # Store for later use
        self._traveler_user = traveler_user

    # ------------------------------------------------------------------
    # Destinations & Attractions
    # ------------------------------------------------------------------

    DESTINATION_SEED_DATA = [
        {
            "city": "Paris",
            "country": "France",
            "currency_code": "EUR",
            "visa_info": "Schengen visa required for non-EU citizens.",
            "best_season": "Spring (April–June)",
            "attractions": [
                {
                    "name": "Eiffel Tower",
                    "category": "Landmark",
                    "avg_cost": decimal.Decimal("26.00"),
                    "lat": decimal.Decimal("48.858370"),
                    "lng": decimal.Decimal("2.294481"),
                },
                {
                    "name": "Louvre Museum",
                    "category": "Museum",
                    "avg_cost": decimal.Decimal("17.00"),
                    "lat": decimal.Decimal("48.860611"),
                    "lng": decimal.Decimal("2.337644"),
                },
            ],
        },
        {
            "city": "Tokyo",
            "country": "Japan",
            "currency_code": "JPY",
            "visa_info": "Visa-free for many nationalities for up to 90 days.",
            "best_season": "Spring (March–April) for cherry blossoms",
            "attractions": [
                {
                    "name": "Senso-ji Temple",
                    "category": "Religious Site",
                    "avg_cost": decimal.Decimal("0.00"),
                    "lat": decimal.Decimal("35.714765"),
                    "lng": decimal.Decimal("139.796655"),
                },
                {
                    "name": "Shibuya Crossing",
                    "category": "Landmark",
                    "avg_cost": decimal.Decimal("0.00"),
                    "lat": decimal.Decimal("35.659513"),
                    "lng": decimal.Decimal("139.700440"),
                },
            ],
        },
        {
            "city": "New York",
            "country": "USA",
            "currency_code": "USD",
            "visa_info": "ESTA required for Visa Waiver Program countries.",
            "best_season": "Fall (September–November)",
            "attractions": [
                {
                    "name": "Statue of Liberty",
                    "category": "Landmark",
                    "avg_cost": decimal.Decimal("24.30"),
                    "lat": decimal.Decimal("40.689247"),
                    "lng": decimal.Decimal("-74.044502"),
                },
                {
                    "name": "Central Park",
                    "category": "Park",
                    "avg_cost": decimal.Decimal("0.00"),
                    "lat": decimal.Decimal("40.785091"),
                    "lng": decimal.Decimal("-73.968285"),
                },
            ],
        },
    ]

    def _seed_destinations(self):
        self.stdout.write("  Creating destinations and attractions …")

        for dest_data in self.DESTINATION_SEED_DATA:
            attractions_data = dest_data.pop("attractions")

            dest, created = Destination.objects.get_or_create(
                city=dest_data["city"],
                country=dest_data["country"],
                defaults={
                    "currency_code": dest_data["currency_code"],
                    "visa_info": dest_data["visa_info"],
                    "best_season": dest_data["best_season"],
                },
            )
            dest_data["attractions"] = attractions_data  # restore

            status = "created" if created else "already exists"
            self.stdout.write(f"    Destination '{dest}' {status}.")

            for attr_data in attractions_data:
                attraction, a_created = Attraction.objects.get_or_create(
                    destination=dest,
                    name=attr_data["name"],
                    defaults={
                        "category": attr_data["category"],
                        "avg_cost": attr_data["avg_cost"],
                        "lat": attr_data["lat"],
                        "lng": attr_data["lng"],
                    },
                )
                a_status = "created" if a_created else "already exists"
                self.stdout.write(f"      Attraction '{attraction.name}' {a_status}.")

        # Save Paris destination for later
        self._paris = Destination.objects.get(city="Paris", country="France")

    # ------------------------------------------------------------------
    # Trips
    # ------------------------------------------------------------------

    def _seed_trips(self):
        self.stdout.write("  Creating sample trip …")

        trip, created = Trip.objects.get_or_create(
            user=self._traveler_user,
            title="My Paris Adventure",
            defaults={
                "destination": self._paris,
                "start_date": datetime.date(2025, 6, 1),
                "end_date": datetime.date(2025, 6, 10),
                "status": Trip.STATUS_PLANNED,
                "prompt_text": (
                    "Plan a 10-day trip to Paris focusing on art, food, and culture."
                ),
            },
        )
        status = "created" if created else "already exists"
        self.stdout.write(f"    Trip '{trip.title}' {status}.")
        self._trip = trip

    # ------------------------------------------------------------------
    # Budget & Expenses  (graceful if apps not yet installed)
    # ------------------------------------------------------------------

    def _seed_budget_and_expenses(self):
        Budget = _import_model("budget", "Budget")
        Expense = _import_model("budget", "Expense")

        if Budget is None:
            self.stdout.write(
                self.style.WARNING(
                    "  ⚠  'budget' app / Budget model not found – skipping budget seed."
                )
            )
            return

        self.stdout.write("  Creating budget …")

        budget, b_created = Budget.objects.get_or_create(
            trip=self._trip,
            defaults={
                "total_amount": decimal.Decimal("3000.00"),
                "currency": "USD",
            },
        )
        b_status = "created" if b_created else "already exists"
        self.stdout.write(f"    Budget for '{self._trip}' {b_status}.")

        if Expense is None:
            self.stdout.write(
                self.style.WARNING(
                    "  ⚠  Expense model not found – skipping expense seed."
                )
            )
            return

        self.stdout.write("  Creating sample expenses …")

        expenses = [
            {
                "category": "transport",
                "amount": decimal.Decimal("650.00"),
                "spent_on": datetime.date(2025, 6, 1),
            },
            {
                "category": "accommodation",
                "amount": decimal.Decimal("1200.00"),
                "spent_on": datetime.date(2025, 6, 1),
            },
        ]

        for exp_data in expenses:
            try:
                expense, e_created = Expense.objects.get_or_create(
                    trip=self._trip,
                    category=exp_data["category"],
                    spent_on=exp_data["spent_on"],
                    defaults={"amount": exp_data["amount"]},
                )
                e_status = "created" if e_created else "already exists"
                self.stdout.write(f"    Expense '{expense.category}' ({expense.amount}) {e_status}.")
            except Exception as exc:  # pragma: no cover
                self.stdout.write(
                    self.style.WARNING(f"    Could not create expense: {exc}")
                )
