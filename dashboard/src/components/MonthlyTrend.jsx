'use client';

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontSize: 13, margin: '2px 0' }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

export default function MonthlyTrend({ data }) {
  if (!data?.length) return null;

  // Group by year for the year labels on X axis
  const ticks = data
    .filter(d => d.month === 1)
    .map(d => d.period);

  return (
    <div className="card">
      <p className="section-title">Monthly Crime Volume — 2020-2024</p>
      <p className="section-sub">Total crimes per month with 3-month rolling average and violent crime overlay</p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="period"
            ticks={ticks}
            tickFormatter={v => v.slice(0, 4)}
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={{ stroke: '#2a2d3a' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#7b82a0' }} />

          {/* COVID shading — approximate months */}
          <ReferenceLine yAxisId="left" x="2020-04" stroke="#7c5cbf" strokeDasharray="4 4" label={{ value: 'COVID', fill: '#7c5cbf', fontSize: 10 }} />

          <Bar yAxisId="left" dataKey="crimes" name="Total Crimes" fill="#4f8ef7" opacity={0.6} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="violent" name="Violent Crimes" fill="#e05252" opacity={0.8} radius={[2, 2, 0, 0]} />
          <Line yAxisId="left" dataKey="rolling3" name="3M Rolling Avg" stroke="#e0c066" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
