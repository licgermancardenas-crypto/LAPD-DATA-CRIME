'use client';

const FILTER_META = {
  area:      { icon: '📍', label: 'Área' },
  category:  { icon: '📂', label: 'Delito' },
  ageGroup:  { icon: '👤', label: 'Edad' },
  timeSlot:  { icon: '🕐', label: 'Horario' },
};

function Chip({ filterKey, value, onClear }) {
  const meta = FILTER_META[filterKey] ?? { icon: '•', label: filterKey };
  const display = typeof value === 'object'
    ? `Día ${value.dow + 1} · ${value.hour}h`
    : value;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 8px', borderRadius: 20,
      background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.35)',
      fontSize: 12, color: '#c0c4d4', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 13 }}>{meta.icon}</span>
      <span style={{ color: '#7b82a0', fontSize: 10 }}>{meta.label}:</span>
      <strong style={{ color: '#4f8ef7', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {display}
      </strong>
      <button
        onClick={() => onClear(filterKey)}
        style={{
          background: 'none', border: 'none', color: '#7b82a0',
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
          transition: 'color .12s',
        }}
        onMouseEnter={e => (e.target.style.color = '#e05252')}
        onMouseLeave={e => (e.target.style.color = '#7b82a0')}
        title={`Quitar filtro ${meta.label}`}
      >✕</button>
    </div>
  );
}

export default function FilterBar({ filters, setFilters }) {
  const active = Object.entries(filters).filter(([, v]) => v !== null);
  if (active.length === 0) return null;

  const clearOne = (key) => setFilters(f => ({ ...f, [key]: null }));
  const clearAll = () => setFilters({ area: null, category: null, ageGroup: null, timeSlot: null });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 32px', background: '#090b14',
      borderBottom: '1px solid rgba(79,142,247,.15)',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 10, color: '#4f8ef7', fontWeight: 700,
        letterSpacing: '.08em', flexShrink: 0,
      }}>
        FILTROS ACTIVOS
      </span>

      {active.map(([k, v]) => (
        <Chip key={k} filterKey={k} value={v} onClear={clearOne} />
      ))}

      <button
        onClick={clearAll}
        style={{
          background: 'none', border: '1px solid #2a2d3a', borderRadius: 6,
          color: '#7b82a0', fontSize: 11, cursor: 'pointer',
          padding: '4px 10px', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.target.style.borderColor = '#e05252'; e.target.style.color = '#e05252'; }}
        onMouseLeave={e => { e.target.style.borderColor = '#2a2d3a'; e.target.style.color = '#7b82a0'; }}
      >
        Limpiar todo
      </button>

      <span style={{ fontSize: 11, color: '#3a3f55', marginLeft: 4 }}>
        Los gráficos que soportan cross-filtering se recalculan automáticamente
      </span>
    </div>
  );
}
