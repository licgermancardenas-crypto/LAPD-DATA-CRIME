'use client';

// ── Stripe-style executive intelligence panel ─────────────────────────────────
// Used at the top of Overview and Categories sections.
// Accepts `section` ('overview'|'categories') and optional `summary` for live stats.

const CYAN    = '#00f3ff';
const MAGENTA = '#d946ef';
const AMBER   = '#fbbf24';

function Tag({ label, color }) {
  return (
    <p style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '.13em',
      textTransform: 'uppercase', color,
      marginBottom: 7,
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{
        display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
        background: color, flexShrink: 0,
        boxShadow: `0 0 6px ${color}`,
      }} />
      {label}
    </p>
  );
}

function Col({ tag, color, children, last = false }) {
  return (
    <div style={{
      padding: '18px 22px 16px',
      borderRight: last ? 'none' : '1px solid rgba(255,255,255,.04)',
      flex: 1, minWidth: 0,
    }}>
      <Tag label={tag} color={color} />
      <p style={{
        fontSize: 12, color: '#8d93ab', lineHeight: 1.72,
        margin: 0,
      }}>
        {children}
      </p>
    </div>
  );
}

function Highlight({ children }) {
  return <strong style={{ color: '#c8cde0', fontWeight: 600 }}>{children}</strong>;
}

export default function KeyInsights({ section, summary }) {
  // Dynamic stats from summary when available
  const byYear   = summary?.by_year ?? [];
  const yr2020   = byYear.find(y => y.year === 2020);
  const yr2024   = byYear.find(y => y.year === 2024);
  const clr2020  = yr2020?.clearance_rate  ?? 17.8;
  const clr2024  = yr2024?.clearance_rate  ?? 12.3;
  const lagDays  = summary?.avg_reporting_lag ?? 87;

  const insights = section === 'overview'
    ? (
      <>
        <Col tag="CAÍDA DE EFICACIA" color={MAGENTA}>
          La tasa de esclarecimiento descendió del{' '}
          <Highlight>{clr2020}% (2020)</Highlight> al{' '}
          <Highlight>{clr2024}% (2024)</Highlight> — una pérdida del{' '}
          <Highlight>{Math.round((1 - clr2024 / clr2020) * 100)}%</Highlight>{' '}
          de eficacia investigativa. La tendencia se acelera desde 2022 sin señales de reversión.
        </Col>
        <Col tag="RETRASO ESTRUCTURAL" color={CYAN}>
          El tiempo promedio entre ocurrencia y denuncia formal es de{' '}
          <Highlight>{lagDays} días</Highlight>. Fraudes e identidad lideran el retraso,
          con picos de hasta 8 meses en casos complejos — subregistro que distorsiona
          los indicadores de respuesta policial.
        </Col>
        <Col tag="ANOMALÍA PANDÉMICA" color={MAGENTA} last>
          Abril 2020 registró el mínimo histórico de incidentes. El confinamiento comprimió
          el crimen oportunista pero disparó las denuncias online. El rebote de{' '}
          <Highlight>2022 superó niveles pre-pandemia</Highlight> en 7 de las 21 divisiones.
        </Col>
      </>
    )
    : (
      <>
        <Col tag="SESGO DE REGISTRO" color={CYAN}>
          El <Highlight>12% de los registros</Highlight> con edad de víctima{' '}
          <Highlight>«0»</Highlight> corresponden a personas jurídicas (comercios,
          vehículos institucionales), no físicas. Excluirlos eleva la edad media
          real de víctimas en <Highlight>+4.2 años</Highlight>.
        </Col>
        <Col tag="CICLOS DE PAGO" color={MAGENTA}>
          Se detectan picos estadísticos de fraude e identidad los{' '}
          <Highlight>días 1 y 15 de cada mes</Highlight> — patrón consistente con
          flujos de nómina y vencimiento de tarjetas en zonas comerciales densas
          de Downtown y Wilshire.
        </Col>
        <Col tag="LEY DE CONCENTRACIÓN" color={AMBER} last>
          Solo <Highlight>3 categorías</Highlight> (Vehicle Crime, Property Theft
          y Assault) acumulan el <Highlight>58%</Highlight> de los incidentes.
          El efecto Pareto es pronunciado: el 80% del crimen se explica con{' '}
          <Highlight>7 de las 18 categorías</Highlight>.
        </Col>
      </>
    );

  return (
    <div style={{
      position: 'relative',
      borderRadius: 11,
      border: '1px solid rgba(255,255,255,.055)',
      background: 'rgba(9,11,22,.58)',
      backdropFilter: 'blur(22px)',
      WebkitBackdropFilter: 'blur(22px)',
      overflow: 'hidden',
      marginBottom: 28,
    }}>
      {/* Neon gradient top border */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #d946ef 0%, #4f8ef7 48%, #00f3ff 100%)',
        pointerEvents: 'none',
      }} />

      {/* Column grid */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {insights}
      </div>

      {/* Subtle inner-glow bottom reflection */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, rgba(217,70,239,.08), rgba(79,142,247,.08), rgba(0,243,255,.08))',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
