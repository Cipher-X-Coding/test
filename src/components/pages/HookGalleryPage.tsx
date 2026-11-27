import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Clock,
  Edit3,
  FileText,
  Layers,
  Loader2,
  MessagesSquare,
  Repeat,
  Scissors,
  Trash2,
} from 'lucide-react';
import type {
  AudioFileSummary,
  HookTier,
  HookWithScenario,
  OrderedAudioMeta,
  TranscriptSegment,
} from '../../types';
import { BLUEPRINT_META, TIER_META, formatTimecode, toFa } from '../../utils/format';
import { SPRING_SOFT, STUDIO_EASE } from '../../utils/motion';
import { SpotlightSurface } from '../StudioEffects';
import {
  BottomTransportDeck,
  type BottomTransportHandle,
} from '../BottomTransportDeck';

interface HookGalleryPageProps {
  title: string;
  subtitle?: string;
  backLabel: string;
  hooks: HookWithScenario[];
  speakerCount?: number;
  segmentCount: number;
  durationSec: number;
  orderedAudioMeta?: OrderedAudioMeta[];
  previewAudio?: AudioFileSummary | null;
  previewSegments?: TranscriptSegment[];
  onBack: () => void;
  onOpenHook: (hook: HookWithScenario) => void;
  onOpenTranscript: () => void;
  onCreateMicroLoop?: () => Promise<void>;
  onCreateRapidQA?: () => Promise<void>;
  onEditCombination?: () => void;
  onDelete: () => void;
}

const TRACK_COLORS = ['#EAB349', '#38BDF8', '#34D399', '#E4834B', '#C084FC'];

export function HookGalleryPage({
  title,
  subtitle,
  backLabel,
  hooks,
  speakerCount,
  segmentCount,
  durationSec,
  orderedAudioMeta,
  previewAudio,
  previewSegments = [],
  onBack,
  onOpenHook,
  onOpenTranscript,
  onCreateMicroLoop,
  onCreateRapidQA,
  onEditCombination,
  onDelete,
}: HookGalleryPageProps) {
  const deckRef = useRef<BottomTransportHandle>(null);
  const [tierFilter, setTierFilter] = useState<'all' | HookTier>('all');
  const [creatingType, setCreatingType] = useState<'micro' | 'qa' | null>(null);

  async function handleCreateSpecial(kind: 'micro' | 'qa') {
    setCreatingType(kind);
    try {
      if (kind === 'micro' && onCreateMicroLoop) await onCreateMicroLoop();
      if (kind === 'qa' && onCreateRapidQA) await onCreateRapidQA();
    } finally {
      setCreatingType(null);
    }
  }

  const counts = {
    all: hooks.length,
    gold: hooks.filter((h) => h.tier === 'gold').length,
    silver: hooks.filter((h) => h.tier === 'silver').length,
    bronze: hooks.filter((h) => h.tier === 'bronze').length,
  };

  const filtered = hooks.filter((h) => (tierFilter === 'all' ? true : h.tier === tierFilter));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-5xl pb-8 space-y-8"
    >
      {/* Top Quiet Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/40 hover:text-[#FAF6EE] cursor-pointer"
        >
          <ArrowRight className="h-3.5 w-3.5 text-[#EAB349] transition-transform duration-200 group-hover:translate-x-0.5" />
          {backLabel}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onEditCombination && (
            <button
              type="button"
              onClick={onEditCombination}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#D6CEC2] transition hover:border-white/25 hover:text-[#FAF6EE] cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-[#EAB349]" />
              تغییر ترتیب ترکیب
            </button>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onOpenTranscript}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-extrabold text-[#FAF6EE] transition hover:border-[#EAB349]/50 hover:bg-[#EAB349]/12 hover:text-[#F8D57E] cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-[#EAB349]" />
            متن کامل و گویندگان
            <span className="rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] text-[#C7BEB0]">
              {toFa(segmentCount)}
            </span>
          </motion.button>

          <button
            type="button"
            onClick={onDelete}
            title="حذف"
            className="rounded-xl p-2 text-[#7D7469] transition hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Spacious Editorial Header */}
      <header className="space-y-4 border-b border-white/[0.07] pb-7">
        {orderedAudioMeta && orderedAudioMeta.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {orderedAudioMeta.map((meta, idx) => (
              <div key={`${meta.audioFileId}-${idx}`} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-[#DDD5C8]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: TRACK_COLORS[idx % TRACK_COLORS.length] }}
                  />
                  {toFa(idx + 1)}. {meta.title.split('—')[0].trim()}
                </span>
                {idx < orderedAudioMeta.length - 1 && (
                  <span className="h-[1.5px] w-4 patch-signal" />
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#FAF6EE]">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#8E867B]">
            {subtitle && <span>{subtitle}</span>}
            {subtitle && <span>·</span>}
            <span className="font-mono" dir="ltr">
              {formatTimecode(durationSec)}
            </span>
            {speakerCount !== undefined && (
              <>
                <span>·</span>
                <span>{toFa(speakerCount)} گوینده تشخیص داده‌شده</span>
              </>
            )}
            <span>·</span>
            <span>{toFa(hooks.length)} قلاب آماده</span>
          </div>
        </div>

        {/* Calm Tier Filter Bar + Special Viral Format Generators (#7 Micro-Loop & #8 Rapid Q&A) */}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between pt-2">
          <div className="max-w-full overflow-x-auto no-scrollbar pb-0.5">
            <div className="inline-flex items-center gap-1 rounded-xl console-inset p-1 whitespace-nowrap">
            {(
              [
                { id: 'all', label: `همه (${toFa(counts.all)})`, dot: '#F5F1E8' },
                { id: 'gold', label: `طلایی · پست (${toFa(counts.gold)})`, dot: '#EAB349' },
                { id: 'silver', label: `نقره‌ای · تریال (${toFa(counts.silver)})`, dot: '#CBD5E1' },
                { id: 'bronze', label: `برنزی · استوری (${toFa(counts.bronze)})`, dot: '#E4834B' },
              ] as const
            ).map((tab) => {
              const active = tierFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTierFilter(tab.id)}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    active ? 'text-[#FAF6EE]' : 'text-[#8E867B] hover:text-[#DDD5C8]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="galleryTierFilter"
                      transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                      className="absolute inset-0 rounded-lg border border-white/12 bg-white/[0.09]"
                    />
                  )}
                  <span
                    className="relative z-10 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tab.dot }}
                  />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
            </div>
          </div>

          {(onCreateMicroLoop || onCreateRapidQA) && (
            <div className="flex flex-wrap items-center gap-2">
              {onCreateMicroLoop && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={creatingType !== null}
                  onClick={() => handleCreateSpecial('micro')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-[11px] font-extrabold text-fuchsia-200 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/18 disabled:opacity-50 cursor-pointer"
                >
                  {creatingType === 'micro' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Repeat className="h-3.5 w-3.5" />
                  )}
                  + میکرو‌ریلز لوپ (۷–۱۵ث)
                </motion.button>
              )}

              {onCreateRapidQA && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={creatingType !== null}
                  onClick={() => handleCreateSpecial('qa')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-extrabold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/18 disabled:opacity-50 cursor-pointer"
                >
                  {creatingType === 'qa' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessagesSquare className="h-3.5 w-3.5" />
                  )}
                  + ریلز مکالمه‌ای (Q&A)
                </motion.button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Spacious, Uncluttered Hook Cards Gallery (Click any card -> Dedicated Scenario Page!) */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="console-panel rounded-3xl p-14 text-center text-sm text-[#8E867B]"
        >
          قلابی در این دسته وجود ندارد.
        </motion.div>
      ) : (
        <motion.div layout className="grid gap-5 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
          {filtered.map((hook, idx) => {
            const meta = TIER_META[hook.tier];
            const bp = BLUEPRINT_META[hook.viralBlueprint || 'myth_buster'];
            return (
              <motion.div
                key={hook.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{
                  layout: SPRING_SOFT,
                  delay: Math.min(idx * 0.035, 0.18),
                  duration: 0.28,
                  ease: STUDIO_EASE,
                }}
                whileHover={{ y: -4, transition: SPRING_SOFT }}
                whileTap={{ scale: 0.985 }}
              >
                <SpotlightSurface
                  onClick={() => onOpenHook(hook)}
                  spotlightColor={meta.glowColor}
                  className="group foil-card flex h-full cursor-pointer flex-col justify-between rounded-3xl transition-all hover:border-white/22"
                >
                  <div>
                    {/* Slim top metallic rim */}
                    <div className={`h-[2.5px] w-full ${meta.accentBar}`} />

                    <div className="p-6">
                      {/* Minimal Top Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-black ${meta.sealClass}`}
                          >
                            {meta.shortLabel}
                          </span>
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${bp.badgeClass}`}
                          >
                            {bp.shortLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          {hook.viralAudit && (
                            <span
                              title="امتیاز رادار وایرالیته"
                              className="inline-flex items-center gap-1 font-mono font-extrabold text-[#F6CE78]"
                            >
                              <Activity className="h-3 w-3" />
                              {toFa(hook.viralAudit.overallScore)}٪
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 font-semibold text-[#8E867B]">
                            {hook.storyFormat === 'story_sequence' && (
                              <Layers className="h-3 w-3 text-[#E4834B]" />
                            )}
                            {hook.formatLabel.split('(')[0].trim()}
                          </span>
                        </div>
                      </div>

                      {/* Sharp Title */}
                      <h3 className="mt-4 text-base font-black leading-7 text-[#FAF6EE] group-hover:text-[#F8D57E] transition">
                        {hook.title}
                      </h3>

                      {/* Whisper-Short Opening Hook Teaser (Clamped to 2 calm lines) */}
                      <p className="mt-3 line-clamp-2 text-xs leading-6 text-[#9E9588]">
                        «{hook.hookVerbatim}»
                      </p>
                    </div>
                  </div>

                  {/* Calm Footer */}
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-4 text-[11px]">
                    <div className="flex items-center gap-3 text-[#8E867B]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ~{toFa(hook.estimatedDurationSec)} ثانیه
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Scissors className="h-3 w-3" />
                        {toFa(hook.scenarioBeats.length)}{' '}
                        {hook.storyFormat === 'story_sequence' ? 'اسلاید' : 'برش'}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-extrabold text-[#DDD5C8] transition group-hover:text-[#F8D57E]">
                      باز کردن سناریو
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                    </span>
                  </div>
                </SpotlightSurface>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Subtle Floating Audio Transport (only for single audio files so user can preview quickly) */}
      {previewAudio && (
        <BottomTransportDeck
          ref={deckRef}
          audioUrl={previewAudio.audioUrl}
          title={previewAudio.title}
          durationSec={previewAudio.durationSec}
          segments={previewSegments}
          hooks={hooks}
          onSelectHookPin={(h) => onOpenHook(h)}
        />
      )}
    </motion.div>
  );
}
