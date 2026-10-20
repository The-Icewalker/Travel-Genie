export const AI_ENGINES = [
  {
    id: 'slm',
    title: 'Local SLM',
    badge: 'qwen-local',
    icon: '⚡',
    subtitle: 'Private & offline via Ollama (qwen-local)',
    description: 'High-speed local inference directly on your machine. Zero cloud latency or quotas.',
  },
  {
    id: 'gemini',
    title: 'Google Gemini',
    badge: 'Gemini API',
    icon: '✨',
    subtitle: 'Cloud LLM via Google AI API',
    description: 'Direct call to Google Gemini Pro cloud models with extensive world knowledge.',
  },
  {
    id: 'auto',
    title: 'Smart Auto',
    badge: 'SLM + Fallback',
    icon: '🔄',
    subtitle: 'Local first, cloud failover',
    description: 'Tries local qwen-local first; automatically falls back to Gemini if Ollama is unreachable.',
  },
];

export default function AiEngineSelector({ value = 'slm', onChange, compact = false }) {
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="tg-label text-[10px]">AI Engine:</span>
          <span className="font-semibold text-[var(--ink-2)]">
            {value === 'slm' && '⚡ Local SLM (qwen-local)'}
            {value === 'gemini' && '✨ Google Gemini API'}
            {value === 'auto' && '🔄 Auto (SLM + Gemini Fallback)'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl border" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
          {AI_ENGINES.map((engine) => {
            const isSelected = value === engine.id;
            return (
              <button
                key={engine.id}
                type="button"
                onClick={() => onChange(engine.id)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'shadow-sm text-white'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--sand)]'
                }`}
                style={{
                  background: isSelected ? 'var(--ink)' : 'transparent',
                }}
              >
                <span>{engine.icon}</span>
                <span className="truncate">{engine.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="tg-label flex items-center gap-1.5">
          <span>🧠 Select AI Planner Engine</span>
        </label>
        <span className="text-[11px] font-semibold text-[var(--mute)]">
          Choose between local neural weights or Google cloud API
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AI_ENGINES.map((engine) => {
          const isSelected = value === engine.id;
          return (
            <button
              key={engine.id}
              type="button"
              onClick={() => onChange(engine.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer group ${
                isSelected
                  ? 'border-[var(--ink)] ring-2 ring-[var(--ink)] shadow-md'
                  : 'border-[var(--line)] hover:border-[var(--ink-2)]'
              }`}
              style={{
                background: isSelected ? 'var(--sand)' : 'var(--paper)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{engine.icon}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
                      : 'bg-white text-[var(--mute)] border-[var(--line)] group-hover:text-[var(--ink)]'
                  }`}
                >
                  {engine.badge}
                </span>
              </div>
              <div className="font-bold text-sm text-[var(--ink)]">
                {engine.title}
              </div>
              <div className="text-[11px] text-[var(--mute)] mt-0.5 leading-snug">
                {engine.subtitle}
              </div>
              <p className="text-[10px] text-[var(--ink-2)] mt-2 opacity-85 leading-normal">
                {engine.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
