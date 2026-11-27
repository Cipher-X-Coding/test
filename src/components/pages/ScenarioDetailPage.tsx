import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Clapperboard,
  Copy,
  Download,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Headphones,
  Loader2,
  Play,
  RefreshCw,
  Repeat,
  Scissors,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  AISettings,
  AudioFileSummary,
  HookWithScenario,
  TranscriptSegment,
} from '../../types';
import {
  BLUEPRINT_META,
  TIER_META,
  buildAdminPublishingSheet,
  buildEditorCutSheet,
  downloadTextFile,
  formatTimecode,
  toFa,
} from '../../utils/format';
import { openHandoffSheetPreview } from '../../utils/handoffSheet';
import {
  SPRING_SNAPPY,
  SPRING_SOFT,
  STUDIO_EASE,
  iconSwapMotion,
  tabPanelMotion,
} from '../../utils/motion';
import {
  ScenarioRoughCutPlayer,
  type RoughCutPlayerHandle,
} from '../ScenarioRoughCutPlayer';
import { PublishingKitPanel } from '../PublishingKitPanel';
import { ViralRadarPanel } from '../ViralRadarPanel';
import { TelegramSendModal } from '../TelegramSendModal';
import { EqualizerBars } from '../StudioEffects';

interface ScenarioDetailPageProps {
  projectTitle: string;
  breadcrumbParent: string;
  hook: HookWithScenario;
  allHooksInContext: HookWithScenario[];
  audioFilesById: Map<string, AudioFileSummary>;
  settings: AISettings | null;
  segments?: TranscriptSegment[];
  onBack: () => void;
  onSelectHook: (hook: HookWithScenario) => void;
  onOpenTranscriptAtSegment?: (segmentId: string) => void;
  onOpenTelegramSettings: () => void;
  onGenerateVariants: (hookId: string) => Promise<void>;
  onApplyVariant: (hookId: string, variantId: string) => Promise<void>;
  onRegeneratePublishingKit: (hookId: string) => Promise<void>;
  onRegenerateCarousel: (hookId: string) => Promise<void>;
}

const BEAT_COLORS = [
  '#EAB349',
  '#38BDF8',
  '#34D399',
  '#E4834B',
  '#C084FC',
  '#F472B6',
];

const VARIANT_LETTERS = ['B', 'C', 'D'];

export function ScenarioDetailPage({
  projectTitle,
  breadcrumbParent,
  hook,
  allHooksInContext,
  audioFilesById,
  settings,
  onBack,
  onSelectHook,
  onOpenTranscriptAtSegment,
  onOpenTelegramSettings,
  onGenerateVariants,
  onApplyVariant,
  onRegeneratePublishingKit,
  onRegenerateCarousel,
}: ScenarioDetailPageProps) {
  const roughCutRef = useRef<RoughCutPlayerHandle>(null);

  const [activeTab, setActiveTab] = useState<'scenario' | 'viral' | 'publishing'>('scenario');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [inMediaResActive, setInMediaResActive] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [applyingVariant, setApplyingVariant] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const [activeBeatIdx, setActiveBeatIdx] = useState<number | null>(null);
  const [isRoughCutPlaying, setIsRoughCutPlaying] = useState(false);

  // Reset transient A/B & trim preview state when switching hooks
  useEffect(() => {
    setSelectedVariantId(null);
    setInMediaResActive(false);
    setActiveBeatIdx(null);
    setIsRoughCutPlaying(false);
  }, [hook.id]);

  const activeVariant = useMemo(
    () =>
      selectedVariantId
        ? hook.alternativeHooks.find((v) => v.id === selectedVariantId) || null
        : null,
    [hook.alternativeHooks, selectedVariantId]
  );

  // Can apply In-Media-Res cut on primary hook when filler intro was detected
  const canTrimInMediaRes = Boolean(
    !activeVariant && hook.inMediaResCut?.hasFillerIntro
  );

  // Compose the effective hook (applying A/B hook swap OR In-Media-Res start trim live to audio & cut-sheet!)
  const effectiveHook: HookWithScenario = useMemo(() => {
    if (hook.scenarioBeats.length === 0) return hook;

    if (activeVariant) {
      const lead = hook.scenarioBeats[0];
      const swappedLead = {
        ...lead,
        segmentId: activeVariant.segmentId,
        sourceAudioId: activeVariant.sourceAudioId,
        sourceAudioTitle: activeVariant.sourceAudioTitle,
        speakerId: activeVariant.speakerId,
        speakerName: activeVariant.speakerName,
        startSec: activeVariant.startSec,
        endSec: activeVariant.endSec,
        verbatimText: activeVariant.verbatimText,
        verifiedVerbatim: activeVariant.verifiedVerbatim,
      };
      const nextBeats = [swappedLead, ...hook.scenarioBeats.slice(1)];
      const estDur = nextBeats.reduce((acc, b) => acc + Math.max(6, b.endSec - b.startSec), 0);

      return {
        ...hook,
        hookVerbatim: activeVariant.verbatimText,
        hookSegmentId: activeVariant.segmentId,
        hookSourceAudioId: activeVariant.sourceAudioId,
        hookSourceAudioTitle: activeVariant.sourceAudioTitle,
        hookStartSec: activeVariant.startSec,
        hookEndSec: activeVariant.endSec,
        hookSpeakerName: activeVariant.speakerName,
        estimatedDurationSec: estDur,
        scenarioBeats: nextBeats,
      };
    }

    if (inMediaResActive && hook.inMediaResCut?.hasFillerIntro) {
      const lead = hook.scenarioBeats[0];
      const trimmedLead = {
        ...lead,
        startSec: hook.inMediaResCut.suggestedTrimStartSec,
        verbatimText: hook.inMediaResCut.punchlineVerbatim,
      };
      const nextBeats = [trimmedLead, ...hook.scenarioBeats.slice(1)];
      const estDur = nextBeats.reduce((acc, b) => acc + Math.max(5, b.endSec - b.startSec), 0);

      return {
        ...hook,
        hookVerbatim: hook.inMediaResCut.punchlineVerbatim,
        hookStartSec: hook.inMediaResCut.suggestedTrimStartSec,
        estimatedDurationSec: estDur,
        scenarioBeats: nextBeats,
      };
    }

    return hook;
  }, [hook, activeVariant, inMediaResActive]);

  const handleActiveBeatChange = useCallback(
    (beatIndex: number | null, playing: boolean) => {
      setActiveBeatIdx(beatIndex);
      setIsRoughCutPlaying(playing);
    },
    []
  );

  async function handleRefreshVariants() {
    setLoadingVariants(true);
    try {
      await onGenerateVariants(hook.id);
      setSelectedVariantId(null);
    } finally {
      setLoadingVariants(false);
    }
  }

  async function handleCommitVariant() {
    if (!activeVariant) return;
    setApplyingVariant(true);
    try {
      await onApplyVariant(hook.id, activeVariant.id);
      setSelectedVariantId(null);
      setInMediaResActive(false);
    } finally {
      setApplyingVariant(false);
    }
  }

  const meta = TIER_META[hook.tier];
  const blueprint = BLUEPRINT_META[hook.viralBlueprint || 'myth_buster'];
  const currentIdx = allHooksInContext.findIndex((h) => h.id === hook.id);
  const prevHook = currentIdx > 0 ? allHooksInContext[currentIdx - 1] : null;
  const nextHook =
    currentIdx >= 0 && currentIdx < allHooksInContext.length - 1
      ? allHooksInContext[currentIdx + 1]
      : null;

  function handleCopy() {
    const text =
      activeTab === 'publishing'
        ? buildAdminPublishingSheet(effectiveHook)
        : buildEditorCutSheet(effectiveHook);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    const safeName = hook.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 48);
    if (activeTab === 'publishing') {
      downloadTextFile(
        `publishing-kit-${hook.tier}-${safeName}.txt`,
        buildAdminPublishingSheet(effectiveHook)
      );
    } else {
      downloadTextFile(
        `scenario-${hook.tier}-${safeName}.txt`,
        buildEditorCutSheet(effectiveHook)
      );
    }
  }

  const isMultiFile =
    effectiveHook.sourceType === 'combination' ||
    new Set(effectiveHook.scenarioBeats.map((b) => b.sourceAudioId)).size > 1;

  const viralScoreDisplay = hook.viralAudit
    ? Math.min(
        98,
        hook.viralAudit.overallScore +
          (inMediaResActive && hook.inMediaResCut?.hasFillerIntro ? 5 : 0)
      )
    : null;

  return (
    <motion.div
      key={hook.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl pb-16"
    >
      {/* Top Quiet Navigation Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/40 hover:text-[#FAF6EE] cursor-pointer"
        >
          <ArrowRight className="h-3.5 w-3.5 text-[#EAB349] transition-transform duration-200 group-hover:translate-x-0.5" />
          بازگشت به {breadcrumbParent}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenTranscriptAtSegment && (
            <button
              type="button"
              onClick={() => onOpenTranscriptAtSegment(effectiveHook.hookSegmentId)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#B4ABA0] transition hover:border-white/25 hover:text-[#FAF6EE] cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              متن
            </button>
          )}

          <button
            type="button"
            onClick={() => openHandoffSheetPreview(projectTitle, [effectiveHook])}
            title="بسته تحویل شکیل برای کارفرما / تدوینگر (چاپ / PDF)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#DDD5C8] transition hover:border-[#EAB349]/45 hover:text-[#F8D57E] cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#EAB349]" />
            بسته تحویل
          </button>

          <button
            type="button"
            onClick={() => setTelegramModalOpen(true)}
            title="ارسال مستقیم سناریو و ویس به گروه تلگرام"
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/12 px-3 py-2 text-xs font-extrabold text-sky-200 transition hover:bg-sky-400/22 cursor-pointer"
          >
            <Bot className="h-3.5 w-3.5" />
            ارسال در گروه
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="دانلود فایل متنی (.txt)"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[#B4ABA0] transition hover:border-white/25 hover:text-[#FAF6EE] cursor-pointer"
          >
            <Download className="h-4 w-4" />
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5F1E8] px-4 py-2 text-xs font-black text-[#141210] transition hover:bg-white cursor-pointer"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="copied" {...iconSwapMotion} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  کپی شد
                </motion.span>
              ) : (
                <motion.span key="copy" {...iconSwapMotion} className="inline-flex items-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  {activeTab === 'publishing' ? 'کپی پکیج ادمین' : 'کپی تدوین'}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Editorial Header — Abundant Breathing Room */}
      <header className="space-y-4 pb-7 border-b border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-3 py-1 text-xs font-black ${meta.sealClass}`}>
            {meta.label}
          </span>
          <span
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${blueprint.badgeClass}`}
          >
            {blueprint.label}
          </span>
          <span className="text-xs font-semibold text-[#A49B8E]">
            {hook.formatLabel}
          </span>
          <span className="text-[#565048]">·</span>
          <span className="text-xs text-[#8E867B]">
            حدود {toFa(effectiveHook.estimatedDurationSec)} ثانیه
          </span>
          <span className="text-[#565048]">·</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            تطابق {toFa(hook.verbatimScore)}٪
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black leading-snug tracking-tight text-[#FAF6EE]">
          {hook.title}
        </h1>

        {hook.rationale && (
          <p className="text-sm leading-7 text-[#9E9588] max-w-2xl">
            {hook.rationale}
          </p>
        )}

        {/* Calm 3-Tab Mode Switcher (horizontally scrollable on narrow phones) */}
        <div className="pt-2 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1 rounded-xl console-inset p-1 whitespace-nowrap">
            {(
              [
                { id: 'scenario', label: 'سناریو و پیش‌شنید ویس', icon: Headphones },
                {
                  id: 'viral',
                  label: 'رادار وایرالیته و موزیک',
                  icon: Activity,
                  badge: viralScoreDisplay !== null ? `${toFa(viralScoreDisplay)}٪` : undefined,
                },
                { id: 'publishing', label: 'پکیج انتشار ادمین', icon: Send },
              ] as Array<{
                id: 'scenario' | 'viral' | 'publishing';
                label: string;
                icon: typeof Headphones;
                badge?: string;
              }>
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                    active ? 'text-[#141210]' : 'text-[#9E9588] hover:text-[#FAF6EE]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="scenarioSubTab"
                      transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-[#F5F1E8]"
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`relative z-10 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black ${
                        active
                          ? 'bg-[#141210]/12 text-[#141210]'
                          : 'bg-[#EAB349]/15 text-[#F6CE78]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'viral' ? (
          <motion.div key="viral-tab" {...tabPanelMotion}>
            <ViralRadarPanel
              hook={effectiveHook}
              inMediaResApplied={inMediaResActive}
              onToggleInMediaRes={
                canTrimInMediaRes
                  ? () => setInMediaResActive((v) => !v)
                  : undefined
              }
            />
          </motion.div>
        ) : activeTab === 'publishing' ? (
          <motion.div key="publishing-tab" {...tabPanelMotion}>
            <PublishingKitPanel
              hook={effectiveHook}
              onRegenerate={() => onRegeneratePublishingKit(hook.id)}
              onRegenerateCarousel={() => onRegenerateCarousel(hook.id)}
            />
          </motion.div>
        ) : (
          <motion.div key="scenario-tab" {...tabPanelMotion}>
            {/* A/B Hook Testing Strip */}
            <section className="pt-7">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#DDD5C8]">
                    <FlaskConical className="h-3.5 w-3.5 text-sky-300" />
                    تست A/B قلاب روی همین سناریو
                    {hook.tier === 'silver' && (
                      <span className="rounded-md bg-sky-400/12 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        عالی برای تریال ریلز
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={loadingVariants}
                    onClick={handleRefreshVariants}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-[#9E9588] transition hover:border-white/25 hover:text-[#FAF6EE] disabled:opacity-45 cursor-pointer"
                  >
                    {loadingVariants ? (
                      <Loader2 className="h-3 w-3 animate-spin text-[#EAB349]" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    پیشنهاد قلاب‌های جدید
                  </button>
                </div>

                {/* Variant Switcher Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVariantId(null)}
                    className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                      !activeVariant
                        ? 'border-[#EAB349]/60 text-[#F8D57E]'
                        : 'border-white/[0.08] bg-black/25 text-[#9E9588] hover:border-white/20 hover:text-[#FAF6EE]'
                    }`}
                  >
                    {!activeVariant && (
                      <motion.span
                        layoutId="abHookPill"
                        transition={SPRING_SNAPPY}
                        className="absolute inset-0 rounded-xl bg-[#EAB349]/15"
                      />
                    )}
                    <span className="relative z-10 font-mono text-[11px]">A</span>
                    <span className="relative z-10">قلاب اصلی</span>
                  </button>

                  {hook.alternativeHooks.map((variant, idx) => {
                    const selected = activeVariant?.id === variant.id;
                    const letter = VARIANT_LETTERS[idx] || String(idx + 2);
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          setInMediaResActive(false);
                        }}
                        className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                          selected
                            ? 'border-sky-400/60 text-sky-200'
                            : 'border-white/[0.08] bg-black/25 text-[#9E9588] hover:border-white/20 hover:text-[#FAF6EE]'
                        }`}
                      >
                        {selected && (
                          <motion.span
                            layoutId="abHookPill"
                            transition={SPRING_SNAPPY}
                            className="absolute inset-0 rounded-xl bg-sky-400/15"
                          />
                        )}
                        <span className="relative z-10 font-mono text-[11px]">{letter}</span>
                        <span className="relative z-10">{variant.angleLabel}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active A/B Preview Banner */}
                <AnimatePresence>
                  {activeVariant && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-400/25 bg-sky-500/[0.08] px-3.5 py-2.5 text-xs">
                        <div className="flex items-start gap-2 text-sky-100/90 min-w-0 flex-1">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
                          <span className="leading-5">
                            <strong className="font-extrabold text-sky-200">
                              پیش‌نمایش تست A/B:{' '}
                            </strong>
                            {activeVariant.whyItWorks} — دکمه پخش پایین را بزنید تا خروجی صوتی‌اش را روی همین بدنه بشنوید.
                          </span>
                        </div>

                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          disabled={applyingVariant}
                          onClick={handleCommitVariant}
                          className="inline-flex items-center gap-1.5 rounded-lg seal-gold px-3.5 py-1.5 text-[11px] font-black shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                          {applyingVariant ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          تثبیت به عنوان قلاب اصلی
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* #9 In-Media-Res Filler Intro Trim Toggle (Live Audio + Text Trim!) */}
                {canTrimInMediaRes && hook.inMediaResCut && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs">
                    <div className="flex items-center gap-2 text-[#B4ABA0]">
                      <Scissors className="h-3.5 w-3.5 text-[#EAB349] shrink-0" />
                      <span>
                        تشخیص مقدمه اضافه ({toFa(hook.inMediaResCut.savedSeconds)} ثانیه اول):{' '}
                        <strong className="text-[#FAF6EE]">
                          شروع مستقیم از وسط جمله برای توقف سریع‌تر مخاطب
                        </strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInMediaResActive((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-black transition cursor-pointer ${
                        inMediaResActive
                          ? 'border-emerald-400/50 bg-emerald-500/18 text-emerald-300'
                          : 'border-[#EAB349]/40 bg-[#EAB349]/12 text-[#F7D782] hover:bg-[#EAB349] hover:text-[#141210]'
                      }`}
                    >
                      <Scissors className="h-3 w-3" />
                      {inMediaResActive
                        ? `برش فعال است (شروع از ${formatTimecode(hook.inMediaResCut.suggestedTrimStartSec)}) ✓`
                        : `برش مقدمه (صرفه‌جویی ${toFa(hook.inMediaResCut.savedSeconds)}ث)`}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Stitched Rough-Cut Voice Preview Player */}
            <section className="pt-6">
              <ScenarioRoughCutPlayer
                ref={roughCutRef}
                hook={effectiveHook}
                audioFilesById={audioFilesById}
                onActiveBeatChange={handleActiveBeatChange}
              />
            </section>

            {/* Micro-Loop Seamless Cue Banner when viewing a #7 Micro-Loop Reel */}
            {hook.specialFormat === 'micro_loop' && hook.viralAudit?.loopSeamNote && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] px-4 py-3 text-xs leading-6 text-fuchsia-100">
                <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
                <span>
                  <strong className="font-extrabold text-fuchsia-200">حالت لوپ بی‌پایان فعال است: </strong>
                  {hook.viralAudit.loopSeamNote}
                </span>
              </div>
            )}

            {/* Pure Editorial Scenario Cut-Sheet */}
            <section className="py-9">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E867B]">
                <span className="font-bold text-[#C7BEB0]">
                  سناریوی دقیق گفتار ({toFa(effectiveHook.scenarioBeats.length)}{' '}
                  {hook.storyFormat === 'story_sequence' ? 'اسلاید' : 'برش'}) — بدون تغییر برای تدوین
                </span>
                <span>روی هر برش کلیک کنید تا از همان‌جا در ویس یکپارچه پخش شود</span>
              </div>

              <div className="relative space-y-5 sm:space-y-6 pr-6 sm:pr-8 before:absolute before:right-[9px] sm:before:right-[11px] before:top-4 before:bottom-4 before:w-[1.5px] before:bg-gradient-to-b before:from-white/25 before:via-white/10 before:to-transparent">
                {effectiveHook.scenarioBeats.map((beat, idx) => {
                  const isCurrent = activeBeatIdx === idx;
                  const beatColor = BEAT_COLORS[idx % BEAT_COLORS.length];
                  const isSwappedHookBeat = idx === 0 && Boolean(activeVariant);
                  const isTrimmedLeadBeat = idx === 0 && inMediaResActive && Boolean(hook.inMediaResCut?.hasFillerIntro);

                  return (
                    <motion.div
                      key={`${effectiveHook.id}-${beat.beatOrder}-${beat.segmentId}-${isTrimmedLeadBeat ? 'trim' : 'full'}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        layout: SPRING_SOFT,
                        delay: Math.min(idx * 0.035, 0.2),
                        duration: 0.28,
                        ease: STUDIO_EASE,
                      }}
                      whileHover={{ y: -1.5 }}
                      className={`relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${
                        isCurrent
                          ? 'border-[#EAB349]/55 bg-[#EAB349]/[0.07] shadow-[0_0_32px_-12px_rgba(234,179,73,0.4)]'
                          : isSwappedHookBeat
                            ? 'border-sky-400/40 bg-sky-400/[0.05]'
                            : isTrimmedLeadBeat
                              ? 'border-emerald-400/35 bg-emerald-500/[0.04]'
                              : 'border-white/[0.06] bg-white/[0.018] hover:border-white/[0.14]'
                      }`}
                    >
                      {/* Timeline Numbered Dot */}
                      <span
                        className={`absolute -right-[33px] sm:-right-[43px] top-5 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] sm:text-[11px] font-black text-[#12100E] ring-4 ring-[#0C0B0A] transition-transform ${
                          isCurrent && isRoughCutPlaying
                            ? 'scale-115 shadow-[0_0_14px_rgba(234,179,73,0.8)]'
                            : ''
                        }`}
                        style={{ backgroundColor: beatColor }}
                      >
                        {toFa(beat.beatOrder)}
                      </span>

                      {/* Clean Single-Line Beat Meta */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#DDD5C8]">
                            {beat.label}
                          </span>
                          {isSwappedHookBeat && (
                            <span className="rounded-md bg-sky-400/20 px-2 py-0.5 text-[10px] font-black text-sky-300">
                              قلاب جایگزین A/B
                            </span>
                          )}
                          {isTrimmedLeadBeat && (
                            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                              شروع وسط جمله ✂️
                            </span>
                          )}
                          {isCurrent && isRoughCutPlaying && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAB349]/40 bg-[#EAB349]/15 px-2.5 py-0.5 text-[10px] font-extrabold text-[#F8D57E]">
                              <EqualizerBars active color="#F8D57E" bars={3} height={10} />
                              در حال پخش
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs">
                          {isMultiFile && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300">
                              <FileAudio className="h-3 w-3" />
                              {beat.sourceAudioTitle.split('—')[0].trim()}
                            </span>
                          )}

                          <span className="text-[11px] text-[#8E867B]">{beat.speakerName}</span>

                          <button
                            type="button"
                            onClick={() => roughCutRef.current?.playBeat(idx)}
                            title="پخش از این برش در ویس یکپارچه"
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold transition cursor-pointer ${
                              isCurrent
                                ? 'border-[#EAB349] bg-[#EAB349] text-[#141210]'
                                : 'border-[#EAB349]/35 bg-[#EAB349]/12 text-[#F7D782] hover:bg-[#EAB349] hover:text-[#141210]'
                            }`}
                            dir="ltr"
                          >
                            <Play className="h-2.5 w-2.5 fill-current" />
                            {formatTimecode(beat.startSec)} — {formatTimecode(beat.endSec)}
                          </button>

                          {onOpenTranscriptAtSegment && (
                            <button
                              type="button"
                              onClick={() => onOpenTranscriptAtSegment(beat.segmentId)}
                              title="مشاهده دقیق در متن کامل"
                              className="text-[11px] text-[#7D7469] hover:text-[#FAF6EE] cursor-pointer"
                            >
                              در متن ↗
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Generous, High-Legibility Verbatim Dialogue (shows trimmed intro struck-through when #9 is ON!) */}
                      <p className="mt-3.5 text-base sm:text-[17px] font-medium leading-9 text-[#FAF6EE]">
                        {isTrimmedLeadBeat && hook.inMediaResCut ? (
                          <>
                            <span className="ml-1.5 line-through text-[#6F685E] decoration-rose-400/60">
                              {hook.inMediaResCut.trimmedIntroText}
                            </span>
                            <span>«{hook.inMediaResCut.punchlineVerbatim}»</span>
                          </>
                        ) : (
                          <>«{beat.verbatimText}»</>
                        )}
                      </p>

                      {/* Quiet Non-Spoken Editing Cue */}
                      {beat.editingNote && (
                        <div className="mt-3 flex items-start gap-2 border-t border-white/[0.05] pt-2.5 text-xs leading-6 text-[#8E867B]">
                          <Clapperboard className="mt-1 h-3.5 w-3.5 shrink-0 text-[#EAB349]/75" />
                          <span>
                            <strong className="font-semibold text-[#B4ABA0]">نکته تدوین: </strong>
                            {beat.editingNote}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calm Book-Like Previous / Next Hook Navigation */}
      {(prevHook || nextHook) && (
        <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] pt-6">
          {prevHook ? (
            <button
              type="button"
              onClick={() => onSelectHook(prevHook)}
              className="group flex items-center gap-2.5 text-right text-xs text-[#9E9588] transition hover:text-[#FAF6EE] cursor-pointer max-w-[46%]"
            >
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] text-[#7D7469]">قلاب قبلی</div>
                <div className="truncate font-bold">{prevHook.title}</div>
              </div>
            </button>
          ) : (
            <span />
          )}

          {nextHook ? (
            <button
              type="button"
              onClick={() => onSelectHook(nextHook)}
              className="group flex items-center gap-2.5 text-left text-xs text-[#9E9588] transition hover:text-[#FAF6EE] cursor-pointer max-w-[46%]"
            >
              <div className="min-w-0">
                <div className="text-[10px] text-[#7D7469]">قلاب بعدی</div>
                <div className="truncate font-bold">{nextHook.title}</div>
              </div>
              <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
      {/* Telegram Group Dispatch Modal */}
      <TelegramSendModal
        open={telegramModalOpen}
        hook={effectiveHook}
        settings={settings}
        audioFilesById={audioFilesById}
        onClose={() => setTelegramModalOpen(false)}
        onOpenTelegramSettings={onOpenTelegramSettings}
      />
    </motion.div>
  );
}
