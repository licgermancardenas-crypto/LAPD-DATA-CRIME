'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const lag  = payload.find(p => p.dataKey === 'avg_lag');
  const roll = payload.find(p => p.dataKey === 'rolling3_lag');
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
      <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 6 }}>{label}</p>
      {lag && (
        <p style={{ color: '#e0883a', fontSize: 13, margin: '2px 0' }}>
          Avg Lag: <strong>{lag.value?.toFixed(1)} days</strong>
        </p>
      )}
      {roll && (
        <p style={{ color: '#4f8ef7', fontSize: 13, margin: '2px 0' }}>
          3M Avg: <strong>{roll.value?.toFixed(1)} days</strong>
        </p>
      )}
    </div>
  );
};

export default function ReportingLagChart({ data }) {
  if (!data?.length) return null;

  const ticks = data.filter(d => d.month === 1).map(d => d.period);
  const overallAvg = (data.reduce((s, d) => s + (d.avg_lag ?? 0), 0) / data.filter(d => d.avg_lag != null).length).toFixed(1);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p className="section-title">Reporting Lag — Days to File a Report</p>
          <p className="section-sub">
            Average days between crime occurrence and police report · cap 365 days · reveals trust &amp; bureaucracy shifts
          </p>
        </div>
        <div style={{
          background: 'rgba(224,136,58,.08)', border: '1px solid rgba(224,136,58,.25)',
          borderRadius: 8, padding: '6px 14px', textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e0883a' }}>{overallAvg}d</div>
          <div style={{ fontSize: 10, color: '#7b82a0' }}>5yr avg</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
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
            domain={[0, 'auto']}
            tick={{ fill: '#7b82a0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}d`}
            label={{ value: 'days', angle: -90, position: 'insideLeft', fill: '#7b82a0', fontSize: 10, dx: -2 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#7b82a0' }} />

          {/* Baseline: 7-day reference */}
          <ReferenceLine y={7} stroke="#2a2d3a" strokeDasharray="4 4" label={{ value: '7d baseline', fill: '#3a3f55', fontSize: 9, position: 'insideTopRight' }} />

          {/* COVID lockdown marker */}
          <ReferenceLine x="2020-04" stroke="#7c5cbf" strokeDasharray="4 4" label={{ value: 'COVID', fill: '#7c5cbf', fontSize: 10 }} />

          <Bar dataKey="avg_lag"    name="Avg Lag (days)" fill="#e0883a" opacity={0.65} radius={[2, 2, 0, 0]} />
          <Line dataKey="rolling3_lag" name="3M Rolling Avg" stroke="#4f8ef7" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <p style={{ fontSize: 11, color: '#3a3f55', marginTop: 10 }}>
        Source: LAPD DR records — DATE OCC vs Date Rptd · reports with lag &gt;365 days excluded as data entry anomalies
      </p>
    </div>
  );
}
