'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const COLORS = {
  'Via Publica':  '#4f8ef7',
  'Residencial':  '#e0883a',
  'Comercial':    '#3ecf8e',
  'Otros':        '#7c5cbf',
  'Transporte':   '#e0c066',
};

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

export default function PremiseChart({ data, activePart = 'all' }) {
  if (!data?.length) return null;

  const chartData = data.map(d => ({
    ...d,
    value: activePart === 'p1' ? d.p1 : activePart === 'p2' ? d.p2 : d.crimes,
  })).sort((a, b) => b.value - a.value);

  const partLabel = activePart === 'p1' ? 'Delitos Graves (Part 1)'
                  : activePart === 'p2' ? 'Delitos Menores (Part 2)'
                  : 'Todos los delitos';

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p className="section-title">Crímenes por Lugar — Macro-Categorías</p>
        <span style={{
          fontSize: 10, color: '#4f8ef7', background: 'rgba(79,142,247,.1)',
          border: '1px solid rgba(79,142,247,.2)', borderRadius: 5, padding: '2px 8px',
        }}>{partLabel}</span>
      </div>
      <p className="section-sub">5 macro-categorías de lugar · Vía Pública = 72% delitos graves · Residencial = mayormente Part 2</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 70, left: 82, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="premise" tick={{ fill: '#c0c4d4', fontSize: 12 }}
            axisLine={false} tickLine={false} width={80} />
          <Tooltip content={<PremTip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map(d => (
              <Cell key={d.premise} fill={COLORS[d.premise] ?? '#7b82a0'} opacity={0.85} />
            ))}
            <LabelList dataKey="share_pct" position="right"
              formatter={v => `${parseFloat(v ?? 0).toFixed(1)}%`} style={{ fontSize: 10, fill: '#7b82a0' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
