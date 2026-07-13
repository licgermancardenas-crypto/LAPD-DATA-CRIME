'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const BLUE   = '#4f8ef7';
const GREEN  = '#34d399';
const CARD   = '#111525';
const BORDER = '#1e2235';
const MUTED  = '#8a90a8';
const DIM    = '#4a5070';

const NEIGHBORHOOD_FEATURES = new Set([
  '% Div. Commercial Zoning', '% Div. Residential Zoning',
  'Tract Poverty Rate', 'Tract Median Income', 'Tract Homeownership Rate',
  'Alcohol Outlets/1k Pop', 'Streetlights/1k Addr',
]);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#fff', fontSize: 12, margin: 0 }}>{d.feature}</p>
      <p style={{ color: d.isNeighborhood ? GREEN : BLUE, fontSize: 12, margin: '2px 0 0' }}>
        importancia relativa: <strong>{d.importance.toFixed(2)}</strong>
      </p>
      {d.isNeighborhood && <p style={{ color: GREEN, fontSize: 10, margin: '4px 0 0' }}>dato de enriquecimiento de barrio</p>}
    </div>
  );
};

export default function ClearanceChart({ model }) {
  if (!model?.feature_importance?.length) return null;

  const data = [...model.feature_importance].reverse().map(f => ({
    ...f,
    isNeighborhood: NEIGHBORHOOD_FEATURES.has(f.feature),
  }));

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Qué predice si un caso se resuelve
      </p>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>
        Importancia relativa de cada feature en el modelo XGBoost (AUC {model.metrics.roc_auc}%). En <span style={{ color: GREEN }}>verde</span>: variables de contexto de barrio agregadas en el enriquecimiento de datos (censo, zonificación, alcohol, luminarias) — no vienen del reporte del crimen en sí.
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis type="category" dataKey="feature" width={150} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="importance" radius={[0, 3, 3, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isNeighborhood ? GREEN : BLUE} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
