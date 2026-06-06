'use client'

const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PART_OPTIONS = [
  { v: 'all', label: 'Todos los delitos' },
  { v: 'p1',  label: 'Part 1 — Graves'  },
  { v: 'p2',  label: 'Part 2 — Menores' },
];

const FILTER_META = {
  area:      { icon: '📍', label: 'División' },
  category:  { icon: '📂', label: 'Delito'   },
  ageGroup:  { icon: '👤', label: 'Edad'     },
  timeSlot:  { icon: '🕐', label: 'Horario'  },
};

// ── Scope badges (which charts each filter affects) ──────────────────────────
const SCOPE = {
  part:     ['Tendencia', 'Divisiones', 'Categorías', 'Locales'],
  category: ['Mapa', 'Divisiones', 'Víctimas'],
  area:     ['Categorías', 'Víctimas'],
  interactive: ['Categorías', 'Divisiones', 'Víctimas'],
};

function ScopeBadges({ keys }) {
  return (
    <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {keys.map(k => (
        <span key={k} style={{
          fontSize: 9, fontWeight: 600, color: '#3a4060',
          background: 'rgba(79,142,247,.06)',
          border: '1px solid #1e2230',
          borderRadius: 4, padding: '1px 5px', letterSpacing: '.02em',
        }}>{k}</span>
      ))}
    </span>
  );
}

function ActiveChip({ filterKey, value, onClear }) {
  const meta = FILTER_META[filterKey] ?? { icon: '·', label: filterKey };
  const display = typeof value === 'object'
    ? `${DAYS_SHORT[value.dow]} · ${value.hour}h`
    : value;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px 3px 7px', borderRadius: 20,
      background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.3)',
      fontSize: 11, color: '#c0c4d4', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 12 }}>{meta.icon}</span>
      <span style={{ color: '#4f5870', fontSize: 10 }}>{meta.label}:</span>
      <strong style={{ color: '#4f8ef7', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {display}
      </strong>
      <button
        onClick={() => onClear(filterKey)}
        style={{
          background: 'none', border: 'none', color: '#4f5870',
          cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 1px',
          transition: 'color .12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4f5870')}
        title={`Quitar filtro ${meta.label}`}
      >✕</button>
    </div>
  );
}

const SELECT_BASE = {
  appearance: 'none', WebkitAppearance: 'none',
  padding: '5px 26px 5px 10px',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234f5870'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  borderRadius: 7, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', outline: 'none', transition: 'all .15s',
  fontFamily: 'inherit',
};

export default function GlobalFilterPanel({
  activePart, setActivePart,
  filters, setFilters,
  categories,
  divisions,
}) {
  const interactiveKeys = ['ageGroup', 'timeSlot'].filter(k => filters[k] !== null);

  const hasDropdownFilter = filters.category !== null || filters.area !== null;
  const hasPartFilter     = activePart !== 'all';
  const hasAnyFilter      = hasPartFilter || hasDropdownFilter || interactiveKeys.length > 0;

  const clearAll = () => {
    setFilters({ area: null, category: null, ageGroup: null, timeSlot: null });
    setActivePart('all');
  };

  const clearOne = (key) => setFilters(f => ({ ...f, [key]: null }));

  return (
    <div style={{
      background: '#08091a',
      borderBottom: '1px solid #141628',
    }}>
      {/* ── Main filter row ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 32px', flexWrap: 'wrap',
        borderBottom: interactiveKeys.length > 0 ? '1px solid #141628' : 'none',
      }}>

        {/* ── Block: FBI UCR Part ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '10px 16px 10px 0',
          borderRight: '1px solid #141628',
          marginRight: 16,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {PART_OPTIONS.map(o => (
              <button
                key={o.v}
                onClick={() => setActivePart(o.v)}
                style={{
                  padding: '5px 12px', borderRadius: 6,
                  fontSize: 11, fontWeight: activePart === o.v ? 700 : 400,
                  cursor: 'pointer', transition: 'all .15s',
                  border: activePart === o.v
                    ? '1px solid rgba(79,142,247,.5)'
                    : '1px solid #1a1d2e',
                  background: activePart === o.v ? 'rgba(79,142,247,.1)' : 'transparent',
                  color: activePart === o.v ? '#4f8ef7' : '#4f5870',
                  whiteSpace: 'nowrap',
                }}
              >{o.label}</button>
            ))}
          </div>
          <ScopeBadges keys={SCOPE.part} />
        </div>

        {/* ── Block: Categoría ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '10px 16px 10px 0',
          borderRight: '1px solid #141628',
          marginRight: 16,
          flexShrink: 0,
        }}>
          <select
            value={filters.category ?? ''}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value || null }))}
            style={{
              ...SELECT_BASE,
              minWidth: 185,
              background: filters.category ? 'rgba(79,142,247,.1)' : '#0e1020',
              border: filters.category ? '1px solid rgba(79,142,247,.4)' : '1px solid #1a1d2e',
              color: filters.category ? '#4f8ef7' : '#7b82a0',
              backgroundImage: SELECT_BASE.backgroundImage,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="">📂 Todas las categorías</option>
            {categories?.map(c => (
              <option key={c.category} value={c.category}>{c.category}</option>
            ))}
          </select>
          <ScopeBadges keys={SCOPE.category} />
        </div>

        {/* ── Block: División ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '10px 16px 10px 0',
          flexShrink: 0,
        }}>
          <select
            value={filters.area ?? ''}
            onChange={e => setFilters(f => ({ ...f, area: e.target.value || null }))}
            style={{
              ...SELECT_BASE,
              minWidth: 185,
              background: filters.area ? 'rgba(79,142,247,.1)' : '#0e1020',
              border: filters.area ? '1px solid rgba(79,142,247,.4)' : '1px solid #1a1d2e',
              color: filters.area ? '#4f8ef7' : '#7b82a0',
              backgroundImage: SELECT_BASE.backgroundImage,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="">📍 Todas las divisiones</option>
            {divisions?.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
          <ScopeBadges keys={SCOPE.area} />
        </div>

        {/* ── Clear all ────────────────────────────────────────────────── */}
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            style={{
              marginLeft: 'auto',
              background: 'none', border: '1px solid #1a1d2e', borderRadius: 6,
              color: '#4f5870', fontSize: 10, cursor: 'pointer', fontWeight: 600,
              padding: '5px 12px', transition: 'all .15s', whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#e05252'; e.currentTarget.style.color = '#e05252'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1d2e'; e.currentTarget.style.color = '#4f5870'; }}
          >
            ✕ Limpiar todo
          </button>
        )}
      </div>

      {/* ── Interactive filters row (from chart clicks) ───────────────────── */}
      {interactiveKeys.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 32px', flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
            color: '#4f8ef7', textTransform: 'uppercase', flexShrink: 0,
          }}>
            Desde gráficos:
          </span>
          {interactiveKeys.map(k => (
            <ActiveChip key={k} filterKey={k} value={filters[k]} onClear={clearOne} />
          ))}
          <ScopeBadges keys={SCOPE.interactive} />
        </div>
      )}
    </div>
  );
}
