'use client';

import { useEffect, useRef } from 'react';

export default function LaMap({ category }) {
  const iframeRef   = useRef(null);
  const categoryRef = useRef(category);
  categoryRef.current = category;

  // Sync category to iframe on every change
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SET_CATEGORY', category: category ?? null },
      '*'
    );
  }, [category]);

  // On iframe initial load: push whatever category is active at that moment
  const handleLoad = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SET_CATEGORY', category: categoryRef.current ?? null },
      '*'
    );
  };

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2d3a', lineHeight: 0 }}>
      <iframe
        ref={iframeRef}
        src="/lapd-map.html"
        title="LAPD Crime Division Map"
        style={{ width: '100%', height: 540, border: 'none', display: 'block' }}
        loading="lazy"
        onLoad={handleLoad}
      />
    </div>
  );
}
