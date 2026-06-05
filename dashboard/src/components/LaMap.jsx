'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Crime intensity color scale: dark navy -> blue -> orange -> red
const STOPS = [
  [13,  33,  55],
  [26,  74, 138],
  [79, 142, 247],
  [224,136,  58],
  [224, 82,  82],
];

function lerp(t) {
  const n = STOPS.length - 1;
  const s = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(Math.floor(s), n - 1);
  const f = s - i;
  const [r1,g1,b1] = STOPS[i], [r2,g2,b2] = STOPS[i+1] || STOPS[n];
  return `rgb(${Math.round(r1+f*(r2-r1))},${Math.round(g1+f*(g2-g1))},${Math.round(b1+f*(b2-b1))})`;
}

export default function LaMap() {
  const divRef  = useRef(null);
  const mapRef  = useRef(null);
  const [sel,   setSel]     = useState(null);
  const [ready, setReady]   = useState(false);
  const [minC,  setMinC]    = useState(33000);
  const [maxC,  setMaxC]    = useState(70000);

  useEffect(() => {
    if (mapRef.current || !divRef.current) return;
    let alive = true;

    import('leaflet').then(({ default: L }) => {
      if (!alive || !divRef.current) return;

      const map = L.map(divRef.current, {
        center: [34.045, -118.28],
        zoom: 10,
        zoomControl: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Dark basemap — no API key
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '<a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      fetch('/data/lapd_divisions_crimes.geojson')
        .then(r => r.json())
        .then(gj => {
          if (!alive) return;

          // Rank by crime volume
          const sorted = [...gj.features].sort((a,b) =>
            b.properties.total_crimes - a.properties.total_crimes);
          sorted.forEach((f, i) => { f.properties.rank = i + 1; });
          gj.features = sorted;

          // Update legend bounds from meta
          if (gj._meta) {
            if (alive) setMinC(gj._meta.min_crimes);
            if (alive) setMaxC(gj._meta.max_crimes);
          }

          let geoLayer;
          geoLayer = L.geoJSON(gj, {
            style: f => ({
              fillColor:   lerp(f.properties.norm),
              fillOpacity: 0.60,
              color:       '#0a0c12',
              weight:      1.8,
              opacity:     0.9,
            }),
            onEachFeature(feature, layer) {
              const p = feature.properties;
              layer.bindTooltip(
                `<div class="lm-tip"><strong>${p.name}</strong><br>` +
                `${p.total_crimes.toLocaleString()} crimes</div>`,
                { sticky: true, className: 'lm-tip-wrap' }
              );
              layer.on({
                mouseover(e) {
                  e.target.setStyle({ fillOpacity: 0.82, weight: 2.5, color: '#ffffff' });
                  e.target.bringToFront();
                },
                mouseout(e) { geoLayer.resetStyle(e.target); },
                click(e) {
                  if (alive) setSel(p);
                  map.fitBounds(e.target.getBounds(), { padding: [60, 60] });
                },
              });
            },
          }).addTo(map);

          if (alive) setReady(true);
        });
    });

    return () => {
      alive = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2d3a' }}>

      {/* Map container */}
      <div ref={divRef} style={{ height: 540, background: '#0a0c12' }} />

      {/* Loading overlay */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, background: '#0f1117',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #1a2035',
            borderTop: '3px solid #4f8ef7', borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }} />
          <span style={{ color: '#7b82a0', fontSize: 13 }}>Fetching map tiles...</span>
        </div>
      )}

      {/* Division info panel */}
      {sel && (
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(10,12,18,0.96)', border: '1px solid #2a2d3a',
          borderRadius: 12, padding: '16px 18px', minWidth: 220,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: lerp(sel.norm), marginRight: 8,
              }} />
              <span style={{ fontWeight: 700, color: '#e8eaf0', fontSize: 15 }}>{sel.name}</span>
            </div>
            <button
              onClick={() => setSel(null)}
              style={{ background: 'none', border: 'none', color: '#7b82a0', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
            >×</button>
          </div>

          {/* Rank badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#1a1d27', border: '1px solid #2a2d3a',
            borderRadius: 6, padding: '3px 10px', marginBottom: 12,
          }}>
            <span style={{ fontSize: 11, color: '#7b82a0' }}>Rank</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e0883a' }}>#{sel.rank}</span>
            <span style={{ fontSize: 11, color: '#7b82a0' }}>of 21 divisions</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gap: 9 }}>
            <SRow label="Total Crimes" value={sel.total_crimes.toLocaleString()} color="#4f8ef7" />
            <SRow
              label="Clearance Rate"
              value={`${sel.clearance.toFixed(1)}%`}
              color={sel.clearance >= 20 ? '#3ecf8e' : sel.clearance >= 12 ? '#e0c066' : '#e05252'}
            />
            <div style={{ height: 1, background: '#2a2d3a', margin: '2px 0' }} />
            <SRow label="Top Category" value={sel.top_category || '—'} color="#7b82a0" small />
          </div>

          {/* Mini bar showing relative crime volume */}
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 4, borderRadius: 2, background: '#1a1d27', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${sel.norm * 100}%`,
                background: lerp(sel.norm),
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#7b82a0' }}>{minC.toLocaleString()}</span>
              <span style={{ fontSize: 10, color: '#7b82a0' }}>{maxC.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 40, right: 52, zIndex: 1000,
        background: 'rgba(10,12,18,0.92)', border: '1px solid #2a2d3a',
        borderRadius: 8, padding: '9px 12px',
      }}>
        <p style={{ fontSize: 10, color: '#7b82a0', marginBottom: 5, fontWeight: 600, letterSpacing: '0.06em' }}>
          CRIME VOLUME 2020-24
        </p>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', width: 110 }}>
          {Array.from({ length: 22 }, (_, i) => (
            <div key={i} style={{ flex: 1, background: lerp(i / 21) }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: '#7b82a0' }}>Low</span>
          <span style={{ fontSize: 9, color: '#7b82a0' }}>High</span>
        </div>
      </div>

      {/* Hint */}
      {ready && !sel && (
        <div style={{
          position: 'absolute', bottom: 40, left: 12, zIndex: 1000,
          background: 'rgba(10,12,18,0.85)', border: '1px solid #2a2d3a',
          borderRadius: 6, padding: '5px 11px', fontSize: 11, color: '#7b82a0',
        }}>
          Click a division to explore
        </div>
      )}

      {/* Leaflet + custom styles */}
      <style>{`
        .lm-tip-wrap { background: transparent !important; border: none !important; box-shadow: none !important; }
        .lm-tip { background: rgba(10,12,18,0.97); border: 1px solid #2a2d3a; border-radius: 8px;
          color: #e8eaf0; font-size: 12px; padding: 7px 12px; line-height: 1.5;
          box-shadow: 0 4px 16px rgba(0,0,0,0.6); font-family: 'Inter', sans-serif; }
        .lm-tip strong { color: #ffffff; }
        .leaflet-tooltip { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-tooltip::before { display: none !important; }
        .leaflet-bar { border: 1px solid #2a2d3a !important; border-radius: 8px !important; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important; }
        .leaflet-control-zoom a { background: #1a1d27 !important; color: #e8eaf0 !important; border-color: #2a2d3a !important; font-size: 16px !important; }
        .leaflet-control-zoom a:hover { background: #2a2d3a !important; }
        .leaflet-control-attribution { background: rgba(10,12,18,0.7) !important; color: #7b82a0 !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: #4f8ef7 !important; }
      `}</style>
    </div>
  );
}

function SRow({ label, value, color, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#7b82a0' }}>{label}</span>
      <span style={{ fontSize: small ? 11 : 13, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}
