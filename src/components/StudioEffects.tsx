import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface SpotlightSurfaceProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  onClick?: () => void;
}

/**
 * Tactile dark anodized console panel with cursor-tracking warm specular sheen.
 */
export function SpotlightSurface({
  children,
  className = '',
  spotlightColor = 'rgba(234, 179, 73, 0.13)',
  onClick,
}: SpotlightSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, active: false });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos((p) => ({ ...p, active: false }))}
      className={`relative overflow-hidden console-panel ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: pos.active ? 1 : 0,
          background: `radial-gradient(360px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 68%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface EqualizerBarsProps {
  active?: boolean;
  color?: string;
  bars?: number;
  height?: number;
}

export function EqualizerBars({
  active = true,
  color = '#EAB349',
  bars = 4,
  height = 16,
}: EqualizerBarsProps) {
  const delays = [0, 0.22, 0.12, 0.34, 0.18];
  const durations = [0.72, 0.95, 0.64, 0.85, 0.78];

  return (
    <span
      className="inline-flex items-end gap-[2.5px]"
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={active ? 'vu-bar rounded-full' : 'rounded-full opacity-40'}
          style={{
            width: 2.5,
            height: active ? '100%' : `${35 + ((i * 19) % 45)}%`,
            backgroundColor: color,
            animationDelay: `${delays[i % delays.length]}s`,
            animationDuration: `${durations[i % durations.length]}s`,
          }}
        />
      ))}
    </span>
  );
}

interface MiniWaveformStripProps {
  seed: string;
  barCount?: number;
  accentColor?: string;
}

export function MiniWaveformStrip({
  seed,
  barCount = 42,
  accentColor = '#EAB349',
}: MiniWaveformStripProps) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const heights = Array.from({ length: barCount }).map((_, idx) => {
    const wave = Math.sin(idx * 0.42 + (hash % 17)) * 0.5 + 0.5;
    const jitter = ((Math.imul(hash ^ (idx * 2654435761), 1597334677) >>> 0) % 100) / 100;
    return Math.round(18 + (wave * 0.55 + jitter * 0.45) * 82);
  });

  return (
    <div
      className="flex h-8 w-full items-center gap-[2.5px] overflow-hidden opacity-85"
      aria-hidden="true"
    >
      {heights.map((h, i) => {
        const highlight = i > barCount * 0.18 && i < barCount * 0.48;
        return (
          <motion.span
            key={i}
            initial={{ scaleY: 0.25, opacity: 0.3 }}
            animate={{ scaleY: 1, opacity: highlight ? 0.95 : 0.38 }}
            transition={{ duration: 0.45, delay: i * 0.008, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 rounded-full"
            style={{
              height: `${h}%`,
              backgroundColor: highlight ? accentColor : '#9E9588',
            }}
          />
        );
      })}
    </div>
  );
}

export function StudioBadgePulse({ color = '#EAB349' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}
