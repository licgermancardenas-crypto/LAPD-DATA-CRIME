'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';

const MUTED_BAR = '#4a5070';
const GREEN = '#34d399';
const BLUE = '#4f8ef7';
const CARD = '#111525';
const BORDER = '#1e2235';
const MUTED = '#8a90a8';
const DIM = '#4a5070';

const METHOD_COLOR = { flat: MUTED_BAR, slot: GREEN, model: BLUE };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1d27', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#fff', fontSize: 12, margin: '0 0 4px', fontWeight: 700 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill, fontSize: 12, margin: '2px 0 0', fontWeight: 600 }}>
          {p.name}: {p.value.toFixed(1)}%
        </p>
      ))}
    </div>
  );
};

/**
 * data: [{ label, flat, slot, model }]  (all values as percent, e.g. 46.3)
 * flatLabel / slotLabel: legend text for the "flat" and "slot" series
 */
export default function GroupedHitrateChart({ title, subtitle, data, flatLabel, slotLabel }) {
  if (!data?.length) return null;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px' }}>
      {title && (
        <p style={{ fontSize: 10, fontWeight: 700, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          {title}
        </p>
      )}
      {subtitle && (
        <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>{subtitle}</p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 5 }} barGap={4} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis domain={[0, 60]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={36} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 10 }}
            formatter={(value) => <span style={{ color: MUTED }}>{value}</span>}
          />
          <Bar dataKey="flat" name={flatLabel} fill={METHOD_COLOR.flat} radius={[3, 3, 0, 0]} maxBarSize={24}>
            <LabelList dataKey="flat" position="top" formatter={(v) => `${v.toFixed(1)}%`} fill={MUTED} fontSize={10} />
          </Bar>
          <Bar dataKey="slot" name={slotLabel} fill={METHOD_COLOR.slot} radius={[3, 3, 0, 0]} maxBarSize={24}>
            <LabelList dataKey="slot" position="top" formatter={(v) => `${v.toFixed(1)}%`} fill={MUTED} fontSize={10} />
          </Bar>
          <Bar dataKey="model" name="Model (full)" fill={METHOD_COLOR.model} radius={[3, 3, 0, 0]} maxBarSize={24}>
            <LabelList dataKey="model" position="top" formatter={(v) => `${v.toFixed(1)}%`} fill="#fff" fontSize={11} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
