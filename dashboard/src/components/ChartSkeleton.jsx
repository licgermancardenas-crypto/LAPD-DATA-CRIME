'use client'

const BARS = [55, 80, 38, 92, 64, 76, 44, 87, 58, 72, 48, 82];

export default function ChartSkeleton({ visible }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(9,11,19,.80)',
        borderRadius: 12,
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: visible ? 'all' : 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 20px 14px',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="sk-shimmer" style={{ height: 13, width: '40%', borderRadius: 5 }} />
        <div className="sk-shimmer" style={{ height: 9,  width: '28%', borderRadius: 4 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {BARS.map((h, i) => (
          <div key={i} className="sk-shimmer" style={{
            flex: 1, height: `${h}%`, minHeight: 6,
            borderRadius: '3px 3px 0 0',
            animationDelay: `${i * 0.07}s`,
          }} />
        ))}
      </div>
      <div className="sk-shimmer" style={{ height: 2, borderRadius: 1, opacity: .4 }} />
    </div>
  );
}
