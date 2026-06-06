'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, activePart }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const crimes = activePart === 'p1' ? d.crimes_p1 : activePart === 'p2' ? d.crimes_p2 : d.crimes;
  const clr    = activePart === 'p1' ? d.clearance_rate_p1 : activePart === 'p2' ? d.clearance_rate_p2 : d.clearance_rate;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#e8eaf0', fontWeight: 600, marginBottom: 6 }}>{d.name}</p>
      <p style={{ color: '#4f8ef7', fontSize: 13 }}>Crímenes: <strong>{crimes.toLocaleString()}</strong></p>
      <p style={{ color: '#3ecf8e', fontSize: 13 }}>Esclarecimiento: <strong>{clr}%</strong></p>
      {activePart === 'all' && (
        <>
          <p style={{ color: '#e0883a', fontSize: 12, marginTop: 4 }}>Part 1: {d.crimes_p1.toLocaleString()}</p>
          <p style={{ color: '#4f8ef7', fontSize: 12 }}>Part 2: {d.crimes_p2.toLocaleString()}</p>
          <p style={{ color: '#e05252', fontSize: 12 }}>Violentos: {d.violent_pct}%</p>
        </>
      )}
    </div>
  );
};

export default function DivisionBar({ data, activePart = 'all' }) {
  if (!data?.length) return null;

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

  return (
    <div className="card">
      <p className="section-title">Crímenes por División LAPD</p>
      <p className="section-sub">
        Total 2020-2024 {partSub} · color = tasa de esclarecimiento (verde &ge; 20%, amarillo 10-20%, rojo &lt; 10%)
      </p>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 11 }} axisLine={false}
            tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#e8eaf0', fontSize: 12 }}
            axisLine={false} tickLine={false} width={78} />
          <Tooltip content={<CustomTooltip activePart={activePart} />} />
          <Bar dataKey={activePart === 'p1' ? 'crimes_p1' : activePart === 'p2' ? 'crimes_p2' : 'crimes'}
               radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={colorFor(getClearance(entry))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
