from django.db import migrations


CREATE_TRIP_COST_SUMMARY_VIEW = """
CREATE OR REPLACE VIEW v_trip_cost_summary AS
SELECT
    t.trip_id,
    t.title,
    b.total_amount,
    COALESCE(SUM(e.amount), 0) AS total_spent,
    b.total_amount - COALESCE(SUM(e.amount), 0) AS remaining
FROM trips_trip t
LEFT JOIN budget_budget b ON b.trip_id = t.trip_id
LEFT JOIN budget_expense e ON e.trip_id = t.trip_id
GROUP BY t.trip_id, t.title, b.total_amount;
"""

DROP_TRIP_COST_SUMMARY_VIEW = "DROP VIEW IF EXISTS v_trip_cost_summary;"

CREATE_SP_TRIP_BUDGET_REPORT = """
CREATE OR REPLACE FUNCTION sp_trip_budget_report(p_trip_id INT)
RETURNS TABLE(category VARCHAR, total_spent NUMERIC)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT e.category, SUM(e.amount)
    FROM budget_expense e
    WHERE e.trip_id = p_trip_id
    GROUP BY e.category;
END;
$$;
"""

DROP_SP_TRIP_BUDGET_REPORT = "DROP FUNCTION IF EXISTS sp_trip_budget_report(INT);"

CREATE_TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION trg_expense_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_budget NUMERIC;
    v_spent  NUMERIC;
BEGIN
    SELECT total_amount INTO v_budget
    FROM budget_budget
    WHERE trip_id = NEW.trip_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_spent
    FROM budget_expense
    WHERE trip_id = NEW.trip_id;

    IF v_spent > v_budget THEN
        UPDATE trips_trip
        SET status = 'over_budget'
        WHERE trip_id = NEW.trip_id;
    END IF;

    RETURN NEW;
END;
$$;
"""

CREATE_TRIGGER = """
DROP TRIGGER IF EXISTS trg_expense_after_insert ON budget_expense;
CREATE TRIGGER trg_expense_after_insert
AFTER INSERT ON budget_expense
FOR EACH ROW
EXECUTE FUNCTION trg_expense_audit();
"""

DROP_TRIGGER = """
DROP TRIGGER IF EXISTS trg_expense_after_insert ON budget_expense;
DROP FUNCTION IF EXISTS trg_expense_audit();
"""

CREATE_INDICES = """
CREATE INDEX IF NOT EXISTS idx_trip_user ON trips_trip(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_destination ON trips_trip(destination_id);
CREATE INDEX IF NOT EXISTS idx_trip_status ON trips_trip(status);
CREATE INDEX IF NOT EXISTS idx_itineraryday_trip ON trips_itineraryday(trip_id);
CREATE INDEX IF NOT EXISTS idx_itineraryitem_day ON trips_itineraryitem(day_id);
CREATE INDEX IF NOT EXISTS idx_expense_trip ON budget_expense(trip_id);
CREATE INDEX IF NOT EXISTS idx_booking_trip ON bookings_booking(trip_id);
"""

DROP_INDICES = """
DROP INDEX IF EXISTS idx_trip_user;
DROP INDEX IF EXISTS idx_trip_destination;
DROP INDEX IF EXISTS idx_trip_status;
DROP INDEX IF EXISTS idx_itineraryday_trip;
DROP INDEX IF EXISTS idx_itineraryitem_day;
DROP INDEX IF EXISTS idx_expense_trip;
DROP INDEX IF EXISTS idx_booking_trip;
"""


def apply_raw_sql(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    with schema_editor.connection.cursor() as cursor:
        if vendor == 'postgresql':
            cursor.execute(CREATE_TRIP_COST_SUMMARY_VIEW)
            cursor.execute(CREATE_SP_TRIP_BUDGET_REPORT)
            cursor.execute(CREATE_TRIGGER_FUNCTION + CREATE_TRIGGER)
            for stmt in CREATE_INDICES.strip().split(';'):
                if stmt.strip():
                    cursor.execute(stmt)
        elif vendor == 'sqlite':
            cursor.execute(DROP_TRIP_COST_SUMMARY_VIEW)
            sqlite_view = """
            CREATE VIEW IF NOT EXISTS v_trip_cost_summary AS
            SELECT
                t.trip_id,
                t.title,
                b.total_amount,
                COALESCE(SUM(e.amount), 0) AS total_spent,
                b.total_amount - COALESCE(SUM(e.amount), 0) AS remaining
            FROM trips_trip t
            LEFT JOIN budget_budget b ON b.trip_id = t.trip_id
            LEFT JOIN budget_expense e ON e.trip_id = t.trip_id
            GROUP BY t.trip_id, t.title, b.total_amount;
            """
            cursor.execute(sqlite_view)
            for stmt in CREATE_INDICES.strip().split(';'):
                if stmt.strip():
                    cursor.execute(stmt)


def revert_raw_sql(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    with schema_editor.connection.cursor() as cursor:
        if vendor == 'postgresql':
            cursor.execute(DROP_TRIGGER)
            cursor.execute(DROP_SP_TRIP_BUDGET_REPORT)
            cursor.execute(DROP_TRIP_COST_SUMMARY_VIEW)
            for stmt in DROP_INDICES.strip().split(';'):
                if stmt.strip():
                    cursor.execute(stmt)
        elif vendor == 'sqlite':
            cursor.execute(DROP_TRIP_COST_SUMMARY_VIEW)
            for stmt in DROP_INDICES.strip().split(';'):
                if stmt.strip():
                    cursor.execute(stmt)


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0001_initial'),
        ('budget', '0001_initial'),
        ('bookings', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(apply_raw_sql, revert_raw_sql),
    ]
