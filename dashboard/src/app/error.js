'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#1a1d27', border: '1px solid #e05252', borderRadius: 12, padding: '24px 32px', maxWidth: 560, width: '100%' }}>
        <p style={{ fontSize: 24, marginBottom: 12 }}>⚠️</p>
        <p style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Something went wrong</p>
        <pre style={{ color: '#e05252', fontSize: 12, background: '#0f1117', borderRadius: 8, padding: 12, overflowX: 'auto', marginBottom: 16 }}>
          {error?.message || String(error)}
        </pre>
        <button
          onClick={reset}
          style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
