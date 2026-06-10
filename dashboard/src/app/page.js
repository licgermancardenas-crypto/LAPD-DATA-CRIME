'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Shield, CheckCircle, Zap, TrendingUp, Clock } from 'lucide-react';
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
import OnboardingModal    from '@/components/OnboardingModal';
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
  return <section id={id} style={{ scrollMarginTop: 24, marginBottom: 68 }}>{children}</section>;
}

function SectionHeader({ title, sub, badge }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.025em', lineHeight: 1.15 }}>{title}</h2>
        <p style={{ color: '#8a8f9f', fontSize: 12, lineHeight: 1.65 }}>{sub}</p>
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
      padding: '8px 16px', borderRadius: 10,
      border: active ? '1px solid rgba(79,142,247,.4)' : '1px solid #2a2d3a',
      background: active ? 'rgba(79,142,247,.1)' : '#1a1d27',
      color: active ? '#4f8ef7' : '#7b82a0',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: 'pointer', transition: 'all 0.2s ease',
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>{label}
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [data,            setData]            = useState(null);
  const [activeNav,       setActiveNav]       = useState('overview');
  const [geoView,         setGeoView]         = useState('map');
  const [showTop,         setShowTop]         = useState(false);
  const [activePart,      setActivePart]      = useState('all');
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [filters,         setFilters]         = useState({
    area: null, category: null, ageGroup: null, timeSlot: null,
  });
  const [isFiltering, setIsFiltering] = useState(false);
  const filtersReady = useRef(false);

  // Show onboarding on first visit
  useEffect(() => {
    if (!localStorage.getItem('lapd_onboarding_v1')) setShowOnboarding(true);
  }, []);
  const closeOnboarding = () => {
    localStorage.setItem('lapd_onboarding_v1', '1');
    setShowOnboarding(false);
  };

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
            { label: summary.total_crimes.toLocaleString(), sub: 'Total Delitos',  color: '#4f8ef7' },
            { label: `${summary.violent_pct}%`,             sub: 'Violentos',      color: '#e05252' },
            { label: `${summary.clearance_rate}%`,          sub: 'Esclarecidos',   color: clrColor  },
          ].map(s => (
            <div key={s.sub} style={{
              background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10,
              padding: '8px 16px', textAlign: 'center', minWidth: 90,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#7b82a0', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
          {/* Help button */}
          <button
            onClick={() => setShowOnboarding(true)}
            title="Guía de uso"
            style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              border: '1px solid rgba(79,142,247,.3)',
              background: 'rgba(79,142,247,.07)',
              color: '#6090e8', fontSize: 14, fontWeight: 700, fontFamily: 'serif',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color .15s, color .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(76,201,240,.5)'; e.currentTarget.style.color='#4cc9f0'; e.currentTarget.style.background='rgba(76,201,240,.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(79,142,247,.3)'; e.currentTarget.style.color='#6090e8'; e.currentTarget.style.background='rgba(79,142,247,.07)'; }}
          >i</button>
        </div>
      </div>

      {/* ── Two-column body: filter panel + content ─────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'flex-start' }}>

        <GlobalFilterPanel
          activePart={activePart}
          setActivePart={setActivePart}
          filters={filters}
          setFilters={setFilters}
          categories={data.categories}
          divisions={data.division}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Thin section tab nav ─────────────────────────────────────── */}
        <div style={{
        display: 'flex', gap: 2, padding: '20px 32px 0', borderBottom: '1px solid #1e2030',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {[
          { id: 'overview',   label: 'Resumen',    icon: '📊' },
          { id: 'geographic', label: 'Geografía',  icon: '🗺️' },
          { id: 'temporal',   label: 'Temporal',   icon: '🕐' },
          { id: 'categories', label: 'Categorías', icon: '📂' },
          { id: 'victims',    label: 'Víctimas',   icon: '👥' },
          { id: 'external',   label: 'Contexto',   icon: '🌦️' },
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
      <main style={{ flex: 1, padding: '44px 40px 80px', maxWidth: 1160, width: '100%' }}>

        {/* Annual mini cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 44 }}>
          {summary.by_year.map(yr => (
            <div key={yr.year} style={{
              background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10,
              padding: '12px 10px', textAlign: 'center', cursor: 'default',
              transition: 'all 0.2s ease',
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
          <SectionHeader title="Macro Tendencia" sub="¿Está mejorando o empeorando la seguridad? Indicadores del período 2020-2024 — evolución anual del clearance rate, violencia y volumen total." badge="1 004 894 registros" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 18, marginBottom: 28 }}>
            <KpiCard label="Total de Delitos"          value={summary.total_crimes.toLocaleString()}   sub="Incidentes confirmados LAPD 2020-2024"                                          color="#4f8ef7" icon={Shield} />
            <KpiCard label="Tasa de Esclarecimiento"   value={`${summary.clearance_rate}%`}           sub="Casos con arresto o cierre excepcional"                                        color={clrColor} icon={CheckCircle} />
            <KpiCard label="Proporción Violenta"       value={`${summary.violent_pct}%`}              sub={`${summary.violent_crimes.toLocaleString()} incidentes violentos registrados`} color="#e05252" icon={Zap} />
            <KpiCard label="Volumen 2024"              value={summary.crimes_2024.toLocaleString()}   trend={summary.yoy_2024_vs_2023} sub="Variación interanual 2024 vs. 2023"          color="#e0883a" icon={TrendingUp} />
            <KpiCard label="Demora de Reporte"         value={`${summary.avg_reporting_lag}d`}        sub="Días promedio entre ocurrencia y denuncia"                                     color="#a78bfa" icon={Clock} />
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
          <SectionHeader title="¿Dónde Ocurre el Crimen?" sub="Distribución geográfica por división policial. El color combina volumen y eficacia: donde hay más crimen y menos resolución está el problema real no resuelto." badge="21 Divisiones" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <ViewTab label="Mapa Interactivo"    icon="🗺️" active={geoView === 'map'}     onClick={() => setGeoView('map')} />
            <ViewTab label="Ranking Divisiones"  icon="📊" active={geoView === 'ranking'} onClick={() => setGeoView('ranking')} />
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
          <SectionHeader title="¿Cuándo Atacan?" sub="Matriz de intensidad hora × día de semana — 168 celdas que mapean los picos de actividad criminal. Rojo = máximo. Clic en celda para cross-filtrar." badge="168 celdas" />
          <ChartWrapper pending={isFiltering} minHeight={320}>
            <HourHeatmap data={hourly} filters={filters} onFilter={handleFilter} />
          </ChartWrapper>
        </Section>

        {/* CATEGORIES */}
        <Section id="categories">
          <SectionHeader
            title="¿Qué Delitos Predominan?"
            sub="Ranking de las 18 categorías criminales de mayor a menor frecuencia. El delito #1 resalta en cian. Clic en barra para sincronizar el mapa geográfico."
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
            title="¿Quiénes Son las Víctimas?"
            sub="Perfil demográfico completo: edad, género y origen étnico. Los segmentos más oscuros revelan los grupos más expuestos — y los más invisibilizados en los datos."
            badge="735k víctimas"
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
          <SectionHeader title="Contexto Externo" sub="¿Influye el calor o el desempleo en el crimen? Correlaciones con temperatura diaria y tasa de desempleo mensual en el área metropolitana de Los Ángeles." />
          <div style={{ display: 'grid', gap: 20 }}>
            <WeatherChart data={weather} />
            <UnemploymentChart data={monthly} />
          </div>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginBottom: 16 }}>Hallazgos Clave</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
              {[
                { icon: '🌡️', title: 'Calor y Crimen',          body: 'Correlación positiva entre temperatura promedio y delitos diarios. Los días con más de 32 °C registran tasas notablemente más altas.' },
                { icon: '🌧️', title: 'Lluvia como Disuasor',    body: 'Los días de lluvia muestran consistentemente menos incidentes. El mal tiempo reduce la actividad al aire libre y los crímenes oportunistas.' },
                { icon: '💼', title: 'Paradoja del Desempleo',  body: 'El pico de desempleo en COVID (abr. 2020: +20%) coincidió con menos crimen — las cuarentenas confinaron a las personas en sus hogares.' },
                { icon: '📉', title: 'Caída del Esclarecimiento', body: 'La tasa cayó del ~18% en 2020 al ~12% en 2024, reflejando la presión creciente de casos sobre la LAPD.' },
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

        </div> {/* end right column */}
      </div>   {/* end two-column body */}

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

      <OnboardingModal open={showOnboarding} onClose={closeOnboarding} />
    </Shell>
  );
}
