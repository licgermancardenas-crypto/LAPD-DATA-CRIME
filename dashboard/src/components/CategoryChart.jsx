'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

function getCategoryColor(index, total) {
  if (index === 0) return '#00f3ff'; // Top crime: electric cyan
  // Fuchsia (#d946ef) → deep indigo (#3b0764) as rank descends
  const t = total > 2 ? (index - 1) / (total - 2) : 0;
  return `rgb(${Math.round(217+(59-217)*t)},${Math.round(70+(7-70)*t)},${Math.round(239+(100-239)*t)})`;
}

function PartToggle({ value, onChange }) {
  const opts = [
    { v: 'all', label: 'Todos' },
    { v: 'p1',  label: 'Part 1 — Graves' },
    { v: 'p2',  label: 'Part 2 — Menores' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: value === o.v ? 700 : 400,
          border: value === o.v
            ? (o.v === 'p1' ? '1px solid rgba(224,136,58,.5)' : o.v === 'p2' ? '1px solid rgba(79,142,247,.5)' : '1px solid rgba(255,255,255,.2)')
            : '1px solid #2a2d3a',
          background: value === o.v
            ? (o.v === 'p1' ? 'rgba(224,136,58,.12)' : o.v === 'p2' ? 'rgba(79,142,247,.12)' : 'rgba(255,255,255,.05)')
            : '#1a1d27',
          color: value === o.v
            ? (o.v === 'p1' ? '#e0883a' : o.v === 'p2' ? '#4f8ef7' : '#e8eaf0')
            : '#7b82a0',
          cursor: 'pointer', transition: 'all .15s',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#e8eaf0', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{d.category}</p>
      <p style={{ color: '#7b82a0', fontSize: 11, marginBottom: 4 }}>
        {d.part === 'p1' ? '🔴 Part 1 — Delito Grave (FBI UCR)' : '🔵 Part 2 — Delito Menor'}
      </p>
      <p style={{ color: '#4f8ef7', fontSize: 12 }}>Crímenes: <strong>{d.crimes.toLocaleString()}</strong></p>
      <p style={{ color: '#7b82a0', fontSize: 12 }}>Participación: <strong>{parseFloat(d.share_pct ?? 0).toFixed(1)}%</strong></p>
      <p style={{ color: '#3ecf8e', fontSize: 12 }}>Esclarecimiento: <strong>{parseFloat(d.clearance_rate ?? 0).toFixed(1)}%</strong></p>
      {d.is_violent && <p style={{ color: '#e05252', fontSize: 11, marginTop: 4 }}>Crimen violento</p>}
      <p style={{ color: '#7c5cbf', fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
        Click para filtrar dashboard por esta categoría
      </p>
    </div>
  );
};

export default function CategoryChart({ data, activePart: externalPart, filters, onFilter }) {
  const [localPart, setLocalPart] = useState('all');
  const activePart = externalPart ?? localPart;
  const setActivePart = externalPart === undefined ? setLocalPart : () => {};

  if (!data?.length) return null;

  const activeCategory = filters?.category ?? null;
  const isFiltered = !!filters?.area;

  const filtered = activePart === 'all' ? data : data.filter(d => d.part === activePart);
  const sorted   = [...filtered].sort((a, b) => b.crimes - a.crimes);

  const handleClick = (entry) => {
    if (!onFilter) return;
    const cat = entry?.category;
    onFilter('category', activeCategory === cat ? null : cat);
  };

  const p1count = data.filter(d => d.part === 'p1').length;
  const p2count = data.filter(d => d.part === 'p2').length;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p className="section-title">Ranking de Delitos por Categoría</p>
          <p className="section-sub">
            Jerarquía criminal por frecuencia: el delito #1 (cian) define la prioridad operacional. Los delitos patrimoniales superan en volumen pero tienen tasas de resolución dramáticamente menores que los violentos.
            {isFiltered && <span style={{ color: '#00f3ff' }}> · Filtrado por área</span>}
          </p>
        </div>
        {externalPart === undefined && <PartToggle value={localPart} onChange={setLocalPart} />}
      </div>

      {/* Color legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#7b82a0' }}>
          <div style={{ width: 10, height: 3, borderRadius: 2, background: '#00f3ff' }} />
          <span>Top delito</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#7b82a0' }}>
          <div style={{ width: 22, height: 3, borderRadius: 2, background: 'linear-gradient(to right, #d946ef, #3b0764)' }} />
          <span>Resto — fucsia → índigo por rango</span>
        </div>
        {activeCategory && (
          <span style={{ fontSize: 10, color: '#9098b8' }}>
            Activo: <strong style={{ color: '#00f3ff' }}>{activeCategory}</strong>
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 28)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, left: 168, bottom: 5 }}
          onClick={(e) => e?.activePayload && handleClick(e.activePayload[0]?.payload)}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 11 }} axisLine={false}
            tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="category" tick={{ fill: '#e8eaf0', fontSize: 11 }}
            axisLine={false} tickLine={false} width={166} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="crimes" radius={[0, 4, 4, 0]} cursor={onFilter ? 'pointer' : 'default'}>
            {sorted.map((entry, i) => {
              const base = getCategoryColor(i, sorted.length);
              const isActive = activeCategory === entry.category;
              const isDimmed = activeCategory && !isActive;
              return (
                <Cell
                  key={i}
                  fill={base}
                  opacity={isDimmed ? 0.18 : isActive ? 1 : i === 0 ? 1 : 0.85}
                  stroke={isActive ? '#fff' : 'none'}
                  strokeWidth={isActive ? 1.5 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
