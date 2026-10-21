import { Link } from 'react-router-dom';

const STATUS_COLORS = {
  planned:   ['var(--sea)',    'var(--sea-soft)'],
  active:    ['var(--moss)',   'var(--moss-soft)'],
  completed: ['var(--ink-2)', 'var(--line)'],
  cancelled: ['var(--coral)', 'var(--coral-soft)'],
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Pill({ status }) {
  const [c, bg] = STATUS_COLORS[status] || STATUS_COLORS.planned;
  return (
    <span
      className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
      style={{ color: c, background: bg }}
    >
      {status || 'planned'}
    </span>
  );
}

/**
 * Editorial Boarding Pass Trip Card
 * @param {{ trip: object }} props
 */
export default function TripCard({ trip }) {
  const nights = Math.max(
    1,
    Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 864e5)
  );
  const code = (trip.destination_detail?.city || trip.destination || trip.title || '???')
    .slice(0, 3)
    .toUpperCase();

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="tg-card text-left flex overflow-hidden group transition hover:-translate-y-1 block shadow-sm hover:shadow-md"
    >
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="tg-label">
              {trip.destination_detail?.country || trip.destination || 'Destination'}
            </div>
            <h3
              className="tg-serif text-2xl font-bold mt-1 group-hover:underline decoration-[var(--coral)] underline-offset-4"
              style={{ color: 'var(--ink)' }}
            >
              {trip.title}
            </h3>
          </div>
          <Pill status={trip.status} />
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div>
            <div className="tg-label">Depart</div>
            <div className="font-bold text-sm">{formatDate(trip.start_date)}</div>
          </div>
          <div className="flex-1 flex items-center gap-2" style={{ color: 'var(--mute)' }}>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 16l20-8-20-8 4 8-4 8zm4-8h16" />
            </svg>
            <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: 'var(--line)' }} />
          </div>
          <div className="text-right">
            <div className="tg-label">Return</div>
            <div className="font-bold text-sm">{formatDate(trip.end_date)}</div>
          </div>
        </div>

        {trip.total_cost != null && (
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[var(--mute)] uppercase tracking-wider font-bold">Estimated Cost</span>
            <span className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
              ${Number(trip.total_cost).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div
        className="tg-perf w-28 flex flex-col items-center justify-center gap-1 p-4"
        style={{ background: 'var(--sand)' }}
      >
        <div className="tg-serif text-3xl font-bold" style={{ color: 'var(--coral)' }}>
          {code}
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--mute)' }}>
          {nights} nights
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
          {trip.status || 'planned'}
        </div>
      </div>
    </Link>
  );
}
