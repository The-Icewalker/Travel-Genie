import { useEffect, useState } from 'react';
import { getTrips } from '../api/trips.js';
import {
  getExpenses,
  createExpense,
  deleteExpense,
  getSpendByCategory,
  getBudgets,
  setTripBudget,
} from '../api/budget.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const CATEGORIES = ['food', 'accommodation', 'transport', 'activities', 'shopping', 'health', 'other'];

const CAT_META = {
  food:          { emoji: '🍜', label: 'Food & Dining', color: 'var(--sun)',    soft: 'var(--sun-soft)' },
  accommodation: { emoji: '🏨', label: 'Hotel & Stay',  color: 'var(--sea)',    soft: 'var(--sea-soft)' },
  transport:     { emoji: '✈️', label: 'Transport',     color: 'var(--coral)',  soft: 'var(--coral-soft)' },
  activities:    { emoji: '🎟️', label: 'Activities',    color: 'var(--moss)',   soft: 'var(--moss-soft)' },
  shopping:      { emoji: '🛍️', label: 'Shopping',      color: 'var(--ink-2)', soft: 'var(--line)' },
  health:        { emoji: '💊', label: 'Health',        color: 'var(--coral)',  soft: 'var(--coral-soft)' },
  other:         { emoji: '📦', label: 'General / Other', color: 'var(--ink-2)', soft: 'var(--line)' },
};

const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmt   = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function Budget() {
  const [trips,        setTrips]        = useState([]);
  const [expenses,     setExpenses]     = useState([]);
  const [byCategory,   setByCategory]   = useState([]);
  const [selectedTrip, setSelectedTrip] = useState('');
  const [targetBudget, setTargetBudget] = useState(0);
  const [currency,     setCurrency]     = useState('USD');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // Active top-level tab: 'overview' | 'set-target'
  const [activeTab, setActiveTab] = useState('overview');

  // Expense form state
  const [form, setForm] = useState({
    trip: '', category: 'food', amount: '', description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [formError,  setFormError]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Set Trip Budget target form state
  const [budgetTargetInput, setBudgetTargetInput] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetMsg, setTargetMsg] = useState('');
  const [targetErr, setTargetErr] = useState('');

  const loadData = async (tripId = '') => {
    setLoading(true); setError('');
    try {
      const [tripsRes, expRes, catRes, budgetRes] = await Promise.all([
        getTrips(),
        getExpenses(tripId || undefined),
        getSpendByCategory(tripId || undefined),
        getBudgets(tripId || undefined),
      ]);
      const tripList = tripsRes.data?.results ?? tripsRes.data ?? [];
      setTrips(tripList);

      setExpenses(expRes.data?.results ?? expRes.data ?? []);
      const catData = catRes.data?.results ?? catRes.data ?? [];
      setByCategory(Array.isArray(catData) ? catData
        : Object.entries(catData).map(([category, total]) => ({ category, total })));

      // Budget targets
      const bList = budgetRes.data?.results ?? budgetRes.data ?? [];
      if (tripId && bList.length > 0) {
        const found = bList.find((b) => String(b.trip) === String(tripId)) || bList[0];
        const val = parseFloat(found.total_amount || 0);
        setTargetBudget(val);
        setBudgetTargetInput(String(val));
        if (found.currency) setCurrency(found.currency);
      } else if (!tripId && bList.length > 0) {
        const sumTarget = bList.reduce((acc, b) => acc + parseFloat(b.total_amount || 0), 0);
        setTargetBudget(sumTarget);
        setBudgetTargetInput(String(sumTarget));
      } else {
        setTargetBudget(0);
        setBudgetTargetInput('');
      }

      // Auto-select trip in form if none selected yet
      if (tripList.length > 0 && !form.trip) {
        const firstId = tripList[0].trip_id || tripList[0].id;
        setForm((f) => ({ ...f, trip: String(firstId) }));
      }
    } catch {
      setError('Failed to load budget data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(selectedTrip); }, [selectedTrip]);

  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    const lower = val.toLowerCase();
    let newCat = form.category;

    if (/food|dining|lunch|dinner|breakfast|meal|restaurant|cafe|eat|coffee|snack|grocer/.test(lower)) {
      newCat = 'food';
    } else if (/hotel|motel|airbnb|hostel|resort|stay|room|accommodation|lodging/.test(lower)) {
      newCat = 'accommodation';
    } else if (/flight|airline|train|uber|taxi|cab|bus|metro|transit|subway|gas|fuel/.test(lower)) {
      newCat = 'transport';
    } else if (/museum|tour|ticket|attraction|park|hike|activity|excursion/.test(lower)) {
      newCat = 'activities';
    } else if (/shopping|souvenir|gift|clothes|mall|store/.test(lower)) {
      newCat = 'shopping';
    }

    setForm((f) => ({ ...f, description: val, category: newCat }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) {
      setFormError('Please enter a valid positive amount.'); return;
    }
    if (!form.trip) { setFormError('Please select a trip.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const tripId = parseInt(form.trip, 10);
      await createExpense({
        trip: isNaN(tripId) ? form.trip : tripId,
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description || CAT_META[form.category]?.label || form.category,
        spent_on: form.date,
        date: form.date,
      });
      setForm((f) => ({ ...f, amount: '', description: '' }));
      await loadData(selectedTrip);
    } catch (err) {
      setFormError(
        err.response?.data?.detail ||
        err.response?.data?.trip?.[0] ||
        err.response?.data?.spent_on?.[0] ||
        Object.values(err.response?.data || {})?.[0]?.[0] ||
        'Failed to add expense.'
      );
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id, isItinerary) => {
    const msg = isItinerary
      ? 'Delete this expense?\n\nNote: This will also remove the corresponding activity from your trip itinerary.'
      : 'Delete this expense?';
    if (!window.confirm(msg)) return;
    setDeletingId(id);
    try { await deleteExpense(id); await loadData(selectedTrip); }
    catch { alert('Failed to delete expense.'); }
    finally { setDeletingId(null); }
  };

  // Upsert Target Budget
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!selectedTrip && trips.length > 0) {
      setTargetErr('Please select a specific trip above to set its target budget.');
      return;
    }
    const val = parseFloat(budgetTargetInput);
    if (isNaN(val) || val < 0) {
      setTargetErr('Please enter a valid target budget amount.');
      return;
    }

    setTargetSaving(true);
    setTargetErr('');
    setTargetMsg('');
    try {
      const targetTripId = selectedTrip || (trips[0]?.trip_id || trips[0]?.id);
      await setTripBudget(parseInt(targetTripId, 10), val, currency);
      setTargetMsg('✅ Target budget updated successfully in database!');
      setTargetBudget(val);
      await loadData(selectedTrip);
      setTimeout(() => setTargetMsg(''), 4000);
    } catch (err) {
      setTargetErr(err.response?.data?.detail || 'Failed to upsert target budget.');
    } finally {
      setTargetSaving(false);
    }
  };

  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const remainingBalance = targetBudget - totalSpent;
  const utilizationPercent = targetBudget > 0 ? Math.round((totalSpent / targetBudget) * 100) : 0;
  const isOverBudget = targetBudget > 0 && totalSpent > targetBudget;
  const sortedCats = [...byCategory].sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 tg-rise">
        <div>
          <div className="tg-label mb-3" style={{ color: 'var(--coral)' }}>Ledger & Targets</div>
          <h1 className="tg-serif text-5xl md:text-6xl font-bold leading-[0.95]">Smart Budget Tracker</h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--ink-2)' }}>
            Real-time spend tracking, target ceilings, and category breakdowns.
          </p>
        </div>
        <label className="flex items-center gap-3">
          <span className="tg-label">Trip</span>
          <select className="tg-input w-56" value={selectedTrip}
            onChange={(e) => setSelectedTrip(e.target.value)}>
            <option value="">All trips</option>
            {trips.map((t) => (
              <option key={t.trip_id || t.id} value={t.trip_id || t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <button
          onClick={() => setActiveTab('overview')}
          className="px-6 py-3 font-bold text-sm transition-all border-b-2"
          style={{
            borderColor: activeTab === 'overview' ? 'var(--coral)' : 'transparent',
            color: activeTab === 'overview' ? 'var(--coral)' : 'var(--mute)',
          }}
        >
          📊 Overview & Breakdown
        </button>
        <button
          onClick={() => setActiveTab('set-target')}
          className="px-6 py-3 font-bold text-sm transition-all border-b-2"
          style={{
            borderColor: activeTab === 'set-target' ? 'var(--coral)' : 'transparent',
            color: activeTab === 'set-target' ? 'var(--coral)' : 'var(--mute)',
          }}
        >
          🎯 Set Trip Budget Target
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}
      {error && !loading && (
        <div className="p-4 rounded-2xl text-sm" style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Top 3 Metric Cards */}
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Target Budget Card */}
            <div className="tg-card p-6 border-t-4 border-t-[var(--sea)]">
              <div className="tg-label text-xs" style={{ color: 'var(--sea)' }}>Target Budget</div>
              <div className="tg-serif text-3xl md:text-4xl font-bold mt-2 text-[var(--ink)]">
                {targetBudget > 0 ? money(targetBudget) : '$0.00'}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--mute)' }}>
                {targetBudget > 0 ? 'Allocated spending ceiling' : 'No target set (Set in target tab)'}
              </p>
            </div>

            {/* Total Spent Card */}
            <div className="tg-card p-6 border-t-4 border-t-[var(--sun)]">
              <div className="tg-label text-xs" style={{ color: 'var(--sun)' }}>Total Spent</div>
              <div className="tg-serif text-3xl md:text-4xl font-bold mt-2 text-[var(--ink)]">
                {money(totalSpent)}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--mute)' }}>
                Across {expenses.length} logged transaction{expenses.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Remaining Balance Card */}
            <div className={`tg-card p-6 border-t-4 ${isOverBudget ? 'border-t-[var(--coral)]' : 'border-t-[var(--moss)]'}`}>
              <div className="tg-label text-xs" style={{ color: isOverBudget ? 'var(--coral)' : 'var(--moss)' }}>
                Remaining Balance
              </div>
              <div className={`tg-serif text-3xl md:text-4xl font-bold mt-2 ${isOverBudget ? 'text-[var(--coral)]' : 'text-[var(--ink)]'}`}>
                {targetBudget > 0 ? money(remainingBalance) : '—'}
              </div>
              <p className="text-xs mt-2 font-bold" style={{ color: isOverBudget ? 'var(--coral)' : 'var(--moss)' }}>
                {targetBudget > 0
                  ? isOverBudget
                    ? `⚠️ Over budget by ${money(Math.abs(remainingBalance))}`
                    : `✓ ${money(remainingBalance)} remaining`
                  : 'Set a target to compute balance'}
              </p>
            </div>
          </div>

          {/* Real-Time Budget Utilization Progress Bar */}
          <div className="tg-card p-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold tracking-wider uppercase">
              <span style={{ color: 'var(--ink)' }}>Budget Utilization Gauge</span>
              <span className={isOverBudget ? 'text-[var(--coral)]' : 'text-[var(--sea)]'}>
                {utilizationPercent}% {isOverBudget ? '(Exceeded Ceiling)' : 'Utilized'}
              </span>
            </div>
            <div className="h-4 rounded-full overflow-hidden" style={{ background: 'var(--sand)' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, utilizationPercent))}%`,
                  background: isOverBudget
                    ? 'var(--coral)'
                    : utilizationPercent > 80
                    ? 'var(--sun)'
                    : 'var(--moss)',
                }}
              />
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: 'var(--mute)' }}>
              <span>$0.00</span>
              <span>Target: {money(targetBudget)}</span>
            </div>
          </div>

          {activeTab === 'set-target' ? (
            /* Set Trip Budget Target Upsert Tab */
            <div className="max-w-2xl mx-auto tg-card p-8 space-y-6">
              <div>
                <div className="tg-label mb-2" style={{ color: 'var(--sea)' }}>Target Ceiling Configuration</div>
                <h2 className="tg-serif text-3xl font-bold text-[var(--ink)]">Set Trip Budget</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>
                  Upsert the total target amount for the selected trip. The database trigger and progress bar will update in real time.
                </p>
              </div>

              {targetMsg && (
                <div className="p-4 rounded-xl text-sm font-bold" style={{ background: 'var(--sea-soft)', color: 'var(--sea)' }}>
                  {targetMsg}
                </div>
              )}
              {targetErr && (
                <div className="p-4 rounded-xl text-sm font-bold" style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
                  ⚠️ {targetErr}
                </div>
              )}

              <form onSubmit={handleSaveBudget} className="space-y-5">
                <label className="block space-y-2">
                  <span className="tg-label">Target Trip *</span>
                  <select
                    className="tg-input text-base"
                    value={selectedTrip || (trips[0]?.trip_id || trips[0]?.id || '')}
                    onChange={(e) => setSelectedTrip(e.target.value)}
                    required
                  >
                    {trips.map((t) => (
                      <option key={t.trip_id || t.id} value={t.trip_id || t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block space-y-2">
                    <span className="tg-label">Target Budget Amount *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2500.00"
                      className="tg-input text-base font-semibold"
                      value={budgetTargetInput}
                      onChange={(e) => {
                        setBudgetTargetInput(e.target.value);
                        setTargetErr('');
                      }}
                      required
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="tg-label">Currency</span>
                    <select
                      className="tg-input text-base"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={targetSaving}
                  className="tg-btn w-full justify-center text-base py-3"
                  style={{ background: 'var(--sea)', color: 'var(--paper)' }}
                >
                  {targetSaving ? 'Saving Target Ceiling...' : '💾 Save & Upsert Trip Budget'}
                </button>
              </form>
            </div>
          ) : (
            /* Overview: Category Breakdown Table + Expenses Log + Add Form */
            <div className="space-y-8">
              {/* Category Breakdown Table */}
              <div className="tg-card p-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="tg-serif text-2xl font-bold text-[var(--ink)]">Category Breakdown Table</h2>
                    <p className="text-xs" style={{ color: 'var(--mute)' }}>Categorical allocations and proportional expenditures.</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'var(--sand)', color: 'var(--ink)' }}>
                    {sortedCats.length} Categories Active
                  </span>
                </div>

                {sortedCats.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: 'var(--mute)' }}>No categorized expenditures logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--line)', color: 'var(--mute)' }}>
                          <th className="py-3 px-2">Category</th>
                          <th className="py-3 px-2">Proportion Bar</th>
                          <th className="py-3 px-2 text-right">Total Spent</th>
                          <th className="py-3 px-2 text-right">% of Spend</th>
                          {targetBudget > 0 && <th className="py-3 px-2 text-right">% of Target</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                        {sortedCats.map(({ category: c, total: v }) => {
                          const k = CAT_META[c] || CAT_META.other;
                          const numVal = parseFloat(v);
                          const spendPct = totalSpent > 0 ? Math.round((numVal / totalSpent) * 100) : 0;
                          const targetPct = targetBudget > 0 ? Math.round((numVal / targetBudget) * 100) : 0;

                          return (
                            <tr key={c} className="hover:bg-black/5 transition">
                              <td className="py-3 px-2 font-bold flex items-center gap-2">
                                <span className="text-lg">{k.emoji}</span>
                                <span>{k.label || c}</span>
                              </td>
                              <td className="py-3 px-2 w-48">
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--sand)' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${spendPct}%`, background: k.color }}
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right font-bold tg-serif">
                                {money(numVal)}
                              </td>
                              <td className="py-3 px-2 text-right font-medium" style={{ color: 'var(--ink-2)' }}>
                                {spendPct}%
                              </td>
                              {targetBudget > 0 && (
                                <td className="py-3 px-2 text-right font-bold" style={{ color: 'var(--sea)' }}>
                                  {targetPct}%
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Grid: Expenses Log & Add Expense Form */}
              <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
                {/* Expenses List */}
                <div className="tg-card p-8">
                  <h2 className="tg-serif text-2xl font-bold mb-5">Expense Transaction Log</h2>
                  {expenses.length === 0 ? (
                    <p style={{ color: 'var(--mute)' }}>No expenses recorded yet.</p>
                  ) : (
                    <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
                      {[...expenses]
                        .sort((a, b) => new Date(b.date || b.spent_on) - new Date(a.date || a.spent_on))
                        .map((exp) => {
                          const expId = exp.expense_id || exp.id;
                          const k = CAT_META[exp.category] || CAT_META.other;
                          const title = exp.description || k.label || (exp.category ? exp.category.charAt(0).toUpperCase() + exp.category.slice(1) : 'Expense');
                          return (
                            <li key={expId} className="flex items-center gap-4 py-4 group">
                              <span className="h-12 w-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                                style={{ background: k.soft }}>{k.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold truncate text-[var(--ink)] flex items-center gap-2">
                                  <span className="truncate">{title}</span>
                                  {exp.is_itinerary_item && (
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background: 'var(--sea-soft)', color: 'var(--sea)' }}
                                    >
                                      🗓️ Day {exp.itinerary_day || 'Itinerary'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs capitalize" style={{ color: 'var(--mute)' }}>
                                  {k.label || exp.category} · {fmt(exp.date || exp.spent_on)}
                                </div>
                              </div>
                              <div className="tg-serif text-xl font-bold flex-shrink-0">{money(exp.amount)}</div>
                              <button
                                onClick={() => handleDelete(expId, exp.is_itinerary_item)}
                                disabled={deletingId === expId}
                                title={exp.is_itinerary_item ? 'Remove expense (also removes activity from itinerary)' : 'Delete expense'}
                                className="opacity-0 group-hover:opacity-100 transition h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 cursor-pointer"
                                style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
                                {deletingId === expId ? '…' : '✕'}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>

                {/* Add Expense Form */}
                <form onSubmit={handleAdd}
                  className="tg-card p-7 lg:sticky lg:top-28 space-y-4 shadow-xl"
                  style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
                  <h2 className="tg-serif text-2xl font-bold">Add Expense</h2>

                  {formError && (
                    <div className="p-3 rounded-xl text-sm"
                      style={{ background: 'rgba(228,87,46,.2)', color: 'var(--coral-soft)' }}>{formError}</div>
                  )}

                  {/* Trip */}
                  <label className="block space-y-2">
                    <span className="tg-label" style={{ color: 'var(--sun)' }}>Trip *</span>
                    <select className="tg-input" style={{ color: 'var(--ink)' }}
                      value={form.trip} onChange={(e) => { setForm({ ...form, trip: e.target.value }); setFormError(''); }}
                      required>
                      <option value="">Select trip</option>
                      {trips.map((t) => (
                        <option key={t.trip_id || t.id} value={t.trip_id || t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Category grid */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="tg-label" style={{ color: 'var(--sun)' }}>Category</span>
                      <span className="text-xs font-bold text-[var(--sun)] capitalize">
                        {CAT_META[form.category]?.emoji} {CAT_META[form.category]?.label || form.category}
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {CATEGORIES.map((c) => (
                        <button type="button" key={c} title={CAT_META[c].label}
                          onClick={() => setForm({ ...form, category: c })}
                          className="h-11 rounded-xl text-lg transition border"
                          style={{
                            background: form.category === c ? 'var(--coral)' : 'rgba(255,255,255,.08)',
                            borderColor: form.category === c ? 'var(--coral)' : 'transparent',
                          }}>
                          {CAT_META[c].emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount */}
                  <label className="block space-y-2">
                    <span className="tg-label" style={{ color: 'var(--sun)' }}>Amount ($) *</span>
                    <input type="number" step="0.01" min="0.01" placeholder="0.00"
                      className="tg-input" style={{ color: 'var(--ink)' }}
                      value={form.amount}
                      onChange={(e) => { setForm({ ...form, amount: e.target.value }); setFormError(''); }}
                      required />
                  </label>

                  {/* Description with intelligent auto-categorization */}
                  <label className="block space-y-2">
                    <span className="tg-label" style={{ color: 'var(--sun)' }}>Description</span>
                    <input placeholder="e.g. Dinner in Marais, Metro pass" className="tg-input" style={{ color: 'var(--ink)' }}
                      value={form.description}
                      onChange={handleDescriptionChange} />
                  </label>

                  {/* Date */}
                  <label className="block space-y-2">
                    <span className="tg-label" style={{ color: 'var(--sun)' }}>Date</span>
                    <input type="date" className="tg-input" style={{ color: 'var(--ink)' }}
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </label>

                  <button type="submit" disabled={submitting}
                    className="tg-btn w-full justify-center"
                    style={{ background: submitting ? 'var(--ink-2)' : 'var(--coral)' }}>
                    {submitting ? <LoadingSpinner size="sm" /> : null}
                    {submitting ? 'Adding…' : '+ Add expense'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
