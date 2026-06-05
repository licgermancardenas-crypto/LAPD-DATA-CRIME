'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#e8eaf0', fontWeight: 600, marginBottom: 6 }}>{d.name}</p>
      <p style={{ color: '#4f8ef7', fontSize: 13 }}>Crimes: <strong>{d.crimes.toLocaleString()}</strong></p>
      <p style={{ color: '#3ecf8e', fontSize: 13 }}>Clearance: <strong>{d.clearance_rate}%</strong></p>
      <p style={{ color: '#e05252', fontSize: 13 }}>Violent: <strong>{d.violent_pct}%</strong></p>
    </div>
  );
};

export default function DivisionBar({ data }) {
  if (!data?.length) return null;

  // Color by clearance rate: green > 20%, yellow 10-20%, red < 10%
  const colorFor = (rate) =>
    rate >= 20 ? '#3ecf8e' : rate >= 10 ? '#e0c066' : '#e05252';

  return (
    <div className="card">
      <p className="section-title">Crimes by LAPD Division</p>
      <p className="section-sub">Total crimes 2020-2024 · colour = clearance rate (green &ge; 20%, yellow 10-20%, red &lt; 10%)</p>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#e8eaf0', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={78}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="crimes" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colorFor(entry.clearance_rate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
