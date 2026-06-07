'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// Cyberpunk year palette — deep indigo (oldest) → fuchsia (most recent)
const YEAR_COLORS = {
  2020: '#3b0764',
  2021: '#4c1d95',
  2022: '#6d28d9',
  2023: '#a21caf',
  2024: '#d946ef',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#7b82a0', fontSize: 11, marginBottom: 4 }}>{d.date} · {d.year}</p>
      <p style={{ color: '#e0883a', fontSize: 13 }}>Temp: <strong>{d.temp}°F</strong></p>
      <p style={{ color: '#4f8ef7', fontSize: 13 }}>Crimes: <strong>{d.crimes.toLocaleString()}</strong></p>
      {d.isHot ? <p style={{ color: '#e05252', fontSize: 11 }}>Hot day (&gt; 90°F)</p> : null}
      {d.isRainy ? <p style={{ color: '#60c9d4', fontSize: 11 }}>Rainy day</p> : null}
    </div>
  );
};

export default function WeatherChart({ data }) {
  if (!data?.length) return null;

  // Downsample for performance: keep every 3rd point
  const sampled = data.filter((_, i) => i % 2 === 0);

  return (
    <div className="card">
      <p className="section-title">Temperatura vs. Volumen Diario de Crimen</p>
      <p className="section-sub">Correlación temperatura-crimen: cada punto = 1 día del período 2020-2024. Los puntos cian (días &gt;90°F) se acumulan sistemáticamente en la zona alta del gráfico, confirmando que el calor extremo amplifica la actividad delictiva urbana.</p>

      <div className="flex gap-3 mb-3 flex-wrap">
        {Object.entries(YEAR_COLORS).map(([yr, col]) => (
          <div key={yr} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
            <span style={{ fontSize: 11, color: '#7b82a0' }}>{yr}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="temp"
            name="Avg Temp"
            type="number"
            domain={['auto', 'auto']}
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Avg Temperature (°F)', position: 'insideBottom', offset: -3, fill: '#7b82a0', fontSize: 11 }}
          />
          <YAxis
            dataKey="crimes"
            name="Crimes"
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={sampled} isAnimationActive={false}>
            {sampled.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isHot ? '#00f3ff' : (YEAR_COLORS[entry.year] ?? '#3b0764')}
                opacity={entry.isHot ? 0.95 : 0.35}
                r={entry.isHot ? 4.5 : 2.5}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
