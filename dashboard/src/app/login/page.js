'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/* ── LAPD Badge SVG (monochromatic, cyan-tinted) ─────────────────────── */
function LAPDBadge() {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-10 h-12 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
      aria-label="LAPD Badge"
    >
      <path d="M100 4 L186 32 L186 130 Q186 190 100 236 Q14 190 14 130 L14 32 Z"
        stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <path d="M100 14 L176 38 L176 130 Q176 183 100 224 Q24 183 24 130 L24 38 Z"
        stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5"/>
      <path d="M14 80 Q2 70 4 55 Q10 65 24 72" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7"/>
      <path d="M14 90 Q0 82 2 66 Q9 76 24 82" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
      <path d="M186 80 Q198 70 196 55 Q190 65 176 72" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7"/>
      <path d="M186 90 Q200 82 198 66 Q191 76 176 82" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
      <line x1="100" y1="18" x2="100" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.8"/>
      <line x1="94" y1="24" x2="106" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.8"/>
      <circle cx="100" cy="24" r="4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.8"/>
      <ellipse cx="100" cy="128" rx="58" ry="72" stroke="currentColor" strokeWidth="2" fill="none"/>
      <ellipse cx="100" cy="128" rx="52" ry="66" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4"/>
      <rect x="90" y="105" width="20" height="40" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.9"/>
      <polygon points="100,92 107,105 93,105" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.9"/>
      <rect x="84" y="118" width="32" height="27" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.6"/>
      <rect x="78" y="130" width="44" height="15" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.5"/>
      <rect x="93" y="110" width="3" height="4" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.7"/>
      <rect x="104" y="110" width="3" height="4" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.7"/>
      <rect x="93" y="120" width="3" height="4" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.7"/>
      <rect x="104" y="120" width="3" height="4" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.7"/>
      <path id="topArc" d="M 50 128 A 50 64 0 0 1 150 128" fill="none"/>
      <text fontSize="7.5" fill="currentColor" opacity="0.9" fontFamily="monospace" letterSpacing="1.5">
        <textPath href="#topArc" startOffset="8%">LOS ANGELES POLICE</textPath>
      </text>
      <rect x="62" y="180" width="76" height="16" rx="2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.8"/>
      <text x="100" y="191" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.9" fontFamily="monospace" letterSpacing="1.5">DEPARTMENT</text>
      <path d="M 58 200 Q 100 210 142 200" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5"/>
      <text x="100" y="208" textAnchor="middle" fontSize="5.5" fill="currentColor" opacity="0.6" fontFamily="monospace" fontStyle="italic">to protect and to serve</text>
      <polygon points="100,232 86,218 114,218" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.7"/>
    </svg>
  );
}

/* ── Input field component ───────────────────────────────────────────── */
function TacticalInput({ label, type = 'text', value, onChange, placeholder, autoComplete, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] text-slate-500 tracking-widest uppercase">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-xs select-none">›</span>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="w-full bg-slate-900/40 border border-slate-800 focus:border-cyan-500/50
                     rounded-lg text-slate-200 font-mono text-sm placeholder-slate-600
                     focus:ring-0 focus:outline-none transition-all duration-200
                     px-4 py-3 pl-7 hover:border-slate-700"
        />
        {children}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode]         = useState('login');   // 'login' | 'signup'
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
    setFullName('');
    setEmail('');
    setPassword('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });

        if (err) throw err;

        if (data.session) {
          router.push('/');
        } else {
          setNotice('ACCESS REQUEST RECEIVED. CHECK YOUR EMAIL TO CONFIRM AND ACTIVATE YOUR ACCOUNT.');
        }

      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

        if (err) throw err;

        if (data.session) {
          router.push('/');
        }
      }
    } catch (err) {
      setError(err.message?.toUpperCase() ?? 'AUTHENTICATION FAILURE. CHECK CREDENTIALS.');
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex">

      {/* ── LEFT PANEL (40%) ──────────────────────────────────────── */}
      <div className="w-full md:w-[40%] bg-slate-950 border-r border-slate-900 flex flex-col justify-between p-10 z-10 shrink-0 overflow-y-auto">

        {/* Branding */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="text-cyan-400">
              <LAPDBadge />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono tracking-widest text-[9px] text-slate-500 uppercase leading-none">
                Los Angeles Police Department
              </span>
              <span className="font-mono tracking-widest text-[10px] text-slate-400 uppercase leading-none">
                OSIRIS // CRIMINAL INTELLIGENCE SYSTEM
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-cyan-500/30 via-slate-700/40 to-transparent mb-8" />

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-slate-900/60 rounded-lg border border-slate-800/60 mb-8">
            {[
              { key: 'login',  label: 'SIGN IN' },
              { key: 'signup', label: 'REQUEST ACCESS' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`flex-1 font-mono text-[10px] tracking-widest py-2 rounded-md transition-all duration-200 ${
                  mode === key
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Heading */}
          <h1 className="font-mono text-xl font-bold text-white tracking-tight mb-1">
            {isSignup ? 'REQUEST CLEARANCE' : 'SECURE ACCESS'}
          </h1>
          <p className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-6">
            {isSignup ? 'Register for demo access' : 'Authorized operators only'}
          </p>

          {/* Error alert */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg border border-rose-500/40 bg-rose-950/30
                            shadow-[0_0_12px_rgba(239,68,68,0.15)] flex gap-2 items-start">
              <span className="text-rose-500 font-mono text-sm mt-0.5 shrink-0">⚠</span>
              <p className="font-mono text-[10px] text-rose-400 tracking-wide leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {/* Success notice */}
          {notice && (
            <div className="mb-5 px-4 py-3 rounded-lg border border-cyan-500/40 bg-cyan-950/20
                            shadow-[0_0_12px_rgba(6,182,212,0.15)] flex gap-2 items-start">
              <span className="text-cyan-400 font-mono text-sm mt-0.5 shrink-0">◈</span>
              <p className="font-mono text-[10px] text-cyan-300/80 tracking-wide leading-relaxed">
                {notice}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {isSignup && (
              <TacticalInput
                label="Full Name"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Agent full name"
                autoComplete="name"
              />
            )}

            <TacticalInput
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="badge@lapd.gov"
              autoComplete="email"
            />

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 tracking-widest uppercase">
                {isSignup ? 'Set Access Key' : 'Access Key'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-xs select-none">›</span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  className="w-full bg-slate-900/40 border border-slate-800 focus:border-cyan-500/50
                             rounded-lg text-slate-200 font-mono text-sm placeholder-slate-600
                             focus:ring-0 focus:outline-none transition-all duration-200
                             px-4 py-3 pl-7 pr-14 hover:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px]
                             text-slate-600 hover:text-slate-400 tracking-wider transition-colors"
                >
                  {showPwd ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-900 disabled:cursor-wait
                         text-slate-950 font-bold tracking-wider text-xs uppercase py-3 rounded-lg
                         shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_28px_rgba(6,182,212,0.55)]
                         transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  {isSignup ? 'SUBMITTING REQUEST...' : 'AUTHENTICATING...'}
                </>
              ) : (
                isSignup ? 'SUBMIT ACCESS REQUEST' : 'INITIATE SESSION'
              )}
            </button>
          </form>

          {/* Status row */}
          <div className="flex items-center gap-2 mt-5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[10px] text-slate-600 tracking-widest">
              OSIRIS UPLINK ACTIVE // NODE-7 CONNECTED
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 mt-8 pt-6 border-t border-slate-900">
          <p className="font-mono text-[10px] text-rose-500/70 tracking-tight leading-snug">
            SECURE CONNECTION // AUTHORIZED PERSONNEL ONLY.
            ALL ACTIVITIES ARE LOGGED UNDER LAPD SECURITY PROTOCOL.
          </p>
          <p className="font-mono text-[9px] text-slate-700 tracking-widest">
            v4.2.1 // 2024 LAPD CRIMINAL INTELLIGENCE DIV.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (60%) — hidden on mobile ──────────────────── */}
      <div className="hidden md:block md:flex-1 relative overflow-hidden">

        {/* Base image — cyberpunk filter */}
        <div
          className="absolute inset-0 bg-cover bg-center brightness-[0.4] contrast-[1.15] saturate-[0.6]"
          style={{ backgroundImage: "url('/los-angeles.avif')" }}
        />

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent mix-blend-multiply" />

        {/* Cyan tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-slate-950/60" />

        {/* Scanlines */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,243,255,0.15) 2px, rgba(0,243,255,0.15) 3px)',
          }}
        />

        {/* Centered tactical content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-16">
          <div className="text-center max-w-lg">
            <p className="font-mono text-[10px] text-cyan-500/60 tracking-[0.3em] uppercase mb-4">
              LAPD // BUREAU OF INVESTIGATION
            </p>
            <h2 className="font-mono text-3xl font-bold text-white/80 tracking-tight leading-tight mb-4">
              OPERATION<br />
              <span className="text-cyan-400/90">OSIRIS</span>
            </h2>
            <p className="font-mono text-xs text-slate-500 tracking-widest leading-relaxed">
              REAL-TIME CRIMINAL INTELLIGENCE<br />
              LOS ANGELES METROPOLITAN AREA<br />
              1,004,894 INCIDENTS · 2020–2024
            </p>
            <div className="mt-8 flex items-center gap-3 justify-center opacity-30">
              <div className="w-16 h-px bg-cyan-400" />
              <div className="w-1.5 h-1.5 rotate-45 border border-cyan-400" />
              <div className="w-16 h-px bg-cyan-400" />
            </div>
          </div>
        </div>

        {/* Coordinates — top right */}
        <div className="absolute top-6 right-6 font-mono text-[9px] text-slate-600 tracking-widest text-right leading-relaxed">
          <div>34.0522° N, 118.2437° W</div>
          <div>LOS ANGELES, CA</div>
          <div className="text-cyan-500/40 mt-1">◈ GRID ACTIVE</div>
        </div>

        {/* Classification — bottom left */}
        <div className="absolute bottom-6 left-6 font-mono text-[9px] text-slate-700 tracking-widest">
          <div>ENCRYPTED CHANNEL · TLS 1.3</div>
          <div>CLASSIFICATION: RESTRICTED</div>
        </div>
      </div>

    </div>
  );
}
