'use client';

import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const DESCENT_ES = {
  'Hispanic/Latino':  'Hispano/Latino',
  'White':            'Blanco',
  'Black':             'Afroamericano',
  'Asian':            'Asiático',
  'Other':             'Otros',
  'Pacific Islander': 'Isleño Pacífico',
  'Unknown':          'Desconocido',
};

const AGE_ES = {
  'Juvenile (<18)':      'Menor de 18',
  'Young Adult (18-24)': 'Joven (18-24)',
  'Adult (25-34)':       'Adulto (25-34)',
  'Adult (35-49)':       'Adulto (35-49)',
  'Middle-Aged (50-64)': 'Mediana edad (50-64)',
  'Senior (65+)':        'Mayor (65+)',
};

const TYPE_ES = {
  Felony: 'Felonía', Misdemeanor: 'Falta', Infraction: 'Infracción', Other: 'Otro',
};

const CYAN    = '#00f3ff';
const MAGENTA = '#d946ef';
const RANK_CYBER = ['#00f3ff', '#d946ef', '#a21caf', '#6d28d9', '#4c1d95', '#3b0764'];

const tipBox = (children) => (
  <div style={{ background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
    {children}
  </div>
);

function MonthlyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tipBox(<>
    <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</p>
    <p style={{ color: CYAN, fontSize: 13, margin: '2px 0' }}>Arrestos: <strong>{d.arrests.toLocaleString()}</strong></p>
    <p style={{ color: MAGENTA, fontSize: 12, margin: '2px 0' }}>Media 3M: <strong>{d.rolling3.toLocaleString()}</strong></p>
  </>);
}

function DivisionTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tipBox(<>
    <p style={{ color: '#e8eaf0', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{d.name}</p>
    <p style={{ color: CYAN, fontSize: 12 }}>Arrestos: <strong>{d.arrests.toLocaleString()}</strong></p>
    {d.arrests_per_1k_addr != null && (
      <p style={{ color: MAGENTA, fontSize: 12 }}>Por 1 000 direcciones activas: <strong>{d.arrests_per_1k_addr.toLocaleString()}</strong></p>
    )}
    {d.active_addresses != null && (
      <p style={{ color: '#7b82a0', fontSize: 11, marginTop: 4 }}>Direcciones activas: {d.active_addresses.toLocaleString()}</p>
    )}
  </>);
}

function RankTip({ active, payload, labelMap }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return tipBox(<>
    <p style={{ color: '#c0c4d4', fontSize: 12, marginBottom: 6 }}>{labelMap?.[d.label] ?? d.label}</p>
    <p style={{ color: CYAN, fontSize: 13 }}>Arrestos: <strong>{d.arrests.toLocaleString()}</strong></p>
    {d.share_pct != null && <p style={{ color: '#7b82a0', fontSize: 11 }}>{d.share_pct}% del total</p>}
  </>);
}

function KpiMini({ label, value, sub, color, border }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #08091a 0%, rgba(13,18,36,0.93) 50%, #08091a 100%)',
      borderRadius: 10, padding: '14px 16px', textAlign: 'center',
      border: `1px solid ${border ?? 'rgba(148,163,184,0.07)'}`,
      transition: 'box-shadow 0.3s ease',
    }}>
      <p style={{ fontSize: 10, color: '#7b82a0', marginBottom: 4, letterSpacing: '.06em' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#7b82a0', lineHeight: 1.55, fontFamily: 'Inter,system-ui,sans-serif' }}>{sub}</p>
    </div>
  );
}

function RankBar({ title, sub, data, labelMap, height = 200 }) {
  if (!data?.length) return null;
  const chartData = data.map(d => ({ ...d, label: d.label }));
  return (
    <div className="card">
      <p className="section-title">{title}</p>
      {sub && <p className="section-sub">{sub}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 60, left: 110, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false}
            tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <YAxis type="category" dataKey="label" tick={{ fill: '#c0c4d4', fontSize: 11 }}
            tickFormatter={v => labelMap?.[v] ?? v}
            axisLine={false} tickLine={false} width={108} />
          <Tooltip content={<RankTip labelMap={labelMap} />} />
          <Bar dataKey="arrests" radius={[0, 4, 4, 0]}>
            {chartData.map((d, i) => (
              <Cell key={d.label} fill={RANK_CYBER[i] ?? '#3b0764'} opacity={i === 0 ? 1 : 0.82} />
            ))}
            {chartData[0]?.share_pct != null && (
              <LabelList dataKey="share_pct" position="right"
                formatter={v => `${v}%`} style={{ fontSize: 10, fill: '#7b82a0' }} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ArrestChart({ data }) {
  if (!data) return null;
  const { summary, monthly, division, demographics, categories } = data;
  if (!summary) return null;

  const felonyShare = summary.felony_pct ?? 0;
  const sexData = demographics?.by_sex ?? [];
  const male = sexData.find(s => s.label === 'Male');
  const female = sexData.find(s => s.label === 'Female');
  const malePct = male && (male.arrests + (female?.arrests ?? 0))
    ? (male.arrests / (male.arrests + female.arrests) * 100).toFixed(1)
    : null;

  const divSorted = [...(division ?? [])].sort((a, b) => b.arrests - a.arrests).slice(0, 21);

  const descentData = (demographics?.by_descent_group ?? []).map(d => ({ ...d, label: d.label }));
  const ageData = (demographics?.by_age_group ?? []).map(d => ({ ...d, label: d.label }));
  const typeData = (demographics?.by_arrest_type ?? []).map(d => ({ ...d, label: d.label }));

  const ticks = (monthly ?? []).filter(d => d.month === 1).map(d => d.period);

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiMini
          label="Total de Arrestos"
          value={summary.total_arrests.toLocaleString()}
          sub="LAPD, 2020 – jun. 2025"
          color={CYAN}
          border="rgba(76,201,240,.2)"
        />
        <KpiMini
          label="Arrestos por Felonía"
          value={`${felonyShare}%`}
          sub={`vs. ${summary.misdemeanor_pct}% por falta menor`}
          color={MAGENTA}
          border="rgba(247,37,133,.2)"
        />
        <KpiMini
          label={`Variación ${summary.latest_full_year - 1}→${summary.latest_full_year}`}
          value={`${summary.yoy_pct > 0 ? '+' : ''}${summary.yoy_pct}%`}
          sub={`${summary.arrests_prev_year.toLocaleString()} → ${summary.arrests_latest_year.toLocaleString()} (años completos)`}
          color={summary.yoy_pct > 0 ? '#e05252' : '#3ecf8e'}
          border="rgba(224,82,82,.2)"
        />
        <KpiMini
          label="Brecha de Género"
          value={malePct ? `${malePct}%` : '—'}
          sub="de los arrestados son hombres"
          color="#7c5cbf"
          border="rgba(124,92,191,.2)"
        />
      </div>

      {summary.ytd_year && (
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.2)',
          fontSize: 11, color: '#a07820', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span>⚠</span>
          <span>
            <strong style={{ color: '#fbbf24' }}>{summary.ytd_year} parcial</strong> — solo hasta el mes {summary.ytd_through_month}
            {' '}({summary.ytd_arrests.toLocaleString()} arrestos). Excluido del cálculo interanual para evitar comparar un año completo contra uno parcial.
          </span>
        </div>
      )}

      {/* ── Monthly trend ── */}
      <div className="card">
        <p className="section-title">Evolución Mensual de Arrestos</p>
        <p className="section-sub">
          Volumen mensual de arrestos LAPD con media móvil trimestral (línea cian) para filtrar ruido de calendario.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={monthly} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey="period" ticks={ticks} tickFormatter={v => v.slice(0, 4)}
              tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#2a2d3a' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
            <Tooltip content={<MonthlyTip />} />
            <Bar dataKey="arrests" name="Arrestos" fill={CYAN} opacity={0.8} radius={[2, 2, 0, 0]} />
            <Line dataKey="rolling3" name="Media 3M" stroke={MAGENTA} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Division ranking ── */}
      <div className="card">
        <p className="section-title">Arrestos por División — Normalizado por Densidad</p>
        <p className="section-sub">
          Central encabeza el ranking absoluto pero con apenas 14 730 direcciones activas — la tasa por 1 000 direcciones revela la presión policial real por unidad de territorio habitado, no solo el volumen bruto.
        </p>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={divSorted} layout="vertical" margin={{ top: 5, right: 50, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 11 }} axisLine={false}
              tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e8eaf0', fontSize: 12 }}
              axisLine={false} tickLine={false} width={78} />
            <Tooltip content={<DivisionTip />} />
            <Bar dataKey="arrests" radius={[0, 4, 4, 0]}>
              {divSorted.map((d, i) => (
                <Cell key={d.name} fill={CYAN} opacity={0.3 + 0.55 * (1 - i / divSorted.length)} />
              ))}
              <LabelList dataKey="arrests_per_1k_addr" position="right"
                formatter={v => v != null ? `${v}/1k` : ''} style={{ fontSize: 10, fill: '#7b82a0' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Demographics grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <RankBar
          title="Por Origen Étnico"
          sub="Distribución de arrestados por grupo de ascendencia."
          data={descentData}
          labelMap={DESCENT_ES}
        />
        <RankBar
          title="Por Tipo de Cargo"
          sub="Felonía vs. falta menor vs. infracción."
          data={typeData}
          labelMap={TYPE_ES}
        />
      </div>
      <RankBar
        title="Por Grupo Etario"
        sub="Concentración de arrestos por rango de edad — el segmento adulto 25-49 domina el volumen."
        data={ageData}
        labelMap={AGE_ES}
        height={220}
      />

      {/* ── Top charge categories ── */}
      <div className="card">
        <p className="section-title">Top 20 Cargos por Categoría</p>
        <p className="section-sub">
          Agresión agravada y violaciones varias encabezan el volumen — DUI y narcóticos completan el top 5.
        </p>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 60, left: 150, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 10 }} axisLine={false}
              tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <YAxis type="category" dataKey="category" tick={{ fill: '#c0c4d4', fontSize: 11 }}
              axisLine={false} tickLine={false} width={146} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return tipBox(<>
                <p style={{ color: '#e8eaf0', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{d.category}</p>
                <p style={{ color: CYAN, fontSize: 12 }}>Arrestos: <strong>{d.arrests.toLocaleString()}</strong></p>
                <p style={{ color: '#7b82a0', fontSize: 11 }}>{d.share_pct}% del total</p>
              </>);
            }} />
            <Bar dataKey="arrests" fill={MAGENTA} opacity={0.82} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
