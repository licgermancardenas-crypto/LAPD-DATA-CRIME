'use client';
import { useState } from 'react';

export default function InfoTooltip({ text, width = 240 }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 5, verticalAlign: 'middle' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {/* ⓘ circle */}
      <span style={{
        width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
        border: `1px solid ${show ? 'rgba(76,201,240,.55)' : 'rgba(79,142,247,.35)'}`,
        background: show ? 'rgba(76,201,240,.1)' : 'rgba(79,142,247,.07)',
        color: show ? '#4cc9f0' : '#6090e8',
        fontSize: 9, fontWeight: 700, fontFamily: 'serif', lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'default', userSelect: 'none',
        transition: 'border-color .15s, background .15s, color .15s',
      }}>i</span>

      {/* Floating tooltip */}
      {show && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width,
          background: 'rgba(4,6,14,.95)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(79,142,247,.2)',
          borderRadius: 9,
          padding: '10px 13px',
          fontSize: 11,
          color: '#b4b9ce',
          lineHeight: 1.7,
          zIndex: 9999,
          boxShadow: '0 10px 30px rgba(0,0,0,.6)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
          textAlign: 'left',
        }}>
          {text}
          {/* Caret */}
          <span style={{
            position: 'absolute',
            bottom: -5, left: '50%',
            width: 8, height: 8,
            background: 'rgba(4,6,14,.95)',
            border: '1px solid rgba(79,142,247,.2)',
            borderTop: 'none', borderLeft: 'none',
            transform: 'translateX(-50%) rotate(45deg)',
            display: 'block',
          }} />
        </span>
      )}
    </span>
  );
}
