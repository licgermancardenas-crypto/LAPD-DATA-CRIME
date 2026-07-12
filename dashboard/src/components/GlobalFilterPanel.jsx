'use client'

import { useState, useEffect } from 'react';
import { LayoutGrid, FolderOpen, MapPin, Calendar, Clock } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

/* ── Constants ─────────────────────────────────────────────────────────────── */
const YEARS  = [2020, 2021, 2022, 2023, 2024];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const THEFT_CATS = [
  { key: 'VEHICLE - STOLEN',      label: 'Robo Vehículo' },
  { key: 'BURGLARY FROM VEHICLE', label: 'Ingr. Vehicular' },
  { key: 'BURGLARY',              label: 'Allanamiento'  },
  { key: 'ROBBERY',               label: 'Asalto c/Robo' },
];

const PART_OPTIONS = [
  { v: 'all', label: 'Todos los Delitos'  },
  { v: 'p1',  label: 'Parte 1 — Grave'   },
  { v: 'p2',  label: 'Parte 2 — Menor'   },
];

const FILTER_META = {
  area:     { icon: '📍', label: 'Division'  },
  category: { icon: '📂', label: 'Crime Type' },
  ageGroup: { icon: '👤', label: 'Age Group'  },
  timeSlot: { icon: '🕐', label: 'Time Slot'  },
};

const SCOPE = {
  part:        ['Trend', 'Divisions', 'Categories', 'Premises'],
  category:    ['Map', 'Divisions', 'Victims'],
  area:        ['Categories', 'Victims'],
  interactive: ['Categories', 'Divisions', 'Victims'],
};

/* ── Style constants ────────────────────────────────────────────────────────── */
const LABEL = {
  fontSize: 11, fontWeight: 700, color: '#9aa3bf',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  display: 'flex', alignItems: 'center', gap: 6,
  marginBottom: 8,
};

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`;

const TOGGLE_BTN = {
  width: 28, height: 28, borderRadius: 8,
  border: '1px solid rgba(255,255,255,.1)',
  background: 'rgba(255,255,255,.04)', color: '#9aa3bf',
  cursor: 'pointer', fontSize: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'all 0.15s ease',
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */
function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '14px 0' }} />;
}

function ScopeBadges({ keys }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
      {keys.map(k => (
        <span key={k} style={{
          fontSize: 9, fontWeight: 600, color: '#5a637a',
          background: 'rgba(79,142,247,.06)', border: '1px solid rgba(79,142,247,.12)',
          borderRadius: 4, padding: '1px 6px', letterSpacing: '.03em',
        }}>{k}</span>
      ))}
    </div>
  );
}

function ActiveChip({ filterKey, value, onClear }) {
  const meta    = FILTER_META[filterKey] ?? { icon: '·', label: filterKey };
  const display = typeof value === 'object' ? `${value.dow}d · ${value.hour}h` : value;
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
      <button onClick={() => onClear(filterKey)} style={{
        background: 'none', border: 'none', color: '#4f5870',
        cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 1px',
        transition: 'color 0.2s ease', marginLeft: 'auto',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4f5870')}
      >✕</button>
    </div>
  );
}

function Pill({ label, on, onClick, color = '#00f3ff' }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 8px', borderRadius: 5,
      fontSize: 10, fontWeight: on ? 700 : 400,
      border: on ? `1px solid ${color}80` : '1px solid rgba(255,255,255,.06)',
      background: on ? `${color}18` : 'transparent',
      color: on ? color : '#4a5070',
      cursor: 'pointer', transition: 'all .12s',
      boxShadow: on ? `0 0 8px ${color}22` : 'none',
      fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

function ToggleBlock({ options, active, onToggle, color = '#7c3aed' }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(({ key, label }) => {
        const on = active === key;
        return (
          <button key={key} onClick={() => onToggle(on ? null : key)} style={{
            flex: 1, padding: '6px 4px', borderRadius: 6,
            fontSize: 10, fontWeight: on ? 700 : 400,
            border: on ? `1px solid ${color}80` : '1px solid rgba(255,255,255,.07)',
            background: on ? `${color}18` : 'rgba(255,255,255,.02)',
            color: on ? color : '#5a637a',
            cursor: 'pointer', transition: 'all .15s', fontFamily: 'monospace',
            boxShadow: on ? `0 0 10px ${color}30` : 'none',
            letterSpacing: '.04em',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function GlobalFilterPanel({
  activePart, setActivePart,
  filters, setFilters,
  categories,
  divisions,
  filteredCount,
  totalCount,
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial collapse state depends on window, unavailable during SSR; must be set post-mount to avoid hydration mismatch
    if (window.innerWidth < 1024) setCollapsed(true);
    const handler = () => { if (window.innerWidth < 1024 && !collapsed) setCollapsed(true); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once auto-collapse; the stale `collapsed` closure only guards a redundant setState, no behavioral bug
  }, []);

  /* Active filter detection */
  const interactiveKeys = ['ageGroup', 'timeSlot'].filter(k => filters[k] !== null);
  const hasAnyFilter = activePart !== 'all'
    || filters.category !== null || filters.area !== null
    || (filters.years?.length > 0) || (filters.months?.length > 0)
    || filters.shift !== null || filters.dayType !== null
    || interactiveKeys.length > 0;

  /* Toggle helpers */
  const toggleYear    = y  => setFilters(f => ({ ...f, years:  f.years?.includes(y)  ? f.years.filter(x=>x!==y)  : [...(f.years??[]),y]  }));
  const toggleMonth   = m  => setFilters(f => ({ ...f, months: f.months?.includes(m) ? f.months.filter(x=>x!==m) : [...(f.months??[]),m] }));
  const toggleShift   = v  => setFilters(f => ({ ...f, shift:   f.shift   === v ? null : v }));
  const toggleDayType = v  => setFilters(f => ({ ...f, dayType: f.dayType === v ? null : v }));
  const setCategory   = v  => setFilters(f => ({ ...f, category: f.category === v ? null : v }));
  const clearOne      = k  => setFilters(f => ({ ...f, [k]: null }));

  const clearAll = () => {
    setFilters({ area: null, category: null, ageGroup: null, timeSlot: null, years: [], months: [], shift: null, dayType: null });
    setActivePart('all');
  };

  /* ── Collapsed rail ── */
  if (collapsed) {
    return (
      <aside style={{
        width: 36, flexShrink: 0, backgroundColor: '#08091a',
        borderRight: '1px solid rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'sticky', top: 0, height: '100vh', zIndex: 30,
      }}>
        <div style={{ height: 2, width: '100%', background: 'linear-gradient(90deg,#d946ef,#00f3ff)', flexShrink: 0 }} />
        <button onClick={() => setCollapsed(false)} title="Show filters"
          style={{ ...TOGGLE_BTN, marginTop: 14 }}
          onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,.09)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='#9aa3bf'; e.currentTarget.style.background='rgba(255,255,255,.04)'; }}
        >›</button>
        {hasAnyFilter && (
          <div style={{ marginTop: 10, width: 7, height: 7, borderRadius: '50%', background: '#00f3ff', boxShadow: '0 0 8px rgba(0,243,255,.7)' }} />
        )}
      </aside>
    );
  }

  return (
    <aside className="tac-panel" style={{
      width: 264, flexShrink: 0, backgroundColor: '#08091a',
      borderRight: '1px solid rgba(255,255,255,0.03)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh',
      overflowY: 'auto', overflowX: 'hidden',
      scrollbarWidth: 'thin', scrollbarColor: 'rgba(42,45,58,0.85) transparent',
      zIndex: 30,
    }}>
      {/* Neon accent */}
      <div style={{ height: 2, background: 'linear-gradient(90deg,#d946ef,#00f3ff)', flexShrink: 0 }} />

      {/* Header */}
      <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, position: 'relative' }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#5a637a', letterSpacing: '.18em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          FILTROS TÁCTICOS // FILTERS
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginTop: 3, letterSpacing: '.01em' }}>
          L.A.I.S.S. Control Panel
        </p>
        <div style={{ position: 'absolute', top: 13, right: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasAnyFilter && (
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00f3ff', boxShadow: '0 0 8px rgba(0,243,255,.7)' }} />
          )}
          <button onClick={() => setCollapsed(true)} title="Hide panel" style={TOGGLE_BTN}
            onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,.09)'; }}
            onMouseLeave={e => { e.currentTarget.style.color='#9aa3bf'; e.currentTarget.style.background='rgba(255,255,255,.04)'; }}
          >‹</button>
        </div>
      </div>

      {/* Record counter */}
      {totalCount != null && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,.03)', background: 'rgba(0,243,255,.02)', flexShrink: 0 }}>
          {filteredCount != null && filteredCount !== totalCount ? (
            <div>
              <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#00f3ff', letterSpacing: '.1em', marginBottom: 2 }}>
                INCIDENTES FILTRADOS
              </p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#e8eaf0', letterSpacing: '.04em' }}>
                <strong style={{ color: '#00f3ff', fontSize: 13 }}>{filteredCount.toLocaleString()}</strong>
                <span style={{ color: '#3a4060' }}> / </span>
                <span style={{ color: '#4a5070' }}>{totalCount.toLocaleString()}</span>
                <span style={{ color: '#3a4060', fontSize: 9 }}> TOTAL</span>
              </p>
              {filteredCount === 0 && (
                <p style={{ fontSize: 9, color: '#e05252', fontFamily: 'monospace', marginTop: 3, letterSpacing: '.06em' }}>
                  ⚠ NO INCIDENTS DETECTED
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#3a4060', letterSpacing: '.08em' }}>
              TOTAL BASE: <span style={{ color: '#4a5070' }}>{totalCount.toLocaleString()}</span> incidentes
            </p>
          )}
        </div>
      )}

      {/* Scrollable filters */}
      <div style={{ flex: 1, padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── AÑO ─────────────────────────────────────── */}
        <span style={LABEL}>
          <Calendar size={11} color="#6b7590" strokeWidth={2} />
          Año
        </span>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {YEARS.map(y => (
            <Pill key={y} label={String(y)} on={filters.years?.includes(y)} onClick={() => toggleYear(y)} color="#00f3ff" />
          ))}
        </div>
        {(filters.years?.length > 0) && (
          <button onClick={() => setFilters(f => ({ ...f, years: [] }))} style={{
            marginTop: 5, fontSize: 9, color: '#4a5070', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left', letterSpacing: '.06em',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a5070')}
          >✕ BORRAR AÑOS</button>
        )}

        <Divider />

        {/* ── MES ──────────────────────────────────────── */}
        <span style={LABEL}>
          <Calendar size={11} color="#6b7590" strokeWidth={2} />
          Mes
        </span>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {MONTHS.map((m, i) => (
            <Pill key={i} label={m} on={filters.months?.includes(i + 1)} onClick={() => toggleMonth(i + 1)} color="#d946ef" />
          ))}
        </div>
        {(filters.months?.length > 0) && (
          <button onClick={() => setFilters(f => ({ ...f, months: [] }))} style={{
            marginTop: 5, fontSize: 9, color: '#4a5070', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left', letterSpacing: '.06em',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a5070')}
          >✕ BORRAR MESES</button>
        )}

        <Divider />

        {/* ── TURNO (DIURNO / NOCTURNO) ─────────────────── */}
        <span style={{ ...LABEL, marginBottom: 6 }}>
          <Clock size={11} color="#6b7590" strokeWidth={2} />
          Turno
          <span style={{ fontSize: 9, color: '#3a4060', fontFamily: 'monospace', letterSpacing: '.04em' }}>→ Mapa Cal.</span>
        </span>
        <ToggleBlock
          options={[
            { key: 'day',   label: '☀  DIURNO  06–18' },
            { key: 'night', label: '🌙 NOCTURNO 18–06' },
          ]}
          active={filters.shift}
          onToggle={toggleShift}
          color="#f0b429"
        />

        <div style={{ marginTop: 8 }}>
          <span style={{ ...LABEL, marginBottom: 6 }}>
            Tipo de Día
            <span style={{ fontSize: 9, color: '#3a4060', fontFamily: 'monospace', letterSpacing: '.04em' }}>→ Mapa Cal.</span>
          </span>
          <ToggleBlock
            options={[
              { key: 'weekday', label: '▪ LABORAL'    },
              { key: 'weekend', label: '▪ FIN DE SEM.' },
            ]}
            active={filters.dayType}
            onToggle={toggleDayType}
            color="#3ecf8e"
          />
        </div>

        <Divider />

        {/* ── SEVERIDAD ────────────────────────────────── */}
        <span style={{ ...LABEL, marginBottom: 6 }}>
          <LayoutGrid size={11} color="#6b7590" strokeWidth={2} />
          Severidad
          <InfoTooltip
            text="Parte 1 — Delitos graves: homicidio, asalto, agresión, violación, robo de auto. Parte 2 — Delitos menores: vandalismo, fraude, drogas, etc."
            width={240}
          />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {PART_OPTIONS.map(o => {
            const on = activePart === o.v;
            return (
              <button key={o.v} onClick={() => setActivePart(o.v)} style={{
                width: '100%', textAlign: 'left', padding: '7px 11px', borderRadius: 6,
                fontSize: 11, fontWeight: on ? 700 : 400, cursor: 'pointer', transition: 'all .15s',
                border: on ? '1px solid rgba(79,142,247,.35)' : '1px solid transparent',
                backgroundColor: on ? 'rgba(79,142,247,.1)' : 'transparent',
                color: on ? '#4f8ef7' : '#94a3b8',
                display: 'flex', alignItems: 'center', gap: 9,
              }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.backgroundColor='rgba(255,255,255,.03)'; e.currentTarget.style.color='#c0c4d4'; }}}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='#94a3b8'; }}}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: on ? '#4f8ef7' : '#2a2d40',
                  boxShadow: on ? '0 0 6px rgba(79,142,247,.65)' : 'none', transition: 'all .15s',
                }} />
                {o.label}
              </button>
            );
          })}
        </div>
        <ScopeBadges keys={SCOPE.part} />

        <Divider />

        {/* ── TIPO DE ROBO ─────────────────────────────── */}
        <span style={LABEL}>
          <FolderOpen size={11} color="#6b7590" strokeWidth={2} />
          Tipo de Robo
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 10 }}>
          {THEFT_CATS.map(({ key, label }) => {
            const on = filters.category === key;
            return (
              <button key={key} onClick={() => setCategory(key)} style={{
                padding: '5px 6px', borderRadius: 5,
                fontSize: 9, fontWeight: on ? 700 : 400, fontFamily: 'monospace',
                border: on ? '1px solid rgba(249,115,22,.5)' : '1px solid rgba(255,255,255,.07)',
                background: on ? 'rgba(249,115,22,.12)' : 'rgba(255,255,255,.02)',
                color: on ? '#fb923c' : '#5a637a',
                cursor: 'pointer', transition: 'all .15s', letterSpacing: '.03em',
                boxShadow: on ? '0 0 8px rgba(249,115,22,.2)' : 'none',
              }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.color='#7b8299'; e.currentTarget.style.borderColor='rgba(255,255,255,.12)'; }}}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.color='#5a637a'; e.currentTarget.style.borderColor='rgba(255,255,255,.07)'; }}}
              >{label}</button>
            );
          })}
        </div>

        {/* Categoría dropdown (lista completa) */}
        <span style={{ ...LABEL, marginBottom: 6, fontSize: 10, color: '#5a637a' }}>
          — o todas las categorías —
        </span>
        <select
          value={filters.category ?? ''}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value || null }))}
          style={{
            width: '100%', appearance: 'none', WebkitAppearance: 'none',
            padding: '7px 26px 7px 11px',
            backgroundColor: filters.category ? 'rgba(79,142,247,.08)' : '#161923',
            backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            border: filters.category ? '1px solid rgba(79,142,247,.35)' : '1px solid #242936',
            borderRadius: 6, color: filters.category ? '#4f8ef7' : '#b0b7d0',
            fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', transition: 'all .15s',
          }}
        >
          <option value="">Todas las categorías</option>
          {categories?.map(c => (
            <option key={c.category} value={c.category}>{c.category}</option>
          ))}
        </select>
        <ScopeBadges keys={SCOPE.category} />

        <Divider />

        {/* ── DIVISIÓN POLICIAL ─────────────────────────── */}
        <span style={LABEL}>
          <MapPin size={11} color="#6b7590" strokeWidth={2} />
          División Policial
        </span>
        <select
          value={filters.area ?? ''}
          onChange={e => setFilters(f => ({ ...f, area: e.target.value || null }))}
          style={{
            width: '100%', appearance: 'none', WebkitAppearance: 'none',
            padding: '7px 26px 7px 11px',
            backgroundColor: filters.area ? 'rgba(79,142,247,.08)' : '#161923',
            backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            border: filters.area ? '1px solid rgba(79,142,247,.35)' : '1px solid #242936',
            borderRadius: 6, color: filters.area ? '#4f8ef7' : '#b0b7d0',
            fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', transition: 'all .15s',
          }}
        >
          <option value="">Todas las divisiones</option>
          {divisions?.map(d => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </select>
        <ScopeBadges keys={SCOPE.area} />

        {/* ── DESDE GRÁFICOS ────────────────────────────── */}
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
        <div style={{ flex: 1, minHeight: 16 }} />

        {/* ── RESET ALL ────────────────────────────────── */}
        {hasAnyFilter && (
          <>
            <Divider />
            <button onClick={clearAll} style={{
              width: '100%', padding: '9px 16px', borderRadius: 8,
              backgroundColor: 'rgba(0,243,255,.04)',
              border: '1px solid rgba(0,243,255,.2)',
              color: '#00f3ff', fontSize: 11, fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: '.1em',
              cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(0,243,255,.10)'; e.currentTarget.style.borderColor='rgba(0,243,255,.5)'; e.currentTarget.style.boxShadow='0 0 14px rgba(0,243,255,.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor='rgba(0,243,255,.04)'; e.currentTarget.style.borderColor='rgba(0,243,255,.2)'; e.currentTarget.style.boxShadow='none'; }}
            >
              ◈ RESET ALL FILTERS
            </button>
          </>
        )}

      </div>
    </aside>
  );
}
