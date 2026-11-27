import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Download,
  Headphones,
  Loader2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scissors,
} from 'lucide-react';
import type { AudioFileSummary, HookWithScenario } from '../types';
import {
  stitchScenarioBeats,
  type StitchedScenarioAudio,
} from '../utils/audioStitcher';
import { formatTimecode, toFa } from '../utils/format';
import { SPRING_SNAPPY, iconSwapMotion } from '../utils/motion';
import { EqualizerBars } from './StudioEffects';

export interface RoughCutPlayerHandle {
  playBeat: (beatIndex: number) => void;
  togglePlay: () => void;
}

interface ScenarioRoughCutPlayerProps {
  hook: HookWithScenario;
  audioFilesById: Map<string, AudioFileSummary>;
  onActiveBeatChange?: (beatIndex: number | null, isPlaying: boolean) => void;
}

const BEAT_COLORS = [
  '#EAB349', // Hook — Brass Gold
  '#38BDF8', // Beat 2 — Sky
  '#34D399', // Beat 3 — Emerald
  '#E4834B', // Beat 4 — Copper
  '#C084FC', // Beat 5 — Violet
  '#F472B6', // Beat 6 — Rose
];

const GAP_OPTIONS = [
  { ms: 0, label: 'کات تیز' },
  { ms: 180, label: 'طبیعی' },
  { ms: 380, label: 'مکث‌دار' },
] as const;

export const ScenarioRoughCutPlayer = forwardRef<
  RoughCutPlayerHandle,
  ScenarioRoughCutPlayerProps
>(function ScenarioRoughCutPlayer(
  { hook, audioFilesById, onActiveBeatChange },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [gapMs, setGapMs] = useState<number>(() =>
    hook.specialFormat === 'micro_loop' || hook.specialFormat === 'rapid_qa' ? 0 : 180
  );
  const [loopEnabled, setLoopEnabled] = useState<boolean>(
    () => hook.specialFormat === 'micro_loop'
  );
  const [stitched, setStitched] = useState<StitchedScenarioAudio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoopEnabled(hook.specialFormat === 'micro_loop');
    if (hook.specialFormat === 'micro_loop' || hook.specialFormat === 'rapid_qa') {
      setGapMs(0);
    }
  }, [hook.id, hook.specialFormat]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [isOutOfView, setIsOutOfView] = useState(false);

  // Build stitched WAV whenever hook or gapMs changes
  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;

    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);

    const audioUrlById = new Map<string, string>();
    audioFilesById.forEach((file, id) => {
      audioUrlById.set(id, file.audioUrl);
    });

    stitchScenarioBeats(hook.scenarioBeats, audioUrlById, gapMs)
      .then((result) => {
        if (cancelled) {
          URL.revokeObjectURL(result.blobUrl);
          return;
        }
        createdBlobUrl = result.blobUrl;
        setStitched((prev) => {
          if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
          return result;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'خطا در ساخت ویس یکپارچه');
        setStitched((prev) => {
          if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [hook, audioFilesById, gapMs]);

  // Smooth 60fps playhead tracking while playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        setCurrentTime(el.currentTime);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Track whether the player scrolled out of view to show compact floating pill
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsOutOfView(!entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Determine which beat slice is currently active at currentTime
  const activeSlice = stitched
    ? stitched.slices.find(
        (s) => currentTime >= s.stitchedStartSec - 0.04 && currentTime <= s.stitchedEndSec + 0.04
      ) ||
      (currentTime > 0 && currentTime < stitched.totalDurationSec
        ? stitched.slices.find((s) => currentTime < s.stitchedEndSec) || null
        : null)
    : null;

  const activeBeatIndex =
    isPlaying || currentTime > 0.02 ? (activeSlice?.beatIndex ?? null) : null;

  useEffect(() => {
    onActiveBeatChange?.(activeBeatIndex, isPlaying);
  }, [activeBeatIndex, isPlaying, onActiveBeatChange]);

  function seekAndPlaySec(sec: number) {
    const el = audioRef.current;
    if (!el || !stitched) return;
    const clamped = Math.max(0, Math.min(sec, stitched.totalDurationSec));
    const run = () => {
      el.currentTime = clamped;
      el.playbackRate = speed;
      setCurrentTime(clamped);
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    };
    if (el.readyState >= 1) {
      run();
    } else {
      el.load();
      el.addEventListener('loadedmetadata', run, { once: true });
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el || !stitched) return;
    if (el.paused) {
      if (el.currentTime >= stitched.totalDurationSec - 0.08) {
        el.currentTime = 0;
        setCurrentTime(0);
      }
      el.playbackRate = speed;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }

  function playBeatByIndex(beatIndex: number) {
    if (!stitched) return;
    const slice = stitched.slices.find((s) => s.beatIndex === beatIndex);
    if (!slice) return;
    seekAndPlaySec(slice.stitchedStartSec);
  }

  useImperativeHandle(ref, () => ({
    playBeat: playBeatByIndex,
    togglePlay,
  }));

  function cycleSpeed() {
    const next: 1 | 1.25 | 1.5 = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function handleScrub(e: MouseEvent<HTMLDivElement>) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !stitched) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = pct * stitched.totalDurationSec;
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = targetSec;
    setCurrentTime(targetSec);
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPct(pct);
  }

  function handleDownloadWav() {
    if (!stitched) return;
    const safeName = hook.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 44);
    const a = document.createElement('a');
    a.href = stitched.blobUrl;
    a.download = `rough-cut-${hook.tier}-${safeName}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const totalDur = Math.max(0.1, stitched?.totalDurationSec || 1);
  const progressPct = Math.min(100, (currentTime / totalDur) * 100);

  return (
    <>
      <div
        ref={containerRef}
        className="console-panel rounded-3xl p-5 sm:p-6 space-y-5"
      >
        {stitched && (
          <audio
            key={stitched.blobUrl}
            ref={audioRef}
            src={stitched.blobUrl}
            loop={loopEnabled}
            preload="auto"
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = speed;
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              if (!loopEnabled) {
                setIsPlaying(false);
                setCurrentTime(stitched.totalDurationSec);
              }
            }}
          />
        )}

        {/* Header Row: Title + Rhythm Selector + Download WAV */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#EAB349]/35 bg-[#EAB349]/12 text-[#F7D782]">
              {isPlaying ? (
                <EqualizerBars active color="#F7D782" bars={3} height={16} />
              ) : (
                <Headphones className="h-4.5 w-4.5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-[#FAF6EE]">
                پیش‌شنید ویس یکپارچه سناریو
              </h2>
              <p className="mt-0.5 text-[11px] text-[#8E867B]">
                تمام {toFa(hook.scenarioBeats.length)} برش به ترتیب کنار هم چسبیده‌اند تا خروجی صوتی را قبل از تدوین بشنوید
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cut Gap / Rhythm Switcher */}
            <div
              className="inline-flex items-center gap-0.5 rounded-xl console-inset p-1"
              title="فاصله بین برش‌ها"
            >
              {GAP_OPTIONS.map((opt) => {
                const active = gapMs === opt.ms;
                return (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => setGapMs(opt.ms)}
                    className={`relative rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                      active
                        ? 'text-[#FAF6EE]'
                        : 'text-[#7D7469] hover:text-[#DDD5C8]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="roughCutGapPill"
                        transition={SPRING_SNAPPY}
                        className="absolute inset-0 rounded-lg bg-white/[0.12]"
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Download Stitched WAV */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              disabled={!stitched || loading}
              onClick={handleDownloadWav}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-[#EAE2D6] transition hover:border-[#EAB349]/45 hover:text-[#F8D57E] disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#EAB349]" />
              دانلود ویس (.wav)
            </motion.button>
          </div>
        </div>

        {/* Body: Loading / Error / Stitched Interactive Rough-Cut Waveform */}
        {loading ? (
          <div className="console-inset flex items-center justify-center gap-3 rounded-2xl py-8 text-xs text-[#A49B8E]">
            <Loader2 className="h-4 w-4 animate-spin text-[#EAB349]" />
            <span>در حال برش و چسباندن صداهای سناریو به یکدیگر...</span>
          </div>
        ) : error || !stitched ? (
          <div className="console-inset flex items-center gap-2.5 rounded-2xl px-4 py-4 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error || 'امکان ساخت پیش‌شنید یکپارچه برای این فایل وجود ندارد.'}</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Segmented Beat Strip — Visual Map of Stitched Cuts */}
            <div className="flex items-center gap-1" dir="ltr">
              {stitched.slices.map((slice, i) => {
                const widthPct = Math.max(6, (slice.durationSec / totalDur) * 100);
                const color = BEAT_COLORS[i % BEAT_COLORS.length];
                const isActive = activeBeatIndex === slice.beatIndex;
                return (
                  <button
                    key={`${slice.beatIndex}-${slice.segmentId}`}
                    type="button"
                    onClick={() => playBeatByIndex(slice.beatIndex)}
                    style={{ width: `${widthPct}%` }}
                    title={`${slice.label} (${formatTimecode(slice.durationSec)})`}
                    className={`group relative flex items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1.5 text-[10px] font-extrabold transition cursor-pointer ${
                      isActive
                        ? 'border-white/35 bg-white/[0.12] text-[#FAF6EE] shadow-sm'
                        : 'border-white/[0.06] bg-white/[0.025] text-[#9E9588] hover:border-white/20 hover:text-[#FAF6EE]'
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate" dir="rtl">
                      {toFa(slice.beatOrder)}. {slice.label.split('—')[0].trim()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Main Transport Row: Play + Waveform + OLED Clock + Speed */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl seal-gold transition hover:brightness-110 cursor-pointer ${
                    isPlaying ? 'play-aura-active' : ''
                  }`}
                  aria-label={isPlaying ? 'توقف' : 'پخش یکپارچه سناریو'}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isPlaying ? (
                      <motion.span key="pause" {...iconSwapMotion}>
                        <Pause className="h-4.5 w-4.5 fill-current" />
                      </motion.span>
                    ) : (
                      <motion.span key="play" {...iconSwapMotion}>
                        <Play className="h-4.5 w-4.5 fill-current translate-x-[1px]" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88, rotate: -45 }}
                  onClick={() => seekAndPlaySec(0)}
                  title="پخش از ابتدا"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#A49B8E] transition hover:border-white/20 hover:text-[#FAF6EE] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  animate={{ rotate: loopEnabled ? 180 : 0 }}
                  transition={SPRING_SNAPPY}
                  onClick={() => setLoopEnabled((v) => !v)}
                  title={loopEnabled ? 'تکرار حلقه (Loop) فعال است' : 'فعال کردن تکرار حلقه (Loop)'}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
                    loopEnabled
                      ? 'border-fuchsia-400/55 bg-fuchsia-500/18 text-fuchsia-300 shadow-[0_0_14px_-4px_rgba(232,121,249,0.5)]'
                      : 'border-white/[0.08] bg-white/[0.03] text-[#8E867B] hover:border-white/20 hover:text-[#FAF6EE]'
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" />
                </motion.button>
              </div>

              {/* Stitched Waveform Scrubbing Bar */}
              <div className="relative flex-1 min-w-0">
                <div
                  ref={trackRef}
                  onClick={handleScrub}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverPct(null)}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    const rect = trackRef.current?.getBoundingClientRect();
                    if (!touch || !rect || !stitched) return;
                    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    seekAndPlaySec(pct * stitched.totalDurationSec);
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const rect = trackRef.current?.getBoundingClientRect();
                    if (!touch || !rect || !stitched || !audioRef.current) return;
                    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                    audioRef.current.currentTime = pct * stitched.totalDurationSec;
                    setCurrentTime(pct * stitched.totalDurationSec);
                  }}
                  dir="ltr"
                  className="relative flex h-12 cursor-pointer touch-none items-end gap-[2px] rounded-2xl console-inset px-3 py-2"
                >
                  {stitched.waveformPeaks.map((height, i) => {
                    const barRatio = (i + 0.5) / stitched.waveformPeaks.length;
                    const barSec = barRatio * totalDur;
                    const passed = barRatio * 100 <= progressPct;
                    const sliceIdx = stitched.slices.findIndex(
                      (s) => barSec >= s.stitchedStartSec && barSec <= s.stitchedEndSec
                    );
                    const barColor =
                      sliceIdx >= 0
                        ? BEAT_COLORS[sliceIdx % BEAT_COLORS.length]
                        : '#575049';

                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-full transition-colors duration-100"
                        style={{
                          height: `${height}%`,
                          backgroundColor: passed ? barColor : 'rgba(255,255,255,0.14)',
                          opacity: passed ? 0.95 : 0.85,
                        }}
                      />
                    );
                  })}

                  {/* Vertical Cut Splice Lines */}
                  {stitched.slices.slice(1).map((slice) => {
                    const cutPct = (slice.stitchedStartSec / totalDur) * 100;
                    return (
                      <div
                        key={`cut-${slice.beatIndex}`}
                        className="pointer-events-none absolute top-1.5 bottom-1.5 w-[1.5px] bg-white/30"
                        style={{ left: `${cutPct}%` }}
                      />
                    );
                  })}

                  {/* Playhead Needle */}
                  <div
                    className="pointer-events-none absolute top-1 bottom-1 w-[2px] rounded-full bg-[#FAF6EE] shadow-[0_0_10px_#EAB349]"
                    style={{ left: `${progressPct}%` }}
                  />

                  {/* Hover Timecode Preview */}
                  <AnimatePresence>
                    {hoverPct !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 3, scale: 0.9 }}
                        transition={{ duration: 0.12 }}
                        className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md border border-white/15 bg-[#1B1815] px-2 py-0.5 font-mono text-[10px] font-bold text-[#F7D782] shadow-lg"
                        style={{ left: `${hoverPct * 100}%` }}
                      >
                        {formatTimecode(hoverPct * totalDur)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* OLED Timecode + Playback Speed */}
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <div
                  className="oled-timecode rounded-xl px-3 py-2 text-xs font-bold text-[#F6CE78]"
                  dir="ltr"
                >
                  <span>{formatTimecode(currentTime)}</span>
                  <span className="mx-1 text-[#6F685E]">/</span>
                  <span className="text-[#9E9588]">{formatTimecode(totalDur)}</span>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={cycleSpeed}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[11px] font-extrabold text-[#DDD5C8] transition hover:border-[#EAB349]/45 hover:text-[#F8D57E] cursor-pointer"
                >
                  <motion.span
                    key={speed}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING_SNAPPY}
                    className="inline-block"
                  >
                    {speed}×
                  </motion.span>
                </motion.button>
              </div>
            </div>

            {/* Active Cut Live Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8E867B] px-1">
              <div className="flex items-center gap-2 min-w-0">
                <Scissors className="h-3 w-3 text-[#EAB349] shrink-0" />
                {activeSlice ? (
                  <span className="truncate text-[#DDD5C8]">
                    {isPlaying ? 'در حال پخش: ' : 'موقعیت فعلی: '}
                    <strong className="font-extrabold text-[#FAF6EE]">
                      برش {toFa(activeSlice.beatOrder)} ({activeSlice.label})
                    </strong>
                    <span className="mx-1.5 text-[#5E574E]">·</span>
                    <span>{activeSlice.speakerName}</span>
                  </span>
                ) : (
                  <span>
                    دکمه پخش را بزنید تا کل سناریو پشت سر هم پخش شود و هر بخش هنگام خوانده شدن روشن شود
                  </span>
                )}
              </div>

              <span className="font-mono text-[10px] text-[#7D7469]" dir="ltr">
                {toFa(stitched.slices.length)} cuts · {formatTimecode(totalDur)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compact Floating Mini-Bar when Scrolling Down During Playback */}
      <AnimatePresence>
        {isOutOfView && isPlaying && stitched && activeSlice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 sm:bottom-5 left-1/2 z-40 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto max-w-md"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-[#EAB349]/35 bg-[#151311]/95 px-4 py-2.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-xl seal-gold cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
              </button>

              <div className="flex items-center gap-2 text-xs">
                <EqualizerBars active color="#F7D782" bars={3} height={13} />
                <span className="font-extrabold text-[#FAF6EE]">
                  برش {toFa(activeSlice.beatOrder)} از {toFa(stitched.slices.length)}
                </span>
                <span className="hidden sm:inline text-[#8E867B]">
                  · {activeSlice.label.split('—')[0].trim()}
                </span>
              </div>

              <span
                className="oled-timecode rounded-lg px-2 py-1 text-[11px] font-bold text-[#F6CE78]"
                dir="ltr"
              >
                {formatTimecode(currentTime)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
