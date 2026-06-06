'use client';

import { useState, useEffect, useRef } from 'react';

const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS  = Array.from({ length: 24 }, (_, i) => i);
const LABELS = HOURS.map(h => h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);
const SPEEDS = [{ label: '1×', ms: 700 }, { label: '2×', ms: 350 }, { label: '4×', ms: 175 }];

function interpolateColor(intensity) {
  const stops = [
    { t: 0.0, r: 26,  g: 29,  b: 39  },
    { t: 0.3, r: 30,  g: 80,  b: 180 },
    { t: 0.6, r: 200, g: 120, b: 40  },
    { t: 1.0, r: 224, g: 82,  b: 82  },
  ];
  let lo = stops[0], hi = stops[1];
  for (let i = 1; i < stops.length - 1; i++) {
    if (intensity >= stops[i].t) { lo = stops[i]; hi = stops[i + 1]; }
  }
  const t = hi.t === lo.t ? 0 : (intensity - lo.t) / (hi.t - lo.t);
  return `rgb(${Math.round(lo.r+(hi.r-lo.r)*t)},${Math.round(lo.g+(hi.g-lo.g)*t)},${Math.round(lo.b+(hi.b-lo.b)*t)})`;
}

export default function HourHeatmap({ data, filters, onFilter }) {
  const [hovered,   setHovered]   = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playHour,  setPlayHour]  = useState(null);
  const [speedIdx,  setSpeedIdx]  = useState(0);
  const intervalRef = useRef(null);

  const activeSlot = filters?.timeSlot ?? null;

  // Build lookup: dow -> hour -> row
  const lookup = {};
  data?.forEach(d => {
    if (!lookup[d.dow]) lookup[d.dow] = {};
    lookup[d.dow][d.hour] = d;
  });

  // Aggregate crimes per hour (across all days) for the play-bar
  const hourTotals = HOURS.map(h =>
    DAYS.reduce((sum, _, dow) => sum + (lookup[dow]?.[h]?.crimes || 0), 0)
  );
  const maxHourTotal = Math.max(...hourTotals);

  useEffect(() => {
    if (!isPlaying) return;
    intervalRef.current = setInterval(() => {
      setPlayHour(h => ((h ?? -1) + 1) % 24);
    }, SPEEDS[speedIdx].ms);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speedIdx]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      clearInterval(intervalRef.current);
      setPlayHour(null);
    } else {
      setPlayHour(0);
      setIsPlaying(true);
    }
  };

  if (!data?.length) return null;

  const activeHour = isPlaying ? playHour : hovered?.hour ?? null;
  const playLabel  = playHour !== null ? LABELS[playHour] : null;
  const playTotal  = playHour !== null ? hourTotals[playHour]?.toLocaleString() : null;

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p className="section-title">Crime Frequency by Hour & Day of Week</p>
          <p className="section-sub">Total crimes 2020–2024 · intensity = relative volume</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Speed picker */}
          {isPlaying && SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              style={{
                padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s',
                border: speedIdx === i ? '1px solid #4f8ef7' : '1px solid #2a2d3a',
                background: speedIdx === i ? 'rgba(79,142,247,.15)' : '#1a1d27',
                color: speedIdx === i ? '#4f8ef7' : '#7b82a0',
              }}
            >{s.label}</button>
          ))}

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all .15s',
              border: isPlaying ? '1px solid rgba(79,142,247,.5)' : '1px solid #2a2d3a',
              background: isPlaying ? 'rgba(79,142,247,.12)' : '#1a1d27',
              color: isPlaying ? '#4f8ef7' : '#7b82a0',
            }}
          >
            <span style={{ fontSize: 14 }}>{isPlaying ? '⏸' : '▶'}</span>
            {isPlaying ? 'Pause' : 'Animate 24h'}
          </button>
        </div>
      </div>

      {/* Live status bar */}
      <div style={{
        height: 34, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10,
        opacity: activeHour !== null ? 1 : 0, transition: 'opacity .2s',
      }}>
        {isPlaying && playLabel && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.3)',
              borderRadius: 8, padding: '4px 12px',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f8ef7', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7' }}>{playLabel}</span>
            </div>
            <span style={{ fontSize: 13, color: '#e8eaf0' }}>
              <strong style={{ color: '#4f8ef7' }}>{playTotal}</strong>
              <span style={{ color: '#7b82a0' }}> crimes across all weekdays</span>
            </span>
          </>
        )}
        {!isPlaying && hovered && (
          <span style={{ fontSize: 13, color: '#e8eaf0' }}>
            <span style={{ color: '#7b82a0' }}>{hovered.day} {LABELS[hovered.hour]} — </span>
            <strong style={{ color: '#4f8ef7' }}>{hovered.crimes.toLocaleString()}</strong>
            <span style={{ color: '#7b82a0' }}> crimes</span>
          </span>
        )}
      </div>

      {/* Hour progress bar (only while playing) */}
      {isPlaying && playHour !== null && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 8, alignItems: 'flex-end', height: 20 }}>
          {HOURS.map(h => (
            <div
              key={h}
              style={{
                flex: 1,
                height: `${Math.round((hourTotals[h] / maxHourTotal) * 100)}%`,
                borderRadius: '2px 2px 0 0',
                background: h === playHour ? '#4f8ef7' : 'rgba(79,142,247,.18)',
                transition: 'background .15s',
              }}
            />
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 520 }}>
          {/* Hour axis labels */}
          <div className="flex" style={{ marginLeft: 40, marginBottom: 4 }}>
            {HOURS.filter(h => h % 3 === 0).map(h => (
              <div key={h} style={{
                width: `${100 / 8}%`, fontSize: 10, textAlign: 'center',
                color: activeHour === h ? '#4f8ef7' : '#7b82a0',
                fontWeight: activeHour === h ? 700 : 400,
                transition: 'color .15s',
              }}>
                {LABELS[h]}
              </div>
            ))}
          </div>

          {/* Rows */}
          {DAYS.map((day, dow) => (
            <div key={day} className="flex items-center" style={{ marginBottom: 3 }}>
              <span style={{ width: 36, fontSize: 11, color: '#7b82a0', textAlign: 'right', paddingRight: 6 }}>
                {day}
              </span>
              <div className="flex flex-1 gap-0.5">
                {HOURS.map(h => {
                  const cell = lookup[dow]?.[h];
                  const intensity = cell?.intensity ?? 0;
                  const isActive = activeHour === h;
                  const isSlotActive = activeSlot?.dow === dow && activeSlot?.hour === h;
                  const isSlotDimmed = activeSlot && !isSlotActive;
                  return (
                    <div
                      key={h}
                      title={`${day} ${LABELS[h]}: ${cell?.crimes?.toLocaleString() ?? 0} crimes`}
                      onMouseEnter={() => !isPlaying && cell && setHovered({ ...cell, day })}
                      onMouseLeave={() => !isPlaying && setHovered(null)}
                      onClick={() => {
                        if (!isPlaying && onFilter && cell) {
                          onFilter('timeSlot', isSlotActive ? null : { dow, hour: h });
                        }
                      }}
                      style={{
                        flex: 1,
                        height: 26,
                        background: interpolateColor(intensity),
                        borderRadius: 3,
                        cursor: isPlaying ? 'default' : 'pointer',
                        transition: 'filter .12s, transform .12s',
                        filter: activeHour !== null
                          ? (isActive ? 'brightness(1.6) saturate(1.3)' : 'brightness(0.35)')
                          : isSlotDimmed
                            ? 'brightness(0.3)'
                            : 'none',
                        transform: (isActive || isSlotActive) ? 'scaleY(1.12)' : 'scaleY(1)',
                        transformOrigin: 'bottom',
                        outline: isSlotActive ? '2px solid #f72585' : isActive ? '1px solid rgba(79,142,247,.7)' : 'none',
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

      <style>{`
        @keyframes pulse {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:.6;transform:scale(1.3)}
        }
      `}</style>
    </div>
  );
}
