'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

// Cyberpunk rank palette: top-1 = electric cyan, rest = fuchsia → deep indigo
const PREMISE_CYBER = ['#00f3ff', '#d946ef', '#a21caf', '#6d28d9', '#3b0764'];

function PremTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#e8eaf0', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{d.premise}</p>
      <p style={{ color: '#4f8ef7', fontSize: 12 }}>Total: <strong>{d.crimes.toLocaleString()}</strong> ({parseFloat(d.share_pct ?? 0).toFixed(1)}%)</p>
      <p style={{ color: '#e05252', fontSize: 12 }}>Part 1 (graves): <strong>{d.p1.toLocaleString()}</strong> ({parseFloat(d.p1_pct ?? 0).toFixed(1)}%)</p>
      <p style={{ color: '#7b82a0', fontSize: 12 }}>Part 2 (menores): <strong>{d.p2.toLocaleString()}</strong></p>
    </div>
  );
}

export default function PremiseChart({ data, activePart = 'all', filters }) {
  if (!data?.length) return null;

  const chartData = data.map(d => ({
    ...d,
    value: activePart === 'p1' ? d.p1 : activePart === 'p2' ? d.p2 : d.crimes,
  })).sort((a, b) => b.value - a.value);

  const partLabel    = activePart === 'p1' ? 'Delitos Graves (Part 1)'
                     : activePart === 'p2' ? 'Delitos Menores (Part 2)'
                     : 'Todos los delitos';
  const hasGeoFilter = filters?.area || filters?.category || filters?.years?.length || filters?.months?.length;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
        <p className="section-title">Crímenes por Lugar — Macro-Categorías</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            fontSize: 10, color: '#4f8ef7', background: 'rgba(79,142,247,.1)',
            border: '1px solid rgba(79,142,247,.2)', borderRadius: 5, padding: '2px 8px',
          }}>{partLabel}</span>
          {hasGeoFilter && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5, fontWeight: 600,
              background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.2)',
              color: '#fbbf24',
            }} title="Los tipos de lugar no tienen desglose por división o categoría — se muestra la distribución global">
              datos globales
            </span>
          )}
        </div>
      </div>
      <p className="section-sub">Análisis del entorno del delito: Vía Pública lidera con el 72 % de los delitos graves, confirmando que el espacio urbano abierto es el principal escenario de riesgo. Residencial concentra infracciones menores.</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 70, left: 82, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="premise" tick={{ fill: '#c0c4d4', fontSize: 12 }}
            axisLine={false} tickLine={false} width={80} />
          <Tooltip content={<PremTip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((d, i) => (
              <Cell key={d.premise} fill={PREMISE_CYBER[i] ?? '#3b0764'} opacity={i === 0 ? 1 : 0.85} />
            ))}
            <LabelList dataKey="share_pct" position="right"
              formatter={v => `${parseFloat(v ?? 0).toFixed(1)}%`} style={{ fontSize: 10, fill: '#7b82a0' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
