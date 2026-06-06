'use client';
import { useState } from 'react';
import Shell from '@/components/Shell';

const MAPS = [
  {
    id: 'divisions',
    label: 'Division Map',
    icon: '🗺️',
    src: '/lapd-map.html',
    title: 'Crime Volume by LAPD Division',
    badge: '21 Divisions',
    insight: [
      { icon: '🔴', text: 'Central, 77th Street and Pacific lead in total crime volume — together representing nearly 20% of all incidents.' },
      { icon: '🟢', text: 'Switching to Clearance Rate reveals divisions like 77th St, Mission and West Valley solve cases at 2× the rate of their peers.' },
      { icon: '⚡', text: 'The choropleth by division aggregates all crime types. Use this view for operational comparisons between patrol areas.' },
    ],
  },
  {
    id: 'per1000',
    label: 'Crime / 1,000',
    icon: '👥',
    src: '/maps/tract-choropleth.html',
    title: 'Relative Crime Risk by Census Tract',
    badge: '~2,500 Tracts',
    insight: [
      { icon: '🔎', text: 'Normalising by population exposes true hotspots: some tracts with low absolute crime numbers have very high per-capita risk due to sparse population.' },
      { icon: '📍', text: 'Downtown and South LA tracts show the highest density, but certain industrial/commercial tracts with near-zero residents show extreme ratios.' },
      { icon: '🏘️', text: 'This layer enables equity analysis: identifying communities that disproportionately bear crime risk relative to their size.' },
    ],
  },
  {
    id: 'vulnerability',
    label: 'Vulnerability Index',
    icon: '⚠️',
    src: '/maps/vulnerability-choropleth.html',
    title: 'Socioeconomic Vulnerability by Census Tract',
    badge: 'Poverty + Income + Crime',
    insight: [
      { icon: '📊', text: 'Composite index combining crime rate (40%), poverty rate (35%) and inverse median income (25%). Use the toolbar buttons inside the map to explore each dimension individually.' },
      { icon: '🔴', text: 'Very High vulnerability tracts concentrate in South LA, East LA and parts of the San Fernando Valley — areas where high crime, high poverty and low income overlap.' },
      { icon: '💡', text: 'Comparing this layer with the Crime/1,000 map reveals tracts where poverty is high but crime is suppressed — and vice versa — informing targeted policy interventions.' },
    ],
  },
  {
    id: 'neighborhoods',
    label: 'Neighborhoods',
    icon: '🏘️',
    src: '/maps/neighborhood-choropleth.html',
    title: '114 LA Times Neighborhoods — Crime & Socioeconomics',
    badge: '114 Neighborhoods',
    insight: [
      { icon: '🏙️', text: 'Downtown leads with 71,808 crimes (2020–2024) — over 1,000 per 1,000 inhabitants. Hollywood, Westlake and Koreatown follow.' },
      { icon: '🏢', text: 'Blue dots mark the 21 LAPD station locations. Dashed blue lines show division boundaries. Both overlays can be toggled with the controls in the top-right corner.' },
      { icon: '🔗', text: 'Each neighborhood popup cross-references its LAPD division clearance rate and top crime category — linking street-level geography to operational police data.' },
    ],
  },
  {
    id: 'mortality',
    label: 'Biz Stability',
    icon: '📉',
    src: '/maps/mortality-choropleth.html',
    title: 'Business Mortality & Crime — Stability Quadrant Analysis',
    badge: '544k Businesses · 4 Quadrants',
    insight: [
      { icon: '🟥', text: '"Stressed" neighborhoods (high crime + low stability): Hollywood, Venice, Vermont-Slauson. High churn despite — or because of — sustained criminal pressure on commercial activity.' },
      { icon: '🟠', text: '"Resilient" neighborhoods: Chinatown, Wilmington, Rancho Park — anchor businesses (15+ years) persist despite elevated crime.' },
      { icon: '📊', text: 'Counterintuitive: 2017 was LA\'s peak closure year (53,665 closures) — not COVID 2020 (29,145). The 2020 dip reflects deferred closures, not resilience.' },
    ],
  },
  {
    id: 'business',
    label: 'Biz & Crime',
    icon: '🏪',
    src: '/maps/business-choropleth.html',
    title: 'Active Businesses vs. Crime by Neighborhood',
    badge: '545k Businesses · 114 Neighborhoods',
    insight: [
      { icon: '🏪', text: 'Downtown concentrates 33,167 active businesses — 470 per 1,000 inhabitants. But with 2.2 crimes per business, Hollywood (2.5) and Westlake (2.7) show higher commercial crime intensity.' },
      { icon: '📊', text: 'The "Crimes per Business" metric reveals where criminal activity disproportionately burdens commercial areas — a key indicator for business viability and insurance risk.' },
      { icon: '🗂️', text: 'Each popup breaks down the 10 business sectors (Food, Retail, Real Estate, Entertainment, etc.) and cross-references income, poverty and LAPD division clearance rate.' },
    ],
  },
];

function MapTab({ map, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '8px 16px', borderRadius: 9,
      border: active ? '1px solid rgba(79,142,247,.4)' : '1px solid #2a2d3a',
      background: active ? 'rgba(79,142,247,.1)' : '#1a1d27',
      color: active ? '#4f8ef7' : '#7b82a0',
      fontSize: 12, fontWeight: active ? 600 : 400,
      cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 15 }}>{map.icon}</span>
      {map.label}
    </button>
  );
}

export default function GeoPage() {
  const [active, setActive] = useState('divisions');
  const current = MAPS.find(m => m.id === active);

  return (
    <Shell geoActiveTab={active}>

      {/* ── Page top bar ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 32px 0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 700, letterSpacing: '.1em', marginBottom: 5 }}>
            GEOSPATIAL ANALYSIS
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            Crime Cartography <span style={{ color: '#4f8ef7' }}>2020–2024</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, color: '#4f8ef7', fontWeight: 700,
            background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.25)',
            borderRadius: 6, padding: '4px 11px',
          }}>6 Layers</span>
          <span style={{
            fontSize: 11, color: '#7b82a0',
            background: '#1a1d27', border: '1px solid #2a2d3a',
            borderRadius: 6, padding: '4px 11px',
          }}>114 Neighborhoods</span>
        </div>
      </div>

      {/* ── Map selector tabs ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 7, padding: '18px 32px 0',
        overflowX: 'auto', scrollbarWidth: 'none',
        borderBottom: '1px solid #1e2030',
        paddingBottom: 18,
      }}>
        {MAPS.map(m => (
          <MapTab key={m.id} map={m} active={active === m.id} onClick={() => setActive(m.id)} />
        ))}
      </div>

      {/* ── Map content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '24px 32px 40px', maxWidth: 1160, width: '100%' }}>
        <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 16, overflow: 'hidden' }}>

          {/* Map iframe (all pre-loaded, toggled via display) */}
          <div style={{ width: '100%', lineHeight: 0, position: 'relative' }}>
            {MAPS.map(m => (
              <div key={m.id} style={{ display: m.id === active ? 'block' : 'none' }}>
                <iframe src={m.src} style={{ width: '100%', height: 560, border: 'none', display: 'block' }} title={m.label} loading="lazy" />
              </div>
            ))}
          </div>

          {/* Analysis panel */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0' }}>{current.title}</p>
              <span style={{
                fontSize: 11, color: '#4f8ef7',
                background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.25)',
                borderRadius: 6, padding: '3px 10px', fontWeight: 600,
              }}>{current.badge}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
              {current.insight.map((ins, i) => (
                <div key={i} style={{
                  background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 10,
                  padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                  <span style={{ fontSize: 12, color: '#7b82a0', lineHeight: 1.55 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </Shell>
  );
}
