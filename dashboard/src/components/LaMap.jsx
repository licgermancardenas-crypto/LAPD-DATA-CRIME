'use client';

export default function LaMap() {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2d3a', lineHeight: 0 }}>
      <iframe
        src="/lapd-map.html"
        title="LAPD Crime Division Map"
        style={{ width: '100%', height: 540, border: 'none', display: 'block' }}
        loading="lazy"
      />
    </div>
  );
}
