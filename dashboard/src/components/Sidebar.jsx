'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MAIN_NAV = [
  {
    id: 'dashboard',
    label: 'Panel Principal',
    icon: '⊞',
    href: '/',
    sub: [
      { id: 'overview',   label: 'Resumen',     href: '/#overview' },
      { id: 'geographic', label: 'Geografía',   href: '/#geographic' },
      { id: 'temporal',   label: 'Temporal',    href: '/#temporal' },
      { id: 'categories', label: 'Categorías',  href: '/#categories' },
      { id: 'external',   label: 'Contexto',    href: '/#external' },
    ],
  },
  {
    id: 'geo',
    label: 'Análisis Geográfico',
    icon: '◎',
    href: '/geo',
    sub: [
      { id: 'divisions',     label: 'Mapa Divisiones',   icon: '🗺️' },
      { id: 'per1000',       label: 'Delitos / 1.000',   icon: '👥' },
      { id: 'vulnerability', label: 'Vulnerabilidad',    icon: '⚠️' },
      { id: 'neighborhoods', label: 'Barrios',            icon: '🏘️' },
      { id: 'mortality',     label: 'Estab. Comercial',  icon: '📉' },
      { id: 'business',      label: 'Comercio y Crimen', icon: '🏪' },
    ],
  },
];

const DATA_ITEMS = [
  { label: 'LAPD Open Data', icon: '📋', desc: '2020–2024' },
  { label: 'Census ACS',     icon: '🏘️', desc: '5-Year Estimates' },
  { label: 'Open-Meteo',     icon: '🌦️', desc: 'Weather & Climate' },
  { label: 'BLS',            icon: '💼', desc: 'Unemployment' },
];

const C = {
  sidebar:  '#080a12',
  border:   '#161926',
  active:   'rgba(79,142,247,.11)',
  hover:    'rgba(255,255,255,.035)',
  accent:   '#4f8ef7',
  text:     '#e8eaf0',
  muted:    '#7b82a0',
  dim:      '#3d4255',
  dimmer:   '#252840',
};

export default function Sidebar({ activeSection = null, geoActiveTab = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isHome = pathname === '/' || pathname === '';
  const isGeo  = pathname === '/geo';

  const W = collapsed ? 60 : 244;

  return (
    <aside style={{
      width: W, flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      background: C.sidebar, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width .2s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden', zIndex: 40,
    }}>

      {/* ── Brand ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '18px 0' : '18px 14px 18px 18px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#4f8ef7 0%,#7c5cbf 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 16px rgba(79,142,247,.2)',
          }}>🏛️</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>LAPD</div>
              <div style={{ fontSize: 10, color: C.dim, whiteSpace: 'nowrap', marginTop: 1 }}>Crime Analytics</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            style={{
              width: 22, height: 22, borderRadius: 8, border: `1px solid ${C.border}`,
              background: '#0f1117', color: C.dim, cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >‹</button>
        )}
      </div>

      {/* ── Expand button (collapsed mode) ── */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{
            width: '100%', padding: '8px 0', border: 'none', borderBottom: `1px solid ${C.border}`,
            background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >›</button>
      )}

      {/* ── Nav scroll area ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', padding: '10px 0' }}>

        {/* Section label */}
        {!collapsed && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.dimmer, letterSpacing: '.14em',
            textTransform: 'uppercase', padding: '8px 18px 5px',
          }}>Menú Principal</div>
        )}

        {/* Main nav items */}
        {MAIN_NAV.map(item => {
          const active = item.id === 'dashboard' ? isHome : isGeo;
          return (
            <div key={item.id}>
              <NavItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={active}
                collapsed={collapsed}
              />
              {!collapsed && active && (
                <div style={{ marginBottom: 4 }}>
                  {item.sub.map(sub => {
                    const subActive = item.id === 'dashboard'
                      ? activeSection === sub.id
                      : geoActiveTab === sub.id;
                    return (
                      <SubItem
                        key={sub.id}
                        href={sub.href || item.href}
                        label={sub.label}
                        icon={sub.icon}
                        active={subActive}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div style={{ height: 1, background: C.border, margin: '10px 0' }} />

        {/* Data sources section */}
        {!collapsed && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.dimmer, letterSpacing: '.14em',
            textTransform: 'uppercase', padding: '4px 18px 5px',
          }}>Fuentes de Datos</div>
        )}

        {DATA_ITEMS.map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '8px 0' : '7px 14px 7px 18px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: C.dim, fontSize: 11,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, opacity: .6 }}>{item.icon}</span>
            {!collapsed && (
              <div>
                <div style={{ color: '#3d4560', fontSize: 11, whiteSpace: 'nowrap' }}>{item.label}</div>
              </div>
            )}
          </div>
        ))}

      </div>

      {/* ── Footer profile ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {!collapsed ? (
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#1a1d27',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>🏛️</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap' }}>LAPD Open Data</div>
              <div style={{ fontSize: 10, color: C.dim, whiteSpace: 'nowrap' }}>Los Angeles · 2020-2024</div>
            </div>
            <div style={{
              marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: C.accent,
              background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.2)',
              borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
            }}>LIVE</div>
          </div>
        ) : (
          <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, background: '#1a1d27',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>🏛️</div>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── Helper components ─────────────────────────────────────────────────────── */

function NavItem({ href, icon, label, active, collapsed }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 11,
        padding: collapsed ? '11px 0' : '10px 14px 10px 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        textDecoration: 'none',
        background: active ? C.active : 'transparent',
        borderLeft: active ? `3px solid ${C.accent}` : '3px solid transparent',
        color: active ? C.text : C.muted,
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'background .12s, color .12s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.hover; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        fontSize: 16, flexShrink: 0, lineHeight: 1,
        opacity: active ? 1 : .55,
        transition: 'opacity .12s',
      }}>{icon}</span>
      {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
    </Link>
  );
}

const C_active  = 'rgba(79,142,247,.07)';
const C_accent  = '#4f8ef7';

function SubItem({ href, label, icon, active }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px 6px 40px',
        textDecoration: 'none',
        background: active ? C_active : 'transparent',
        color: active ? '#98b4f7' : '#454a65',
        fontSize: 12, fontWeight: active ? 600 : 400,
        borderLeft: '3px solid transparent',
        transition: 'color .12s, background .12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#7b82a0'; }}
      onMouseLeave={e => { e.currentTarget.style.color = active ? '#98b4f7' : '#454a65'; }}
    >
      {icon ? (
        <span style={{ fontSize: 12, opacity: active ? .9 : .5 }}>{icon}</span>
      ) : (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
          background: active ? C_accent : '#252840',
        }} />
      )}
      {label}
    </a>
  );
}
