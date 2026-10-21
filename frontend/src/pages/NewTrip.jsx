import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip } from '../api/trips.js';
import { generateTripPlan } from '../api/ai.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AiEngineSelector from '../components/AiEngineSelector.jsx';

const INSPIRATION_PRESETS = [
  {
    title: 'Kyoto & Tokyo Blossom Route',
    destination: 'Kyoto, Japan',
    days: 7,
    tag: 'Culture & Gastronomy',
    prompt: '7-day cultural expedition through Kyoto and Tokyo. Focus on traditional tea ceremonies, Arashiyama bamboo forest, Fushimi Inari at sunrise, Tsukiji food market, and boutique ryokans. Budget: $3,500.',
  },
  {
    title: 'Amalfi Coast Cliffside Voyage',
    destination: 'Positano, Italy',
    days: 5,
    tag: 'Scenic & Coastal',
    prompt: '5 days exploring Positano, Ravello, and Capri. Include lemon grove dining, Path of the Gods hike, sunset sailing around the Faraglioni rocks, and seaside trattorias. Budget: $2,800.',
  },
  {
    title: 'Swiss Glacier Scenic Rails',
    destination: 'Zermatt, Switzerland',
    days: 6,
    tag: 'Alpine & Nature',
    prompt: '6 days alpine journey riding the Glacier Express from Zermatt to St. Moritz. Focus on panoramic train rides, Matterhorn views, alpine fondue, and cogwheel railway excursions. Budget: $4,200.',
  },
  {
    title: 'Parisian Art & Patisseries',
    destination: 'Paris, France',
    days: 4,
    tag: 'Art & Architecture',
    prompt: '4 days in Paris exploring Marais art galleries, Musee d’Orsay, hidden courtyard cafes in Montmartre, and an evening Seine cruise. Budget: $2,000.',
  },
];

export default function NewTrip() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // 'form' | 'generating' | 'result'

  const [form, setForm] = useState({
    title: '',
    destination: '',
    start_date: '',
    end_date: '',
    prompt_text: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [aiEngine, setAiEngine] = useState('slm'); // 'slm' | 'gemini' | 'auto'
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [createdTripId, setCreatedTripId] = useState(null);

  // Rotating inspiring quotes while generating
  const [quoteIdx, setQuoteIdx] = useState(0);
  const quotes = [
    'Consulting local climate, topography & transit routes…',
    'Curating hidden gems, local cafes & iconic sights…',
    'Synthesising custom day-by-day schedules…',
    'Finalising your personalised luxury itinerary…',
  ];

  useEffect(() => {
    if (step !== 'generating') return;
    const interval = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % quotes.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [step]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setError('');
  };

  const applyPreset = (preset) => {
    const start = new Date();
    start.setDate(start.getDate() + 30);
    const end = new Date(start);
    end.setDate(end.getDate() + preset.days);

    setForm({
      title: preset.title,
      destination: preset.destination,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      prompt_text: preset.prompt,
    });
    setFieldErrors({});
    setError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Trip title is required.';
    if (!form.destination.trim()) errs.destination = 'Destination is required.';
    if (!form.start_date) errs.start_date = 'Start date is required.';
    if (!form.end_date) errs.end_date = 'End date is required.';
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      errs.end_date = 'End date must be after start date.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setStep('generating');
    setError('');

    let tripId = null;
    try {
      // 1. Create trip record
      const tripRes = await createTrip({
        title: form.title,
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      const trip = tripRes.data;
      tripId = trip.trip_id || trip.id;
      setCreatedTripId(tripId);

      // 2. If prompt provided, invoke AI planner
      if (form.prompt_text.trim()) {
        try {
          const aiRes = await generateTripPlan(tripId, form.prompt_text, null, aiEngine);
          setGeneratedPlan(aiRes.data);
        } catch (aiErr) {
          console.warn('AI planning note:', aiErr);
        }
      }

      setStep('result');
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        for (const [key, val] of Object.entries(data)) {
          mapped[key] = Array.isArray(val) ? val[0] : val;
        }
        setFieldErrors(mapped);
        if (data.detail) {
          setError(data.detail);
        } else if (data.non_field_errors) {
          setError(Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors);
        }
      } else {
        setError('Failed to create trip. Please verify your details.');
      }
      setStep('form');
    }
  };

  // Generating Step
  if (step === 'generating') {
    return (
      <div className="max-w-xl mx-auto py-16 text-center tg-rise">
        <div className="tg-card p-12 relative overflow-hidden shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm border border-[var(--line)]"
               style={{ background: 'var(--coral-soft)' }}>
            <span className="tg-float">🧭</span>
          </div>

          <div className="tg-label mb-2" style={{ color: 'var(--coral)' }}>
            AI Concierge At Work
          </div>
          <h2 className="tg-serif text-3xl md:text-4xl font-bold" style={{ color: 'var(--ink)' }}>
            Crafting Your Itinerary
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-2)] max-w-sm mx-auto">
            Structuring daily excursions, transit timings, and curated recommendations for <strong>{form.destination}</strong>.
          </p>

          <div className="mt-8 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>

          <div className="mt-8 pt-6 border-t border-dashed" style={{ borderColor: 'var(--line)' }}>
            <p className="text-xs font-semibold text-[var(--mute)] transition-all duration-500 min-h-[1.5rem]">
              ✨ {quotes[quoteIdx]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Result Step
  if (step === 'result') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 tg-rise">
        {/* Ticket Header */}
        <div className="tg-card overflow-hidden shadow-xl">
          <div className="px-6 py-4 flex items-center justify-between"
               style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎟️</span>
              <span className="font-bold text-sm tracking-wider uppercase">Trip Confirmed</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
                  style={{ background: 'var(--coral)', color: 'var(--paper)' }}>
              Ready to Explore
            </span>
          </div>

          <div className="p-8 text-center">
            <div className="tg-serif text-4xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
              {form.title}
            </div>
            <p className="text-base font-medium flex items-center justify-center gap-2" style={{ color: 'var(--sea)' }}>
              <span>📍</span> {form.destination}
              <span className="text-[var(--mute)]">•</span>
              <span>📅 {form.start_date} → {form.end_date}</span>
            </p>
          </div>
        </div>

        {/* AI Itinerary summary if created */}
        {generatedPlan && (
          <div className="tg-card p-6 shadow-md">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                   style={{ background: 'var(--sun-soft)', color: 'var(--sun)' }}>
                🤖
              </div>
              <div>
                <h3 className="tg-serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                  Bespoke AI Itinerary
                </h3>
                <p className="text-xs text-[var(--mute)] flex items-center gap-2">
                  <span>Curated specifically from your prompts & preferences</span>
                  {(generatedPlan?.engine_used || aiEngine) && (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--ink)] text-white">
                      Engine: {generatedPlan?.engine_used || aiEngine}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {generatedPlan.days?.length > 0 ? (
                generatedPlan.days.map((d) => (
                  <div key={d.day_number} className="p-4 rounded-2xl border" style={{ background: 'var(--sand)', borderColor: 'var(--line)' }}>
                    <div className="font-bold text-sm text-[var(--ink)] mb-2 flex items-center justify-between">
                      <span>Day {d.day_number}: {d.summary}</span>
                      <span className="text-xs font-semibold text-[var(--mute)]">{d.items?.length || 0} activities</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[var(--ink-2)]">
                      {d.items?.map((it, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-[var(--coral)] font-bold">•</span>
                          {it.start_time && (
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[10px] bg-white border border-[var(--line)]">
                              {it.start_time}
                            </span>
                          )}
                          <span className="font-medium text-[var(--ink)]">{it.title}</span>
                          {it.est_cost > 0 && (
                            <span className="text-[var(--mute)] ml-auto font-semibold">${it.est_cost}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--ink-2)] leading-relaxed">
                  {typeof generatedPlan.itinerary === 'string'
                    ? generatedPlan.itinerary
                    : JSON.stringify(generatedPlan.itinerary || generatedPlan, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(`/trips/${createdTripId}`)}
            className="tg-btn flex-1 justify-center py-3.5 text-base shadow-lg"
          >
            <span>View Complete Itinerary →</span>
          </button>
          <button
            onClick={() => navigate('/trips')}
            className="tg-ghost flex-1 justify-center py-3.5 text-base"
          >
            Back to All Trips
          </button>
        </div>
      </div>
    );
  }

  // Default Form Step
  return (
    <div className="max-w-3xl mx-auto space-y-8 tg-rise">
      {/* Title */}
      <div>
        <div className="tg-label mb-2" style={{ color: 'var(--coral)' }}>
          Concierge Studio
        </div>
        <h1 className="tg-serif text-4xl md:text-5xl font-bold" style={{ color: 'var(--ink)' }}>
          Design Your Next Journey
        </h1>
        <p className="mt-2 text-base" style={{ color: 'var(--ink-2)' }}>
          Set your route, specify your travel window, and let our intelligent AI planner draft a bespoke daily itinerary.
        </p>
      </div>

      {/* Inspiring Presets */}
      <div>
        <div className="tg-label mb-3">Quick Inspiration Presets</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INSPIRATION_PRESETS.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => applyPreset(p)}
              className="tg-card p-4 text-left transition hover:-translate-y-1 hover:border-[var(--coral)] group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[var(--coral)]">{p.tag}</span>
                <span className="text-[var(--mute)] font-medium">{p.days} Days</span>
              </div>
              <div className="font-bold text-sm text-[var(--ink)] group-hover:text-[var(--coral)] transition-colors">
                {p.title}
              </div>
              <div className="text-xs text-[var(--mute)] mt-1 truncate">
                {p.destination}
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="p-4 rounded-2xl border text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--coral-soft)', borderColor: 'var(--coral)', color: 'var(--coral)' }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Trip Planning Form */}
      <form onSubmit={handleSubmit} className="tg-card p-8 space-y-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="title" className="tg-label block mb-1.5">
              Trip Title <span className="text-[var(--coral)]">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={form.title}
              onChange={handleChange}
              className={`tg-input ${fieldErrors.title ? '!border-[var(--coral)]' : ''}`}
              placeholder="e.g. Japanese Gardens & Temples"
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-[var(--coral)] font-medium">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="destination" className="tg-label block mb-1.5">
              Destination <span className="text-[var(--coral)]">*</span>
            </label>
            <input
              id="destination"
              name="destination"
              type="text"
              required
              value={form.destination}
              onChange={handleChange}
              className={`tg-input ${fieldErrors.destination ? '!border-[var(--coral)]' : ''}`}
              placeholder="e.g. Kyoto, Japan"
            />
            {fieldErrors.destination && (
              <p className="mt-1 text-xs text-[var(--coral)] font-medium">{fieldErrors.destination}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="start_date" className="tg-label block mb-1.5">
              Departure Date <span className="text-[var(--coral)]">*</span>
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              value={form.start_date}
              onChange={handleChange}
              className={`tg-input ${fieldErrors.start_date ? '!border-[var(--coral)]' : ''}`}
            />
            {fieldErrors.start_date && (
              <p className="mt-1 text-xs text-[var(--coral)] font-medium">{fieldErrors.start_date}</p>
            )}
          </div>

          <div>
            <label htmlFor="end_date" className="tg-label block mb-1.5">
              Return Date <span className="text-[var(--coral)]">*</span>
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              required
              min={form.start_date || undefined}
              value={form.end_date}
              onChange={handleChange}
              className={`tg-input ${fieldErrors.end_date ? '!border-[var(--coral)]' : ''}`}
            />
            {fieldErrors.end_date && (
              <p className="mt-1 text-xs text-[var(--coral)] font-medium">{fieldErrors.end_date}</p>
            )}
          </div>
        </div>

        {/* AI Planner Section */}
        <div className="pt-4 border-t space-y-5" style={{ borderColor: 'var(--line)' }}>
          {/* AI Engine Selector */}
          <AiEngineSelector value={aiEngine} onChange={setAiEngine} />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✨</span>
              <label htmlFor="prompt_text" className="tg-label">
                AI Travel Concierge Prompts <span className="text-[var(--mute)] font-normal">(Optional)</span>
              </label>
            </div>
            <textarea
              id="prompt_text"
              name="prompt_text"
              rows={4}
              value={form.prompt_text}
              onChange={handleChange}
              className="tg-input resize-none"
              placeholder="Tell us your travel style, dietary preferences, pace, interests (e.g. art, hikes, hidden bistros), and total budget target…"
            />
            <p className="mt-2 text-xs text-[var(--mute)]">
              {aiEngine === 'slm' && '⚡ Powered by local SLM (qwen-local via Ollama). High speed, private & offline capable.'}
              {aiEngine === 'gemini' && '✨ Powered by Google Gemini Pro API in the cloud.'}
              {aiEngine === 'auto' && '🔄 Auto Engine: Uses local qwen-local first, automatically falling back to Gemini if offline.'}
            </p>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" className="tg-btn flex-1 justify-center py-3.5 text-base">
            {form.prompt_text.trim() ? '✨ Curate & Generate AI Itinerary' : 'Create Trip Ticket →'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/trips')}
            className="tg-ghost text-center py-3.5 px-6"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
