'use client';

export default function KpiCard({ label, value, sub, trend, color = '#4f8ef7', icon: Icon }) {
  const trendColor = trend > 0 ? '#e05252' : trend < 0 ? '#3ecf8e' : '#7b82a0';
  const trendSign  = trend > 0 ? '+' : '';

  return (
    <div style={{
      background: 'rgba(30, 34, 48, 0.45)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: 14,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Neon gradient top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #d946ef, #00f3ff)',
        zIndex: 1, pointerEvents: 'none',
      }} />

      {/* ── Header: label + icon ───────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 18,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 500, color: '#94a3b8',
          lineHeight: 1.35, maxWidth: '72%',
        }}>
          {label}
        </span>

        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: `${color}18`,
            border: `1px solid ${color}28`,
            boxShadow: `0 0 14px ${color}12, inset 0 0 8px ${color}08`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={17} color={color} strokeWidth={1.75} />
          </div>
        )}
      </div>

      {/* ── Main value + trend ─────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14 }}>
        <span style={{
          fontSize: '2.25rem', fontWeight: 800,
          color: '#ffffff', lineHeight: 1,
          textShadow: `0 0 28px ${color}55, 0 0 60px ${color}20`,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.025em',
        }}>
          {value}
        </span>
        {trend !== undefined && trend !== null && (
          <span style={{
            fontSize: 13, fontWeight: 700, marginBottom: 4,
            color: trendColor, letterSpacing: '-0.01em',
          }}>
            {trendSign}{trend}%
          </span>
        )}
      </div>

      {/* ── Divider ────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 10 }} />

      {/* ── Secondary text ─────────────────────────── */}
      {sub && (
        <span style={{
          fontSize: 11, color: '#64748b',
          lineHeight: 1.5, letterSpacing: '0.01em',
        }}>
          {sub}
        </span>
      )}

    </div>
  );
}
