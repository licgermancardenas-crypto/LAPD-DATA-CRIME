'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const BLUE   = '#4f8ef7';
const GREEN  = '#34d399';
const MUTED_BAR = '#4a5070';
const CARD   = '#111525';
const BORDER = '#1e2235';
const MUTED  = '#8a90a8';
const DIM    = '#4a5070';

const COLORS = {
  'Model (baseline + neighborhood context)': BLUE,
  'Baseline persistence only': GREEN,
  'Random': MUTED_BAR,
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#fff', fontSize: 12, margin: 0 }}>{d.method}</p>
      <p style={{ color: COLORS[d.method], fontSize: 13, margin: '2px 0 0', fontWeight: 700 }}>
        {(d.hit_rate * 100).toFixed(1)}% of crime captured
      </p>
    </div>
  );
};

export default function HotspotChart({ model }) {
  if (!model?.hit_rate_comparison?.length) return null;

  const data = model.hit_rate_comparison.map(d => ({ ...d, pct: +(d.hit_rate * 100).toFixed(1) }));

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        % del crimen real capturado por el top {(model.metrics.top_k_pct * 100).toFixed(0)}% de tracts de mayor riesgo predicho
      </p>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>
        Métrica estándar de criminología para evaluar modelos de hotspot (&ldquo;hit rate&rdquo; / Predictive Accuracy Index). Compara el modelo completo contra un baseline ingenuo que solo usa el historial 2020-22 de cada tract, sin ningún dato de contexto de barrio.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
          <XAxis type="number" domain={[0, 60]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: BORDER }} tickLine={false}
            tickFormatter={v => `${v}%`}/>
          <YAxis type="category" dataKey="method" width={0} tick={false} axisLine={false} tickLine={false}/>
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="pct" radius={[0, 3, 3, 0]} barSize={28}>
            {data.map((d, i) => <Cell key={i} fill={COLORS[d.method]} fillOpacity={0.85} />)}
            <LabelList dataKey="method" position="insideLeft" fill="#fff" fontSize={11} />
            <LabelList dataKey="pct" position="right" formatter={v => `${v}%`} fill="#fff" fontSize={12} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
