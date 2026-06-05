'use client';

import { useState } from 'react';

const DAYS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const LABELS  = HOURS.map(h => h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

function interpolateColor(intensity) {
  // Dark blue -> mid blue -> orange -> red
  const stops = [
    { t: 0.0, r: 26,  g: 29,  b: 39  },  // surface
    { t: 0.3, r: 30,  g: 80,  b: 180 },  // blue
    { t: 0.6, r: 200, g: 120, b: 40  },  // orange
    { t: 1.0, r: 224, g: 82,  b: 82  },  // red
  ];
  let lo = stops[0], hi = stops[1];
  for (let i = 1; i < stops.length - 1; i++) {
    if (intensity >= stops[i].t) { lo = stops[i]; hi = stops[i + 1]; }
  }
  const t = hi.t === lo.t ? 0 : (intensity - lo.t) / (hi.t - lo.t);
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r},${g},${b})`;
}

export default function HourHeatmap({ data }) {
  const [hovered, setHovered] = useState(null);

  if (!data?.length) return null;

  // Build lookup: dow -> hour -> row
  const lookup = {};
  data.forEach(d => {
    if (!lookup[d.dow]) lookup[d.dow] = {};
    lookup[d.dow][d.hour] = d;
  });

  return (
    <div className="card">
      <p className="section-title">Crime Frequency by Hour & Day of Week</p>
      <p className="section-sub">Total crimes 2020-2024 · intensity = relative volume (dark = low, red = peak)</p>

      {hovered && (
        <div className="mb-3 text-sm" style={{ color: '#e8eaf0' }}>
          <span style={{ color: '#7b82a0' }}>{hovered.day} {LABELS[hovered.hour]} — </span>
          <strong style={{ color: '#4f8ef7' }}>{hovered.crimes.toLocaleString()}</strong>
          <span style={{ color: '#7b82a0' }}> crimes</span>
        </div>
      )}

      {/* Hour axis labels */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 520 }}>
          <div className="flex" style={{ marginLeft: 40, marginBottom: 4 }}>
            {HOURS.filter(h => h % 3 === 0).map(h => (
              <div key={h} style={{ width: `${100 / 8}%`, fontSize: 10, color: '#7b82a0', textAlign: 'center' }}>
                {LABELS[h]}
              </div>
            ))}
          </div>

          {DAYS.map((day, dow) => (
            <div key={day} className="flex items-center" style={{ marginBottom: 3 }}>
              <span style={{ width: 36, fontSize: 11, color: '#7b82a0', textAlign: 'right', paddingRight: 6 }}>
                {day}
              </span>
              <div className="flex flex-1 gap-0.5">
                {HOURS.map(h => {
                  const cell = lookup[dow]?.[h];
                  const intensity = cell?.intensity ?? 0;
                  const bg = interpolateColor(intensity);
                  return (
                    <div
                      key={h}
                      title={`${day} ${LABELS[h]}: ${cell?.crimes?.toLocaleString() ?? 0} crimes`}
                      onMouseEnter={() => cell && setHovered({ ...cell, day })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        flex: 1,
                        height: 26,
                        background: bg,
                        borderRadius: 3,
                        cursor: 'default',
                        transition: 'filter 0.1s',
                        filter: hovered?.dow === dow && hovered?.hour === h ? 'brightness(1.4)' : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4" style={{ marginLeft: 40 }}>
            <span style={{ fontSize: 10, color: '#7b82a0' }}>Low</span>
            <div style={{
              flex: 1, maxWidth: 200, height: 8, borderRadius: 4,
              background: 'linear-gradient(to right, #1a1d27, #1e50b4, #c87828, #e05252)',
            }} />
            <span style={{ fontSize: 10, color: '#7b82a0' }}>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
