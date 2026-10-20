from django.db import migrations


def add_description_column_if_missing(apps, schema_editor):
    table = 'budget_expense'
    column = 'description'
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute("ALTER TABLE budget_expense ADD COLUMN IF NOT EXISTS description VARCHAR(255) DEFAULT '';")
        elif connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(budget_expense);")
            columns = [row[1] for row in cursor.fetchall()]
            if column not in columns:
                cursor.execute("ALTER TABLE budget_expense ADD COLUMN description VARCHAR(255) DEFAULT '';")
        else:
            try:
                cursor.execute("ALTER TABLE budget_expense ADD COLUMN description VARCHAR(255) DEFAULT '';")
            except Exception:
                pass


class Migration(migrations.Migration):

    dependencies = [
        ('budget', '0002_expense_description_expense_itinerary_item'),
    ]

    operations = [
        migrations.RunPython(
            add_description_column_if_missing,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
