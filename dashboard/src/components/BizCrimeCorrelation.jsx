'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  buildSpatialIndex,
  computeCommercialCorrelation,
  computeNlThreshold,
} from '../lib/geoAnalytics';

// ── Radial arc gauge (SVG) ─────────────────────────────────────────────────
function ArcGauge({ value, max = 100, size = 80, color = '#00bfff' }) {
  const r   = (size - 10) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const arc = Math.PI * 1.5;                          // 270° sweep
  const pct = Math.min(value / max, 1);
  const sweep = arc * pct;
  const startAngle = Math.PI * 0.75;                  // start at 7-o'clock
  const endAngle   = startAngle + sweep;

  const polar = (angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const s = polar(startAngle);
  const e = polar(endAngle);
  const large = sweep > Math.PI ? 1 : 0;

  const trackEnd = polar(startAngle + arc);
  const trackLarge = 1;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:'block', flexShrink:0 }}>
      {/* Track */}
      <path
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${trackLarge} 1 ${trackEnd.x} ${trackEnd.y}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} strokeLinecap="round"
      />
      {/* Filled arc */}
      {pct > 0 && (
        <path
          d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`}
          fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}aa)` }}
        />
      )}
      {/* Center text */}
      <text x={cx} y={cy - 3} textAnchor="middle" fill={color}
        style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
        {value.toFixed(1)}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill="rgba(255,255,255,0.45)"
        style={{ fontSize: 7, fontFamily: "'Courier New', monospace", letterSpacing: '.06em' }}>
        %
      </text>
    </svg>
  );
}

// ── Sector bar row ────────────────────────────────────────────────────────────
function SectorRow({ label, pct, rank, color }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 3 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', fontFamily:'monospace', width: 10 }}>
            #{rank}
          </span>
          <span style={{ fontSize: 10, color: '#e0f2fe', fontWeight: 600 }}>{label}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color, textShadow: `0 0 8px ${color}` }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: `linear-gradient(90deg, ${color}55, ${color})`,
          transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
        }}/>
      </div>
    </div>
  );
}

const SECTOR_COLORS = ['#00bfff', '#38bdf8', '#7dd3fc', '#bae6fd'];

// ── Skeleton loader ────────────────────────────────────────────────────────
function Skeleton({ h = 10, w = '100%', mb = 6 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 3, marginBottom: mb,
      background: 'rgba(56,189,248,0.06)',
      animation: 'pulse 1.6s ease-in-out infinite',
    }}/>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
/**
 * BizCrimeCorrelation — computes and displays:
 *   1. Índice de Correlación Comercial (% of crimes in nightlife zones)
 *   2. Top Rubros Afectados (ranked business sectors by crime density)
 *
 * Loads its own data so it doesn't depend on parent state.
 * Runs computation via setTimeout to avoid blocking the UI thread.
 */
export default function BizCrimeCorrelation({ simHour }) {
  const [status,  setStatus]  = useState('loading'); // 'loading' | 'ready' | 'error'
  const [result,  setResult]  = useState(null);
  const [isCalc,  setIsCalc]  = useState(false);

  // Persistent refs — loaded once, survive re-renders
  const crimeRef   = useRef(null);  // crime_points_hourly.json
  const indexRef   = useRef(null);  // SpatialEntry[]
  const threshRef  = useRef(3);     // nightlife threshold
  const timerRef   = useRef(null);  // debounce handle

  // ── Load data once ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch('/data/crime_points_hourly.json').then(r => r.json()),
      fetch('/data/neighborhood_business_enriched.geojson').then(r => r.json()),
    ])
      .then(([crimeData, bizGeo]) => {
        if (cancelled) return;
        crimeRef.current  = crimeData;
        indexRef.current  = buildSpatialIndex(bizGeo.features);
        threshRef.current = computeNlThreshold(bizGeo.features);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, []);

  // ── Re-compute when simHour changes (debounced 80 ms) ──────────────────
  useEffect(() => {
    if (status !== 'ready') return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsCalc(true);
      // Run async via setTimeout(0) so the UI can repaint first
      setTimeout(() => {
        const pts = crimeRef.current?.hours?.[simHour] ?? [];
        const res = computeCommercialCorrelation(pts, indexRef.current, threshRef.current);
        setResult(res);
        setIsCalc(false);
      }, 0);
    }, 80);

    return () => clearTimeout(timerRef.current);
  }, [simHour, status]);

  // ── Risk level label ────────────────────────────────────────────────────
  const riskLabel = useMemo(() => {
    if (!result) return null;
    const ci = result.correlationIndex;
    if (ci >= 55) return { text: 'CRÍTICO',  color: '#ef4444' };
    if (ci >= 35) return { text: 'ELEVADO',  color: '#f97316' };
    if (ci >= 20) return { text: 'MODERADO', color: '#eab308' };
    return           { text: 'BAJO',       color: '#34d399' };
  }, [result]);

  // ── Render states ───────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{ padding: '4px 0' }}>
        <Skeleton h={68} mb={8}/>
        <Skeleton h={8} w="80%" mb={6}/>
        <Skeleton h={8} w="60%" mb={6}/>
        <Skeleton h={8} w="70%" mb={0}/>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '8px 0', fontSize: 10, color: '#ef4444', fontFamily:'monospace' }}>
        ⚠ Error cargando datos de negocios
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ padding: '4px 0' }}>
        <Skeleton h={68} mb={8}/>
        <Skeleton h={8} w="75%" mb={6}/>
        <Skeleton h={8} w="55%"/>
      </div>
    );
  }

  return (
    <div style={{ position:'relative' }}>

      {/* Computing overlay */}
      {isCalc && (
        <div style={{
          position:'absolute', inset:0, zIndex:2,
          background:'rgba(1,10,26,0.55)', backdropFilter:'blur(2px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          borderRadius: 6,
        }}>
          <span style={{ fontSize: 9, color: '#38bdf8', fontFamily:'monospace', letterSpacing:'.15em' }}>
            ◈ CALCULANDO…
          </span>
        </div>
      )}

      {/* ── Correlation Index ─────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap: 12,
        padding: '10px 12px',
        background: 'rgba(0,191,255,0.05)',
        border: '1px solid rgba(0,191,255,0.18)',
        borderRadius: 7,
        marginBottom: 10,
      }}>
        <ArcGauge value={result.correlationIndex} color="#00bfff" size={76}/>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'rgba(0,191,255,0.70)',
            letterSpacing: '.12em', marginBottom: 3, textTransform:'uppercase',
          }}>
            Índice Comercial
          </div>
          <div style={{
            fontSize: 11, color: '#bae6fd', lineHeight: 1.45, marginBottom: 6,
            fontWeight: 500,
          }}>
            De los <strong style={{ color:'#fff' }}>{result.totalSampled.toLocaleString()}</strong> incidentes
            de las <strong style={{ color:'#67e8f9' }}>
              {String(simHour).padStart(2,'0')}:00 hs
            </strong>,{' '}
            <strong style={{ color:'#00bfff' }}>{result.inZone.toLocaleString()}</strong> ocurrieron
            en zonas de alta actividad comercial nocturna.
          </div>
          {riskLabel && (
            <div style={{
              display:'inline-flex', alignItems:'center', gap: 5,
              padding: '2px 8px', borderRadius: 4,
              background: `${riskLabel.color}15`,
              border: `1px solid ${riskLabel.color}40`,
            }}>
              <span style={{
                display:'inline-block', width: 5, height: 5,
                borderRadius:'50%', background: riskLabel.color,
                boxShadow: `0 0 6px ${riskLabel.color}`,
              }}/>
              <span style={{
                fontSize: 9, fontWeight: 800, color: riskLabel.color,
                letterSpacing:'.1em',
              }}>
                {riskLabel.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Top Rubros Afectados ──────────────────────────────────────── */}
      {result.topSectors.length > 0 ? (
        <div>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'rgba(56,189,248,0.65)',
            letterSpacing: '.12em', marginBottom: 7, textTransform:'uppercase',
            display:'flex', alignItems:'center', gap: 6,
          }}>
            <span>Top Rubros Afectados</span>
            <span style={{
              fontSize: 8, color: 'rgba(103,232,249,0.45)',
              background:'rgba(103,232,249,0.06)',
              border:'1px solid rgba(103,232,249,0.15)',
              borderRadius: 3, padding:'0 5px',
            }}>
              % crímenes en zona
            </span>
          </div>
          {result.topSectors.map((s, i) => (
            <SectorRow
              key={s.key}
              rank={i + 1}
              label={s.label}
              pct={s.pct}
              color={SECTOR_COLORS[i] ?? '#93c5fd'}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily:'monospace', padding:'4px 0' }}>
          Sin correlación comercial detectada a esta hora.
        </div>
      )}

      {/* Footer metadata */}
      <div style={{
        marginTop: 8,
        fontSize: 8, color: 'rgba(255,255,255,0.22)',
        fontFamily:'monospace', letterSpacing:'.07em',
      }}>
        Muestra: {result.totalSampled.toLocaleString()} pts · Umbral NL: {result.nlThreshold.toFixed(1)}
      </div>
    </div>
  );
}
