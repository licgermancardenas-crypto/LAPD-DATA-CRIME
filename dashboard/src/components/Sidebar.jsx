'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const MAIN_NAV = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '⊞',
    href: '/dashboard',
    sub: [
      { id: 'overview',   label: 'Overview',    href: '/dashboard#overview' },
      { id: 'geographic', label: 'Geography',   href: '/dashboard#geographic' },
      { id: 'temporal',   label: 'Temporal',    href: '/dashboard#temporal' },
      { id: 'categories', label: 'Categories',  href: '/dashboard#categories' },
      { id: 'victims',    label: 'Victims',     href: '/dashboard#victims' },
      { id: 'arrests',    label: 'Arrests',     href: '/dashboard#arrests' },
      { id: 'external',   label: 'Context',     href: '/dashboard#external' },
    ],
  },
  {
    id: 'geo',
    label: 'Geo Analysis',
    icon: '◎',
    href: '/geo',
    sub: [
      { id: 'divisions',      label: 'Division Map',      icon: '🗺️', href: '/geo#divisions' },
      { id: 'per1000',        label: 'Crimes / 1,000',    icon: '👥', href: '/geo#per1000' },
      { id: 'vulnerability',  label: 'Vulnerability',     icon: '⚠️', href: '/geo#vulnerability' },
      { id: 'neighborhoods',  label: 'Neighborhoods',     icon: '🏘️', href: '/geo#neighborhoods' },
      { id: 'mortality',      label: 'Biz Stability',     icon: '📉', href: '/geo#mortality' },
      { id: 'heatmap',        label: 'Heatmap',           icon: '🔥', href: '/geo#heatmap' },
      { id: 'business',       label: 'Biz & Crime',       icon: '🏪', href: '/geo#business' },
      { id: 'council-density',label: 'CD Density',        icon: '🏛️', href: '/geo#council-density' },
    ],
  },
  {
    id: 'osiris',
    label: 'OSINT Terminal',
    icon: '◈',
    href: '/osiris',
    sub: [],
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: '⊜',
    href: '/compare',
    sub: [],
  },
  {
    id: 'insights',
    label: 'Intelligence',
    icon: '◉',
    href: '/insights',
    sub: [
      { id: 'scale',         label: 'Scope & Scale',        href: '/insights#scale'        },
      { id: 'clearance',     label: 'Clearance Crisis',     href: '/insights#clearance'    },
      { id: 'geography',     label: 'Geography',            href: '/insights#geography'    },
      { id: 'categories',    label: 'Crime Categories',     href: '/insights#categories'   },
      { id: 'temporal',      label: 'Temporal Patterns',    href: '/insights#temporal'     },
      { id: 'victims',       label: 'Victim Demographics',  href: '/insights#victims'      },
      { id: 'neighborhoods', label: 'Neighborhood Risk',    href: '/insights#neighborhoods'},
      { id: 'arrests',       label: 'Arrest Patterns',      href: '/insights#arrests'      },
      { id: 'findings',      label: 'Key Findings',         href: '/insights#findings'     },
    ],
  },
  {
    id: 'glossary',
    label: 'Glossary',
    icon: '📖',
    href: '/glossary',
    sub: [
      { id: 'temporal',     label: 'Temporal Metrics',    href: '/glossary#temporal'    },
      { id: 'demographic',  label: 'Demographic Vars',    href: '/glossary#demographic' },
      { id: 'crime-code',   label: 'Crime Codes',         href: '/glossary#crime-code'  },
      { id: 'lapd-concept', label: 'LAPD Concepts',       href: '/glossary#lapd-concept'},
    ],
  },
];

const DATA_ITEMS = [
  { label: 'LAPD Open Data', icon: '📋', desc: '2020–2024' },
  { label: 'Census ACS',     icon: '🏘️', desc: '5-Year Estimates' },
  { label: 'Open-Meteo',     icon: '🌦️', desc: 'Weather API' },
  { label: 'BLS',            icon: '💼', desc: 'Unemployment' },
];

const C = {
  sidebar: '#080a12',
  border:  '#1e2235',
  active:  'rgba(79,142,247,.13)',
  hover:   'rgba(255,255,255,.045)',
  accent:  '#4f8ef7',
  text:    '#e8eaf0',
  navInactive: '#b0b7d0',
  muted:   '#7b82a0',
  dim:     '#4a5070',
  dimmer:  '#2a2e48',
};

export default function Sidebar({ activeSection = null, geoActiveTab = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  const isHome     = pathname === '/dashboard';
  const isGeo      = pathname === '/geo';
  const isOsiris   = pathname === '/osiris';
  const isCompare  = pathname === '/compare';
  const isInsights = pathname === '/insights';
  const isGlossary = pathname === '/glossary';

  // Auto-collapse on narrow screens
  useEffect(()=>{
    if(typeof window==='undefined') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial collapse state depends on window, unavailable during SSR; must be set post-mount to avoid hydration mismatch
    if(window.innerWidth < 768) setCollapsed(true);
    const handler=()=>{ if(window.innerWidth<768&&!collapsed) setCollapsed(true); };
    window.addEventListener('resize',handler);
    return()=>window.removeEventListener('resize',handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once auto-collapse; the stale `collapsed` closure only guards a redundant setState, no behavioral bug
  },[]);

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
            fontSize: 18, boxShadow: '0 0 20px rgba(79,142,247,.3)',
          }}>🏛️</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '.02em' }}>LAPD</div>
              <div style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap', marginTop: 1, letterSpacing: '.08em' }}>Crime Analytics</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.05)', color: '#9aa3bf',
              cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.color='#9aa3bf'; e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,.12)'; }}
          >‹</button>
        )}
      </div>

      {/* ── Expand button (collapsed mode) ── */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{
            width: '100%', padding: '10px 0', border: 'none', borderBottom: `1px solid ${C.border}`,
            background: 'rgba(255,255,255,.02)', color: '#9aa3bf', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='#9aa3bf'; e.currentTarget.style.background='rgba(255,255,255,.02)'; }}
        >›</button>
      )}

      {/* ── Nav scroll area ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: 'rgba(42,45,58,0.8) transparent', padding: '12px 0' }}>

        {/* Section label */}
        {!collapsed && (
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: '.16em',
            textTransform: 'uppercase', padding: '4px 18px 8px',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{ flex: 1, height: 1, background: C.dimmer }} />
            Navigation
            <span style={{ flex: 1, height: 1, background: C.dimmer }} />
          </div>
        )}

        {/* Main nav items */}
        {MAIN_NAV.map(item => {
          const active = item.id === 'dashboard' ? isHome
                       : item.id === 'geo'       ? isGeo
                       : item.id === 'osiris'    ? isOsiris
                       : item.id === 'compare'   ? isCompare
                       : item.id === 'insights'  ? isInsights
                       : item.id === 'glossary'  ? isGlossary
                       : false;
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
                      : item.id === 'geo'
                      ? geoActiveTab === sub.id
                      : false;
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
        <div style={{ height: 1, background: C.border, margin: '12px 0' }} />

        {/* Data sources section */}
        {!collapsed && (
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: '.16em',
            textTransform: 'uppercase', padding: '4px 18px 8px',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{ flex: 1, height: 1, background: C.dimmer }} />
            Data Sources
            <span style={{ flex: 1, height: 1, background: C.dimmer }} />
          </div>
        )}

        {DATA_ITEMS.map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '8px 0' : '6px 14px 6px 18px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, opacity: .65 }}>{item.icon}</span>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#7b88aa', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</div>
                <div style={{ color: '#4a5070', fontSize: 10, marginTop: 1 }}>{item.desc}</div>
              </div>
            )}
          </div>
        ))}

      </div>

      {/* ── Operator (hardcoded DEMO-GUEST) ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {!collapsed ? (
          <div style={{ padding: '10px 14px 10px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: C.accent,
                letterSpacing: '.14em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>◈ OPERADOR</span>
              <span style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{
              fontSize: 11, color: '#b0b7d0', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              DEMO-GUEST
            </div>
            <div style={{
              fontSize: 9, color: C.dim, fontFamily: 'monospace', marginTop: 3, letterSpacing: '.06em',
            }}>
              UNRESTRICTED VIEW
            </div>
            {/* Disconnect button */}
            <button
              onClick={() => router.push('/login')}
              style={{
                marginTop: 8, width: '100%', padding: '5px 0', borderRadius: 5,
                border: '1px solid rgba(100,116,139,.25)',
                background: 'rgba(100,116,139,.06)',
                color: '#64748b', fontSize: 10, fontWeight: 700,
                letterSpacing: '.1em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'monospace',
                transition: 'all .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(100,116,139,.14)';
                e.currentTarget.style.borderColor = 'rgba(100,116,139,.5)';
                e.currentTarget.style.color = '#94a3b8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(100,116,139,.06)';
                e.currentTarget.style.borderColor = 'rgba(100,116,139,.25)';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              ⏻ DISCONNECT
            </button>
          </div>
        ) : (
          <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              border: `1px solid rgba(79,142,247,.22)`,
              background: 'rgba(79,142,247,.07)',
              color: C.accent, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', fontWeight: 800,
            }} title="OPERADOR: DEMO-GUEST">D</div>
            <button
              onClick={() => router.push('/login')}
              title="Disconnect"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid rgba(100,116,139,.22)',
                background: 'rgba(100,116,139,.06)',
                color: '#64748b', fontSize: 14,
                cursor: 'pointer', fontFamily: 'monospace',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(100,116,139,.14)'; e.currentTarget.style.borderColor='rgba(100,116,139,.4)'; e.currentTarget.style.color='#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(100,116,139,.06)'; e.currentTarget.style.borderColor='rgba(100,116,139,.22)'; e.currentTarget.style.color='#64748b'; }}
            >⏻</button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {!collapsed ? (
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,rgba(79,142,247,.15),rgba(124,92,191,.15))',
              border: '1px solid rgba(79,142,247,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>🏛️</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#b0b7d0', whiteSpace: 'nowrap' }}>LAPD Open Data</div>
              <div style={{ fontSize: 10, color: C.dim, whiteSpace: 'nowrap', marginTop: 1 }}>Los Angeles · 2020–2024</div>
            </div>
            <div style={{
              fontSize: 9, fontWeight: 800, color: C.accent,
              background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.25)',
              borderRadius: 4, padding: '3px 7px', whiteSpace: 'nowrap', letterSpacing: '.06em',
            }}>LIVE</div>
          </div>
        ) : (
          <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg,rgba(79,142,247,.12),rgba(124,92,191,.12))',
              border: '1px solid rgba(79,142,247,.12)',
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
        color: active ? '#fff' : C.navInactive,
        fontSize: 14, fontWeight: active ? 700 : 500,
        letterSpacing: '.01em',
        transition: 'background .12s, color .12s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = '#e0e4f0'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.navInactive; }}}
    >
      <span style={{
        fontSize: 16, flexShrink: 0, lineHeight: 1,
        opacity: active ? 1 : .7,
        transition: 'opacity .12s',
      }}>{icon}</span>
      {!collapsed && (
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0,
        }}>{label}</span>
      )}
    </Link>
  );
}

const C_active  = 'rgba(79,142,247,.08)';
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
        color: active ? '#98b4f7' : '#6b7590',
        fontSize: 12, fontWeight: active ? 600 : 400,
        borderLeft: '3px solid transparent',
        transition: 'color .12s, background .12s',
        overflow: 'hidden',
        letterSpacing: '.01em',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#b0b7d0'; }}
      onMouseLeave={e => { e.currentTarget.style.color = active ? '#98b4f7' : '#6b7590'; }}
    >
      {icon ? (
        <span style={{ fontSize: 12, opacity: active ? .9 : .6, flexShrink: 0 }}>{icon}</span>
      ) : (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
          background: active ? C_accent : '#3a3f5a',
        }} />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
        {label}
      </span>
    </a>
  );
}
