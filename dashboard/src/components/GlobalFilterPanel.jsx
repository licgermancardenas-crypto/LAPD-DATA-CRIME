'use client'

import { LayoutGrid, FolderOpen, MapPin } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

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

const SCOPE = {
  part:        ['Tendencia', 'Divisiones', 'Categorías', 'Locales'],
  category:    ['Mapa', 'Divisiones', 'Víctimas'],
  area:        ['Categorías', 'Víctimas'],
  interactive: ['Categorías', 'Divisiones', 'Víctimas'],
};

const LABEL = {
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 8,
};

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`;

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '16px 0' }} />;
}

function ScopeBadges({ keys }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
      {keys.map(k => (
        <span key={k} style={{
          fontSize: 9, fontWeight: 600, color: '#3a4060',
          background: 'rgba(79,142,247,.05)',
          border: '1px solid #1e2230',
          borderRadius: 4, padding: '1px 5px', letterSpacing: '.02em',
        }}>{k}</span>
      ))}
    </div>
  );
}

function ActiveChip({ filterKey, value, onClear }) {
  const meta = FILTER_META[filterKey] ?? { icon: '·', label: filterKey };
  const display = typeof value === 'object'
    ? `${DAYS_SHORT[value.dow]} · ${value.hour}h`
    : value;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 8px', borderRadius: 6,
      background: 'rgba(79,142,247,.08)', border: '1px solid rgba(79,142,247,.2)',
      fontSize: 11, color: '#c0c4d4',
    }}>
      <span style={{ fontSize: 12 }}>{meta.icon}</span>
      <span style={{ color: '#4f5870', fontSize: 10 }}>{meta.label}:</span>
      <strong style={{ color: '#4f8ef7', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {display}
      </strong>
      <button
        onClick={() => onClear(filterKey)}
        style={{
          background: 'none', border: 'none', color: '#4f5870',
          cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 1px',
          transition: 'color 0.2s ease', marginLeft: 'auto',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4f5870')}
        title={`Quitar filtro ${meta.label}`}
      >✕</button>
    </div>
  );
}

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
    setFilters({ area: null, category: null, ageGroup: null, timeSlot: null, years: [], months: [] });
    setActivePart('all');
  };
  const clearOne = (key) => setFilters(f => ({ ...f, [key]: null }));

  return (
    <aside style={{
      width: 260,
      flexShrink: 0,
      backgroundColor: '#08091a',
      borderRight: '1px solid rgba(255,255,255,0.03)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      zIndex: 30,
    }}>
      {/* Neon gradient accent */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #d946ef, #00f3ff)', flexShrink: 0 }} />

      {/* Panel header */}
      <div style={{
        padding: '14px 20px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
        position: 'relative',
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#3a4060', letterSpacing: '.12em', textTransform: 'uppercase' }}>
          PANEL DE CONTROL
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginTop: 4 }}>
          Filtros
        </p>
        {/* Active-filters indicator dot */}
        {hasAnyFilter && (
          <div style={{
            position: 'absolute', top: 16, right: 18,
            width: 7, height: 7, borderRadius: '50%',
            background: '#00f3ff',
            boxShadow: '0 0 8px rgba(0,243,255,.7)',
          }} />
        )}
      </div>

      {/* Scrollable filter content */}
      <div style={{ flex: 1, padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>

        {/* ── PERÍODO ─────────────────────────────────── */}
        <span style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayoutGrid size={12} color="#475569" strokeWidth={2} />
          Período
          <InfoTooltip
            text="Part 1 — Delitos Graves: homicidio, robo violento, agresión, violación y hurto calificado según estándar FBI. Part 2 — Delitos Menores: resto de infracciones (vandalismo, fraude, drogas, etc.)."
            width={250}
          />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {PART_OPTIONS.map(o => {
            const on = activePart === o.v;
            return (
              <button
                key={o.v}
                onClick={() => setActivePart(o.v)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '8px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: on ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  border: on ? '1px solid rgba(79,142,247,.35)' : '1px solid transparent',
                  backgroundColor: on ? 'rgba(79,142,247,.1)' : 'transparent',
                  color: on ? '#4f8ef7' : '#94a3b8',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,.03)'; e.currentTarget.style.color = '#c0c4d4'; }}}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: on ? '#4f8ef7' : '#2a2d40',
                  boxShadow: on ? '0 0 6px rgba(79,142,247,.65)' : 'none',
                  transition: 'all 0.2s ease',
                }} />
                {o.label}
              </button>
            );
          })}
        </div>
        <ScopeBadges keys={SCOPE.part} />

        <Divider />

        {/* ── CATEGORÍA ───────────────────────────────── */}
        <span style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={12} color="#475569" strokeWidth={2} />
          Categoría de Delito
        </span>
        <select
          value={filters.category ?? ''}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value || null }))}
          style={{
            width: '100%',
            appearance: 'none', WebkitAppearance: 'none',
            padding: '8px 28px 8px 12px',
            backgroundColor: filters.category ? 'rgba(79,142,247,.08)' : '#161923',
            backgroundImage: CHEVRON,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            border: filters.category ? '1px solid rgba(79,142,247,.35)' : '1px solid #242936',
            borderRadius: 6,
            color: filters.category ? '#4f8ef7' : '#94a3b8',
            fontSize: 12,
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <option value="">Todas las categorías</option>
          {categories?.map(c => (
            <option key={c.category} value={c.category}>{c.category}</option>
          ))}
        </select>
        <ScopeBadges keys={SCOPE.category} />

        <Divider />

        {/* ── DIVISIÓN ────────────────────────────────── */}
        <span style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={12} color="#475569" strokeWidth={2} />
          División Policial
        </span>
        <select
          value={filters.area ?? ''}
          onChange={e => setFilters(f => ({ ...f, area: e.target.value || null }))}
          style={{
            width: '100%',
            appearance: 'none', WebkitAppearance: 'none',
            padding: '8px 28px 8px 12px',
            backgroundColor: filters.area ? 'rgba(79,142,247,.08)' : '#161923',
            backgroundImage: CHEVRON,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            border: filters.area ? '1px solid rgba(79,142,247,.35)' : '1px solid #242936',
            borderRadius: 6,
            color: filters.area ? '#4f8ef7' : '#94a3b8',
            fontSize: 12,
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <option value="">Todas las divisiones</option>
          {divisions?.map(d => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </select>
        <ScopeBadges keys={SCOPE.area} />

        {/* ── DESDE GRÁFICOS ──────────────────────────── */}
        {interactiveKeys.length > 0 && (
          <>
            <Divider />
            <span style={LABEL}>Desde Gráficos</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {interactiveKeys.map(k => (
                <ActiveChip key={k} filterKey={k} value={filters[k]} onClear={clearOne} />
              ))}
            </div>
            <ScopeBadges keys={SCOPE.interactive} />
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── LIMPIAR TODO ─────────────────────────────── */}
        {hasAnyFilter && (
          <>
            <Divider />
            <button
              onClick={clearAll}
              style={{
                width: '100%',
                padding: '9px 16px', borderRadius: 8,
                backgroundColor: 'rgba(224,82,82,.06)',
                border: '1px solid rgba(224,82,82,.2)',
                color: '#e05252',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(224,82,82,.12)'; e.currentTarget.style.borderColor = 'rgba(224,82,82,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(224,82,82,.06)'; e.currentTarget.style.borderColor = 'rgba(224,82,82,.2)'; }}
            >
              ✕ Limpiar filtros
            </button>
          </>
        )}

      </div>
    </aside>
  );
}
