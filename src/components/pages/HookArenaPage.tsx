import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Swords,
  Trophy,
} from 'lucide-react';
import type { AudioFileSummary, HookTier, HookWithScenario } from '../../types';
import { stitchScenarioBeats } from '../../utils/audioStitcher';
import { BLUEPRINT_META, TIER_META, formatTimecode, toFa } from '../../utils/format';
import { openHandoffSheetPreview } from '../../utils/handoffSheet';
import { SPRING_SNAPPY, SPRING_SOFT, STUDIO_EASE } from '../../utils/motion';
import { EqualizerBars } from '../StudioEffects';

interface HookArenaPageProps {
  projectTitle: string;
  hooks: HookWithScenario[];
  audioFilesById: Map<string, AudioFileSummary>;
  onBack: () => void;
  onOpenHook: (hook: HookWithScenario) => void;
}

function ArenaAudioButton({
  hook,
  audioFilesById,
  activePlayingId,
  onStartPlay,
  onStopPlay,
}: {
  hook: HookWithScenario;
  audioFilesById: Map<string, AudioFileSummary>;
  activePlayingId: string | null;
  onStartPlay: (hookId: string) => void;
  onStopPlay: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [dur, setDur] = useState<number>(hook.estimatedDurationSec);
  const [loading, setLoading] = useState(false);

  const isPlaying = activePlayingId === hook.id;

  // Pause automatically if the opponent starts playing
  useEffect(() => {
    if (!isPlaying && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function handleToggle() {
    if (isPlaying) {
      audioRef.current?.pause();
      onStopPlay();
      return;
    }

    let url = blobUrl;
    if (!url) {
      setLoading(true);
      try {
        const urlMap = new Map<string, string>();
        audioFilesById.forEach((f, id) => urlMap.set(id, f.audioUrl));
        const res = await stitchScenarioBeats(hook.scenarioBeats, urlMap, 120);
        url = res.blobUrl;
        setBlobUrl(res.blobUrl);
        setDur(Math.round(res.totalDurationSec));
      } catch {
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    onStartPlay(hook.id);
    setTimeout(() => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = 0;
      el.play().catch(() => onStopPlay());
    }, 30);
  }

  return (
    <div className="flex items-center gap-2.5">
      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onEnded={() => onStopPlay()}
        />
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        disabled={loading}
        onClick={handleToggle}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition cursor-pointer ${
          isPlaying
            ? 'seal-gold'
            : 'border border-[#EAB349]/40 bg-[#EAB349]/12 text-[#F8D57E] hover:bg-[#EAB349] hover:text-[#141210]'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            آماده‌سازی ویس...
          </>
        ) : isPlaying ? (
          <>
            <Pause className="h-3.5 w-3.5 fill-current" />
            توقف پخش
            <EqualizerBars active color="#141210" bars={3} height={11} />
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 fill-current" />
            شنیدن ویس پیش‌ادیت
          </>
        )}
      </motion.button>

      <span className="font-mono text-[11px] text-[#8E867B]" dir="ltr">
        {formatTimecode(dur)}
      </span>
    </div>
  );
}

export function HookArenaPage({
  projectTitle,
  hooks,
  audioFilesById,
  onBack,
  onOpenHook,
}: HookArenaPageProps) {
  const [tierFilter, setTierFilter] = useState<'all' | HookTier>('all');
  const [blindMode, setBlindMode] = useState(true);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  const pool = useMemo(() => {
    const filtered = hooks.filter((h) =>
      tierFilter === 'all' ? true : h.tier === tierFilter
    );
    // Cap at 8 strongest hooks so tournament finishes fast & decisively (max 7 matches!)
    return [...filtered]
      .sort((a, b) => (b.viralAudit?.overallScore || 70) - (a.viralAudit?.overallScore || 70))
      .slice(0, 8);
  }, [hooks, tierFilter]);

  const [queue, setQueue] = useState<HookWithScenario[]>([]);
  const [nextRound, setNextRound] = useState<HookWithScenario[]>([]);
  const [eliminated, setEliminated] = useState<HookWithScenario[]>([]);
  const [matchNum, setMatchNum] = useState(1);
  const [champion, setChampion] = useState<HookWithScenario | null>(null);

  function startTournament(items: HookWithScenario[]) {
    setActivePlayingId(null);
    if (items.length <= 1) {
      setChampion(items[0] || null);
      setQueue([]);
      setNextRound([]);
      setEliminated([]);
      setMatchNum(1);
      return;
    }
    setChampion(null);
    setQueue(items);
    setNextRound([]);
    setEliminated([]);
    setMatchNum(1);
  }

  useEffect(() => {
    startTournament(pool);
  }, [pool]);

  const leftHook = queue[0] || null;
  const rightHook = queue[1] || null;

  function pickWinner(winner: HookWithScenario, loser: HookWithScenario) {
    setActivePlayingId(null);
    const remaining = queue.slice(2);
    const updatedNext = [...nextRound, winner];
    const updatedElim = [loser, ...eliminated]; // most recently eliminated = highest rank

    setEliminated(updatedElim);

    if (remaining.length >= 2) {
      setQueue(remaining);
      setNextRound(updatedNext);
      setMatchNum((m) => m + 1);
    } else {
      // Bye advances automatically if odd count
      const carry = remaining.length === 1 ? [...updatedNext, remaining[0]] : updatedNext;
      if (carry.length === 1) {
        setChampion(carry[0]);
        setQueue([]);
        setNextRound([]);
      } else {
        setQueue(carry);
        setNextRound([]);
        setMatchNum((m) => m + 1);
      }
    }
  }

  const totalMatchesEst = Math.max(1, pool.length - 1);
  const podium = champion ? [champion, ...eliminated].slice(0, 5) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-5xl space-y-8 pb-16"
    >
      {/* Top Quiet Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/40 hover:text-[#FAF6EE] cursor-pointer"
        >
          <ArrowRight className="h-3.5 w-3.5 text-[#EAB349]" />
          بازگشت به خزانه قلاب‌ها
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBlindMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
              blindMode
                ? 'border-sky-400/45 bg-sky-500/12 text-sky-200'
                : 'border-white/10 bg-white/[0.03] text-[#9E9588] hover:text-[#FAF6EE]'
            }`}
          >
            {blindMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {blindMode ? 'حالت تست کور فعال است' : 'نمایش عنوان و امتیاز'}
          </button>

          <button
            type="button"
            onClick={() => startTournament(pool)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-[#B4ABA0] transition hover:border-white/25 hover:text-[#FAF6EE] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            شروع مجدد
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="space-y-4 border-b border-white/[0.07] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-black text-[#FAF6EE]">
              <Swords className="h-7 w-7 text-[#EAB349]" />
              نبرد قلاب‌ها (تورنمنت انتخاب برترین‌ها)
            </h1>
            <p className="mt-1.5 text-xs leading-6 text-[#9E9588]">
              ویس پیش‌ادیت دو سناریو را پشت هم بشنوید و هرکدام گیراتر بود انتخاب کنید تا در ۲ دقیقه، اولویت‌های اول انتشار مشخص شوند.
            </p>
          </div>

          <div className="inline-flex gap-1 rounded-xl console-inset p-1">
            {(
              [
                { id: 'all', label: 'همه' },
                { id: 'gold', label: 'طلایی' },
                { id: 'silver', label: 'نقره‌ای' },
                { id: 'bronze', label: 'برنزی' },
              ] as const
            ).map((opt) => {
              const active = tierFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTierFilter(opt.id)}
                  className={`relative rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    active ? 'text-[#141210]' : 'text-[#8E867B] hover:text-[#FAF6EE]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="arenaTierPill"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-lg bg-[#F5F1E8]"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Arena Stage OR Final Podium */}
      {pool.length < 2 ? (
        <div className="console-panel rounded-3xl p-14 text-center text-sm text-[#8E867B]">
          برای برگزاری نبرد قلاب‌ها حداقل به ۲ قلاب در این دسته نیاز است.
        </div>
      ) : champion ? (
        /* FINAL PODIUM VIEW */
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="console-panel rounded-3xl border-[#EAB349]/45 p-7 text-center space-y-4">
            <motion.div
              initial={{ scale: 0.4, rotate: -18, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={SPRING_SNAPPY}
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl seal-gold"
            >
              <Crown className="h-7 w-7" />
            </motion.div>
            <div>
              <span className="text-xs font-extrabold text-[#F6CE78]">
                برنده اول نبرد قلاب‌های «{projectTitle}»
              </span>
              <h2 className="mt-2 text-xl sm:text-2xl font-black text-[#FAF6EE]">
                {champion.title}
              </h2>
              <p className="mt-2 mx-auto max-w-xl text-xs leading-7 text-[#B4ABA0]">
                «{champion.hookVerbatim}»
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => onOpenHook(champion)}
                className="inline-flex items-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black cursor-pointer"
              >
                باز کردن سناریوی قهرمان
                <ArrowLeft className="h-3.5 w-3.5" />
              </motion.button>

              <button
                type="button"
                onClick={() =>
                  openHandoffSheetPreview(`برترین‌های ${projectTitle}`, podium)
                }
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-extrabold text-[#FAF6EE] hover:border-[#EAB349]/50 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#EAB349]" />
                خروجی بسته تحویل {toFa(podium.length)} برگزیده (PDF/HTML)
              </button>
            </div>
          </div>

          {/* Ranked Top List */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#FAF6EE]">
              رده‌بندی نهایی اولویت انتشار
            </h3>
            {podium.map((h, idx) => {
              const meta = TIER_META[h.tier];
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.28, ease: STUDIO_EASE }}
                  whileHover={{ x: -3, transition: SPRING_SOFT }}
                  onClick={() => onOpenHook(h)}
                  className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-[#EAB349]/45 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                        idx === 0
                          ? 'seal-gold'
                          : idx === 1
                            ? 'seal-silver'
                            : idx === 2
                              ? 'seal-bronze'
                              : 'bg-white/[0.06] text-[#9E9588]'
                      }`}
                    >
                      {toFa(idx + 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-black text-[#FAF6EE] group-hover:text-[#F8D57E]">
                          {h.title}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${meta.sealClass}`}>
                          {meta.shortLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#8E867B]">
                        «{h.hookVerbatim}»
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#DDD5C8] group-hover:text-[#F8D57E]">
                    مشاهده
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* HEAD-TO-HEAD DUEL STAGE */
        leftHook &&
        rightHook && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-[#9E9588]">
              <span className="inline-flex items-center gap-2 font-extrabold text-[#FAF6EE]">
                <Headphones className="h-4 w-4 text-[#EAB349]" />
                رقابت {toFa(matchNum)} از {toFa(totalMatchesEst)}
              </span>
              <span>به هر دو گوش دهید و قوی‌ترین قلاب را انتخاب کنید</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${leftHook.id}-vs-${rightHook.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="grid gap-6 md:grid-cols-2"
              >
                {[
                  { hook: leftHook, opponent: rightHook, label: 'گزینه اول (A)' },
                  { hook: rightHook, opponent: leftHook, label: 'گزینه دوم (B)' },
                ].map(({ hook: contender, opponent, label }) => {
                  const meta = TIER_META[contender.tier];
                  const bp = BLUEPRINT_META[contender.viralBlueprint || 'myth_buster'];
                  return (
                    <motion.div
                      key={contender.id}
                      whileHover={{ y: -3, transition: SPRING_SOFT }}
                      className="console-panel flex flex-col justify-between rounded-3xl p-6 space-y-6 border-white/[0.1] hover:border-[#EAB349]/40 transition"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-lg bg-white/[0.07] px-2.5 py-1 text-[11px] font-black text-[#F6CE78]">
                            {label}
                          </span>

                          {!blindMode && (
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${meta.sealClass}`}>
                                {meta.shortLabel}
                              </span>
                              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${bp.badgeClass}`}>
                                {bp.shortLabel}
                              </span>
                            </div>
                          )}
                        </div>

                        <AnimatePresence>
                          {!blindMode && (
                            <motion.h3
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden text-base font-black leading-7 text-[#FAF6EE]"
                            >
                              {contender.title}
                            </motion.h3>
                          )}
                        </AnimatePresence>

                        <p className="text-base font-medium leading-9 text-[#FAF6EE]">
                          «{contender.hookVerbatim}»
                        </p>

                        <div className="text-[11px] text-[#8E867B]">
                          {toFa(contender.scenarioBeats.length)} برش · ~
                          {toFa(contender.estimatedDurationSec)} ثانیه
                        </div>
                      </div>

                      <div className="space-y-4 border-t border-white/[0.07] pt-5">
                        <ArenaAudioButton
                          hook={contender}
                          audioFilesById={audioFilesById}
                          activePlayingId={activePlayingId}
                          onStartPlay={(id) => setActivePlayingId(id)}
                          onStopPlay={() => setActivePlayingId(null)}
                        />

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.015 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => pickWinner(contender, opponent)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F5F1E8] py-3 text-xs font-black text-[#141210] transition hover:bg-white cursor-pointer"
                        >
                          <Trophy className="h-4 w-4 text-amber-700" />
                          این قلاب قوی‌تر بود — انتخاب برنده
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        )
      )}
    </motion.div>
  );
}
