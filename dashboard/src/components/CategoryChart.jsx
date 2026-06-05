'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

const PALETTE = [
  '#4f8ef7','#e05252','#3ecf8e','#e0883a',
  '#7c5cbf','#e0c066','#60c9d4','#7b82a0',
  '#f77d4f','#52c0e0','#8ecf3e','#cf523e',
  '#5f7cc4','#c4a55f','#3ece8b','#9b59b6',
  '#e67e22','#1abc9c',
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#e8eaf0', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{d.category}</p>
      <p style={{ color: '#4f8ef7', fontSize: 12 }}>Crimes: <strong>{d.crimes.toLocaleString()}</strong></p>
      <p style={{ color: '#7b82a0', fontSize: 12 }}>Share: <strong>{d.share_pct}%</strong></p>
      <p style={{ color: '#3ecf8e', fontSize: 12 }}>Clearance: <strong>{d.clearance_rate}%</strong></p>
      {d.is_violent && <span style={{ color: '#e05252', fontSize: 11 }}>Violent crime</span>}
    </div>
  );
};

export default function CategoryChart({ data }) {
  if (!data?.length) return null;

  const sorted = [...data].sort((a, b) => b.crimes - a.crimes);

  return (
    <div className="card">
      <p className="section-title">Crimes by Category</p>
      <p className="section-sub">Top 18 crime categories 2020-2024 · hover for clearance rate</p>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 140, bottom: 5 }}
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
            dataKey="category"
            tick={{ fill: '#e8eaf0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={138}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="crimes" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.is_violent ? '#e05252' : PALETTE[i % PALETTE.length]}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
