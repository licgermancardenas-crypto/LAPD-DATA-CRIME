'use client';
import { useState } from 'react';

const STEPS = [
  {
    icon: '🏛️',
    tag: '01 · Plataforma',
    title: '¿Qué es este dashboard?',
    body: 'Plataforma de análisis criminológico con ~1.000.000 de registros oficiales de la LAPD (2020–2024). Explorá incidentes geolocalizados en tiempo real con filtros cruzados, mapas de calor y correlaciones externas.',
    accent: '#4f8ef7',
  },
  {
    icon: '📊',
    tag: '02 · Datos',
    title: '¿Qué información analiza?',
    body: 'Cada registro incluye fecha, ubicación GPS, categoría FBI (Part 1 Graves / Part 2 Menores), perfil de la víctima (edad, género, etnia) y la división policial interviniente. Se cruzan con datos de temperatura y desempleo metropolitano.',
    accent: '#d946ef',
  },
  {
    icon: '🔥',
    tag: '03 · Interactividad',
    title: 'El mapa de calor de 24 horas',
    body: 'En Geografía → Análisis de Calor, el slider inferior reproduce hora a hora cómo se distribuye el crimen en la ciudad. Presioná ▶ para animar las 24 horas y descubrir los picos de actividad delictiva por zona y momento del día.',
    accent: '#00f3ff',
  },
];

export default function OnboardingModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const advance = () => isLast ? onClose() : setStep(s => s + 1);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.75)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      padding: 24,
      animation: 'om-fade .25s ease',
    }}>
      <style>{`
        @keyframes om-fade{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes om-slide{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
      `}</style>

      <div style={{
        width: '100%', maxWidth: 480,
        background: 'rgba(6,8,18,.88)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.04)',
      }}>

        {/* Neon gradient top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, #d946ef, ${current.accent})` }} />

        {/* Step content */}
        <div key={step} style={{ padding: '32px 32px 24px', animation: 'om-slide .22s ease' }}>

          {/* Icon + tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${current.accent}22, ${current.accent}11)`,
              border: `1px solid ${current.accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>{current.icon}</div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.13em',
              color: current.accent, textTransform: 'uppercase',
            }}>{current.tag}</span>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: 20, fontWeight: 800, color: '#fff',
            lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.02em',
          }}>{current.title}</h2>

          {/* Body */}
          <p style={{
            fontSize: 13, color: '#8a90a8', lineHeight: 1.75, marginBottom: 28,
          }}>{current.body}</p>

          {/* Step dots + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 6 }}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  style={{
                    width: i === step ? 18 : 6,
                    height: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
                    background: i === step ? current.accent : 'rgba(255,255,255,.12)',
                    transition: 'width .2s ease, background .2s ease',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{
                    padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,.1)',
                    background: 'transparent', color: '#7b82a0',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'color .15s, border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#c0c4d4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#7b82a0'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; }}
                >Atrás</button>
              )}
              <button
                onClick={advance}
                style={{
                  padding: '9px 22px', borderRadius: 9, border: 'none',
                  background: `linear-gradient(135deg, ${current.accent}, ${current.accent}bb)`,
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 0 18px ${current.accent}44`,
                  transition: 'opacity .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '.88'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >{isLast ? 'Comenzar →' : 'Siguiente →'}</button>
            </div>
          </div>
        </div>

        {/* Skip link */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,.04)',
          padding: '12px 32px',
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: '#5a6280', fontSize: 11, cursor: 'pointer',
              transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#9096b0'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a6280'}
          >Saltar introducción</button>
        </div>
      </div>
    </div>
  );
}
