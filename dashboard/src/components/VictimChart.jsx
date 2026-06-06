'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const DESCENT_ES = {
  'Hispanic/Latino': 'Hispano/Latino',
  'White':           'Blanco',
  'Black':           'Afroamericano',
  'Asian':           'Asiático',
  'Other':           'Otros',
  'Pacific Islander':'Isleño Pacífico',
  'Unknown':         'Desconocido',
};

const AGE_ES = {
  'Juvenile (<18)':      'Menor de 18',
  'Young Adult (18-24)': 'Joven (18-24)',
  'Adult (25-34)':       'Adulto (25-34)',
  'Adult (35-49)':       'Adulto (35-49)',
  'Middle-Aged (50-64)': 'Mediana edad (50-64)',
  'Senior (65+)':        'Mayor (65+)',
};

const MAGENTA = '#f72585';
const CYAN    = '#4cc9f0';
const TEAL    = '#00b4d8';
const VIOLET  = '#7c5cbf';
const GOLD    = '#e0c066';

const DESCENT_COLORS = {
  'Hispanic/Latino': MAGENTA,
  'White':           CYAN,
  'Black':           '#e05252',
  'Asian':           TEAL,
  'Other':           VIOLET,
  'Pacific Islander': GOLD,
};

const tipBox = (children) => (
  <div style={{ background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px', minWidth: 200 }}>
    {children}
  </div>
);

function AgeTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tipBox(<>
    <p style={{ color: '#c0c4d4', fontSize: 12, marginBottom: 6 }}>{AGE_ES[d.age] ?? d.age}</p>
    <p style={{ color: CYAN, fontSize: 13, margin: '2px 0' }}>Total: <strong>{d.crimes.toLocaleString()}</strong> ({parseFloat(d.share_pct ?? 0).toFixed(1)}%)</p>
    <p style={{ color: MAGENTA, fontSize: 13, margin: '2px 0' }}>Violentos: <strong>{d.violent.toLocaleString()}</strong> ({parseFloat(d.violent_pct ?? 0).toFixed(1)}%)</p>
    <p style={{ color: '#7b82a0', fontSize: 11, marginTop: 4 }}>
      Click para filtrar por este grupo etario
    </p>
  </>);
}

function DescentTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tipBox(<>
    <p style={{ color: '#c0c4d4', fontSize: 12, marginBottom: 6 }}>{DESCENT_ES[d.descent] ?? d.descent}</p>
    <p style={{ color: CYAN, fontSize: 13, margin: '2px 0' }}>Víctimas: <strong>{d.crimes.toLocaleString()}</strong></p>
    <p style={{ color: MAGENTA, fontSize: 13, margin: '2px 0' }}>Violentos: <strong>{d.violent.toLocaleString()}</strong> ({parseFloat(d.violent_pct ?? 0).toFixed(1)}%)</p>
  </>);
}

function CatSexTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tipBox(<>
    <p style={{ color: '#c0c4d4', fontSize: 12, marginBottom: 6 }}>{d.label}</p>
    <p style={{ color: MAGENTA, fontSize: 13, margin: '2px 0' }}>Femenino: <strong>{d.Female.toLocaleString()}</strong> ({parseFloat(d.female_pct ?? 0).toFixed(1)}%)</p>
    <p style={{ color: CYAN,    fontSize: 13, margin: '2px 0' }}>Masculino: <strong>{d.Male.toLocaleString()}</strong> ({(100 - parseFloat(d.female_pct ?? 0)).toFixed(1)}%)</p>
    <p style={{ color: '#7b82a0', fontSize: 12, marginTop: 4 }}>Total: {d.total.toLocaleString()}</p>
  </>);
}

function KpiMini({ label, value, sub, color, border }) {
  return (
    <div style={{
      background: '#0f1117', borderRadius: 10, padding: '14px 16px', textAlign: 'center',
      border: `1px solid ${border ?? '#2a2d3a'}`,
    }}>
      <p style={{ fontSize: 10, color: '#7b82a0', marginBottom: 4, letterSpacing: '.06em' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#7b82a0', lineHeight: 1.4 }}>{sub}</p>
    </div>
  );
}

export default function VictimChart({ data, filters, onFilter }) {
  if (!data) return null;
  const { by_sex, by_age, by_descent, by_cat_sex,
          no_victim_count, no_victim_pct, victim_count,
          _filtered, _filter_total } = data;

  const activeAge = filters?.ageGroup ?? null;
  const isFiltered = !!filters?.category;

  const male   = by_sex?.find(s => s.sex === 'Male');
  const female = by_sex?.find(s => s.sex === 'Female');
  const gapVio = female && male
    ? (female.violent_pct - male.violent_pct).toFixed(1)
    : '—';

  const descentData = (by_descent ?? []).map(d => ({
    ...d,
    label: DESCENT_ES[d.descent] ?? d.descent,
  }));

  const ageData = (by_age ?? []).map(d => ({
    ...d,
    label: AGE_ES[d.age] ?? d.age,
  }));

  const catData = (by_cat_sex ?? [])
    .map(d => ({
      ...d,
      label: d.category
        .replace('Violent - ', '')
        .replace('Property - ', '')
        .replace('Crimes Against Children', 'vs Menores')
        .replace('Human Trafficking', 'Trata de Personas')
        .replace('Identity / Fraud', 'Fraude/Identidad')
        .replace('Drug Offense', 'Drogas')
        .replace('Sex Offense', 'Delito Sexual')
        .replace('Domestic Violence', 'Violencia Doméstica'),
    }))
    .slice(0, 14);

  const handleAgeClick = (e) => {
    if (!onFilter) return;
    const entry = e?.activePayload?.[0]?.payload;
    if (!entry?.age) return;
    onFilter('ageGroup', activeAge === entry.age ? null : entry.age);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* Filter context banner */}
      {_filtered && (
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(79,142,247,.08)', border: '1px solid rgba(79,142,247,.2)',
          fontSize: 12, color: '#4f8ef7',
        }}>
          Datos filtrados por selección activa
          {_filter_total && ` · ${_filter_total.toLocaleString()} registros`}
          {isFiltered && <span style={{ color: '#7b82a0' }}> · categoría seleccionada</span>}
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiMini
          label="Víctimas Masculinas"
          value={`${parseFloat(male?.share_pct ?? 0).toFixed(1)}%`}
          sub={`${male?.crimes.toLocaleString() ?? '—'} · ${parseFloat(male?.violent_pct ?? 0).toFixed(1)}% violento`}
          color={CYAN}
          border="rgba(76,201,240,.2)"
        />
        <KpiMini
          label="Víctimas Femeninas"
          value={`${parseFloat(female?.share_pct ?? 0).toFixed(1)}%`}
          sub={`${female?.crimes.toLocaleString() ?? '—'} · ${parseFloat(female?.violent_pct ?? 0).toFixed(1)}% violento`}
          color={MAGENTA}
          border="rgba(247,37,133,.2)"
        />
        <KpiMini
          label="Brecha violencia F>M"
          value={`+${gapVio}pp`}
          sub="Las mujeres enfrentan más violencia per cápita"
          color="#e05252"
          border="rgba(224,82,82,.2)"
        />
        <KpiMini
          label="Sin datos de víctima"
          value={`${parseFloat(no_victim_pct ?? 0).toFixed(1)}%`}
          sub={`${no_victim_count?.toLocaleString()} delitos contra empresas/vehículos`}
          color={VIOLET}
          border="rgba(124,92,191,.2)"
        />
      </div>

      {/* ── Age distribution ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <p className="section-title">Victimización por Grupo Etario</p>
            <p className="section-sub">
              Solo el 73.2% tiene datos de víctima identificable · excluye edad≤0 (empresas/vehículos)
              {onFilter && <span style={{ color: '#7c5cbf' }}> · Click para filtrar</span>}
            </p>
          </div>
          {activeAge && (
            <div style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11,
              background: 'rgba(124,92,191,.15)', border: '1px solid rgba(124,92,191,.3)',
              color: '#7c5cbf', whiteSpace: 'nowrap',
            }}>
              {AGE_ES[activeAge] ?? activeAge}
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ageData} margin={{ top: 18, right: 20, left: 10, bottom: 4 }}
            onClick={handleAgeClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2030" />
            <XAxis dataKey="label" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<AgeTip />} />
            <Bar dataKey="crimes"  name="Total"    radius={[3,3,0,0]}
              cursor={onFilter ? 'pointer' : 'default'}>
              {ageData.map((entry, i) => {
                const isActive = activeAge === entry.age;
                const isDimmed = activeAge && !isActive;
                return <Cell key={i} fill={CYAN} opacity={isDimmed ? 0.15 : 0.55}
                  stroke={isActive ? CYAN : 'none'} strokeWidth={isActive ? 2 : 0} />;
              })}
            </Bar>
            <Bar dataKey="violent" name="Violento" radius={[3,3,0,0]}
              cursor={onFilter ? 'pointer' : 'default'}>
              {ageData.map((entry, i) => {
                const isActive = activeAge === entry.age;
                const isDimmed = activeAge && !isActive;
                return <Cell key={i} fill={MAGENTA} opacity={isDimmed ? 0.2 : 0.9}
                  stroke={isActive ? MAGENTA : 'none'} strokeWidth={isActive ? 2 : 0} />;
              })}
              <LabelList dataKey="violent_pct" position="top"
                formatter={v => `${parseFloat(v ?? 0).toFixed(1)}%`} style={{ fontSize: 9, fill: '#9b82c8' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
          {[[CYAN, 'Total'], [MAGENTA, 'Violentos']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7b82a0' }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Descent breakdown ── */}
      <div className="card">
        <p className="section-title">Perfil por Grupo Étnico</p>
        <p className="section-sub">
          Víctimas totales y tasa de crimen violento · excluye "Desconocido" ·
          Hispano/Latino y Afroamericano duplican la exposición violenta de Blancos
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={descentData} layout="vertical" margin={{ top: 4, right: 68, left: 110, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2030" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false}
              tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#c0c4d4', fontSize: 12 }}
              axisLine={false} tickLine={false} width={108} />
            <Tooltip content={<DescentTip />} />
            <Bar dataKey="crimes" radius={[0,4,4,0]}>
              {descentData.map(d => (
                <Cell key={d.descent} fill={DESCENT_COLORS[d.descent] ?? VIOLET} opacity={0.7} />
              ))}
              <LabelList dataKey="violent_pct" position="right"
                formatter={v => `${parseFloat(v ?? 0).toFixed(1)}% vio`} style={{ fontSize: 10, fill: '#7b82a0' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Crime type × Sex ── */}
      <div className="card">
        <p className="section-title">Tipo de Crimen × Género de Víctima</p>
        <p className="section-sub">
          Participación femenina por categoría — revela patrones de género en la criminalidad (top 14 por volumen)
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={catData} layout="vertical" margin={{ top: 4, right: 72, left: 116, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2030" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false}
              tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#c0c4d4', fontSize: 11 }}
              axisLine={false} tickLine={false} width={114} />
            <Tooltip content={<CatSexTip />} />
            <Bar dataKey="Female" stackId="a" fill={MAGENTA} opacity={0.85} />
            <Bar dataKey="Male"   stackId="a" fill={CYAN}    opacity={0.75} radius={[0,4,4,0]}>
              <LabelList dataKey="female_pct" position="right"
                formatter={v => `${parseFloat(v ?? 0).toFixed(1)}% F`} style={{ fontSize: 9, fill: '#7b82a0' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
          {[[MAGENTA, 'Femenino'], [CYAN, 'Masculino']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#7b82a0' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#3a3f55', marginTop: 10 }}>
          Nota: registros con vict_sex="Unknown" excluidos · edad≤0 excluida en preprocessing
        </p>
      </div>

    </div>
  );
}
