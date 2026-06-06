'use client';

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontSize: 13, margin: '2px 0' }}>
          {p.name}:{' '}
          <strong>
            {p.name === 'Unemployment %'
              ? `${parseFloat(p.value ?? 0).toFixed(1)}%`
              : typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </strong>
        </p>
      ))}
    </div>
  );
};

export default function UnemploymentChart({ data }) {
  if (!data?.length) return null;

  const ticks = data.filter(d => d.month === 1).map(d => d.period);

  return (
    <div className="card">
      <p className="section-title">Unemployment Rate vs Monthly Crime Volume</p>
      <p className="section-sub">LA-Long Beach-Anaheim MSA unemployment (BLS) · COVID spike visible April 2020</p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
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
            yAxisId="crimes"
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="unemp"
            orientation="right"
            tick={{ fill: '#e0883a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />

          <Area
            yAxisId="crimes"
            dataKey="crimes"
            name="Monthly Crimes"
            stroke="#4f8ef7"
            fill="#4f8ef7"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="unemp"
            dataKey="unemp_rate"
            name="Unemployment %"
            stroke="#e0883a"
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="5 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
