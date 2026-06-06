'use client';
import { useState } from 'react';
import Link from 'next/link';

const MAPS = [
  {
    id: 'divisions',
    label: 'Division Choropleth',
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
    label: 'Crime per 1,000 Inhabitants',
    icon: '👥',
    src: '/maps/tract-choropleth.html',
    title: 'Relative Crime Risk by Census Tract',
    badge: '~2,300 Tracts',
    insight: [
      { icon: '🔎', text: 'Normalising by population exposes true hotspots: some tracts with low absolute crime numbers have very high per-capita risk due to sparse population.' },
      { icon: '📍', text: 'Downtown and South LA tracts show the highest density, but certain industrial/commercial tracts with near-zero residents show extreme ratios — a data artefact worth noting.' },
      { icon: '🏘️', text: 'This layer enables equity analysis: identifying communities that disproportionately bear crime risk relative to their size.' },
    ],
  },
];

const S = {
  page:     { minHeight: '100vh', background: '#0f1117', color: '#e8eaf0', fontFamily: 'Inter,system-ui,sans-serif' },
  header:   { background: 'rgba(15,17,23,.96)', borderBottom: '1px solid #2a2d3a', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50, padding: '0 24px' },
  hInner:   { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  brand:    { display: 'flex', alignItems: 'center', gap: 10 },
  dot:      { width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#7c5cbf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  back:     { fontSize: 13, color: '#7b82a0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid #2a2d3a', transition: 'all .15s' },
  wrap:     { maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' },
  pageTitle:{ fontSize: 11, color: '#4f8ef7', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 },
  h1:       { fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6 },
  sub:      { color: '#7b82a0', fontSize: 14, marginBottom: 28 },
  tabs:     { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  card:     { background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 16, overflow: 'hidden' },
  mapWrap:  { width: '100%', lineHeight: 0, position: 'relative' },
  iframe:   { width: '100%', height: 580, border: 'none', display: 'block' },
  analysis: { padding: '24px 28px' },
  aHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  aTitle:   { fontSize: 17, fontWeight: 700, color: '#e8eaf0' },
  badge:    { fontSize: 11, color: '#4f8ef7', background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.25)', borderRadius: 6, padding: '3px 10px', fontWeight: 600 },
  insights: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 },
  insightCard: { background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' },
  insightIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  insightText: { fontSize: 13, color: '#7b82a0', lineHeight: 1.55 },
};

function Tab({ map, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 18px', borderRadius: 10,
      border: active ? '1px solid rgba(79,142,247,.4)' : '1px solid #2a2d3a',
      background: active ? 'rgba(79,142,247,.1)' : '#1a1d27',
      color: active ? '#4f8ef7' : '#7b82a0',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', transition: 'all .15s',
    }}>
      <span style={{ fontSize: 16 }}>{map.icon}</span>
      {map.label}
    </button>
  );
}

export default function GeoPage() {
  const [active, setActive] = useState('divisions');
  const current = MAPS.find(m => m.id === active);

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={S.brand}>
            <div style={S.dot}>🏛️</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0' }}>LAPD</span>
            <span style={{ fontSize: 14, color: '#7b82a0' }}>Crime Dashboard</span>
            <span style={{ fontSize: 10, color: '#4f8ef7', background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.25)', borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>GEO</span>
          </div>
          <Link href="/" style={S.back}>← Dashboard</Link>
        </div>
      </header>

      <div style={S.wrap}>
        {/* Page title */}
        <p style={S.pageTitle}>GEOSPATIAL ANALYSIS</p>
        <h1 style={S.h1}>Crime Cartography<span style={{ color: '#4f8ef7' }}> 2020–2024</span></h1>
        <p style={S.sub}>Multi-layer geographic analysis of crime patterns across Los Angeles</p>

        {/* Map tabs */}
        <div style={S.tabs}>
          {MAPS.map(m => (
            <Tab key={m.id} map={m} active={active === m.id} onClick={() => setActive(m.id)} />
          ))}
        </div>

        {/* Map card */}
        <div style={S.card}>
          <div style={S.mapWrap}>
            {MAPS.map(m => (
              <div key={m.id} style={{ display: m.id === active ? 'block' : 'none' }}>
                <iframe src={m.src} style={S.iframe} title={m.label} loading="lazy" />
              </div>
            ))}
          </div>

          {/* Analysis panel */}
          <div style={S.analysis}>
            <div style={S.aHeader}>
              <p style={S.aTitle}>{current.title}</p>
              <span style={S.badge}>{current.badge}</span>
            </div>
            <div style={S.insights}>
              {current.insight.map((ins, i) => (
                <div key={i} style={S.insightCard}>
                  <span style={S.insightIcon}>{ins.icon}</span>
                  <span style={S.insightText}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
