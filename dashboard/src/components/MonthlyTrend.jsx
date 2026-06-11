'use client';

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import TimeFilterBar from './TimeFilterBar';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontSize: 13, margin: '2px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
          {' crimes/day'}
        </p>
      ))}
    </div>
  );
};

export default function MonthlyTrend({ data, filteredData, activePart = 'all', filters, setFilters }) {
  const isFiltered  = !!filteredData;
  const chartData   = filteredData || data;
  if (!chartData?.length) return null;

  const ticks = chartData.filter(d => d.month === 1).map(d => d.period);

  // When filteredData is active, part is already pre-filtered — always use base keys.
  const avgKey  = isFiltered ? 'daily_avg'      : (activePart === 'p1' ? 'daily_avg_p1'  : activePart === 'p2' ? 'daily_avg_p2'  : 'daily_avg');
  const rollKey = isFiltered ? 'rolling3_daily' : (activePart === 'p1' ? 'rolling3_p1'   : activePart === 'p2' ? 'rolling3_p2'   : 'rolling3_daily');
  const barColor  = activePart === 'p1' ? '#a78bfa' : activePart === 'p2' ? '#34d399' : '#4f8ef7';
  const partLabel = activePart === 'p1' ? 'Part 1 – Graves' : activePart === 'p2' ? 'Part 2 – Menores' : 'Todos';

  const hasGeoFilter    = !!(filters?.area || filters?.category || filters?.years?.length || filters?.months?.length);
  const showGlobalBadge = hasGeoFilter && !isFiltered;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
        <p className="section-title">Evolución Anual del Crimen</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {activePart !== 'all' && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5, fontWeight: 700,
              background: activePart === 'p1' ? 'rgba(224,136,58,.12)' : 'rgba(79,142,247,.12)',
              color:      activePart === 'p1' ? '#e0883a'               : '#4f8ef7',
              border:     activePart === 'p1' ? '1px solid rgba(224,136,58,.3)' : '1px solid rgba(79,142,247,.3)',
            }}>{partLabel}</span>
          )}
          {isFiltered && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5, fontWeight: 600,
              background: 'rgba(62,207,142,.07)', border: '1px solid rgba(62,207,142,.2)',
              color: '#3ecf8e',
            }}>filtrado</span>
          )}
          {showGlobalBadge && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5, fontWeight: 600,
              background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.2)',
              color: '#fbbf24',
            }} title="La serie temporal no tiene desglose por división o categoría — se muestra la tendencia global">
              datos globales
            </span>
          )}
        </div>
      </div>
      <p className="section-sub">
        Monitoreo del comportamiento macro del crimen: la media móvil trimestral (línea cian) revela la tendencia estructural, filtrando las variaciones de calendario. ¿Está bajando o subiendo el problema real?
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="period" ticks={ticks} tickFormatter={v => v.slice(0, 4)}
            tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#2a2d3a' }} tickLine={false} />
          <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(0)}
            label={{ value: 'delitos/día', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10, dx: -4 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#94a3b8' }} />
          <ReferenceLine yAxisId="left" x="2020-04" stroke="#f472b6" strokeDasharray="4 4" strokeOpacity={0.7}
            label={{ value: 'COVID', fill: '#f472b6', fontSize: 10 }} />
          <Bar  yAxisId="left" dataKey={avgKey}  name="Delitos/día"  fill={barColor} opacity={0.82} radius={[2,2,0,0]} />
          {activePart === 'all' && (
            <Bar yAxisId="left" dataKey="daily_violent" name="Violentos/día" fill="#f472b6" opacity={0.9} radius={[2,2,0,0]} />
          )}
          <Line yAxisId="left" dataKey={rollKey} name="Media 3M" stroke="#00f3ff" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      {setFilters && (
        <TimeFilterBar
          years={filters?.years ?? []}
          months={filters?.months ?? []}
          onYears={v => setFilters(f => ({ ...f, years: v }))}
          onMonths={v => setFilters(f => ({ ...f, months: v }))}
        />
      )}
    </div>
  );
}
