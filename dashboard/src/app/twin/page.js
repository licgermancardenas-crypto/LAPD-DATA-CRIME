'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Boxes, X } from 'lucide-react';

const Twin3DMap = dynamic(() => import('../../components/Twin3DMap'), {
  ssr: false,
  loading: () => null,
});

const C = {
  bg: '#010d1f',
  border: 'rgba(56,189,248,.25)',
  accent: '#38bdf8',
};

const HEADER_H = 58;

export default function TwinPage() {
  const [clickInfo, setClickInfo] = useState(null);

  const onClickInfo = useCallback((info) => setClickInfo(info), []);

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: C.bg,
      fontFamily: "'JetBrains Mono','Courier New',monospace", color: '#fff',
    }}>
      <div style={{ position: 'absolute', top: HEADER_H, left: 0, right: 0, bottom: 0 }}>
        <Twin3DMap onClickInfo={onClickInfo} />
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H, zIndex: 1000,
        background: 'rgba(1,8,22,.90)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center',
        boxShadow: '0 4px 40px rgba(0,0,0,.7)',
      }}>
        <Link href="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 14px', borderRight: `1px solid ${C.border}`,
          textDecoration: 'none', color: '#7dd3fc', flexShrink: 0, height: '100%',
        }}>
          <ArrowLeft size={14} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em' }}>INICIO</span>
        </Link>

        <div style={{ padding: '0 14px', borderRight: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, flexShrink: 0,
              background: 'linear-gradient(135deg,#1d4ed8,#0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(14,165,233,.35)',
            }}>
              <Boxes size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#67e8f9', letterSpacing: '.12em', lineHeight: 1 }}>
                GEMELO DIGITAL 3D
              </div>
              <div style={{ fontSize: 9, color: '#7dd3fc', letterSpacing: '.12em', marginTop: 2, fontWeight: 600 }}>
                L.A.I.S.S. // CITY TWIN
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 14px', borderLeft: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ fontSize: 10, color: '#34d399', letterSpacing: '.12em', fontWeight: 800 }}>LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Click info panel ─────────────────────────────────────────────── */}
      {clickInfo && (
        <div style={{
          position: 'absolute', top: HEADER_H + 12, right: 12, zIndex: 1000,
          width: 260, background: 'linear-gradient(160deg,rgba(2,8,22,.96),rgba(1,5,15,.98))',
          backdropFilter: 'blur(22px)', border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '14px 16px', boxShadow: '0 0 40px rgba(0,0,0,.75)',
        }}>
          <button onClick={() => setClickInfo(null)} style={{
            position: 'absolute', top: 10, right: 10, background: 'transparent',
            border: 'none', color: '#7dd3fc', cursor: 'pointer',
          }}><X size={14} /></button>
          <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, letterSpacing: '.1em', marginBottom: 8 }}>
            ◈ DIVISIÓN LAPD
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{clickInfo.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
            <div>Total crímenes: <b style={{ color: '#fff' }}>{Number(clickInfo.total).toLocaleString()}</b></div>
            <div>Tasa de clearance: <b style={{ color: '#fff' }}>{Number(clickInfo.clearance).toFixed(1)}%</b></div>
            <div>Categoría top: <b style={{ color: '#fff' }}>{clickInfo.topCategory}</b></div>
          </div>
        </div>
      )}
    </div>
  );
}
