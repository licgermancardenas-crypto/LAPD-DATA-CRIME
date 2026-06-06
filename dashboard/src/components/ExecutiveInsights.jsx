'use client'

const INSIGHTS = [
  {
    id: 'clearance',
    icon: '📉',
    metric: '−50 %',
    metricColor: '#e05252',
    glowColor: 'rgba(224,82,82,.18)',
    borderColor: 'rgba(224,82,82,.28)',
    title: 'Clearance rate en caída libre',
    body: 'Del 24 % (2020) al 12.1 % (2024), la tasa de esclarecimiento se redujo a la mitad en cuatro años. Los delitos graves Part 1 se resuelven en menos de 1 de cada 11 casos en las divisiones más cargadas.',
  },
  {
    id: 'vehicle',
    icon: '🚗',
    metric: '4.4 %',
    metricColor: '#e0883a',
    glowColor: 'rgba(224,136,58,.13)',
    borderColor: 'rgba(224,136,58,.3)',
    title: 'Robo vehicular: el crimen impune',
    body: '194 292 robos de vehículo (19.3 % del total) se resuelven en apenas 4.4 % de los casos — el peor ratio de todas las categorías. Junto a theft y burglary, el crimen patrimonial suma 454 k registros con resolución promedio del 6.7 %.',
  },
  {
    id: 'downtown',
    icon: '🏙️',
    metric: '9 %',
    metricColor: '#4cc9f0',
    glowColor: 'rgba(76,201,240,.1)',
    borderColor: 'rgba(76,201,240,.25)',
    title: 'Downtown: triple volumen, mitad de eficacia',
    body: 'Central (Downtown) concentra 69 668 delitos — el máximo de las 21 divisiones — con solo 9 % de esclarecimiento en delitos graves. Divisiones residenciales como West Valley o Topanga duplican esa tasa con volumen 40 % menor.',
  },
  {
    id: 'minors',
    icon: '🔴',
    metric: '66.3 %',
    metricColor: '#a78bfa',
    glowColor: 'rgba(167,139,250,.1)',
    borderColor: 'rgba(167,139,250,.25)',
    title: 'Menores: víctimas mayoritariamente violentas',
    body: '2 de cada 3 crímenes con víctima menor de 18 años son violentos — la proporción más alta de cualquier grupo etario (vs. 30–35 % en adultos). A ello se suma que el 26.8 % de los 1 M de registros carece de dato de víctima, sesgando todas las métricas demográficas hacia abajo.',
  },
];

export default function ExecutiveInsights() {
  return (
    <div style={{
      background: '#0c0e1a',
      border: '1px solid #1e2030',
      borderRadius: 14,
      padding: '20px 24px 22px',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 3, height: 18, borderRadius: 2,
            background: 'linear-gradient(180deg,#4f8ef7,#a78bfa)',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#7b82a0',
          }}>
            Key Insights · Análisis 2020–2024
          </span>
        </div>
        <span style={{
          fontSize: 10, color: '#3a3f55', fontWeight: 500,
        }}>
          Basado en 1 004 894 registros · LAPD Open Data
        </span>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {INSIGHTS.map((ins) => (
          <div key={ins.id} style={{
            background: ins.glowColor,
            border: `1px solid ${ins.borderColor}`,
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
          }}>
            {/* Left: metric block */}
            <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 56 }}>
              <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 5 }}>{ins.icon}</div>
              <div style={{
                fontSize: 19, fontWeight: 800, lineHeight: 1,
                color: ins.metricColor,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-.01em',
              }}>
                {ins.metric}
              </div>
            </div>

            {/* Right: text */}
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: 13, fontWeight: 700,
                color: '#e8eaf0', marginBottom: 6, lineHeight: 1.3,
              }}>
                {ins.title}
              </p>
              <p style={{
                fontSize: 11.5, color: '#7b82a0',
                lineHeight: 1.6, margin: 0,
              }}>
                {ins.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
