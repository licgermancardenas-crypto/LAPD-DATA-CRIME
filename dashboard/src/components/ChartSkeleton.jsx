'use client'

import { useState, useEffect } from 'react';

const BARS = [55, 80, 38, 92, 64, 76, 44, 87, 58, 72, 48, 82];

const MESSAGES = [
  '* [DESENCRIPTANDO PAQUETES DE DATOS SEGUROS...]',
  '* [INDEXANDO NODOS DE GEOLOCALIZACIÓN...]',
  '* [SINCRONIZANDO REGISTROS DE INCIDENTES...]',
  '* [PROCESANDO MATRIZ TEMPORAL DE DELITOS...]',
  '* [CARGANDO CAPAS DE ANÁLISIS TÁCTICO LAPD...]',
  '* [VALIDANDO INTEGRIDAD DEL DATASET 2020-2024...]',
];

export default function ChartSkeleton({ visible }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 850);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(6,8,16,.91)',
        borderRadius: 12,
        opacity: visible ? 1 : 0,
        transition: 'opacity 280ms ease',
        pointerEvents: visible ? 'all' : 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 20px 14px',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      {/* GPU-accelerated scanline via transform:translateY */}
      <div className="tac-scanline" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="sk-shimmer" style={{ height: 13, width: '40%', borderRadius: 5 }} />
        <div className="sk-shimmer" style={{ height: 9,  width: '28%', borderRadius: 4 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {BARS.map((h, i) => (
          <div key={i} className="sk-shimmer" style={{
            flex: 1, height: `${h}%`, minHeight: 6,
            borderRadius: '3px 3px 0 0',
            animationDelay: `${i * 0.07}s`,
          }} />
        ))}
      </div>

      <div className="sk-shimmer" style={{ height: 2, borderRadius: 1, opacity: .4 }} />

      {/* Rotating micro-text terminal */}
      <p style={{
        fontSize: 9, fontFamily: 'monospace',
        color: 'rgba(0,243,255,.42)',
        letterSpacing: '.06em', lineHeight: 1.4, margin: 0,
        minHeight: 13,
      }}>
        {MESSAGES[msgIdx]}
      </p>
    </div>
  );
}
