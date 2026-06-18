'use client';

/** Right-side vertical icon rail (decorative HUD controls, like the mockup). */
export function IconRail() {
  const items = [
    { icon: '🎯', label: '조준' },
    { icon: '🔊', label: '소리' },
    { icon: '🎵', label: '음악' },
    { icon: '⚙️', label: '설정' },
  ];
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <button key={it.label} className="icon-rail-btn" title={it.label} aria-label={it.label}>
          <span className="text-lg">{it.icon}</span>
        </button>
      ))}
    </div>
  );
}
