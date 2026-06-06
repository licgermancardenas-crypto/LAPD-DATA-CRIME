'use client';

export default function KpiCard({ label, value, sub, trend, color = '#4f8ef7', icon }) {
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
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#5a6070', textTransform: 'uppercase', letterSpacing: '.09em' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 18, opacity: 0.75 }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <span style={{
          fontSize: 34, fontWeight: 700, color, lineHeight: 1,
          textShadow: `0 0 24px ${color}55, 0 0 48px ${color}22`,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        {trend !== undefined && trend !== null && (
          <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: trendColor }}>
            {trendSign}{trend}%
          </span>
        )}
      </div>
      {sub && <span style={{ fontSize: 11, color: '#5a6070', lineHeight: 1.45 }}>{sub}</span>}
    </div>
  );
}
