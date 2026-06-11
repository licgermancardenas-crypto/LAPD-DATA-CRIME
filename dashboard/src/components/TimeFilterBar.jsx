'use client';

// Reusable multi-select year + month filter bar — embedded at the bottom of chart cards.
// controls global filters.years / filters.months (arrays).

const YEARS  = [2020, 2021, 2022, 2023, 2024];
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function Pill({ label, on, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 9px', borderRadius: 5,
        fontSize: 11, fontWeight: on ? 700 : 400,
        border: on ? `1px solid ${color}80` : '1px solid rgba(255,255,255,.06)',
        background: on ? `${color}18` : 'transparent',
        color: on ? color : '#4a5070',
        cursor: 'pointer', transition: 'all .12s',
        boxShadow: on ? `0 0 8px ${color}22` : 'none',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >{label}</button>
  );
}

function ClearBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, color: '#4a5070', background: 'none', border: 'none',
      cursor: 'pointer', padding: '0 2px', fontFamily: 'inherit',
      transition: 'color .12s',
    }}
      onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
      onMouseLeave={e => (e.currentTarget.style.color = '#4a5070')}
    >✕</button>
  );
}

export default function TimeFilterBar({ years = [], months = [], onYears, onMonths }) {
  const hasFilter = years.length > 0 || months.length > 0;

  function toggleYear(y)  { onYears(years.includes(y)   ? years.filter(x => x !== y)   : [...years, y]); }
  function toggleMonth(m) { onMonths(months.includes(m) ? months.filter(x => x !== m) : [...months, m]); }

  return (
    <div style={{
      marginTop: 18,
      padding: '12px 0 0',
      borderTop: '1px solid rgba(255,255,255,.05)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>

      {/* ── Year row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#3a4060',
          letterSpacing: '.12em', textTransform: 'uppercase', minWidth: 28, flexShrink: 0,
        }}>AÑO</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {YEARS.map(y => (
            <Pill key={y} label={String(y)} on={years.includes(y)} onClick={() => toggleYear(y)} color="#00f3ff" />
          ))}
        </div>
        {years.length > 0 && <ClearBtn onClick={() => onYears([])} />}
      </div>

      {/* ── Month row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#3a4060',
          letterSpacing: '.12em', textTransform: 'uppercase', minWidth: 28, flexShrink: 0,
        }}>MES</span>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {MONTHS.map((m, i) => (
            <Pill key={i} label={m} on={months.includes(i + 1)} onClick={() => toggleMonth(i + 1)} color="#d946ef" />
          ))}
        </div>
        {months.length > 0 && <ClearBtn onClick={() => onMonths([])} />}
      </div>

      {/* ── Active summary + clear all ── */}
      {hasFilter && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
          <span style={{ fontSize: 10, color: '#3ecf8e' }}>
            ✓{years.length  > 0 && ` ${years.sort((a,b)=>a-b).join(', ')}`}
             {months.length > 0 && ` · ${months.sort((a,b)=>a-b).map(m => MONTHS[m-1]).join(', ')}`}
          </span>
          <button
            onClick={() => { onYears([]); onMonths([]); }}
            style={{
              fontSize: 10, color: '#e05252',
              background: 'rgba(224,82,82,.07)', border: '1px solid rgba(224,82,82,.2)',
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Limpiar</button>
        </div>
      )}
    </div>
  );
}
