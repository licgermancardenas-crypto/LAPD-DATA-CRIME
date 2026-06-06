'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import KpiCard           from '@/components/KpiCard';
import MonthlyTrend      from '@/components/MonthlyTrend';
import DivisionBar       from '@/components/DivisionBar';
import HourHeatmap       from '@/components/HourHeatmap';
import CategoryChart     from '@/components/CategoryChart';
import WeatherChart      from '@/components/WeatherChart';
import UnemploymentChart from '@/components/UnemploymentChart';

// Leaflet requires browser DOM — load only on client
const LaMap = dynamic(() => import('@/components/LaMap'), { ssr: false });

const NAV = [
  { id: 'overview',   label: 'Overview' },
  { id: 'geographic', label: 'Geographic' },
  { id: 'temporal',   label: 'Temporal' },
  { id: 'categories', label: 'Categories' },
  { id: 'external',   label: 'Context' },
];

// ── Loading screen ──────────────────────────────────────────────────────────
function LoadingScreen() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDot(d => (d + 1) % 4), 380);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
    }}>
      {/* Logo */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg, #4f8ef7 0%, #7c5cbf 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, boxShadow: '0 0 40px rgba(79,142,247,0.25)',
      }}>
        🏛️
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 600, letterSpacing: '0.12em', marginBottom: 8 }}>
          LOS ANGELES POLICE DEPARTMENT
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>
          Crime Analysis Dashboard
        </h1>
        <p style={{ fontSize: 13, color: '#7b82a0' }}>2020 – 2024</p>
      </div>
      {/* Animated bar */}
      <div style={{ width: 200, height: 3, background: '#1a1d27', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, background: '#4f8ef7',
          animation: 'loadBar 1.4s ease-in-out infinite',
        }} />
      </div>
      <p style={{ fontSize: 12, color: '#7b82a0' }}>
        Loading{'.'.repeat(dot + 1)}
      </p>
      <style>{`
        @keyframes loadBar {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── Reusable section wrapper ────────────────────────────────────────────────
function Section({ id, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 68, marginBottom: 56 }}>
      {children}
    </section>
  );
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub, badge }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>{title}</h2>
        <p style={{ color: '#7b82a0', fontSize: 13, lineHeight: 1.5 }}>{sub}</p>
      </div>
      {badge && (
        <span style={{
          fontSize: 11, color: '#4f8ef7',
          background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)',
          borderRadius: 6, padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap',
        }}>{badge}</span>
      )}
    </div>
  );
}

// ── Tab button ──────────────────────────────────────────────────────────────
function Tab({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8,
        border: active ? '1px solid rgba(79,142,247,0.4)' : '1px solid #2a2d3a',
        background: active ? 'rgba(79,142,247,0.1)' : '#1a1d27',
        color: active ? '#4f8ef7' : '#7b82a0',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [data,      setData]      = useState(null);
  const [activeNav, setActiveNav] = useState('overview');
  const [geoView,   setGeoView]   = useState('map'); // 'map' | 'ranking'
  const [showTop,   setShowTop]   = useState(false);

  // Load all JSON data
  useEffect(() => {
    const b = '/data';
    Promise.all([
      fetch(`${b}/summary.json`).then(r => r.json()),
      fetch(`${b}/monthly.json`).then(r => r.json()),
      fetch(`${b}/hourly_dow.json`).then(r => r.json()),
      fetch(`${b}/division.json`).then(r => r.json()),
      fetch(`${b}/categories.json`).then(r => r.json()),
      fetch(`${b}/weather_daily.json`).then(r => r.json()),
    ]).then(([summary, monthly, hourly, division, categories, weather]) => {
      setData({ summary, monthly, hourly, division, categories, weather });
    }).catch(err => {
      console.error('Data load failed:', err);
      setData('error');
    });
  }, []);

  // Track active section on scroll + show "back to top"
  const handleScroll = useCallback(() => {
    setShowTop(window.scrollY > 400);
    for (const item of [...NAV].reverse()) {
      const el = document.getElementById(item.id);
      if (el && el.getBoundingClientRect().top <= 90) {
        setActiveNav(item.id);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (!data) return <LoadingScreen />;
  if (data === 'error') return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#1a1d27', border: '1px solid #e05252', borderRadius: 12, padding: '24px 32px', maxWidth: 480, textAlign: 'center' }}>
        <p style={{ fontSize: 24, marginBottom: 12 }}>⚠️</p>
        <p style={{ color: '#e8eaf0', fontWeight: 700, marginBottom: 8 }}>Failed to load dashboard data</p>
        <p style={{ color: '#7b82a0', fontSize: 13 }}>Check the browser console for details. Try refreshing the page.</p>
      </div>
    </div>
  );

  const { summary, monthly, hourly, division, categories, weather } = data;

  const clrColor = summary.clearance_rate >= 20 ? '#3ecf8e'
                 : summary.clearance_rate >= 12 ? '#e0c066' : '#e05252';

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh' }}>

      {/* ── Sticky nav ─────────────────────────────────────────────────── */}
      <header style={{
        background: 'rgba(15,17,23,0.96)',
        borderBottom: '1px solid #2a2d3a',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>

            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f8ef7 0%, #7c5cbf 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🏛️</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0' }}>LAPD</span>
              <span style={{ fontSize: 14, color: '#7b82a0' }}>Crime Dashboard</span>
              <span style={{
                fontSize: 10, color: '#4f8ef7',
                background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)',
                borderRadius: 5, padding: '2px 7px', fontWeight: 600,
              }}>2020-24</span>
            </div>

            {/* Nav links */}
            <nav style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Link href="/geo" style={{
                fontSize: 13, fontWeight: 600, color: '#4f8ef7',
                padding: '6px 13px', borderRadius: 7,
                border: '1px solid rgba(79,142,247,.3)',
                background: 'rgba(79,142,247,.08)',
                textDecoration: 'none', marginRight: 6,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>🗺️ Geo Analysis</Link>
              {NAV.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveNav(item.id)}
                  style={{
                    position: 'relative',
                    fontSize: 13, fontWeight: activeNav === item.id ? 600 : 400,
                    color: activeNav === item.id ? '#e8eaf0' : '#7b82a0',
                    padding: '6px 13px',
                    borderRadius: 7,
                    background: 'transparent',
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                  }}
                >
                  {item.label}
                  {activeNav === item.id && (
                    <span style={{
                      position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                      width: 16, height: 2, borderRadius: 1, background: '#4f8ef7',
                    }} />
                  )}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, #12151e 0%, #0f1117 100%)',
        borderBottom: '1px solid #2a2d3a',
        padding: '48px 24px 40px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>
            LOS ANGELES POLICE DEPARTMENT
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#ffffff', marginBottom: 10, lineHeight: 1.15 }}>
            Crime Analysis
            <span style={{ color: '#4f8ef7' }}> 2020–2024</span>
          </h1>
          <p style={{ color: '#7b82a0', fontSize: 15, maxWidth: 560, lineHeight: 1.6, marginBottom: 20 }}>
            {summary.total_crimes.toLocaleString()} crime records · 21 LAPD divisions ·
            enriched with weather, unemployment, and census geographies
          </p>

          {/* Quick stats row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Violent',   value: `${summary.violent_pct}%`,    color: '#e05252' },
              { label: 'Clearance', value: `${summary.clearance_rate}%`, color: clrColor },
              { label: 'Peak Year', value: '2022',                       color: '#e0883a' },
              { label: 'Divisions', value: '21',                         color: '#7c5cbf' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: s.color }} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#7b82a0' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 7, marginTop: 18, flexWrap: 'wrap' }}>
            {['UCR Part 1 & 2', 'Open-Meteo Weather', 'BLS Unemployment', 'Census TIGER', 'Leaflet Map', 'Prophet Forecast', 'XGBoost ML'].map(t => (
              <span key={t} style={{
                fontSize: 11, color: '#7b82a0',
                background: '#1a1d27', border: '1px solid #2a2d3a',
                borderRadius: 20, padding: '3px 10px',
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* OVERVIEW */}
        <Section id="overview">
          <SectionHeader
            title="Executive Overview"
            sub="Key performance indicators across the full 5-year period"
            badge="1,004,894 records"
          />

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard label="Total Crimes"    value={summary.total_crimes.toLocaleString()}
              sub="2020-2024 cumulative" color="#4f8ef7" icon="📋" />
            <KpiCard label="Clearance Rate"  value={`${summary.clearance_rate}%`}
              sub="Cases with arrest or exceptional clearance" color={clrColor} icon="✅" />
            <KpiCard label="Violent Share"   value={`${summary.violent_pct}%`}
              sub={`${summary.violent_crimes.toLocaleString()} violent incidents`} color="#e05252" icon="⚡" />
            <KpiCard label="2024 vs 2023"    value={summary.crimes_2024.toLocaleString()}
              trend={summary.yoy_2024_vs_2023} sub="Year-over-year change" color="#e0883a" icon="📈" />
          </div>

          {/* Annual breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
            {summary.by_year.map(yr => (
              <div key={yr.year} style={{
                background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10,
                padding: '14px 10px', textAlign: 'center',
                transition: 'border-color 0.2s, transform 0.15s',
                cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f4a6a'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d3a'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <p style={{ fontSize: 12, color: '#7b82a0', marginBottom: 6 }}>{yr.year}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#e8eaf0', marginBottom: 4 }}>
                  {(yr.crimes / 1000).toFixed(0)}k
                </p>
                <p style={{ fontSize: 11, color: '#3ecf8e' }}>CLR {yr.clearance_rate}%</p>
                <p style={{ fontSize: 11, color: '#e05252' }}>VIO {yr.violent_pct}%</p>
              </div>
            ))}
          </div>

          <MonthlyTrend data={monthly} />
        </Section>

        {/* GEOGRAPHIC */}
        <Section id="geographic">
          <SectionHeader
            title="Geographic Distribution"
            sub="Crime volume and clearance rates across the 21 LAPD patrol divisions"
            badge="21 Divisions"
          />

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Tab label="Interactive Map" icon="🗺️" active={geoView === 'map'}     onClick={() => setGeoView('map')} />
            <Tab label="Division Rankings" icon="📊" active={geoView === 'ranking'} onClick={() => setGeoView('ranking')} />
          </div>

          {geoView === 'map' ? (
            <div>
              <LaMap />
              <p style={{ fontSize: 12, color: '#7b82a0', marginTop: 10, textAlign: 'center' }}>
                Division boundaries from LAPD GeoHub · Crime stats from LAPD Open Data 2020-2024
              </p>
            </div>
          ) : (
            <DivisionBar data={division} />
          )}
        </Section>

        {/* TEMPORAL */}
        <Section id="temporal">
          <SectionHeader
            title="Temporal Patterns"
            sub="When do crimes occur? Hour of day vs day of week — all 5 years combined"
            badge="168 cells"
          />
          <HourHeatmap data={hourly} />
        </Section>

        {/* CATEGORIES */}
        <Section id="categories">
          <SectionHeader
            title="Crime Categories"
            sub="UCR Part 1 & 2 classification — 18 categories · red bars indicate violent crime"
            badge="18 categories"
          />
          <CategoryChart data={categories} />
        </Section>

        {/* EXTERNAL CONTEXT */}
        <Section id="external">
          <SectionHeader
            title="Weather & Economic Context"
            sub="Temperature and unemployment correlations — LA-Long Beach-Anaheim MSA"
          />
          <div style={{ display: 'grid', gap: 20 }}>
            <WeatherChart data={weather} />
            <UnemploymentChart data={monthly} />
          </div>

          {/* Key findings cards */}
          <div style={{
            background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12,
            padding: '20px 24px', marginTop: 20,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginBottom: 16 }}>Key Findings</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              {[
                { icon: '🌡️', title: 'Heat & Crime',         body: 'Positive correlation between avg temperature and daily crime. Hot days (&gt;90°F) show measurably higher incident rates.' },
                { icon: '🌧️', title: 'Rain Deterrence',      body: 'Rainy days consistently show lower crime counts. Wet weather reduces outdoor activity and opportunistic crimes.' },
                { icon: '💼', title: 'Unemployment Paradox', body: 'COVID-era spike (Apr 2020: 20%+) coincided with lower crime — lockdowns confined people indoors.' },
                { icon: '📉', title: 'Clearance Decline',    body: 'Rate dropped from ~18% in 2020 to ~12% in 2024, reflecting growing caseload pressure on LAPD.' },
              ].map(f => (
                <div key={f.title} style={{
                  padding: '14px 16px', background: '#0f1117', borderRadius: 10, border: '1px solid #2a2d3a',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3d50'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d3a'; }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                  <p style={{ fontWeight: 600, color: '#e8eaf0', fontSize: 13, marginBottom: 5 }}>{f.title}</p>
                  <p style={{ color: '#7b82a0', fontSize: 12, lineHeight: 1.55 }}
                    dangerouslySetInnerHTML={{ __html: f.body }} />
                </div>
              ))}
            </div>
          </div>
        </Section>

      </main>

      {/* ── Back to top ─────────────────────────────────────────────────── */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 100,
            width: 44, height: 44, borderRadius: '50%',
            background: '#1a1d27', border: '1px solid #2a2d3a',
            color: '#7b82a0', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f8ef7'; e.currentTarget.style.color = '#4f8ef7'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d3a'; e.currentTarget.style.color = '#7b82a0'; }}
          aria-label="Back to top"
        >↑</button>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #2a2d3a', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 4 }}>
          Data: LAPD Open Data (2020-2024) · Weather: Open-Meteo · Unemployment: BLS LAUMT062310000000003
        </p>
        <p style={{ color: '#3a3d50', fontSize: 12 }}>
          Built with Next.js 14 · React-Leaflet · Recharts · Tailwind · Vercel
        </p>
      </footer>
    </div>
  );
}
