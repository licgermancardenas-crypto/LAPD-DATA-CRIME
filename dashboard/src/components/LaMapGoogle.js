'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';

// ── Constants ───────────────────────────────────────────────────────────────
const LIBRARIES = [];
const CENTER    = { lat: 34.0522, lng: -118.2437 };

// LA bounding box for spatial grid (cluster mode)
const LA_S = 33.68, LA_N = 34.38, LA_W = -118.77, LA_E = -117.88;
const GR = 18, GC = 22; // grid rows × cols
const DLAT = (LA_N - LA_S) / GR;
const DLNG = (LA_E - LA_W) / GC;

const ZOOM_THRESHOLD = 12; // below → clusters, at/above → neon pins

// ── Map options ─────────────────────────────────────────────────────────────
const MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  // mapId enables WebGL vector rendering — required for tilt > 45° and real 3D buildings
  mapId: 'DEMO_MAP_ID',
  tilt: 60,
  heading: 45,
  // Note: styles[] is silently ignored when mapId is set; use Cloud Console for custom styling
  tiltInteractionEnabled: true,
  headingInteractionEnabled: true,
  rotateControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  zoomControl: true,
  gestureHandling: 'greedy',
};

// ── Styles ──────────────────────────────────────────────────────────────────
const ROOT = { position:'absolute', inset:0, overflow:'hidden', background:'#000' };

// Electric cyberpunk satellite filter — lifts vivid colors, deepens blacks
const MAP_WRAP = {
  position:'absolute', inset:0,
  filter:'brightness(0.55) contrast(1.65) saturate(1.40) hue-rotate(340deg)',
  willChange:'filter',
};
const MAP_CONTAINER = { width:'100%', height:'100%' };
const CRIME_CANVAS  = {
  position:'absolute', inset:0, width:'100%', height:'100%',
  pointerEvents:'none', zIndex:500,
};
const SCANLINES = {
  position:'absolute', inset:0, zIndex:800, pointerEvents:'none',
  background:'repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)',
};
const VIGNETTE = {
  position:'absolute', inset:0, zIndex:700, pointerEvents:'none',
  background:'radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.70) 100%)',
};
const WATERMARK = {
  position:'absolute', top:'50%', left:'50%',
  transform:'translate(-50%,-50%) rotate(-18deg)',
  zIndex:600, pointerEvents:'none',
  fontSize:13, fontWeight:900, letterSpacing:'.5em', userSelect:'none',
  color:'rgba(0,255,80,.022)', whiteSpace:'nowrap',
  fontFamily:"'Courier New',monospace",
};
const CROSSHAIR_WRAP = {
  position:'absolute', top:'50%', left:'50%',
  transform:'translate(-50%,-50%)',
  zIndex:900, pointerEvents:'none', opacity:0.35,
};
const HUD = {
  position:'absolute', zIndex:900, pointerEvents:'none',
  fontSize:9, letterSpacing:'.12em', lineHeight:1.82,
  color:'rgba(0,255,90,.65)',
  fontFamily:"'Courier New',Courier,monospace",
};
const COORDS = {
  position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)',
  zIndex:900, pointerEvents:'none', whiteSpace:'nowrap',
  background:'rgba(0,4,0,.82)', border:'1px solid rgba(0,255,80,.20)',
  padding:'3px 18px', borderRadius:2,
  fontSize:9, color:'rgba(0,255,90,.75)', letterSpacing:'.15em',
  textShadow:'0 0 12px rgba(0,255,80,.5)',
  fontFamily:"'Courier New',Courier,monospace",
};
const LOCK = {
  position:'absolute', top:'calc(50% + 34px)', left:'50%',
  transform:'translateX(-50%)',
  zIndex:1000, pointerEvents:'none',
  fontSize:11, fontWeight:700, color:'#00ff50', letterSpacing:'.28em',
  textShadow:'0 0 18px rgba(0,255,80,1),0 0 36px rgba(0,255,80,.5)',
  userSelect:'none', fontFamily:"'Courier New',Courier,monospace",
  whiteSpace:'nowrap',
};
// Station badge layer — sibling to crime canvas, outside CSS filter
const STATION_LAYER = {
  position:'absolute', inset:0,
  overflow:'hidden', pointerEvents:'none', zIndex:502,
};

// Legend box (shown in pin mode)
const LEGEND = {
  position:'absolute', bottom:28, right:14, zIndex:900, pointerEvents:'none',
  background:'rgba(0,4,0,.78)', border:'1px solid rgba(0,255,80,.18)',
  borderRadius:4, padding:'6px 10px',
  fontFamily:"'Courier New',Courier,monospace",
  fontSize:9, letterSpacing:'.1em', lineHeight:2,
};

// ── Police station badge SVG (cyan neon shield) ─────────────────────────────
const BADGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40">' +
  '<path d="M17 1 L31 7 L31 21 Q31 34 17 39 Q3 34 3 21 L3 7 Z" fill="rgba(0,10,30,0.92)" stroke="#00bfff" stroke-width="1.7"/>' +
  '<path d="M17 4.5 L28 9.5 L28 21 Q28 31.5 17 36 Q6 31.5 6 21 L6 9.5 Z" fill="none" stroke="rgba(0,191,255,0.28)" stroke-width="0.8"/>' +
  '<polygon points="17,10.5 18.6,15.7 24.2,15.7 19.8,18.9 21.4,24.1 17,20.9 12.6,24.1 14.2,18.9 9.8,15.7 15.4,15.7" fill="#00bfff" opacity="0.94"/>' +
  '<text x="17" y="34.5" text-anchor="middle" fill="#00bfff" font-size="5.5" font-family="monospace" font-weight="bold" letter-spacing="0.8">LAPD</text>' +
  '</svg>';

// ── Crosshair SVG ───────────────────────────────────────────────────────────
function Crosshair() {
  return (
    <div style={CROSSHAIR_WRAP}>
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="13.5" stroke="#00ff50" strokeWidth="0.7"/>
        <circle cx="26" cy="26" r="2.8"  fill="#00ff50" fillOpacity="0.5"/>
        <line x1="0"  y1="26" x2="16" y2="26" stroke="#00ff50" strokeWidth="0.7"/>
        <line x1="36" y1="26" x2="52" y2="26" stroke="#00ff50" strokeWidth="0.7"/>
        <line x1="26" y1="0"  x2="26" y2="16" stroke="#00ff50" strokeWidth="0.7"/>
        <line x1="26" y1="36" x2="26" y2="52" stroke="#00ff50" strokeWidth="0.7"/>
        {[[2,2,10,2],[2,2,2,10],[50,2,42,2],[50,2,50,10],
          [2,50,10,50],[2,50,2,42],[50,50,42,50],[50,50,50,42]]
          .map(([x1,y1,x2,y2],i)=>(
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#00ff50" strokeWidth="0.55" opacity=".45"/>
          ))}
      </svg>
    </div>
  );
}

// ── Invisible projection overlay ─────────────────────────────────────────────
function makeProjOverlayClass(G) {
  class ProjOverlay extends G.OverlayView {
    onAdd()    {}
    draw()     {}
    onRemove() {}
  }
  return ProjOverlay;
}

// ── Canvas renderers (module-level for zero closure overhead) ────────────────

function renderPins(ctx, pts, proj, w, h, tick, mapBounds) {
  if (!pts.length) return;

  // Pre-filter by map bounds to skip fromLatLngToContainerPixel on hidden pts
  const ne = mapBounds.getNorthEast(), sw = mapBounds.getSouthWest();
  const PAD = 0.03;
  const nLat = ne.lat()+PAD, sLat = sw.lat()-PAD;
  const eLng = ne.lng()+PAD, wLng = sw.lng()-PAD;

  const LIMIT  = 500;
  const step   = pts.length > LIMIT ? Math.ceil(pts.length / LIMIT) : 1;
  const sample = [];
  for (let i = 0; i < pts.length; i += step) {
    const ll = pts[i];
    const la = ll.lat(), ln = ll.lng();
    if (la >= sLat && la <= nLat && ln >= wLng && ln <= eLng) sample.push(ll);
  }
  if (!sample.length) return;

  const PULSE_FROM = Math.max(0, sample.length - 35);

  for (let i = 0; i < sample.length; i++) {
    const px = proj.fromLatLngToContainerPixel(sample[i]);
    if (!px) continue;
    const { x, y } = px;
    if (x < -15 || x > w+15 || y < -15 || y > h+15) continue;

    // Part-1 = pink neon  |  Part-2 = cyan neon  (alternate by index)
    const isPink   = i % 2 === 0;
    const hexColor = isPink ? '#ff007f' : '#00ffff';
    const rgb      = isPink ? '255,0,127' : '0,255,255';

    // Outer glow (radial gradient, no shadowBlur overhead)
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 13);
    glow.addColorStop(0,   `rgba(${rgb},0.55)`);
    glow.addColorStop(0.55,`rgba(${rgb},0.18)`);
    glow.addColorStop(1,   `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI*2);
    ctx.fill();

    // Core pin
    ctx.fillStyle = hexColor;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI*2);
    ctx.fill();

    // White center
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI*2);
    ctx.fill();

    // Pulse ring on the "most-recent" pins
    if (i >= PULSE_FROM) {
      const phase = (tick * 2 + i * 17) % 90;
      const ring  = 5 + phase * 0.32;
      const alpha = Math.max(0, 0.80 * (1 - phase / 90));
      ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(2)})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, ring, 0, Math.PI*2);
      ctx.stroke();
    }
  }
}

function renderClusters(ctx, clusters, proj, w, h) {
  for (const { count, ll } of clusters) {
    if (!count) continue;
    const px = proj.fromLatLngToContainerPixel(ll);
    if (!px) continue;
    const { x, y } = px;
    if (x < -40 || x > w+40 || y < -40 || y > h+40) continue;

    const r     = count > 400 ? 27 : count > 100 ? 21 : count > 25 ? 16 : 11;
    const fsize = count > 400 ? 11 : count > 100 ? 10 : 9;
    const label = count > 9999 ? '9k+' : count > 999 ? `${(count/1000).toFixed(1)}k` : String(count);

    // Dark navy fill — rgba(15, 23, 42, 0.85)
    ctx.fillStyle = 'rgba(15,23,42,0.87)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();

    // Violet neon border with glow
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#9d4edd';
    ctx.strokeStyle = '#9d4edd';
    ctx.lineWidth   = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.stroke();

    // Label text — white + violet glow
    ctx.shadowBlur   = 6;
    ctx.shadowColor  = '#9d4edd';
    ctx.fillStyle    = '#ffffff';
    ctx.font         = `bold ${fsize}px 'Courier New',monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    ctx.shadowBlur = 0; // reset so it doesn't bleed into next iteration
  }
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LaMapGoogle({ simHour, filterYear, filterArea, filterPart, data, onClickInfo }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  // refs
  const mapRef          = useRef(null);
  const projOverlayRef  = useRef(null);
  const crimeCanvasRef  = useRef(null);
  const stationLayerRef = useRef(null);  // container div for station badges
  const stationDivsRef  = useRef([]);    // [{div, ll}] — badge elements + LatLng
  const divisionGeoRef  = useRef(null);
  const dataRef         = useRef(data);
  const hourlyLLRef     = useRef([]);   // LatLng[][]  (24 h)
  const hourlyGridRef   = useRef([]);   // {count,ll}[][] (24 h cluster grids)
  const simHourRef      = useRef(simHour);
  const mapZoomRef      = useRef(11);
  const tickRef         = useRef(0);

  useEffect(() => { dataRef.current    = data;    }, [data]);
  useEffect(() => { simHourRef.current = simHour; }, [simHour]);

  // state
  const [crimePoints,    setCrimePoints]    = useState(null);
  const [coordText,      setCoordText]      = useState('LAT: 34.05220° N  |  LNG: 118.24370° W  |  LOS ANGELES');
  const [clock,          setClock]          = useState('');
  const [showLock,       setShowLock]       = useState(false);
  const [ptCount,        setPtCount]        = useState(0);
  const [isClusterMode,  setIsClusterMode]  = useState(true);

  // clock
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().replace('T',' ').slice(0,19)+' UTC');
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // load crime hourly data
  useEffect(() => {
    fetch('/data/crime_points_hourly.json')
      .then(r => r.json())
      .then(setCrimePoints)
      .catch(e => console.warn('[LaMapGoogle] crime_points_hourly.json:', e));
  }, []);

  // pre-compute LatLng arrays + cluster grids for all 24 hours
  useEffect(() => {
    if (!crimePoints || !isLoaded || !window?.google) return;
    const G = window.google.maps;

    const allLL    = [];
    const allGrids = [];

    for (const hr of crimePoints.hours) {
      // LatLng array (pin mode)
      const lls = hr
        .filter(([la, ln]) => la !== 0 && ln !== 0)
        .map(([la, ln]) => new G.LatLng(la, ln));
      allLL.push(lls);

      // Spatial grid (cluster mode)
      const gridMap = {};
      for (const [la, ln] of hr) {
        if (la === 0 && ln === 0) continue;
        const ci = Math.max(0, Math.min(GR-1, Math.floor((la - LA_S) / DLAT)));
        const cj = Math.max(0, Math.min(GC-1, Math.floor((ln - LA_W) / DLNG)));
        const k  = ci * GC + cj;
        if (!gridMap[k]) {
          gridMap[k] = {
            count: 0,
            ll: new G.LatLng(LA_S + (ci + 0.5) * DLAT, LA_W + (cj + 0.5) * DLNG),
          };
        }
        gridMap[k].count++;
      }
      allGrids.push(Object.values(gridMap));
    }

    hourlyLLRef.current    = allLL;
    hourlyGridRef.current  = allGrids;
    setPtCount(allLL[simHourRef.current]?.length || 0);
  }, [crimePoints, isLoaded]);

  // ── Main canvas draw ──────────────────────────────────────────────────────
  const drawCrimes = useCallback(() => {
    const canvas = crimeCanvasRef.current;
    const map    = mapRef.current;
    const proj   = projOverlayRef.current?.getProjection?.();
    if (!canvas || !map || !proj) return;

    const mapDiv = map.getDiv();
    const w = mapDiv.offsetWidth, h = mapDiv.offsetHeight;
    if (!w || !h) return;

    if (canvas.width  !== w) canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const hour   = simHourRef.current;
    const zoom   = mapZoomRef.current;
    const bounds = map.getBounds();
    if (!bounds) return;

    if (zoom < ZOOM_THRESHOLD) {
      // ── Cluster mode ─────────────────────────────────────────────────────
      const clusters = hourlyGridRef.current[hour] || [];
      renderClusters(ctx, clusters, proj, w, h);
    } else {
      // ── Neon pin mode ────────────────────────────────────────────────────
      const pts = hourlyLLRef.current[hour] || [];
      renderPins(ctx, pts, proj, w, h, tickRef.current, bounds);
      setPtCount(pts.length);
    }
  }, []);

  // reposition station badges on map pan/zoom
  const repositionStations = useCallback(() => {
    const proj = projOverlayRef.current?.getProjection?.();
    if (!proj) return;
    for (const { div, ll } of stationDivsRef.current) {
      const px = proj.fromLatLngToContainerPixel(ll);
      if (!px) continue;
      div.style.left = (px.x - 17) + 'px';
      div.style.top  = (px.y - 40) + 'px';
    }
  }, []);

  // pulse animation tick (~20 fps)
  useEffect(() => {
    const t = setInterval(() => {
      tickRef.current = (tickRef.current + 1) % 120;
      if (mapZoomRef.current >= ZOOM_THRESHOLD) drawCrimes();
    }, 50);
    return () => clearInterval(t);
  }, [drawCrimes]);

  // redraw when simHour changes
  useEffect(() => {
    drawCrimes();
  }, [simHour, drawCrimes]);

  // zoom to filterArea
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    if (!filterArea) {
      mapRef.current.panTo(CENTER);
      mapRef.current.setZoom(11);
      return;
    }
    if (!divisionGeoRef.current) return;
    const feat = divisionGeoRef.current.features.find(
      f => f.properties.name?.toUpperCase() === filterArea.toUpperCase()
    );
    if (!feat) return;
    const G = window.google.maps;
    const bounds = new G.LatLngBounds();
    const rings = feat.geometry.type === 'MultiPolygon'
      ? feat.geometry.coordinates.flatMap(p => p[0])
      : feat.geometry.coordinates[0];
    rings.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    mapRef.current.fitBounds(bounds, 60);
  }, [filterArea, isLoaded]);

  const flashLock = useCallback((info) => {
    if (onClickInfo) onClickInfo(info);
    setShowLock(true);
    setTimeout(() => setShowLock(false), 900);
  }, [onClickInfo]);

  // ── Map load ──────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((mapInstance) => {
    mapRef.current = mapInstance;

    // Force 3D perspective camera — declarative options may be overridden before the
    // map is fully initialized, so we set them imperatively here as well
    mapInstance.setTilt(60);
    mapInstance.setHeading(45);

    // Invisible overlay — only used for MapCanvasProjection access
    const ProjClass = makeProjOverlayClass(window.google.maps);
    const overlay   = new ProjClass();
    overlay.setMap(mapInstance);
    projOverlayRef.current = overlay;

    // Redraw on map state changes
    mapInstance.addListener('idle', () => {
      const z = mapInstance.getZoom() || 11;
      mapZoomRef.current = z;
      setIsClusterMode(z < ZOOM_THRESHOLD);
      drawCrimes();
      repositionStations();
    });

    // Police station badges (fixed layer — not filtered by simHour)
    fetch('/data/lapd_stations.geojson')
      .then(r => r.json())
      .then(gj => {
        const container = stationLayerRef.current;
        if (!container) return;
        const G = window.google.maps;

        gj.features.forEach(feat => {
          const [lng, lat] = feat.geometry.coordinates;
          const p = feat.properties;
          const ll = new G.LatLng(lat, lng);
          const name = p.division.split(' ')
            .map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

          const div = document.createElement('div');
          div.style.cssText =
            'position:absolute;width:34px;height:40px;' +
            'filter:drop-shadow(0 0 8px rgba(0,191,255,0.80));' +
            'cursor:pointer;pointer-events:auto;' +
            'transform:translateZ(0);';
          div.innerHTML = BADGE_SVG;

          // Tooltip element
          const tip = document.createElement('div');
          tip.style.cssText =
            'display:none;position:absolute;bottom:46px;left:50%;transform:translateX(-50%);' +
            'background:rgba(0,6,20,0.95);border:1px solid rgba(0,191,255,0.30);' +
            'border-radius:4px;padding:8px 12px;white-space:nowrap;z-index:10;' +
            'box-shadow:0 0 18px rgba(0,191,255,0.15);pointer-events:none;';
          tip.innerHTML =
            '<div style="font:700 11px/1.4 \'Courier New\',monospace;color:#00bfff;margin-bottom:3px">' +
            '<span style="opacity:.5">◈ </span>' + name + ' Division</div>' +
            '<div style="font:10px/1.5 \'Courier New\',monospace;color:#94a3b8">' + p.address + '</div>' +
            '<div style="font:700 9px \'Courier New\',monospace;color:rgba(0,191,255,0.42);margin-top:3px">PRECINCT ' + p.prec + '</div>';
          div.appendChild(tip);

          div.addEventListener('mouseenter', () => { tip.style.display = 'block'; });
          div.addEventListener('mouseleave', () => { tip.style.display = 'none';  });
          div.addEventListener('click', (e) => {
            e.stopPropagation();
            flashLock({ clickType:'station', name: name + ' Division', address: p.address, prec: p.prec });
          });

          container.appendChild(div);
          stationDivsRef.current.push({ div, ll });
        });

        // Initial position after adding to DOM
        requestAnimationFrame(() => repositionStations());
      })
      .catch(e => console.warn('[LaMapGoogle] stations:', e));

    // Division boundaries
    fetch('/data/lapd_divisions_crimes.geojson')
      .then(r => r.json())
      .then(gj => {
        divisionGeoRef.current = gj;
        const div = dataRef.current?.division;
        if (div?.length) {
          const sorted  = [...div].sort((a, b) => (b.crimes||0) - (a.crimes||0));
          const rankMap = {};
          sorted.forEach((d, i) => { rankMap[d.name.toUpperCase()] = i+1; });
          gj.features.forEach(f => {
            f.properties._rank = rankMap[f.properties.name?.toUpperCase()] ?? '—';
          });
        } else {
          const sorted = [...gj.features].sort((a, b) =>
            (b.properties.total_crimes||0) - (a.properties.total_crimes||0));
          sorted.forEach((f, i) => { f.properties._rank = i+1; });
        }
        mapInstance.data.addGeoJson(gj);
        mapInstance.data.setStyle({
          fillOpacity: 0,
          strokeColor: '#00ff50',
          strokeOpacity: 0.82,
          strokeWeight: 1.6,
        });
        mapInstance.data.addListener('click', (e) => {
          e.stop();
          const p = e.feature;
          flashLock({
            clickType:   'division',
            name:        p.getProperty('name')           || '—',
            total:       p.getProperty('total_crimes')   || p.getProperty('crimes') || 0,
            clearance:   p.getProperty('clearance_rate') || 0,
            topCategory: p.getProperty('top_category')   || '—',
            rank:        p.getProperty('_rank')          || '—',
            totalDivs:   21,
          });
        });
        mapInstance.data.addListener('mouseover', e => {
          mapInstance.data.overrideStyle(e.feature, { strokeOpacity:1, strokeWeight:2.5 });
        });
        mapInstance.data.addListener('mouseout', e => {
          mapInstance.data.revertStyle(e.feature);
        });
      })
      .catch(e => console.warn('[LaMapGoogle] divisions:', e));
  }, [drawCrimes, flashLock, repositionStations]);

  const onMapClick  = useCallback((e) => {
    flashLock({ clickType:'location', lat:e.latLng.lat().toFixed(4), lng:e.latLng.lng().toFixed(4) });
  }, [flashLock]);

  const onMouseMove = useCallback((e) => {
    const lat = e.latLng.lat().toFixed(5);
    const lng = Math.abs(e.latLng.lng()).toFixed(5);
    setCoordText(`LAT: ${lat}° N  |  LNG: ${lng}° W  |  LOS ANGELES BASIN`);
  }, []);

  const filterStatus = [
    filterYear                         ? `Y:${filterYear}` : '',
    filterArea                         ? `DIV:${filterArea.slice(0,10).toUpperCase()}` : '',
    filterPart && filterPart !== 'all' ? filterPart.toUpperCase() : '',
  ].filter(Boolean).join('  ') || 'ALL YEARS · ALL AREAS';

  // ── States ─────────────────────────────────────────────────────────────────
  if (loadError) return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
      justifyContent:'center', background:'#000', color:'#ff4444',
      fontFamily:'monospace', fontSize:12, textAlign:'center', padding:24 }}>
      ⚠ SATELLITE UPLINK FAILED
    </div>
  );

  if (!isLoaded) return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
      justifyContent:'center', background:'#000', color:'rgba(0,255,80,.7)',
      fontFamily:'monospace', fontSize:11, letterSpacing:'.22em' }}>
      ◈ INITIALIZING SATELLITE UPLINK…
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={ROOT}>

      {/* Electric satellite — CSS filter only touches the map */}
      <div style={MAP_WRAP}>
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER}
          center={CENTER}
          zoom={11}
          options={MAP_OPTIONS}
          onLoad={onMapLoad}
          onClick={onMapClick}
          onMouseMove={onMouseMove}
        />
      </div>

      {/* Crime canvas — outside filter, full neon brightness */}
      <canvas ref={crimeCanvasRef} style={CRIME_CANVAS}/>

      {/* Station badge layer — outside filter, pointer-events enabled per badge */}
      <div ref={stationLayerRef} style={STATION_LAYER}/>

      {/* HUD overlays */}
      <div style={SCANLINES}/>
      <div style={VIGNETTE}/>
      <div style={WATERMARK}>LAPD CRIME INTELLIGENCE SYSTEM — CLASSIFIED // FOUO</div>
      <Crosshair/>

      {/* TL */}
      <div style={{ ...HUD, top:14, left:14 }}>
        <div style={{ color:'rgba(0,255,90,1)', fontSize:10, fontWeight:700, letterSpacing:'.2em', marginBottom:2 }}>
          ◈ L.A. MAP // CIA TACTICAL
        </div>
        <div>SRC: LAPD OPEN DATA 2020–2024</div>
        <div>MODE: <span style={{ color: isClusterMode ? '#9d4edd' : '#ff007f' }}>
          {isClusterMode ? 'CLUSTER 3D OVERVIEW' : 'NEON PIN 3D DETAIL'}
        </span></div>
        <div>CAM: <span style={{ color:'rgba(0,255,90,.9)' }}>TILT 60° · HDG 45°</span></div>
        <div>STATUS: <span style={{ color:'#ff5500' }}>■ SURVEILLANCE ACTIVE</span></div>
      </div>

      {/* TR */}
      <div style={{ ...HUD, top:14, right:14, textAlign:'right' }}>
        <div style={{ color:'rgba(0,255,90,.85)', fontWeight:700 }}>{clock}</div>
        <div>CLASSIFICATION: UNCLASSIFIED // FOUO</div>
        <div>COORD SYS: WGS84 · EPSG:4326</div>
        <div>HOUR: <span style={{ color:'rgba(0,255,90,.95)', fontWeight:700 }}>
          {String(simHour).padStart(2,'0')}:00 HS
        </span></div>
      </div>

      {/* BL */}
      <div style={{ ...HUD, bottom:28, left:14 }}>
        <div>FILTER: <span style={{ color:'rgba(0,255,90,.95)' }}>{filterStatus}</span></div>
        {!isClusterMode && (
          <div>INCIDENTS: <span style={{ color:'rgba(0,255,90,.95)', fontWeight:700 }}>
            {ptCount.toLocaleString()} pts
          </span></div>
        )}
      </div>

      {/* BR — legend in pin mode */}
      {!isClusterMode ? (
        <div style={LEGEND}>
          <div style={{ color:'rgba(0,255,90,.6)', fontSize:8, letterSpacing:'.15em', marginBottom:3 }}>CRIME LEGEND</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
              background:'#ff007f', boxShadow:'0 0 6px #ff007f' }}/>
            <span style={{ color:'rgba(255,0,127,.95)', fontSize:9 }}>PART 1 — VIOLENT</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
              background:'#00ffff', boxShadow:'0 0 6px #00ffff' }}/>
            <span style={{ color:'rgba(0,255,255,.95)', fontSize:9 }}>PART 2 — PROPERTY</span>
          </div>
          <div style={{ color:'rgba(157,78,221,.8)', fontSize:8, marginTop:3 }}>
            ◉ PULSING = RECENT INCIDENTS
          </div>
        </div>
      ) : (
        <div style={{ ...HUD, bottom:28, right:14, textAlign:'right' }}>
          <div>PROVIDER: <span style={{ color:'rgba(0,255,90,.95)' }}>GOOGLE HYBRID</span></div>
          <div>CLUSTERS: <span style={{ color:'#9d4edd', fontWeight:700 }}>■ ACTIVE</span></div>
          <div style={{ color:'rgba(0,255,90,.55)', fontSize:8 }}>ZOOM IN FOR DETAIL</div>
        </div>
      )}

      <div style={COORDS}>{coordText}</div>
      {showLock && <div style={LOCK}>◈ TARGET ACQUIRED</div>}
    </div>
  );
}
