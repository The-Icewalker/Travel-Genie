import { useState, useEffect } from 'react';
import { getTrips } from '../api/trips.js';
import { getBookings, createBooking, deleteBooking } from '../api/bookings.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

export default function Bookings() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Live search parameters
  const [origin, setOrigin] = useState('New York');
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [guests, setGuests] = useState(1);

  // Bookings list & modal
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hub'); // 'hub' | 'reservations'
  const [bookingForm, setBookingForm] = useState({
    booking_type: 'flight',
    provider_name: 'Google Flights',
    confirmation_code: '',
    amount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tripsRes, bookingsRes] = await Promise.all([
        getTrips(),
        getBookings(),
      ]);
      const tripList = tripsRes.data?.results ?? tripsRes.data ?? [];
      setTrips(tripList);

      const bList = bookingsRes.data?.results ?? bookingsRes.data ?? [];
      setBookings(bList);

      if (tripList.length > 0) {
        selectTrip(tripList[0]);
      }
    } catch (err) {
      console.error('Failed to load bookings data', err);
    } finally {
      setLoading(false);
    }
  };

  const selectTrip = (t) => {
    if (!t) return;
    const tId = t.trip_id || t.id;
    setSelectedTripId(String(tId));
    setSelectedTrip(t);

    const destName = t.destination?.city || t.destination?.name || t.destination_detail?.name || t.title || 'Paris';
    setDestination(destName);

    const start = t.start_date || new Date().toISOString().split('T')[0];
    const end = t.end_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    setDepartDate(start);
    setReturnDate(end);
  };

  const handleTripChange = (e) => {
    const id = e.target.value;
    setSelectedTripId(id);
    const found = trips.find((t) => String(t.trip_id || t.id) === String(id));
    if (found) selectTrip(found);
  };

  // Dynamic Deep-Links with URL Parameter Encoding
  const getGoogleFlightsUrl = () => {
    const query = `Flights from ${origin} to ${destination} on ${departDate} through ${returnDate}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
  };

  const getBookingComUrl = () => {
    const params = new URLSearchParams({
      ss: destination,
      checkin: departDate,
      checkout: returnDate,
      group_adults: String(guests),
      no_rooms: '1',
    });
    return `https://www.booking.com/searchresults.html?${params.toString()}`;
  };

  const getAirbnbUrl = () => {
    const params = new URLSearchParams({
      checkin: departDate,
      checkout: returnDate,
      adults: String(guests),
    });
    return `https://www.airbnb.com/s/${encodeURIComponent(destination)}/homes?${params.toString()}`;
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!selectedTripId) {
      setErrorMsg('Please select a trip first.');
      return;
    }
    if (!bookingForm.amount || parseFloat(bookingForm.amount) <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await createBooking({
        trip: parseInt(selectedTripId, 10),
        booking_type: bookingForm.booking_type,
        amount: parseFloat(bookingForm.amount),
        status: 'confirmed',
        confirmation_code: bookingForm.confirmation_code || undefined,
      });

      setSuccessMsg(`Reservation recorded! Expense synced atomically to trip budget.`);
      setBookingForm({
        booking_type: 'flight',
        provider_name: 'Google Flights',
        confirmation_code: '',
        amount: '',
      });

      const res = await getBookings();
      setBookings(res.data?.results ?? res.data ?? []);
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to save reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this booking record?')) return;
    try {
      await deleteBooking(id);
      const res = await getBookings();
      setBookings(res.data?.results ?? res.data ?? []);
    } catch (err) {
      alert('Failed to delete booking.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 tg-rise">
        <div>
          <div className="tg-label mb-3" style={{ color: 'var(--coral)' }}>
            Reservations & Meta-Search
          </div>
          <h1 className="tg-serif text-5xl md:text-6xl font-bold leading-[0.95]">
            Live Bookings Hub
          </h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--ink-2)' }}>
            Dynamic multi-provider search across Google Flights, Booking.com, and Airbnb with synced trip parameters.
          </p>
        </div>

        {/* Target Trip Selector */}
        {trips.length > 0 && (
          <label className="flex items-center gap-3">
            <span className="tg-label">Trip</span>
            <select
              className="tg-input w-64"
              value={selectedTripId}
              onChange={handleTripChange}
            >
              {trips.map((t) => (
                <option key={t.trip_id || t.id} value={t.trip_id || t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <button
          onClick={() => setActiveTab('hub')}
          className="px-6 py-3 font-bold text-sm transition-all border-b-2"
          style={{
            borderColor: activeTab === 'hub' ? 'var(--coral)' : 'transparent',
            color: activeTab === 'hub' ? 'var(--coral)' : 'var(--mute)',
          }}
        >
          🌐 3-Provider Live Search
        </button>
        <button
          onClick={() => setActiveTab('reservations')}
          className="px-6 py-3 font-bold text-sm transition-all border-b-2"
          style={{
            borderColor: activeTab === 'reservations' ? 'var(--coral)' : 'transparent',
            color: activeTab === 'reservations' ? 'var(--coral)' : 'var(--mute)',
          }}
        >
          📋 Logged Reservations ({bookings.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : activeTab === 'hub' ? (
        <div className="space-y-8">
          {/* Dynamic Search Parameters Bar */}
          <div className="tg-card p-6 shadow-sm">
            <div className="tg-label mb-4" style={{ color: 'var(--sun)' }}>
              Bound Search Parameters
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--mute)] uppercase tracking-wider mb-1">
                  Origin City
                </label>
                <input
                  type="text"
                  className="tg-input"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. New York, JFK"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--mute)] uppercase tracking-wider mb-1">
                  Destination
                </label>
                <input
                  type="text"
                  className="tg-input"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Tokyo, Japan"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--mute)] uppercase tracking-wider mb-1">
                  Departure Date
                </label>
                <input
                  type="date"
                  className="tg-input"
                  value={departDate}
                  onChange={(e) => setDepartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--mute)] uppercase tracking-wider mb-1">
                  Return Date
                </label>
                <input
                  type="date"
                  className="tg-input"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--mute)] uppercase tracking-wider mb-1">
                  Guests
                </label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  className="tg-input"
                  value={guests}
                  onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
            </div>
          </div>

          {/* 3 Provider Live Cards */}
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {/* 1. Google Flights Card */}
            <div className="tg-card p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300 border-t-4 border-t-blue-500">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">✈️</span>
                  <span
                    className="text-xs font-extrabold uppercase px-3 py-1 rounded-full"
                    style={{ background: '#dbeafe', color: '#1d4ed8' }}
                  >
                    Air Travel
                  </span>
                </div>
                <h3 className="tg-serif text-2xl font-bold mb-2">Google Flights</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
                  Deep-linked turn-key flight comparison engine. Pre-populates round-trip routes, travel dates, and lowest fare graphs.
                </p>

                <div className="p-4 rounded-xl text-xs space-y-1 mb-6 font-mono" style={{ background: 'var(--sand)' }}>
                  <div className="text-[var(--mute)] font-sans font-bold uppercase text-[10px]">Encoded Routing</div>
                  <div className="truncate font-semibold text-[var(--ink)]">
                    {origin} → {destination}
                  </div>
                  <div className="text-[var(--mute)]">{departDate} to {returnDate}</div>
                </div>
              </div>

              <a
                href={getGoogleFlightsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="tg-btn w-full justify-center text-center font-bold text-sm py-3 transition shadow-md"
                style={{ background: '#1a73e8', color: '#ffffff' }}
              >
                Search Google Flights ↗
              </a>
            </div>

            {/* 2. Booking.com Card */}
            <div className="tg-card p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300 border-t-4 border-t-indigo-600">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">🏨</span>
                  <span
                    className="text-xs font-extrabold uppercase px-3 py-1 rounded-full"
                    style={{ background: '#e0e7ff', color: '#4338ca' }}
                  >
                    Hotels & Resorts
                  </span>
                </div>
                <h3 className="tg-serif text-2xl font-bold mb-2">Booking.com</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
                  Instant accommodation search with synchronized city boundaries, check-in/out timestamps, and guest count binding.
                </p>

                <div className="p-4 rounded-xl text-xs space-y-1 mb-6 font-mono" style={{ background: 'var(--sand)' }}>
                  <div className="text-[var(--mute)] font-sans font-bold uppercase text-[10px]">Encoded Query</div>
                  <div className="truncate font-semibold text-[var(--ink)]">
                    📍 {destination}
                  </div>
                  <div className="text-[var(--mute)]">{departDate} · {guests} Guest{guests > 1 ? 's' : ''}</div>
                </div>
              </div>

              <a
                href={getBookingComUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="tg-btn w-full justify-center text-center font-bold text-sm py-3 transition shadow-md"
                style={{ background: '#003580', color: '#ffffff' }}
              >
                Search on Booking.com ↗
              </a>
            </div>

            {/* 3. Airbnb Card */}
            <div className="tg-card p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300 border-t-4 border-t-rose-500">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">🏡</span>
                  <span
                    className="text-xs font-extrabold uppercase px-3 py-1 rounded-full"
                    style={{ background: '#ffe4e6', color: '#e11d48' }}
                  >
                    Vacation Rentals
                  </span>
                </div>
                <h3 className="tg-serif text-2xl font-bold mb-2">Airbnb</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
                  Hand-picked local stays and apartments with destination query path, stay duration, and party size parameters.
                </p>

                <div className="p-4 rounded-xl text-xs space-y-1 mb-6 font-mono" style={{ background: 'var(--sand)' }}>
                  <div className="text-[var(--mute)] font-sans font-bold uppercase text-[10px]">Encoded Homes URL</div>
                  <div className="truncate font-semibold text-[var(--ink)]">
                    /homes?checkin={departDate}
                  </div>
                  <div className="text-[var(--mute)]">checkout={returnDate} · {guests} Adult{guests > 1 ? 's' : ''}</div>
                </div>
              </div>

              <a
                href={getAirbnbUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="tg-btn w-full justify-center text-center font-bold text-sm py-3 transition shadow-md"
                style={{ background: '#FF5A5F', color: '#ffffff' }}
              >
                Explore on Airbnb ↗
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* Logged Reservations & Direct Booking Tab */
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* Left: Bookings table */}
          <div className="tg-card p-8">
            <h2 className="tg-serif text-2xl font-bold mb-4">Confirmed Reservations</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
              Creating a booking automatically records a verified expense transaction in PostgreSQL.
            </p>

            {bookings.length === 0 ? (
              <div className="p-8 text-center rounded-2xl" style={{ background: 'var(--sand)', color: 'var(--mute)' }}>
                No reservations saved yet. Record a flight or hotel booking to link it with your trip budget!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--mute)' }}>
                      <th className="py-3 px-2">Type</th>
                      <th className="py-3 px-2">Trip</th>
                      <th className="py-3 px-2">Code</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Amount</th>
                      <th className="py-3 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {bookings.map((b) => {
                      const bId = b.booking_id || b.id;
                      const tripObj = trips.find((t) => (t.trip_id || t.id) === b.trip);
                      return (
                        <tr key={bId} className="hover:bg-black/5 transition">
                          <td className="py-4 px-2 font-bold capitalize">
                            <span className="mr-2">{b.booking_type === 'flight' ? '✈️' : '🏨'}</span>
                            {b.booking_type}
                          </td>
                          <td className="py-4 px-2 text-[var(--ink-2)] truncate max-w-[140px]">
                            {tripObj?.title || `Trip #${b.trip}`}
                          </td>
                          <td className="py-4 px-2 font-mono text-xs">
                            {b.confirmation_code || '—'}
                          </td>
                          <td className="py-4 px-2">
                            <span
                              className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full"
                              style={{ background: 'var(--sea-soft)', color: 'var(--sea)' }}
                            >
                              {b.status || 'Confirmed'}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right font-bold tg-serif text-base">
                            ${Number(b.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button
                              onClick={() => handleDelete(bId)}
                              className="h-8 w-8 rounded-full inline-flex items-center justify-center text-xs font-bold transition hover:scale-105 cursor-pointer"
                              style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}
                              title="Delete booking"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Record reservation form */}
          <form
            onSubmit={handleCreateReservation}
            className="tg-card p-7 space-y-4 shadow-xl"
            style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
          >
            <h2 className="tg-serif text-2xl font-bold">Record Reservation</h2>
            <p className="text-xs text-[var(--mute)]">
              Saves booking and logs atomic expense to your trip.
            </p>

            {successMsg && (
              <div className="p-3 rounded-xl text-xs font-bold" style={{ background: 'var(--sea)', color: '#fff' }}>
                ✅ {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 rounded-xl text-xs font-bold" style={{ background: 'var(--coral)', color: '#fff' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="tg-label text-xs" style={{ color: 'var(--sun)' }}>Associated Trip *</span>
              <select
                className="tg-input text-sm"
                style={{ color: 'var(--ink)' }}
                value={selectedTripId}
                onChange={handleTripChange}
                required
              >
                <option value="">Select trip</option>
                {trips.map((t) => (
                  <option key={t.trip_id || t.id} value={t.trip_id || t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="tg-label text-xs" style={{ color: 'var(--sun)' }}>Booking Type</span>
              <select
                className="tg-input text-sm"
                style={{ color: 'var(--ink)' }}
                value={bookingForm.booking_type}
                onChange={(e) => setBookingForm({ ...bookingForm, booking_type: e.target.value })}
              >
                <option value="flight">✈️ Flight Reservation</option>
                <option value="hotel">🏨 Hotel / Accommodation</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="tg-label text-xs" style={{ color: 'var(--sun)' }}>Amount ($) *</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="350.00"
                className="tg-input text-sm"
                style={{ color: 'var(--ink)' }}
                value={bookingForm.amount}
                onChange={(e) => setBookingForm({ ...bookingForm, amount: e.target.value })}
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="tg-label text-xs" style={{ color: 'var(--sun)' }}>Confirmation Code</span>
              <input
                type="text"
                placeholder="e.g. TG-FL-8921"
                className="tg-input text-sm font-mono"
                style={{ color: 'var(--ink)' }}
                value={bookingForm.confirmation_code}
                onChange={(e) => setBookingForm({ ...bookingForm, confirmation_code: e.target.value })}
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="tg-btn w-full justify-center text-sm font-bold py-3 mt-4"
              style={{ background: 'var(--coral)', color: 'var(--paper)' }}
            >
              {submitting ? 'Recording...' : '+ Record & Sync Expense'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
