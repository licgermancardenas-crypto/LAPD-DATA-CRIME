'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Shell              from '@/components/Shell';
import KpiCard            from '@/components/KpiCard';
import MonthlyTrend       from '@/components/MonthlyTrend';
import DivisionBar        from '@/components/DivisionBar';
import HourHeatmap        from '@/components/HourHeatmap';
import CategoryChart      from '@/components/CategoryChart';
import WeatherChart       from '@/components/WeatherChart';
import UnemploymentChart  from '@/components/UnemploymentChart';
import ReportingLagChart  from '@/components/ReportingLagChart';
import VictimChart        from '@/components/VictimChart';
import PremiseChart       from '@/components/PremiseChart';
import GlobalFilterPanel  from '@/components/GlobalFilterPanel';
import ChartSkeleton      from '@/components/ChartSkeleton';
import ExecutiveInsights  from '@/components/ExecutiveInsights';
import { computeCategories, computeDivisions, computeVictims } from '@/lib/filterUtils';

const LaMap = dynamic(() => import('@/components/LaMap'), { ssr: false });

const NAV_SECTIONS = [
  { id: 'overview' },
  { id: 'geographic' },
  { id: 'temporal' },
  { id: 'categories' },
  { id: 'victims' },
  { id: 'external' },
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
      minHeight: '100vh', background: '#080a12',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
      flexDirection: 'column',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 14,
        background: 'linear-gradient(135deg,#4f8ef7,#7c5cbf)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, boxShadow: '0 0 40px rgba(79,142,247,.25)',
      }}>🏛️</div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 700, letterSpacing: '.12em', marginBottom: 8 }}>
          LOS ANGELES POLICE DEPARTMENT
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>Crime Analysis Dashboard</h1>
        <p style={{ fontSize: 13, color: '#7b82a0' }}>2020 – 2024</p>
      </div>
      <div style={{ width: 200, height: 3, background: '#1a1d27', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: '#4f8ef7', animation: 'loadBar 1.4s ease-in-out infinite' }} />
      </div>
      <p style={{ fontSize: 12, color: '#7b82a0' }}>Loading{'.'.repeat(dot + 1)}</p>
      <style>{`@keyframes loadBar{0%{width:0%;margin-left:0%}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
    </div>
  );
}

function ChartWrapper({ pending, minHeight = 240, children }) {
  return (
    <div style={{ position: 'relative', minHeight }}>
      {children}
      <ChartSkeleton visible={pending} />
    </div>
  );
}

function Section({ id, children }) {
  return <section id={id} style={{ scrollMarginTop: 24, marginBottom: 52 }}>{children}</section>;
}

function SectionHeader({ title, sub, badge }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>{title}</h2>
        <p style={{ color: '#7b82a0', fontSize: 13, lineHeight: 1.5 }}>{sub}</p>
      </div>
      {badge && (
        <span style={{
          fontSize: 11, color: '#4f8ef7',
          background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.25)',
          borderRadius: 6, padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap',
        }}>{badge}</span>
      )}
    </div>
  );
}

function ViewTab({ label, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 8,
      border: active ? '1px solid rgba(79,142,247,.4)' : '1px solid #2a2d3a',
      background: active ? 'rgba(79,142,247,.1)' : '#1a1d27',
      color: active ? '#4f8ef7' : '#7b82a0',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', transition: 'all .15s',
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>{label}
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [data,       setData]       = useState(null);
  const [activeNav,  setActiveNav]  = useState('overview');
  const [geoView,    setGeoView]    = useState('map');
  const [showTop,    setShowTop]    = useState(false);
  const [activePart, setActivePart] = useState('all');
  const [filters,    setFilters]    = useState({
    area: null, category: null, ageGroup: null, timeSlot: null,
  });
  const [isFiltering, setIsFiltering] = useState(false);
  const filtersReady = useRef(false);

  useEffect(() => {
    const b = '/data';
    Promise.all([
      fetch(`${b}/summary.json`).then(r => r.json()),
      fetch(`${b}/monthly.json`).then(r => r.json()),
      fetch(`${b}/hourly_dow.json`).then(r => r.json()),
      fetch(`${b}/division.json`).then(r => r.json()),
      fetch(`${b}/categories.json`).then(r => r.json()),
      fetch(`${b}/weather_daily.json`).then(r => r.json()),
      fetch(`${b}/victims.json`).then(r => r.json()),
      fetch(`${b}/premises.json`).then(r => r.json()),
      fetch(`${b}/cross_div_cat.json`).then(r => r.json()),
    ]).then(([summary, monthly, hourly, division, categories, weather, victims, premises, crossDivCat]) => {
      setData({ summary, monthly, hourly, division, categories, weather, victims, premises, crossDivCat });
    }).catch(() => setData('error'));
  }, []);

  const handleScroll = useCallback(() => {
    setShowTop(window.scrollY > 300);
    for (const item of [...NAV_SECTIONS].reverse()) {
      const el = document.getElementById(item.id);
      if (el && el.getBoundingClientRect().top <= 80) {
        setActiveNav(item.id);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // ── Skeleton trigger on filter/part change ─────────────────────────────
  useEffect(() => {
    if (!filtersReady.current) { filtersReady.current = true; return; }
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 380);
    return () => clearTimeout(t);
  }, [filters, activePart]);

  // ── Cross-filter computed data ──────────────────────────────────────────
  const computedCategories = useMemo(() => {
    if (!data || data === 'error') return null;
    return computeCategories(data.crossDivCat, data.categories, filters, activePart);
  }, [data, filters, activePart]);

  const computedDivisions = useMemo(() => {
    if (!data || data === 'error') return null;
    const result = computeDivisions(data.crossDivCat, filters, activePart);
    return result ?? data.division; // null = use base
  }, [data, filters, activePart]);

  const computedVictims = useMemo(() => {
    if (!data || data === 'error') return null;
    return computeVictims(data.victims?.raw_cross ?? [], data.victims, filters);
  }, [data, filters]);

  // ── Filter setter ───────────────────────────────────────────────────────
  const handleFilter = useCallback((key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
  }, []);

  if (!data) return <LoadingScreen />;

  if (data === 'error') return (
    <Shell>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#1a1d27', border: '1px solid #e05252', borderRadius: 12, padding: '24px 32px', maxWidth: 480, textAlign: 'center' }}>
          <p style={{ fontSize: 24, marginBottom: 12 }}>⚠️</p>
          <p style={{ color: '#e8eaf0', fontWeight: 700, marginBottom: 8 }}>Failed to load dashboard data</p>
          <p style={{ color: '#7b82a0', fontSize: 13 }}>Check the browser console for details. Try refreshing the page.</p>
        </div>
      </div>
    </Shell>
  );

  const { summary, monthly, hourly, premises, weather } = data;
  const clrColor = summary.clearance_rate >= 20 ? '#3ecf8e'
                 : summary.clearance_rate >= 12 ? '#e0c066' : '#e05252';

  return (
    <Shell activeSection={activeNav}>

      {/* ── Page top bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 32px 0', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 700, letterSpacing: '.1em', marginBottom: 5 }}>
            CRIME ANALYTICS · LOS ANGELES
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            Analysis Dashboard <span style={{ color: '#4f8ef7' }}>2020–2024</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: summary.total_crimes.toLocaleString(), sub: 'Total Crimes', color: '#4f8ef7' },
            { label: `${summary.violent_pct}%`, sub: 'Violent',  color: '#e05252' },
            { label: `${summary.clearance_rate}%`, sub: 'Clearance', color: clrColor },
          ].map(s => (
            <div key={s.sub} style={{
              background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10,
              padding: '8px 16px', textAlign: 'center', minWidth: 90,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#7b82a0', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Unified global filter panel ──────────────────────────────────── */}
      <GlobalFilterPanel
        activePart={activePart}
        setActivePart={setActivePart}
        filters={filters}
        setFilters={setFilters}
        categories={data.categories}
        divisions={data.division}
      />

      {/* ── Thin section tab nav ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '20px 32px 0', borderBottom: '1px solid #1e2030',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {[
          { id: 'overview',   label: 'Overview',     icon: '📊' },
          { id: 'geographic', label: 'Geographic',   icon: '🗺️' },
          { id: 'temporal',   label: 'Temporal',     icon: '🕐' },
          { id: 'categories', label: 'Categories',   icon: '📂' },
          { id: 'victims',    label: 'Victims',      icon: '👥' },
          { id: 'external',   label: 'Context',      icon: '🌦️' },
        ].map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={() => setActiveNav(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px',
              textDecoration: 'none',
              fontSize: 12, fontWeight: activeNav === item.id ? 600 : 400,
              color: activeNav === item.id ? '#e8eaf0' : '#7b82a0',
              borderBottom: activeNav === item.id ? '2px solid #4f8ef7' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color .15s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            {item.label}
          </a>
        ))}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '36px 32px 80px', maxWidth: 1160, width: '100%' }}>

        {/* Annual mini cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 32 }}>
          {summary.by_year.map(yr => (
            <div key={yr.year} style={{
              background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10,
              padding: '12px 10px', textAlign: 'center', cursor: 'default',
              transition: 'border-color .2s, transform .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3f55'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d3a'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <p style={{ fontSize: 11, color: '#7b82a0', marginBottom: 5 }}>{yr.year}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf0', marginBottom: 3 }}>{(yr.crimes / 1000).toFixed(0)}k</p>
              <p style={{ fontSize: 10, color: '#3ecf8e' }}>CLR {yr.clearance_rate}%</p>
              <p style={{ fontSize: 10, color: '#e05252' }}>VIO {yr.violent_pct}%</p>
            </div>
          ))}
        </div>

        {/* OVERVIEW */}
        <Section id="overview">
          <SectionHeader title="Executive Overview" sub="Key performance indicators across the full 5-year period" badge="1,004,894 records" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
            <KpiCard label="Total Crimes"    value={summary.total_crimes.toLocaleString()} sub="2020-2024 cumulative" color="#4f8ef7" icon="📋" />
            <KpiCard label="Clearance Rate"  value={`${summary.clearance_rate}%`} sub="Cases with arrest or exceptional clearance" color={clrColor} icon="✅" />
            <KpiCard label="Violent Share"   value={`${summary.violent_pct}%`} sub={`${summary.violent_crimes.toLocaleString()} violent incidents`} color="#e05252" icon="⚡" />
            <KpiCard label="2024 vs 2023"    value={summary.crimes_2024.toLocaleString()} trend={summary.yoy_2024_vs_2023} sub="Year-over-year change" color="#e0883a" icon="📈" />
            <KpiCard label="Reporting Lag"   value={`${summary.avg_reporting_lag}d`} sub="Avg days: crime occurred → report filed" color="#a78bfa" icon="🕐" />
          </div>
          <ExecutiveInsights />
          <ChartWrapper pending={isFiltering} minHeight={280}>
            <MonthlyTrend data={monthly} activePart={activePart} />
          </ChartWrapper>
          <div style={{ marginTop: 20 }}>
            <ReportingLagChart data={monthly} />
          </div>
        </Section>

        {/* GEOGRAPHIC */}
        <Section id="geographic">
          <SectionHeader title="Geographic Distribution" sub="Crime volume and clearance rates across the 21 LAPD patrol divisions" badge="21 Divisions" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <ViewTab label="Interactive Map"    icon="🗺️" active={geoView === 'map'}     onClick={() => setGeoView('map')} />
            <ViewTab label="Division Rankings"  icon="📊" active={geoView === 'ranking'} onClick={() => setGeoView('ranking')} />
          </div>
          {geoView === 'map' ? (
            <div>
              <LaMap category={filters.category} />
              <p style={{ fontSize: 12, color: '#7b82a0', marginTop: 10, textAlign: 'center' }}>
                Division boundaries from LAPD GeoHub · Crime stats from LAPD Open Data 2020-2024
              </p>
            </div>
          ) : (
            <ChartWrapper pending={isFiltering} minHeight={420}>
              <DivisionBar
                data={computedDivisions}
                activePart={activePart}
                filters={filters}
                onFilter={handleFilter}
              />
            </ChartWrapper>
          )}
        </Section>

        {/* TEMPORAL */}
        <Section id="temporal">
          <SectionHeader title="Temporal Patterns" sub="When do crimes occur? Hour of day vs day of week — all 5 years combined" badge="168 cells" />
          <ChartWrapper pending={isFiltering} minHeight={320}>
            <HourHeatmap data={hourly} filters={filters} onFilter={handleFilter} />
          </ChartWrapper>
        </Section>

        {/* CATEGORIES */}
        <Section id="categories">
          <SectionHeader
            title="Categorías de Crimen"
            sub="Clasificación UCR Part 1 (graves FBI) y Part 2 (menores) — 18 categorías · click en barra para cross-filtrar el dashboard"
            badge="18 categorías"
          />
          <ChartWrapper pending={isFiltering} minHeight={340}>
            <CategoryChart
              data={computedCategories}
              activePart={activePart}
              filters={filters}
              onFilter={handleFilter}
            />
          </ChartWrapper>
          <div style={{ marginTop: 20 }}>
            <ChartWrapper pending={isFiltering} minHeight={260}>
              <PremiseChart data={premises} activePart={activePart} />
            </ChartWrapper>
          </div>
        </Section>

        {/* VICTIMS */}
        <Section id="victims">
          <SectionHeader
            title="Victim Demographics"
            sub="Who gets victimized? Age, gender, and ethnic breakdown — cross-filterable by crime category and age group"
            badge="735k victims"
          />
          <ChartWrapper pending={isFiltering} minHeight={460}>
            <VictimChart
              data={computedVictims}
              filters={filters}
              onFilter={handleFilter}
            />
          </ChartWrapper>
        </Section>

        {/* CONTEXT */}
        <Section id="external">
          <SectionHeader title="Weather & Economic Context" sub="Temperature and unemployment correlations — LA-Long Beach-Anaheim MSA" />
          <div style={{ display: 'grid', gap: 20 }}>
            <WeatherChart data={weather} />
            <UnemploymentChart data={monthly} />
          </div>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginBottom: 16 }}>Key Findings</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
              {[
                { icon: '🌡️', title: 'Heat & Crime',         body: 'Positive correlation between avg temperature and daily crime. Hot days (&gt;90°F) show measurably higher incident rates.' },
                { icon: '🌧️', title: 'Rain Deterrence',      body: 'Rainy days consistently show lower crime counts. Wet weather reduces outdoor activity and opportunistic crimes.' },
                { icon: '💼', title: 'Unemployment Paradox', body: 'COVID-era spike (Apr 2020: 20%+) coincided with lower crime — lockdowns confined people indoors.' },
                { icon: '📉', title: 'Clearance Decline',    body: 'Rate dropped from ~18% in 2020 to ~12% in 2024, reflecting growing caseload pressure on LAPD.' },
              ].map(f => (
                <div key={f.title} style={{
                  padding: '14px 16px', background: '#0f1117', borderRadius: 10, border: '1px solid #2a2d3a',
                  transition: 'border-color .2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3d50'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2d3a'}
                >
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                  <p style={{ fontWeight: 600, color: '#e8eaf0', fontSize: 13, marginBottom: 5 }}>{f.title}</p>
                  <p style={{ color: '#7b82a0', fontSize: 12, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: f.body }} />
                </div>
              ))}
            </div>
          </div>
        </Section>

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e2030', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ color: '#7b82a0', fontSize: 11 }}>
          Data: LAPD Open Data (2020-2024) · Weather: Open-Meteo · Unemployment: BLS LAUMT062310000000003
        </p>
        <p style={{ color: '#3a3d50', fontSize: 11 }}>Built with Next.js 14 · Leaflet · Recharts · Vercel</p>
      </footer>

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 100,
            width: 40, height: 40, borderRadius: '50%',
            background: '#1a1d27', border: '1px solid #2a2d3a',
            color: '#7b82a0', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.4)', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f8ef7'; e.currentTarget.style.color = '#4f8ef7'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d3a'; e.currentTarget.style.color = '#7b82a0'; }}
          aria-label="Back to top"
        >↑</button>
      )}
    </Shell>
  );
}
