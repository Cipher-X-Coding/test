import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { HookWithScenario, TranscriptSegment } from '../types';
import { TIER_META, formatTimecode } from '../utils/format';
import { iconSwapMotion } from '../utils/motion';
import { EqualizerBars } from './StudioEffects';

export interface BottomTransportHandle {
  seekAndPlay: (sec: number) => void;
}

interface BottomTransportDeckProps {
  audioUrl: string;
  title: string;
  durationSec: number;
  segments?: TranscriptSegment[];
  hooks?: HookWithScenario[];
  onTimeChange?: (sec: number) => void;
  onSelectHookPin?: (hook: HookWithScenario) => void;
}

const BAR_COUNT = 76;

export const BottomTransportDeck = forwardRef<BottomTransportHandle, BottomTransportDeckProps>(
  function BottomTransportDeck(
    {
      audioUrl,
      title,
      durationSec,
      segments = [],
      hooks = [],
      onTimeChange,
      onSelectHookPin,
    },
    ref
  ) {
    const audioElRef = useRef<HTMLAudioElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [realDuration, setRealDuration] = useState(durationSec);
    const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
    const [hoverPct, setHoverPct] = useState<number | null>(null);

    useEffect(() => {
      setRealDuration(durationSec);
      setCurrentTime(0);
      setIsPlaying(false);
    }, [audioUrl, durationSec]);

    const effectiveDuration = Math.max(1, realDuration || durationSec);

    useImperativeHandle(ref, () => ({
      seekAndPlay(sec: number) {
        const el = audioElRef.current;
        if (!el) return;
        const clamped = Math.max(0, Math.min(sec, effectiveDuration));
        const runPlay = () => {
          el.currentTime = clamped;
          setCurrentTime(clamped);
          onTimeChange?.(clamped);
          el.play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        };
        if (el.readyState >= 1) {
          runPlay();
        } else {
          el.load();
          el.addEventListener('loadedmetadata', runPlay, { once: true });
        }
      },
    }));

    function togglePlay() {
      const el = audioElRef.current;
      if (!el) return;
      if (el.paused) {
        el.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      } else {
        el.pause();
        setIsPlaying(false);
      }
    }

    function skip(delta: number) {
      const el = audioElRef.current;
      if (!el) return;
      const next = Math.max(0, Math.min(effectiveDuration, el.currentTime + delta));
      el.currentTime = next;
      setCurrentTime(next);
      onTimeChange?.(next);
    }

    function cycleSpeed() {
      const el = audioElRef.current;
      const next: 1 | 1.25 | 1.5 = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
      setSpeed(next);
      if (el) el.playbackRate = next;
    }

    function handleScrub(e: MouseEvent<HTMLDivElement>) {
      const rect = trackRef.current?.getBoundingClientRect();
      const el = audioElRef.current;
      if (!rect || !el) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetSec = pct * effectiveDuration;
      el.currentTime = targetSec;
      setCurrentTime(targetSec);
      onTimeChange?.(targetSec);
    }

    function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverPct(pct);
    }

    const bars = useMemo(() => {
      let hash = 2166136261;
      for (let i = 0; i < audioUrl.length; i++) {
        hash ^= audioUrl.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }

      return Array.from({ length: BAR_COUNT }).map((_, i) => {
        const ratio = (i + 0.5) / BAR_COUNT;
        const t = ratio * effectiveDuration;
        const seg = segments.find((s) => t >= s.startSec && t <= s.endSec);
        const wave = Math.sin(i * 0.38 + (hash % 11)) * 0.5 + 0.5;
        const jitter = ((Math.imul(hash ^ (i * 2246822519), 3266489917) >>> 0) % 100) / 100;
        const height = Math.round(22 + (wave * 0.45 + jitter * 0.55) * 76);
        return {
          ratio,
          height,
          color: seg?.speakerColor || '#EAB349',
        };
      });
    }, [audioUrl, effectiveDuration, segments]);

    const progressPct = Math.min(100, (currentTime / effectiveDuration) * 100);
    const activeSeg = segments.find(
      (s) => currentTime >= s.startSec && currentTime <= s.endSec
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="sticky bottom-20 sm:bottom-4 z-20 mx-auto mt-6 max-w-5xl"
      >
        <div className="rounded-2xl border border-white/[0.12] bg-[#141210]/92 px-4 py-3 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <audio
            ref={audioElRef}
            src={audioUrl}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 1) setRealDuration(d);
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setCurrentTime(t);
              onTimeChange?.(t);
            }}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Play + Track Info */}
            <div className="flex items-center gap-3 shrink-0 sm:w-56">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.88 }}
                onClick={togglePlay}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl seal-gold transition hover:brightness-110 cursor-pointer ${
                  isPlaying ? 'play-aura-active' : ''
                }`}
                aria-label={isPlaying ? 'توقف' : 'پخش'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.span key="pause" {...iconSwapMotion}>
                      <Pause className="h-4 w-4 fill-current" />
                    </motion.span>
                  ) : (
                    <motion.span key="play" {...iconSwapMotion}>
                      <Play className="h-4 w-4 fill-current translate-x-[1px]" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <EqualizerBars active={isPlaying} color="#EAB349" bars={3} height={11} />
                  <span className="truncate text-xs font-bold text-[#F5F1E8]">
                    {title}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[#8E867B]">
                  {activeSeg?.speakerName || 'برای پرش، روی موج صدا کلیک کنید'}
                </div>
              </div>
            </div>

            {/* Interactive Waveform Scrubber (LTR time axis) */}
            <div className="flex-1 min-w-0" dir="ltr">
              <div
                ref={trackRef}
                onClick={handleScrub}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverPct(null)}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  const rect = trackRef.current?.getBoundingClientRect();
                  const el = audioElRef.current;
                  if (!touch || !rect || !el) return;
                  const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                  const target = pct * effectiveDuration;
                  el.currentTime = target;
                  setCurrentTime(target);
                  onTimeChange?.(target);
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const rect = trackRef.current?.getBoundingClientRect();
                  const el = audioElRef.current;
                  if (!touch || !rect || !el) return;
                  const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                  const target = pct * effectiveDuration;
                  el.currentTime = target;
                  setCurrentTime(target);
                  onTimeChange?.(target);
                }}
                className="relative flex h-10 w-full cursor-pointer touch-none select-none items-center gap-[2px] px-1"
              >
                {/* Hook Diamond Pins */}
                {hooks.map((h) => {
                  const leftPct = Math.max(
                    1.5,
                    Math.min(98.5, (h.hookStartSec / effectiveDuration) * 100)
                  );
                  return (
                    <button
                      key={h.id}
                      type="button"
                      title={`${TIER_META[h.tier].shortLabel} · ${formatTimecode(h.hookStartSec)} — ${h.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = audioElRef.current;
                        if (el) {
                          el.currentTime = h.hookStartSec;
                          setCurrentTime(h.hookStartSec);
                          onTimeChange?.(h.hookStartSec);
                          el.play()
                            .then(() => setIsPlaying(true))
                            .catch(() => {});
                        }
                        onSelectHookPin?.(h);
                      }}
                      style={{ left: `${leftPct}%`, backgroundColor: TIER_META[h.tier].dotColor }}
                      className="absolute -top-1 z-20 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[1.5px] ring-2 ring-[#141210] transition hover:scale-150 cursor-pointer"
                    />
                  );
                })}

                {bars.map((bar, idx) => {
                  const barPct = bar.ratio * 100;
                  const isPast = barPct <= progressPct;
                  const isHoverRange = hoverPct !== null && barPct <= hoverPct * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-full transition-colors duration-100"
                      style={{
                        height: `${bar.height}%`,
                        backgroundColor: isPast
                          ? bar.color
                          : isHoverRange
                            ? 'rgba(245, 241, 232, 0.32)'
                            : 'rgba(245, 241, 232, 0.13)',
                      }}
                    />
                  );
                })}

                {/* Playhead Needle */}
                <div
                  className="pointer-events-none absolute top-0.5 bottom-0.5 z-10 w-[2px] rounded-full bg-[#F7D782] shadow-[0_0_10px_#EAB349]"
                  style={{ left: `${progressPct}%` }}
                />

                {hoverPct !== null && (
                  <div
                    className="pointer-events-none absolute -top-6 z-30 -translate-x-1/2 rounded-md bg-[#221F1C] border border-white/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#F5F1E8]"
                    style={{ left: `${hoverPct * 100}%` }}
                  >
                    {formatTimecode(hoverPct * effectiveDuration)}
                  </div>
                )}
              </div>
            </div>

            {/* Quiet Jog + OLED Timecode */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => skip(-5)}
                title="۵ ثانیه عقب"
                className="rounded-lg p-1.5 text-[#9E9588] transition hover:bg-white/[0.06] hover:text-[#F5F1E8] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => skip(5)}
                title="۵ ثانیه جلو"
                className="rounded-lg p-1.5 text-[#9E9588] transition hover:bg-white/[0.06] hover:text-[#F5F1E8] cursor-pointer"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={cycleSpeed}
                className="rounded-lg px-2 py-1 font-mono text-[11px] font-bold text-[#EAB349] transition hover:bg-white/[0.06] cursor-pointer"
                dir="ltr"
              >
                {speed}x
              </button>
              <div
                className="rounded-lg bg-black/45 px-2.5 py-1 font-mono text-[11px] font-bold oled-timecode text-[#F7D782]"
                dir="ltr"
              >
                {formatTimecode(currentTime)}{' '}
                <span className="text-[#6F685E]">/ {formatTimecode(effectiveDuration)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);
