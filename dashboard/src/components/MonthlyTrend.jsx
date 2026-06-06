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
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
          {p.dataKey !== 'rolling3_daily' ? ' crimes/day' : ' crimes/day'}
        </p>
      ))}
    </div>
  );
};

export default function MonthlyTrend({ data }) {
  if (!data?.length) return null;

  const ticks = data.filter(d => d.month === 1).map(d => d.period);

  return (
    <div className="card">
      <p className="section-title">Daily Average Crime Rate — 2020-2024</p>
      <p className="section-sub">
        Crimes per day (normalized by month length) · eliminates the Feb/March calendar bias
      </p>
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
            domain={['auto', 'auto']}
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(0)}`}
            label={{ value: 'crimes/day', angle: -90, position: 'insideLeft', fill: '#7b82a0', fontSize: 10, dx: -4 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#7b82a0' }} />

          <ReferenceLine yAxisId="left" x="2020-04" stroke="#7c5cbf" strokeDasharray="4 4" label={{ value: 'COVID', fill: '#7c5cbf', fontSize: 10 }} />

          <Bar yAxisId="left" dataKey="daily_avg"     name="Total crimes/day"   fill="#4f8ef7" opacity={0.6} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="daily_violent" name="Violent crimes/day" fill="#e05252" opacity={0.8} radius={[2, 2, 0, 0]} />
          <Line yAxisId="left" dataKey="rolling3_daily" name="3M Rolling Avg"   stroke="#e0c066" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
