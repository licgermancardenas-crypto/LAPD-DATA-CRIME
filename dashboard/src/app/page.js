'use client';

import { useState, useEffect } from 'react';
import KpiCard         from '@/components/KpiCard';
import MonthlyTrend    from '@/components/MonthlyTrend';
import DivisionBar     from '@/components/DivisionBar';
import HourHeatmap     from '@/components/HourHeatmap';
import CategoryChart   from '@/components/CategoryChart';
import WeatherChart    from '@/components/WeatherChart';
import UnemploymentChart from '@/components/UnemploymentChart';

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'geographic',  label: 'Geographic' },
  { id: 'temporal',    label: 'Temporal' },
  { id: 'categories',  label: 'Categories' },
  { id: 'external',    label: 'Weather & Economy' },
];

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div style={{
        width: 48, height: 48, border: '3px solid #2a2d3a',
        borderTop: '3px solid #4f8ef7', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#7b82a0', fontSize: 14 }}>Loading LAPD data...</p>
    </div>
  );
}

function Section({ id, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 72 }} className="mb-10">
      {children}
    </section>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>{title}</h2>
      <p style={{ color: '#7b82a0', fontSize: 13 }}>{sub}</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [activeNav, setActiveNav] = useState('overview');

  useEffect(() => {
    const base = '/data';
    Promise.all([
      fetch(`${base}/summary.json`).then(r => r.json()),
      fetch(`${base}/monthly.json`).then(r => r.json()),
      fetch(`${base}/hourly_dow.json`).then(r => r.json()),
      fetch(`${base}/division.json`).then(r => r.json()),
      fetch(`${base}/categories.json`).then(r => r.json()),
      fetch(`${base}/weather_daily.json`).then(r => r.json()),
    ]).then(([summary, monthly, hourly, division, categories, weather]) => {
      setData({ summary, monthly, hourly, division, categories, weather });
    });
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handler = () => {
      for (const item of [...NAV_ITEMS].reverse()) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 90) {
          setActiveNav(item.id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (!data) return <Spinner />;

  const { summary, monthly, hourly, division, categories, weather } = data;

  const clearanceColor =
    summary.clearance_rate >= 20 ? '#3ecf8e' :
    summary.clearance_rate >= 10 ? '#e0c066' : '#e05252';

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh' }}>

      {/* ── Top Header ──────────────────────────────────────────────── */}
      <header style={{
        background: '#0f1117',
        borderBottom: '1px solid #2a2d3a',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

            {/* Logo + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f8ef7, #7c5cbf)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>
                🏛️
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#e8eaf0' }}>LAPD Crime</span>
                <span style={{ fontSize: 15, fontWeight: 400, color: '#7b82a0' }}> Dashboard</span>
              </div>
              <span style={{
                fontSize: 11, color: '#7b82a0',
                background: '#1a1d27', border: '1px solid #2a2d3a',
                borderRadius: 6, padding: '2px 8px',
              }}>
                2020 – 2024
              </span>
            </div>

            {/* Nav */}
            <nav style={{ display: 'flex', gap: 4 }}>
              {NAV_ITEMS.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveNav(item.id)}
                  style={{
                    fontSize: 13,
                    fontWeight: activeNav === item.id ? 600 : 400,
                    color: activeNav === item.id ? '#4f8ef7' : '#7b82a0',
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: activeNav === item.id ? '#1a1d27' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, #1a1d27 0%, #0f1117 100%)',
        borderBottom: '1px solid #2a2d3a',
        padding: '40px 24px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 8 }}>
            LOS ANGELES POLICE DEPARTMENT
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#e8eaf0', marginBottom: 8, lineHeight: 1.2 }}>
            Crime Analysis 2020–2024
          </h1>
          <p style={{ color: '#7b82a0', fontSize: 15, maxWidth: 600 }}>
            {summary.total_crimes.toLocaleString()} crime records · 21 divisions · enriched with weather,
            unemployment, and census geographies
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {['UCR Part 1 & 2', 'Open-Meteo Weather', 'BLS Unemployment', 'Census TIGER'].map(tag => (
              <span key={tag} style={{
                fontSize: 11, color: '#7b82a0',
                background: '#1a1d27', border: '1px solid #2a2d3a',
                borderRadius: 20, padding: '3px 10px',
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* SECTION: Overview */}
        <Section id="overview">
          <SectionHeader
            title="Executive Overview"
            sub="Key performance indicators across the full 5-year period"
          />

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard
              label="Total Crimes"
              value={summary.total_crimes.toLocaleString()}
              sub="2020 – 2024 cumulative"
              color="#4f8ef7"
              icon="📋"
            />
            <KpiCard
              label="Clearance Rate"
              value={`${summary.clearance_rate}%`}
              sub="Cases with arrest or exceptional clearance"
              color={clearanceColor}
              icon="✅"
            />
            <KpiCard
              label="Violent Crime Share"
              value={`${summary.violent_pct}%`}
              sub={`${summary.violent_crimes.toLocaleString()} violent incidents`}
              color="#e05252"
              icon="⚡"
            />
            <KpiCard
              label="2024 vs 2023"
              value={summary.crimes_2024.toLocaleString()}
              trend={summary.yoy_2024_vs_2023}
              sub="Year-over-year change"
              color="#e0883a"
              icon="📈"
            />
          </div>

          {/* Annual summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 24 }}>
            {summary.by_year.map(yr => (
              <div key={yr.year} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                <p style={{ fontSize: 12, color: '#7b82a0', marginBottom: 4 }}>{yr.year}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0' }}>{(yr.crimes / 1000).toFixed(0)}k</p>
                <p style={{ fontSize: 11, color: '#3ecf8e' }}>CLR {yr.clearance_rate}%</p>
                <p style={{ fontSize: 11, color: '#e05252' }}>VIO {yr.violent_pct}%</p>
              </div>
            ))}
          </div>

          <MonthlyTrend data={monthly} />
        </Section>

        {/* SECTION: Geographic */}
        <Section id="geographic">
          <SectionHeader
            title="Geographic Distribution"
            sub="Crime volume across the 21 LAPD patrol divisions"
          />
          <DivisionBar data={division} />
        </Section>

        {/* SECTION: Temporal */}
        <Section id="temporal">
          <SectionHeader
            title="Temporal Patterns"
            sub="When do crimes occur? Hour of day, day of week, and monthly seasonality"
          />
          <HourHeatmap data={hourly} />
        </Section>

        {/* SECTION: Categories */}
        <Section id="categories">
          <SectionHeader
            title="Crime Categories"
            sub="UCR Part 1 & 2 classification — 18 broad categories · red = violent"
          />
          <CategoryChart data={categories} />
        </Section>

        {/* SECTION: External */}
        <Section id="external">
          <SectionHeader
            title="Weather & Economic Context"
            sub="Relationship between crime, temperature, and unemployment — LA-Long Beach-Anaheim MSA"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <WeatherChart data={weather} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <UnemploymentChart data={monthly} />
            </div>
          </div>

          {/* Key findings */}
          <div className="card mt-5" style={{ marginTop: 20 }}>
            <p className="section-title">Key Findings</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12 }}>
              {[
                { icon: '🌡️', title: 'Heat & Crime', body: 'Positive correlation between avg temperature and daily crime volume. Hot days (>90°F) show measurably higher incident rates.' },
                { icon: '🌧️', title: 'Rain Deterrence', body: 'Rainy days consistently show lower crime counts. Wet weather reduces outdoor activity and opportunistic crimes.' },
                { icon: '💼', title: 'Unemployment Paradox', body: 'COVID-era unemployment spike (Apr 2020: 20%+) coincided with LOWER crime — lockdowns confined people indoors.' },
                { icon: '📉', title: 'Clearance Decline', body: 'Clearance rate has declined from ~18% in 2020 to ~12% in 2024, reflecting resource pressure on LAPD.' },
              ].map(f => (
                <div key={f.title} style={{ padding: 16, background: '#0f1117', borderRadius: 10 }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                  <p style={{ fontWeight: 600, color: '#e8eaf0', fontSize: 14, marginBottom: 6 }}>{f.title}</p>
                  <p style={{ color: '#7b82a0', fontSize: 12, lineHeight: 1.5 }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #2a2d3a', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#7b82a0', fontSize: 12 }}>
          Data: LAPD Open Data (2020-2024) · Weather: Open-Meteo · Unemployment: BLS Series LAUMT062310000000003
        </p>
        <p style={{ color: '#2a2d3a', fontSize: 12, marginTop: 4 }}>
          Built with Next.js · Recharts · Tailwind CSS · Deployed on Vercel
        </p>
      </footer>
    </div>
  );
}
