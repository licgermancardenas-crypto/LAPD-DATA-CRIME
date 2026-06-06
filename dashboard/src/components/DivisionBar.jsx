'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, activePart, hasFilter }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const crimes = activePart === 'p1' ? d.crimes_p1 : activePart === 'p2' ? d.crimes_p2 : d.crimes;
  const clr    = activePart === 'p1' ? d.clearance_rate_p1 : activePart === 'p2' ? d.clearance_rate_p2 : d.clearance_rate;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#e8eaf0', fontWeight: 600, marginBottom: 6 }}>{d.name}</p>
      <p style={{ color: '#4f8ef7', fontSize: 13 }}>Crímenes: <strong>{crimes.toLocaleString()}</strong></p>
      <p style={{ color: '#3ecf8e', fontSize: 13 }}>Esclarecimiento: <strong>{parseFloat(clr ?? 0).toFixed(1)}%</strong></p>
      {activePart === 'all' && (
        <>
          <p style={{ color: '#e0883a', fontSize: 12, marginTop: 4 }}>Part 1: {(d.crimes_p1 ?? 0).toLocaleString()}</p>
          <p style={{ color: '#4f8ef7', fontSize: 12 }}>Part 2: {(d.crimes_p2 ?? 0).toLocaleString()}</p>
          <p style={{ color: '#e05252', fontSize: 12 }}>Violentos: {parseFloat(d.violent_pct ?? 0).toFixed(1)}%</p>
        </>
      )}
      {hasFilter && (
        <p style={{ color: '#7c5cbf', fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
          Click para filtrar por esta área
        </p>
      )}
    </div>
  );
};

export default function DivisionBar({ data, activePart = 'all', filters, onFilter }) {
  if (!data?.length) return null;

  const activeArea   = filters?.area ?? null;
  const isFiltered   = !!filters?.category;

  const colorFor = (rate) =>
    rate >= 20 ? '#3ecf8e' : rate >= 10 ? '#e0c066' : '#e05252';

  const getValue = (d) =>
    activePart === 'p1' ? d.crimes_p1 : activePart === 'p2' ? d.crimes_p2 : d.crimes;

  const getClearance = (d) =>
    activePart === 'p1' ? d.clearance_rate_p1 : activePart === 'p2' ? d.clearance_rate_p2 : d.clearance_rate;

  const sorted = [...data].sort((a, b) => getValue(b) - getValue(a));

  const partSub = activePart === 'p1' ? '— sólo Delitos Graves Part 1 (FBI UCR)'
                : activePart === 'p2' ? '— sólo Delitos Menores Part 2'
                : '';

  const handleClick = (e) => {
    if (!onFilter) return;
    const entry = e?.activePayload?.[0]?.payload;
    if (!entry) return;
    onFilter('area', activeArea === entry.name ? null : entry.name);
  };

  return (
    <div className="card">
      <p className="section-title">¿Qué División Concentra el Problema?</p>
      <p className="section-sub">
        Ranking por volumen 2020-2024 {partSub} · el color revela la tasa de esclarecimiento: verde ≥ 20 %, ámbar 10-20 %, rojo &lt; 10 %
        {isFiltered && <span style={{ color: '#4cc9f0' }}> · Filtrado por categoría</span>}
        {onFilter && <span style={{ color: '#7b82a0' }}> · Clic para cross-filtrar</span>}
      </p>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
          onClick={handleClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 11 }} axisLine={false}
            tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#e8eaf0', fontSize: 12 }}
            axisLine={false} tickLine={false} width={78} />
          <Tooltip content={<CustomTooltip activePart={activePart} hasFilter={!!onFilter} />} />
          <Bar
            dataKey={activePart === 'p1' ? 'crimes_p1' : activePart === 'p2' ? 'crimes_p2' : 'crimes'}
            radius={[0, 4, 4, 0]}
            cursor={onFilter ? 'pointer' : 'default'}
          >
            {sorted.map((entry, i) => {
              const isActive = activeArea === entry.name;
              const isDimmed = activeArea && !isActive;
              return (
                <Cell
                  key={i}
                  fill={colorFor(getClearance(entry))}
                  opacity={isDimmed ? 0.25 : 0.85}
                  stroke={isActive ? '#fff' : 'none'}
                  strokeWidth={isActive ? 1.5 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
