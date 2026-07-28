'use client';

import { Fragment, useState } from 'react';

const CARD = '#111525';
const BORDER = '#1e2235';
const MUTED = '#8a90a8';
const DIM = '#4a5070';

// Sequential ramp — one hue, light -> dark, matching the app's blue accent
const RAMP = ['#0f1a2e', '#132a52', '#1c3f7a', '#2c5aa8', '#4f8ef7', '#8ab4fb'];

const DAY_TYPES = [
  { key: 'weekday', label: 'Weekday' },
  { key: 'weekend', label: 'Weekend' },
];
const TIME_BLOCKS = [
  { key: 'latenight', label: 'Late Night', sub: '00–05' },
  { key: 'morning', label: 'Morning', sub: '06–11' },
  { key: 'afternoon', label: 'Afternoon', sub: '12–17' },
  { key: 'evening', label: 'Evening', sub: '18–23' },
];

function colorFor(t) {
  const n = RAMP.length - 1;
  const s = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(Math.floor(s), n - 1);
  return RAMP[i + 1];
}

export default function TemporalSlotHeatmap({ slotSummary }) {
  const [hover, setHover] = useState(null);
  if (!slotSummary?.length) return null;

  const bySlot = {};
  slotSummary.forEach((s) => { bySlot[s.slot] = s; });
  const max = Math.max(...slotSummary.map((s) => s.citywide_baseline_rate));
  const min = Math.min(...slotSummary.map((s) => s.citywide_baseline_rate));

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px', position: 'relative' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Citywide crimes/day, 2020–22 baseline — by day type × time of day
      </p>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>
        Every cell is the same city. Nothing here is neighborhood or model — it&rsquo;s just where 1,004,894 incidents actually fell in the week. This is the pattern the flat tract-level model in the chart above couldn&rsquo;t see at all.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '84px repeat(4, 1fr)', gap: 2, maxWidth: 620 }}>
        <div />
        {TIME_BLOCKS.map((tb) => (
          <div key={tb.key} style={{ textAlign: 'center', fontSize: 10, color: MUTED, fontWeight: 600, paddingBottom: 6 }}>
            {tb.label}<div style={{ fontSize: 9, color: DIM }}>{tb.sub}</div>
          </div>
        ))}
        {DAY_TYPES.map((dt) => (
          <Fragment key={dt.key}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>
              {dt.label}
            </div>
            {TIME_BLOCKS.map((tb) => {
              const key = `${dt.key}_${tb.key}`;
              const cell = bySlot[key];
              const rate = cell?.citywide_baseline_rate ?? 0;
              const t = max > min ? (rate - min) / (max - min) : 0.5;
              const isHover = hover === key;
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    position: 'relative', aspectRatio: '1.4', borderRadius: 6,
                    background: colorFor(t), display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'default', outline: isHover ? '2px solid #fff' : '2px solid transparent',
                    outlineOffset: -2, transition: 'outline .1s',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(rate)}
                  </span>
                  {isHover && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                      background: '#1a1d27', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 10px',
                      fontSize: 10, color: MUTED, whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 14px rgba(0,0,0,.4)',
                    }}>
                      <div style={{ color: '#fff', fontWeight: 700 }}>{dt.label} · {tb.label}</div>
                      <div>{rate.toFixed(1)} crimes/day citywide</div>
                      <div>{(cell?.citywide_target_count ?? 0).toLocaleString()} crimes in target period</div>
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: 9, color: DIM }}>Fewer crimes/day</span>
        <div style={{ display: 'flex', height: 8, width: 120, borderRadius: 4, overflow: 'hidden' }}>
          {RAMP.slice(1).map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
        </div>
        <span style={{ fontSize: 9, color: DIM }}>More crimes/day</span>
      </div>
    </div>
  );
}
