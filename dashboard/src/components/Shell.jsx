'use client';

import Sidebar from './Sidebar';

export default function Shell({ children, activeSection = null, geoActiveTab = null }) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0f1117',
      fontFamily: 'Inter,system-ui,sans-serif',
      color: '#e8eaf0',
    }}>
      <Sidebar activeSection={activeSection} geoActiveTab={geoActiveTab} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
