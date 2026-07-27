'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Map as MapLibreMap, NavigationControl, AttributionControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Default blob:-URL worker gets killed by some browsers/security software before it can
// fetch a single tile (map hangs forever on "load"). Pointing at a real static file sidesteps it.
setWorkerUrl('/maplibre-gl-worker.mjs');

// ── Constants ────────────────────────────────────────────────────────────────
const CENTER      = [-118.2437, 34.0522];
const START_ZOOM   = 15.2;
const CAM_2D       = { pitch: 0,  bearing: 0 };
const CAM_3D       = { pitch: 55, bearing: -20 };

// Free, keyless vector tiles (OpenMapTiles schema — building layer ships
// render_height / render_min_height, computed from OSM height/levels tags).
const TILES_URL = 'https://tiles.openfreemap.org/planet';
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// Free, public-domain elevation (Terrarium PNG-RGB, AWS Open Data — SRTM/GMTED mosaic).
// This is what puts the real Hollywood Hills / Santa Monica Mtns relief under the twin.
const TERRAIN_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

function heightRamp(stops) {
  return [
    'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
    ...stops.flatMap((c, i) => [[0, 15, 40, 90, 200][i], c]),
  ];
}

// Three lighting rigs — real sun position/color per time of day, not just a palette swap.
// Switching one changes sky, sun, and every ground color together so it reads as one scene.
const TIME_PRESETS = {
  sunset: {
    label: 'ATARDECER', icon: '◑',
    sky: {
      'sky-color': '#ff7a3d', 'horizon-color': '#ffcf8a', 'fog-color': '#3a1a3a',
      'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.65, 'fog-ground-blend': 0.72,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.65, 17, 0],
    },
    light: { anchor: 'viewport', color: '#ffb37a', intensity: 0.55, position: [1.3, 250, 14] },
    bg: '#160b14', landcover: '#1d1018', park: '#2a2716', water: '#2a1030', roadsMajor: '#ff9a4d',
    buildingColor: heightRamp(['#1a0f18', '#3a1f2c', '#7a3d3a', '#c97a4a', '#f4c37a']),
  },
  day: {
    label: 'DÍA', icon: '☀',
    sky: {
      'sky-color': '#5fa8dd', 'horizon-color': '#cfe8f7', 'fog-color': '#eaf6ff',
      'sky-horizon-blend': 0.45, 'horizon-fog-blend': 0.55, 'fog-ground-blend': 0.65,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.5, 17, 0],
    },
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.55, position: [1.3, 200, 62] },
    bg: '#0c1720', landcover: '#132531', park: '#154226', water: '#0e4f6e', roadsMajor: '#38bdf8',
    buildingColor: heightRamp(['#101c26', '#1c3245', '#335a75', '#6f9dbd', '#c3dced']),
  },
  night: {
    label: 'NOCHE', icon: '●',
    sky: {
      'sky-color': '#010a16', 'horizon-color': '#0a2436', 'fog-color': '#020a14',
      'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.7,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.6, 17, 0],
    },
    light: { anchor: 'viewport', color: '#5fa0c0', intensity: 0.22, position: [1.4, 210, 25] },
    bg: '#020509', landcover: '#04080d', park: '#062718', water: '#03141f', roadsMajor: '#0891b2',
    buildingColor: heightRamp(['#03060b', '#060e18', '#0a1a2c', '#122f47', '#1c4a63']),
  },
};
const DEFAULT_PRESET = 'sunset';

function applyTimePreset(map, key) {
  const p = TIME_PRESETS[key];
  if (!map || !p) return;
  map.setLight(p.light);
  map.setSky(p.sky);
  map.setPaintProperty('bg', 'background-color', p.bg);
  map.setPaintProperty('landcover', 'fill-color', p.landcover);
  map.setPaintProperty('park', 'fill-color', p.park);
  map.setPaintProperty('water', 'fill-color', p.water);
  map.setPaintProperty('roads-major', 'line-color', p.roadsMajor);
  map.setPaintProperty('buildings-2d', 'fill-color', p.buildingColor);
  map.setPaintProperty('buildings-3d', 'fill-extrusion-color', p.buildingColor);
}

// Quick-jump chips — real LA neighborhoods, not abstract coordinates
const LOCATIONS = [
  { id: 'downtown',  label: 'DOWNTOWN',  center: [-118.2437, 34.0522], zoom: 15.5 },
  { id: 'hollywood', label: 'HOLLYWOOD', center: [-118.3387, 34.1016], zoom: 15.5 },
  { id: 'venice',    label: 'VENICE',    center: [-118.4695, 33.9850], zoom: 15.5 },
  { id: 'koreatown', label: 'KOREATOWN', center: [-118.3004, 34.0577], zoom: 15.5 },
  { id: 'southla',   label: 'SOUTH LA',  center: [-118.2632, 33.9722], zoom: 15.5 },
];

const MAP_STYLE = {
  version: 8,
  glyphs: GLYPHS_URL,
  sources: {
    omt: { type: 'vector', url: TILES_URL },
    'terrain-dem': {
      type: 'raster-dem', encoding: 'terrarium',
      tiles: [TERRAIN_DEM_URL], tileSize: 256, maxzoom: 14,
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': TIME_PRESETS[DEFAULT_PRESET].bg } },
    {
      id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover',
      paint: { 'fill-color': TIME_PRESETS[DEFAULT_PRESET].landcover, 'fill-opacity': 0.6 },
    },
    {
      id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park',
      paint: { 'fill-color': TIME_PRESETS[DEFAULT_PRESET].park, 'fill-opacity': 0.65 },
    },
    {
      id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water',
      paint: { 'fill-color': TIME_PRESETS[DEFAULT_PRESET].water, 'fill-opacity': 0.92 },
    },
    // Hidden until MODO 3D — terrain relief is invisible from a flat top-down 2D view anyway,
    // so the (fairly heavy) elevation pyramid only needs to load once the user asks for 3D.
    {
      id: 'hillshade', type: 'hillshade', source: 'terrain-dem',
      layout: { visibility: 'none' },
      paint: {
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#12324a',
        'hillshade-accent-color': '#04101c',
        'hillshade-exaggeration': 0.55,
      },
    },
    {
      id: 'roads', type: 'line', source: 'omt', 'source-layer': 'transportation',
      paint: {
        'line-color': '#0d2436',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 16, 1.6],
      },
    },
    {
      id: 'roads-major', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      paint: {
        'line-color': TIME_PRESETS[DEFAULT_PRESET].roadsMajor,
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 2.6],
      },
    },
    {
      id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      paint: { 'line-color': '#123044', 'line-width': 0.6, 'line-opacity': 0.7 },
    },
    // Flat footprints — visible in 2D mode
    {
      id: 'buildings-2d', type: 'fill', source: 'omt', 'source-layer': 'building',
      paint: { 'fill-color': TIME_PRESETS[DEFAULT_PRESET].buildingColor, 'fill-outline-color': '#123244' },
    },
    // Extruded volumes — the Digital Twin, hidden until MODO 3D is toggled on
    {
      id: 'buildings-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building',
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': TIME_PRESETS[DEFAULT_PRESET].buildingColor,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.96,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // Labels — real place names read far more "alive" than anonymous geometry
    {
      id: 'road-labels', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'symbol-placement': 'line', 'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-letter-spacing': 0.05,
      },
      paint: {
        'text-color': '#5fb8d6', 'text-halo-color': '#00060f', 'text-halo-width': 1.2,
        'text-opacity': 0.85,
      },
    },
    {
      id: 'place-labels', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 15],
        'text-transform': 'uppercase', 'text-letter-spacing': 0.08,
      },
      paint: {
        'text-color': '#e8fbff', 'text-halo-color': '#001018', 'text-halo-width': 1.4,
      },
    },
  ],
  sky: TIME_PRESETS[DEFAULT_PRESET].sky,
  // No top-level `terrain` here on purpose — applied lazily via map.setTerrain() when
  // MODO 3D activates, so the initial load doesn't wait on the elevation pyramid.
  light: TIME_PRESETS[DEFAULT_PRESET].light,
};

// ── HUD styles ───────────────────────────────────────────────────────────────
const HUD = {
  position: 'absolute', zIndex: 900, pointerEvents: 'none',
  fontSize: 9, letterSpacing: '.12em', lineHeight: 1.82,
  color: 'rgba(0,255,90,.65)', fontFamily: "'Courier New',Courier,monospace",
};
const SCANLINES = {
  position: 'absolute', inset: 0, zIndex: 800, pointerEvents: 'none',
  background: 'repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)',
};
const VIGNETTE = {
  position: 'absolute', inset: 0, zIndex: 700, pointerEvents: 'none',
  background: 'radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.65) 100%)',
};
const COORDS = {
  position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
  zIndex: 900, pointerEvents: 'none', whiteSpace: 'nowrap',
  background: 'rgba(0,4,0,.82)', border: '1px solid rgba(0,255,80,.20)',
  padding: '3px 18px', borderRadius: 2,
  fontSize: 9, color: 'rgba(0,255,90,.75)', letterSpacing: '.15em',
  textShadow: '0 0 12px rgba(0,255,80,.5)', fontFamily: "'Courier New',Courier,monospace",
};

function CamBtn({ label, title, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 26, height: 24, borderRadius: 3, cursor: disabled ? 'default' : 'pointer',
        fontFamily: "'Courier New',Courier,monospace", fontSize: 11, fontWeight: 700,
        background: 'rgba(0,10,4,.7)',
        border: `1px solid rgba(0,255,80,${disabled ? 0.12 : 0.3})`,
        color: disabled ? 'rgba(0,255,90,.25)' : 'rgba(0,255,90,.85)',
        transition: 'all .2s',
      }}
    >
      {label}
    </button>
  );
}

export default function Twin3DMap({ onClickInfo }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const [ready,   setReady]   = useState(false);
  const [is3D,    setIs3D]    = useState(false);
  const [coordText, setCoordText] = useState('LAT: 34.05220° N  |  LNG: 118.24370° W  |  LOS ANGELES');
  const [ptCount, setPtCount] = useState(0);
  const [timeKey, setTimeKey] = useState(DEFAULT_PRESET);
  const [cam, setCam] = useState({ pitch: CAM_2D.pitch, bearing: CAM_2D.bearing });

  // ── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: CENTER,
      zoom: START_ZOOM,
      pitch: CAM_2D.pitch,
      bearing: CAM_2D.bearing,
      antialias: true,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    map.on('error', (e) => console.error('[Twin3DMap] map error:', e?.error?.message || e));
    map.on('mousemove', (e) => {
      setCoordText(
        `LAT: ${e.lngLat.lat.toFixed(5)}° N  |  LNG: ${Math.abs(e.lngLat.lng).toFixed(5)}° W  |  LOS ANGELES BASIN`
      );
    });
    map.on('moveend', () => {
      setCam({ pitch: Math.round(map.getPitch()), bearing: Math.round(map.getBearing()) });
    });

    map.on('load', () => {
      // Division boundaries — same source LaMapGoogle uses, on top of the twin
      fetch('/data/lapd_divisions_crimes.geojson')
        .then((r) => r.json())
        .then((gj) => {
          if (!mapRef.current) return;
          mapRef.current.addSource('divisions', { type: 'geojson', data: gj });
          mapRef.current.addLayer({
            id: 'division-lines', type: 'line', source: 'divisions',
            paint: { 'line-color': '#00ff50', 'line-width': 1.4, 'line-opacity': 0.75 },
          });
          mapRef.current.on('click', 'division-lines', (e) => {
            const p = e.features?.[0]?.properties;
            if (!p || !onClickInfo) return;
            onClickInfo({
              clickType: 'division', name: p.name || '—',
              total: p.total_crimes || 0, clearance: p.clearance_rate || 0,
              topCategory: p.top_category || '—',
            });
          });
        })
        .catch((e) => console.warn('[Twin3DMap] divisions:', e));

      // Crime incidents — current-hour snapshot, heatmap (any zoom) + pin layer (close zoom)
      fetch('/data/crime_points_hourly.json')
        .then((r) => r.json())
        .then((d) => {
          if (!mapRef.current) return;
          const hour = new Date().getHours();
          const pts  = d.hours[hour] || [];
          const fc = {
            type: 'FeatureCollection',
            features: pts.map(([lat, lng]) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: {},
            })),
          };
          setPtCount(fc.features.length);
          mapRef.current.addSource('crime-pts', { type: 'geojson', data: fc });

          // Immune to fill-extrusion depth occlusion — always reads on top of the twin
          mapRef.current.addLayer({
            id: 'crime-heat', type: 'heatmap', source: 'crime-pts',
            paint: {
              'heatmap-weight': 0.7,
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 1.8],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 26],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.75, 17, 0.25],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0,    'rgba(0,0,0,0)',
                0.2,  'rgba(0,191,255,0.45)',
                0.5,  'rgba(0,255,255,0.65)',
                0.75, 'rgba(217,70,239,0.80)',
                1,    'rgba(255,0,127,0.95)',
              ],
            },
          });
          mapRef.current.addLayer({
            id: 'crime-pins', type: 'circle', source: 'crime-pts',
            minzoom: 15,
            paint: {
              'circle-radius': 3.4,
              'circle-color': '#ff007f',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 0.95],
              'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 0.95],
            },
          });
        })
        .catch((e) => console.warn('[Twin3DMap] crime points:', e));

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onClickInfo]);

  // ── 3D toggle ────────────────────────────────────────────────────────────
  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    const camTarget = next ? CAM_3D : CAM_2D;
    map.easeTo({ pitch: camTarget.pitch, bearing: camTarget.bearing, duration: 1200, essential: true });
    map.setLayoutProperty('buildings-3d', 'visibility', next ? 'visible' : 'none');
    map.setLayoutProperty('buildings-2d', 'visibility', next ? 'none' : 'visible');
    map.setLayoutProperty('hillshade', 'visibility', next ? 'visible' : 'none');
    map.setTerrain(next ? { source: 'terrain-dem', exaggeration: 1.4 } : null);
  }, [is3D]);

  // ── Time-of-day ──────────────────────────────────────────────────────────
  const applyTime = useCallback((key) => {
    setTimeKey(key);
    if (mapRef.current) applyTimePreset(mapRef.current, key);
  }, []);

  // ── Manual camera commands ──────────────────────────────────────────────
  const rotateBy = useCallback((deltaDeg) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: map.getBearing() + deltaDeg, duration: 500 });
  }, []);

  const resetNorth = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, duration: 600 });
  }, []);

  const tiltBy = useCallback((deltaDeg) => {
    const map = mapRef.current;
    if (!map) return;
    const next = Math.max(0, Math.min(75, map.getPitch() + deltaDeg));
    map.easeTo({ pitch: next, duration: 500 });
  }, []);

  const flyToLocation = useCallback((loc) => {
    mapRef.current?.flyTo({ center: loc.center, zoom: loc.zoom, duration: 2200, essential: true });
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── MODO 3D // TWIN toggle ─────────────────────────────────────── */}
      <button
        onClick={toggle3D}
        disabled={!ready}
        style={{
          position: 'absolute', top: 14, left: 14, zIndex: 950,
          padding: '9px 16px', borderRadius: 3, cursor: ready ? 'pointer' : 'wait',
          fontFamily: "'Courier New',Courier,monospace", fontSize: 11, fontWeight: 700,
          letterSpacing: '.14em', textTransform: 'uppercase',
          background: is3D ? 'rgba(0,255,80,.14)' : 'rgba(0,10,4,.82)',
          border: `1px solid ${is3D ? '#00ff50' : 'rgba(0,255,80,.35)'}`,
          color: is3D ? '#00ff50' : 'rgba(0,255,90,.85)',
          boxShadow: is3D ? '0 0 22px rgba(0,255,80,.35)' : 'none',
          transition: 'all .25s',
        }}
      >
        [ MODO 3D // TWIN ]{is3D ? ' ◈ ON' : ''}
      </button>

      {/* ── Time-of-day rig ────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 54, left: 14, zIndex: 950, display: 'flex', gap: 4 }}>
        {Object.entries(TIME_PRESETS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => applyTime(key)}
            disabled={!ready}
            title={p.label}
            style={{
              padding: '5px 9px', borderRadius: 3, cursor: ready ? 'pointer' : 'wait',
              fontFamily: "'Courier New',Courier,monospace", fontSize: 9, fontWeight: 700,
              letterSpacing: '.08em',
              background: timeKey === key ? 'rgba(0,255,80,.14)' : 'rgba(0,10,4,.7)',
              border: `1px solid ${timeKey === key ? '#00ff50' : 'rgba(0,255,80,.25)'}`,
              color: timeKey === key ? '#00ff50' : 'rgba(0,255,90,.7)',
              transition: 'all .2s',
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* ── Camera commands ────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 86, left: 14, zIndex: 950, display: 'flex', gap: 4 }}>
        <CamBtn label="⟲" title="Rotar izquierda" disabled={!ready} onClick={() => rotateBy(-30)} />
        <CamBtn label="⊙" title="Resetear norte" disabled={!ready} onClick={resetNorth} />
        <CamBtn label="⟳" title="Rotar derecha" disabled={!ready} onClick={() => rotateBy(30)} />
        <CamBtn label="▲" title="Inclinar más" disabled={!ready || !is3D} onClick={() => tiltBy(10)} />
        <CamBtn label="▼" title="Inclinar menos" disabled={!ready || !is3D} onClick={() => tiltBy(-10)} />
      </div>

      <div style={SCANLINES} />
      <div style={VIGNETTE} />

      {/* TL — status */}
      <div style={{ ...HUD, top: 118, left: 14 }}>
        <div>SRC: OPENFREEMAP · OSM BUILDINGS</div>
        <div>MODE: <span style={{ color: is3D ? '#00ff50' : '#9d4edd' }}>
          {is3D ? 'DIGITAL TWIN 3D' : 'PLANAR 2D'}
        </span></div>
        <div>CAM: <span style={{ color: 'rgba(0,255,90,.9)' }}>
          PITCH {cam.pitch}° · BRG {cam.bearing}°
        </span></div>
      </div>

      {/* TR — incidents */}
      <div style={{ ...HUD, top: 14, right: 66, textAlign: 'right' }}>
        <div>INCIDENTS (HR SNAPSHOT): <span style={{ color: 'rgba(0,255,90,.95)', fontWeight: 700 }}>
          {ptCount.toLocaleString()}
        </span></div>
      </div>

      {/* ── Quick-jump chips ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
        zIndex: 950, display: 'flex', gap: 5, pointerEvents: 'auto',
      }}>
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => flyToLocation(loc)}
            disabled={!ready}
            style={{
              padding: '5px 10px', borderRadius: 12, cursor: ready ? 'pointer' : 'wait',
              fontFamily: "'Courier New',Courier,monospace", fontSize: 9, fontWeight: 700,
              letterSpacing: '.08em',
              background: 'rgba(0,10,4,.75)', border: '1px solid rgba(0,255,80,.25)',
              color: 'rgba(0,255,90,.8)', whiteSpace: 'nowrap', transition: 'all .2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,255,80,.14)'; e.currentTarget.style.color = '#00ff50'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,10,4,.75)'; e.currentTarget.style.color = 'rgba(0,255,90,.8)'; }}
          >
            ◈ {loc.label}
          </button>
        ))}
      </div>

      <div style={COORDS}>{coordText}</div>

      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#000', color: 'rgba(0,255,80,.7)',
          fontFamily: 'monospace', fontSize: 11, letterSpacing: '.22em', zIndex: 999,
        }}>
          ◈ INICIALIZANDO GEMELO DIGITAL…
        </div>
      )}
    </div>
  );
}
