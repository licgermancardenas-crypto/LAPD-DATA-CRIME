'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

// ── Shared tooltip style ────────────────────────────────────────────────────
const tip = (rows) => (
  <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px', minWidth: 200 }}>
    {rows}
  </div>
);

// ── Age chart ───────────────────────────────────────────────────────────────
function AgeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tip(<>
    <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 6 }}>{label}</p>
    <p style={{ color: '#4f8ef7', fontSize: 13, margin: '2px 0' }}>Total: <strong>{d.crimes.toLocaleString()}</strong> ({d.share_pct}%)</p>
    <p style={{ color: '#e05252', fontSize: 13, margin: '2px 0' }}>Violent: <strong>{d.violent.toLocaleString()}</strong> ({d.violent_pct}%)</p>
  </>);
}

// ── Descent chart ───────────────────────────────────────────────────────────
function DescentTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tip(<>
    <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 6 }}>{label}</p>
    <p style={{ color: '#4f8ef7', fontSize: 13, margin: '2px 0' }}>Total victims: <strong>{d.crimes.toLocaleString()}</strong></p>
    <p style={{ color: '#e05252', fontSize: 13, margin: '2px 0' }}>Violent: <strong>{d.violent.toLocaleString()}</strong> ({d.violent_pct}% of total)</p>
  </>);
}

// ── Crime × Sex chart ────────────────────────────────────────────────────────
function CatSexTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tip(<>
    <p style={{ color: '#7b82a0', fontSize: 12, marginBottom: 6 }}>{label}</p>
    <p style={{ color: '#e878a0', fontSize: 13, margin: '2px 0' }}>Female: <strong>{d.Female.toLocaleString()}</strong> ({d.female_pct}%)</p>
    <p style={{ color: '#4f8ef7', fontSize: 13, margin: '2px 0' }}>Male: <strong>{d.Male.toLocaleString()}</strong> ({(100 - d.female_pct).toFixed(1)}%)</p>
    <p style={{ color: '#7b82a0', fontSize: 12, margin: '4px 0 0' }}>Total: {d.total.toLocaleString()}</p>
  </>);
}

// ── Descent color scale (blue → orange gradient by violent %) ───────────────
const DESCENT_COLORS = {
  'Hispanic/Latino': '#e0883a',
  'Black':           '#e05252',
  'White':           '#4f8ef7',
  'Asian':           '#3ecf8e',
  'Other':           '#7c5cbf',
  'Pacific Islander':'#e0c066',
};

export default function VictimChart({ data }) {
  if (!data) return null;
  const { by_sex, by_age, by_descent, by_cat_sex } = data;

  const male   = by_sex.find(s => s.sex === 'Male');
  const female = by_sex.find(s => s.sex === 'Female');

  // Short labels for age axis
  const ageData = by_age.map(d => ({
    ...d,
    label: d.age.replace('Adult (', '').replace(')', '').replace('Middle-Aged ', '').replace('Young Adult ', 'Young ').replace('Juvenile ', 'Juvenile '),
  }));

  // Shorten category names for readability
  const catData = by_cat_sex
    .map(d => ({
      ...d,
      label: d.category
        .replace('Violent - ', '')
        .replace('Property - ', '')
        .replace('Crimes Against Children', 'vs Children')
        .replace('Human Trafficking', 'H. Trafficking')
        .replace('Identity / Fraud', 'Identity/Fraud')
        .replace('Drug Offense', 'Drug'),
    }))
    .slice(0, 14); // top 14 by total

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Sex summary row ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Male Victims',   value: `${male?.share_pct}%`,   sub: `${male?.crimes.toLocaleString()} total · ${male?.violent_pct}% violent`,   color: '#4f8ef7' },
          { label: 'Female Victims', value: `${female?.share_pct}%`, sub: `${female?.crimes.toLocaleString()} total · ${female?.violent_pct}% violent`, color: '#e878a0' },
          { label: 'F > M Violent',  value: `+${(female?.violent_pct - male?.violent_pct).toFixed(1)}pp`, sub: 'Female victims face more violence per capita', color: '#e05252' },
        ].map(c => (
          <div key={c.label} style={{
            background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10,
            padding: '14px 16px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 10, color: '#7b82a0', marginBottom: 4, letterSpacing: '.06em' }}>{c.label.toUpperCase()}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: c.color, marginBottom: 4 }}>{c.value}</p>
            <p style={{ fontSize: 11, color: '#7b82a0', lineHeight: 1.4 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Age distribution ─────────────────────────────────────────────── */}
      <div className="card">
        <p className="section-title">Victimization by Age Group</p>
        <p className="section-sub">Total vs violent incidents — note juvenile violent % spike (66%)</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ageData} margin={{ top: 16, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="label" tick={{ fill: '#7b82a0', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<AgeTooltip />} />
            <Bar dataKey="crimes"  name="Total"   fill="#4f8ef7" opacity={0.6} radius={[3,3,0,0]} />
            <Bar dataKey="violent" name="Violent" fill="#e05252" opacity={0.85} radius={[3,3,0,0]}>
              <LabelList
                dataKey="violent_pct"
                position="top"
                formatter={v => `${v}%`}
                style={{ fontSize: 9, fill: '#7b82a0' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Descent breakdown ────────────────────────────────────────────── */}
      <div className="card">
        <p className="section-title">Victim Profile by Ethnic Group</p>
        <p className="section-sub">Total victims and violent crime exposure — excludes "Unknown" records</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={by_descent} layout="vertical" margin={{ top: 4, right: 60, left: 90, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="descent" tick={{ fill: '#c0c4d4', fontSize: 12 }} axisLine={false} tickLine={false} width={88} />
            <Tooltip content={<DescentTooltip />} />
            <Bar dataKey="crimes" radius={[0,3,3,0]}>
              {by_descent.map(d => (
                <Cell key={d.descent} fill={DESCENT_COLORS[d.descent] ?? '#7c5cbf'} opacity={0.55} />
              ))}
              <LabelList dataKey="violent_pct" position="right" formatter={v => `${v}% vio`} style={{ fontSize: 10, fill: '#7b82a0' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Crime type × Sex ─────────────────────────────────────────────── */}
      <div className="card">
        <p className="section-title">Crime Type × Victim Gender</p>
        <p className="section-sub">Female share per crime category — reveals gendered crime patterns (top 14 by volume)</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={catData} layout="vertical" margin={{ top: 4, right: 70, left: 112, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#c0c4d4', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip content={<CatSexTooltip />} />
            <Bar dataKey="Female" stackId="a" fill="#e878a0" opacity={0.85} />
            <Bar dataKey="Male"   stackId="a" fill="#4f8ef7" opacity={0.75} radius={[0,3,3,0]}>
              <LabelList dataKey="female_pct" position="right" formatter={v => `${v}% F`} style={{ fontSize: 9, fill: '#7b82a0' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
          {[['#e878a0', 'Female'], ['#4f8ef7', 'Male']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7b82a0' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
