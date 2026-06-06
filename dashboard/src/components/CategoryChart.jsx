'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

const PART_COLORS = {
  p1: { violent: '#e05252', nonViolent: '#e0883a' },
  p2: { violent: '#7c5cbf', nonViolent: '#4f8ef7' },
};

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
      <p style={{ color: '#7b82a0', fontSize: 12 }}>Participación: <strong>{d.share_pct}%</strong></p>
      <p style={{ color: '#3ecf8e', fontSize: 12 }}>Esclarecimiento: <strong>{d.clearance_rate}%</strong></p>
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
          <p className="section-title">Crímenes por Categoría</p>
          <p className="section-sub">
            {p1count} Part 1 (graves FBI) · {p2count} Part 2 (menores)
            {isFiltered && <span style={{ color: '#4f8ef7' }}> · Filtrado por área seleccionada</span>}
            {onFilter && <span style={{ color: '#7c5cbf' }}> · Click en barra para filtrar</span>}
          </p>
        </div>
        {externalPart === undefined && <PartToggle value={localPart} onChange={setLocalPart} />}
      </div>

      {/* Part legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        {activePart !== 'p2' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#7b82a0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05252' }} />Part 1 Violento
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0883a', marginLeft: 6 }} />Part 1 No-Violento
          </div>
        )}
        {activePart !== 'p1' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#7b82a0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c5cbf' }} />Part 2 Violento
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f8ef7', marginLeft: 6 }} />Part 2 No-Violento
          </div>
        )}
        {activeCategory && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c5cbf' }} />
            <span style={{ fontSize: 11, color: '#7c5cbf' }}>Seleccionado: <strong>{activeCategory}</strong></span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 28)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, left: 168, bottom: 5 }}
          onClick={(e) => e?.activePayload && handleClick(e.activePayload[0]?.payload)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#7b82a0', fontSize: 11 }} axisLine={false}
            tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="category" tick={{ fill: '#e8eaf0', fontSize: 11 }}
            axisLine={false} tickLine={false} width={166} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="crimes" radius={[0, 4, 4, 0]} cursor={onFilter ? 'pointer' : 'default'}>
            {sorted.map((entry, i) => {
              const pc = PART_COLORS[entry.part] ?? { violent: '#e05252', nonViolent: '#4f8ef7' };
              const base = entry.is_violent ? pc.violent : pc.nonViolent;
              const isActive = activeCategory === entry.category;
              const isDimmed = activeCategory && !isActive;
              return (
                <Cell
                  key={i}
                  fill={base}
                  opacity={isDimmed ? 0.25 : 0.85}
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
