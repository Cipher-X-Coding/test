import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Disc3,
  Flame,
  Music2,
  Repeat,
  Scissors,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HookWithScenario } from '../types';
import { BLUEPRINT_META, formatTimecode, toFa } from '../utils/format';
import { SPRING_SNAPPY, iconSwapMotion } from '../utils/motion';

interface ViralRadarPanelProps {
  hook: HookWithScenario;
  inMediaResApplied: boolean;
  onToggleInMediaRes?: () => void;
}

function ScoreMeter({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div className="console-inset rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#DDD5C8]">{label}</span>
        <span className="font-mono text-sm font-black" style={{ color }}>
          {toFa(score)}٪
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function ViralRadarPanel({
  hook,
  inMediaResApplied,
  onToggleInMediaRes,
}: ViralRadarPanelProps) {
  const [copiedKw, setCopiedKw] = useState<string | null>(null);

  const audit = hook.viralAudit;
  const mood = hook.audioMoodGuide;
  const blueprint = BLUEPRINT_META[hook.viralBlueprint || 'myth_buster'];
  const inMedia = hook.inMediaResCut;

  // Boost hookHoldScore visually when user turns on In-Media-Res filler trim!
  const effectiveHookHold = audit
    ? Math.min(98, audit.hookHoldScore + (inMediaResApplied && inMedia?.hasFillerIntro ? 12 : 0))
    : 80;
  const effectiveOverall = audit
    ? Math.min(98, audit.overallScore + (inMediaResApplied && inMedia?.hasFillerIntro ? 5 : 0))
    : 80;

  function copyKeyword(kw: string) {
    navigator.clipboard.writeText(kw);
    setCopiedKw(kw);
    setTimeout(() => setCopiedKw(null), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8 py-8"
    >
      {/* 1. Overall Viral Score + Matched Blueprint (#2 + #13) */}
      {audit && (
        <section className="console-panel rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                key={effectiveOverall}
                initial={{ scale: 0.9, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING_SNAPPY}
                className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#EAB349]/40 bg-[#EAB349]/12"
              >
                <div className="text-center">
                  <div className="font-mono text-xl font-black text-[#F8D57E] leading-none">
                    {toFa(effectiveOverall)}
                  </div>
                  <div className="mt-1 text-[9px] font-bold text-[#B4ABA0]">از ۱۰۰</div>
                </div>
              </motion.div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-[#FAF6EE]">
                    رادار وایرالیته و ماندگاری مخاطب
                  </h2>
                  <span
                    className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-extrabold ${blueprint.badgeClass}`}
                  >
                    الگو: {blueprint.label}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-6 text-[#9E9588]">
                  {blueprint.description}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Algorithmic Metrics */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreMeter label="قدرت ۳ ثانیه اول (Hook Hold)" score={effectiveHookHold} color="#EAB349" />
            <ScoreMeter label="ریتم و ماندگاری (Retention)" score={audit.retentionPaceScore} color="#38BDF8" />
            <ScoreMeter label="پتانسیل ارسال به دیگران (DM Share)" score={audit.shareabilityScore} color="#34D399" />
            <ScoreMeter label="نرخ ذخیره (Saveability)" score={audit.saveabilityScore} color="#E4834B" />
          </div>

          {/* Seamless Loop Seam Note for Micro-Loop Reels (#7) */}
          {audit.loopSeamNote && (
            <div className="flex items-start gap-3 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/[0.08] p-4 text-xs leading-6 text-fuchsia-100">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
              <div>
                <strong className="font-extrabold text-fuchsia-200">
                  مهندسی حلقه بی‌پایان (Seamless Loop):{' '}
                </strong>
                {audit.loopSeamNote}
              </div>
            </div>
          )}

          {/* Drop-off Radar (#2) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#DDD5C8]">
              <Activity className="h-4 w-4 text-[#EAB349]" />
              رادار افت مخاطب (Drop-off Radar)
            </div>

            {audit.dropoffWarnings.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-3.5 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                ریتم برش‌ها تند و سالم است — هیچ نقطه افت بحرانی در این سناریو دیده نشد.
              </div>
            ) : (
              <div className="space-y-2.5">
                {audit.dropoffWarnings.map((w, idx) => {
                  const isIntroWarning = w.beatOrder === 1 && w.atSec === 0 && inMedia?.hasFillerIntro;
                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-4 space-y-2 ${
                        isIntroWarning && inMediaResApplied
                          ? 'border-emerald-400/30 bg-emerald-500/[0.06]'
                          : w.severity === 'high'
                            ? 'border-rose-400/30 bg-rose-500/[0.06]'
                            : 'border-amber-400/25 bg-amber-500/[0.05]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-extrabold">
                          {isIntroWarning && inMediaResApplied ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle
                              className={`h-4 w-4 ${
                                w.severity === 'high' ? 'text-rose-400' : 'text-amber-300'
                              }`}
                            />
                          )}
                          <span className="text-[#FAF6EE]">
                            برش {toFa(w.beatOrder)} · حوالی ثانیه{' '}
                            <span className="font-mono" dir="ltr">
                              {formatTimecode(w.atSec)}
                            </span>
                          </span>
                        </div>

                        {isIntroWarning && onToggleInMediaRes && (
                          <button
                            type="button"
                            onClick={onToggleInMediaRes}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black transition cursor-pointer ${
                              inMediaResApplied
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'seal-gold'
                            }`}
                          >
                            <Scissors className="h-3 w-3" />
                            {inMediaResApplied ? 'برش مقدمه فعال شد ✓' : 'فعال‌سازی برش وسط جمله'}
                          </button>
                        )}
                      </div>

                      <p className="text-xs leading-6 text-[#DDD5C8]">{w.issue}</p>
                      <p className="text-xs leading-6 text-[#A49B8E]">
                        <strong className="font-bold text-[#F6CE78]">راه حل: </strong>
                        {w.fix}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Viral Wins */}
          {audit.quickWins.length > 0 && (
            <div className="space-y-2.5 border-t border-white/[0.07] pt-5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#F6CE78]">
                <Flame className="h-4 w-4" />
                اصلاح‌های سریع برای جهش وایرالیته
              </div>
              <ul className="space-y-2">
                {audit.quickWins.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs leading-6 text-[#C7BEB0]"
                  >
                    <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-[#EAB349]" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 2. Audio Mood & Music Drop Guide (#12) */}
      {mood && (
        <section className="console-panel rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/12 text-sky-300">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#FAF6EE]">
                راهنمای موسیقی پس‌زمینه و حال‌وهوای صدا
              </h2>
              <p className="mt-0.5 text-xs text-[#9E9588]">{mood.moodTitle}</p>
            </div>
          </div>

          <p className="text-xs leading-7 text-[#C7BEB0]">{mood.vibeDescription}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="console-inset rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E867B]">
                <Disc3 className="h-3.5 w-3.5 text-sky-300" />
                ریتم پیشنهادی (BPM)
              </div>
              <div className="text-xs font-extrabold text-[#FAF6EE]">{mood.bpmRange}</div>
            </div>

            <div className="console-inset rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E867B]">
                <Volume2 className="h-3.5 w-3.5 text-[#EAB349]" />
                تراز صدای موزیک زیر گوینده
              </div>
              <div className="text-xs font-extrabold text-[#FAF6EE]">{mood.volumeDbGuide}</div>
            </div>
          </div>

          {/* Golden Music Drop Moment */}
          {mood.musicDropPhrase && (
            <div className="rounded-2xl border border-[#EAB349]/30 bg-[#EAB349]/[0.07] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#F8D57E]">
                <VolumeX className="h-4 w-4" />
                لحظه طلایی قطع موزیک (Music Drop) — برش {toFa(mood.musicDropBeatOrder || 1)}
              </div>
              <p className="text-sm font-bold leading-7 text-[#FAF6EE]">
                «{mood.musicDropPhrase}...»
              </p>
              <p className="text-xs leading-6 text-[#B4ABA0]">{mood.musicDropReason}</p>
            </div>
          )}

          {/* Ready-to-Search Audio Keywords */}
          {mood.searchKeywords.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-bold text-[#8E867B]">
                کلیدواژه جستجوی موزیک (CapCut / Artlist / Epidemic / اینستاگرام) — کلیک برای کپی:
              </span>
              <div className="flex flex-wrap gap-2" dir="ltr">
                {mood.searchKeywords.map((kw) => {
                  const isCopied = copiedKw === kw;
                  return (
                    <motion.button
                      key={kw}
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => copyKeyword(kw)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-bold transition cursor-pointer ${
                        isCopied
                          ? 'border-emerald-400/50 bg-emerald-500/12 text-emerald-300'
                          : 'border-white/12 bg-white/[0.04] text-[#EAE2D6] hover:border-sky-400/50 hover:text-sky-200'
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isCopied ? (
                          <motion.span key="ok" {...iconSwapMotion}>
                            <Check className="h-3 w-3 text-emerald-400" />
                          </motion.span>
                        ) : (
                          <motion.span key="cp" {...iconSwapMotion}>
                            <Copy className="h-3 w-3 text-[#8E867B]" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {kw}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </motion.div>
  );
}
