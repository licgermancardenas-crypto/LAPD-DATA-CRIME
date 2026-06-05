'use client';

export default function KpiCard({ label, value, sub, trend, color = '#4f8ef7', icon }) {
  const trendColor = trend > 0 ? '#e05252' : trend < 0 ? '#3ecf8e' : '#7b82a0';
  const trendSign  = trend > 0 ? '+' : '';

  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold" style={{ color }}>{value}</span>
        {trend !== undefined && trend !== null && (
          <span className="text-sm font-medium mb-1" style={{ color: trendColor }}>
            {trendSign}{trend}%
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
