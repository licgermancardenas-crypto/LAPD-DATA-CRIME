'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const CARD = '#111525';
const BORDER = '#1e2235';
const MUTED = '#8a90a8';
const DIM = '#4a5070';

const GROUP_COLOR = { all: '#4f8ef7', violent: '#f87171', vehicle: '#e0c066', property: '#a78bfa' };
const GROUP_ORDER = ['all', 'violent', 'vehicle', 'property'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1d27', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#fff', fontSize: 12, margin: '0 0 4px', fontWeight: 700 }}>{label} from nearest station</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill, fontSize: 12, margin: '2px 0 0', fontWeight: 600 }}>
          {p.name}: {p.value.toFixed(2)}×
        </p>
      ))}
    </div>
  );
};

/** groups: { all: {label, bands:[{band, concentration_ratio}...]}, violent: {...}, ... } */
export default function TransitConcentrationChart({ groups, bands }) {
  if (!groups || !bands?.length) return null;

  const data = bands.map((band, i) => {
    const row = { band };
    GROUP_ORDER.forEach((g) => { row[g] = groups[g]?.bands?.[i]?.concentration_ratio ?? 0; });
    return row;
  });

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Crime concentration by distance to nearest Metro rail station
      </p>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 18, maxWidth: 760 }}>
        Ratio of (share of crime in this band) to (share of population living this close to a station). 1.0× (dashed line) means crime exactly tracks where people live — above it means crime is over-represented near transit beyond population alone.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }} barGap={3} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
          <XAxis dataKey="band" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}×`} width={34} />
          <ReferenceLine y={1} stroke={MUTED} strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 10 }}
            formatter={(value) => <span style={{ color: MUTED }}>{value}</span>}
          />
          {GROUP_ORDER.map((g) => (
            <Bar key={g} dataKey={g} name={groups[g]?.label || g} fill={GROUP_COLOR[g]} radius={[3, 3, 0, 0]} maxBarSize={22} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
