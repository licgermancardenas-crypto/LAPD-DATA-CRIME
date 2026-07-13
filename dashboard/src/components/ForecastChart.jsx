'use client';

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const BLUE   = '#4f8ef7';
const MUTED  = '#8a90a8';
const GREEN  = '#34d399';
const RED    = '#f87171';
const BORDER = '#1e2235';
const CARD   = '#111525';
const DIM    = '#4a5070';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const get = (key) => payload.find(p => p.dataKey === key)?.value;
  return (
    <div style={{ background: '#111525', border: '1px solid #1e2235', borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
      <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 6 }}>{label}</p>
      {get('actual_reliable') != null && <p style={{ color: BLUE, fontSize: 13, margin: '2px 0' }}>Actual: <strong>{get('actual_reliable').toLocaleString()}</strong></p>}
      {get('actual_excluded') != null && <p style={{ color: MUTED, fontSize: 13, margin: '2px 0' }}>Actual (incompleto): <strong>{get('actual_excluded').toLocaleString()}</strong></p>}
      {get('xgb') != null && <p style={{ color: GREEN, fontSize: 13, margin: '2px 0' }}>XGBoost: <strong>{get('xgb').toLocaleString()}</strong></p>}
      {get('prophet') != null && <p style={{ color: RED, fontSize: 13, margin: '2px 0' }}>Prophet: <strong>{get('prophet').toLocaleString()}</strong></p>}
    </div>
  );
};

export default function ForecastChart({ forecast }) {
  if (!forecast?.series?.length) return null;

  const cutoffIdx = forecast.series.findIndex(r => r.month === forecast.reliable_cutoff);
  const lastReliableMonth = forecast.reliable_cutoff;

  const chartData = forecast.series.map((r, i) => ({
    month: r.month,
    actual_reliable: r.reliable ? r.actual : (r.month === lastReliableMonth ? r.actual : null),
    actual_excluded: !r.reliable ? r.actual : (r.month === lastReliableMonth ? r.actual : null),
    xgb: r.xgb_backtest ?? r.xgb_forecast ?? null,
    prophet: r.prophet_backtest ?? r.prophet_forecast ?? null,
    ci: (r.prophet_ci_lower != null && r.prophet_ci_upper != null) ? [r.prophet_ci_lower, r.prophet_ci_upper] : null,
  }));

  const ticks = chartData.filter((_, i) => i % 6 === 0).map(d => d.month);

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Forecast de Volumen — 12 Meses
      </p>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>
        Modelo entrenado solo con los 51 meses confiables (2020-01 a {lastReliableMonth}) — los meses posteriores están en el dataset pero subcontados por retraso de denuncia, no reflejan una baja real de crimen. Comparación XGBoost (MAPE {forecast.backtest_metrics.find(m => m.model === 'XGBoost')?.mape}%) vs Prophet (MAPE {forecast.backtest_metrics.find(m => m.model === 'Prophet')?.mape}%) sobre los últimos 12 meses confiables (held-out).
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="month" ticks={ticks} tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#2a2d3a' }} tickLine={false} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            label={{ value: 'crímenes/mes', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10, dx: -4 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#94a3b8' }} />
          <ReferenceLine x={lastReliableMonth} stroke="#fff" strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: 'datos confiables terminan', fill: '#fff', fontSize: 10, position: 'insideTopLeft' }} />
          <Area dataKey="ci" name="IC 90% (Prophet)" stroke="none" fill={RED} fillOpacity={0.12} />
          <Line dataKey="actual_reliable" name="Actual" stroke={BLUE} strokeWidth={2.5} dot={false} />
          <Line dataKey="actual_excluded" name="Actual (incompleto)" stroke={MUTED} strokeWidth={1.8} strokeDasharray="3 3" dot={false} />
          <Line dataKey="xgb" name="XGBoost" stroke={GREEN} strokeWidth={2} dot={{ r: 2 }} />
          <Line dataKey="prophet" name="Prophet" stroke={RED} strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
