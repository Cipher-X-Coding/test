import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  Scissors,
  Search,
  Sparkles,
  Swords,
} from 'lucide-react';
import type { HookTier, HookWithScenario, ViralBlueprintId } from '../types';
import {
  BLUEPRINT_META,
  TIER_META,
  buildEditorCutSheet,
  downloadTextFile,
  toFa,
} from '../utils/format';
import { openHandoffSheetPreview } from '../utils/handoffSheet';
import { SPRING_SNAPPY, SPRING_SOFT, STUDIO_EASE } from '../utils/motion';
import { SpotlightSurface } from './StudioEffects';

interface ContentBankProps {
  projectTitle: string;
  hooks: HookWithScenario[];
  onOpenHook: (hook: HookWithScenario, filteredList: HookWithScenario[]) => void;
  onOpenQuoteBuilder: () => void;
  onOpenHookArena: () => void;
}

export function ContentBank({
  projectTitle,
  hooks,
  onOpenHook,
  onOpenQuoteBuilder,
  onOpenHookArena,
}: ContentBankProps) {
  const [tier, setTier] = useState<'all' | HookTier>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'audio' | 'combination'>('all');
  const [blueprintFilter, setBlueprintFilter] = useState<'all' | ViralBlueprintId>('all');
  const [query, setQuery] = useState('');

  // Show only viral blueprints present in this project (with counts)
  const blueprintCounts = useMemo(() => {
    const map = new Map<ViralBlueprintId, number>();
    for (const h of hooks) {
      const bp = h.viralBlueprint || 'myth_buster';
      map.set(bp, (map.get(bp) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [hooks]);

  const filtered = hooks.filter((h) => {
    if (tier !== 'all' && h.tier !== tier) return false;
    if (sourceFilter !== 'all' && h.sourceType !== sourceFilter) return false;
    if (blueprintFilter !== 'all' && (h.viralBlueprint || 'myth_buster') !== blueprintFilter) {
      return false;
    }
    if (query.trim()) {
      const q = query.trim();
      return (
        h.title.includes(q) ||
        h.hookVerbatim.includes(q) ||
        h.hookSourceAudioTitle.includes(q)
      );
    }
    return true;
  });

  function exportAllFiltered() {
    const content = filtered.map((h) => buildEditorCutSheet(h)).join('\n\n\n');
    const safeProject = projectTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
    downloadTextFile(`content-bank-${safeProject}.txt`, content);
  }

  return (
    <div className="space-y-5">
      {/* Slim Filter & Export Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <div className="inline-flex shrink-0 gap-1 rounded-xl console-inset p-1">
            {(
              [
                { id: 'all', label: 'همه', dot: '#F5F1E8' },
                { id: 'gold', label: 'طلایی · پست', dot: '#EAB349' },
                { id: 'silver', label: 'نقره‌ای · تریال', dot: '#CBD5E1' },
                { id: 'bronze', label: 'برنزی · استوری', dot: '#E4834B' },
              ] as const
            ).map((opt) => {
              const active = tier === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTier(opt.id)}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    active ? 'text-[#FAF6EE]' : 'text-[#8E867B] hover:text-[#DDD5C8]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="bankTierPill"
                      transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                      className="absolute inset-0 rounded-lg border border-white/12 bg-white/[0.09]"
                    />
                  )}
                  <span
                    className="relative z-10 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: opt.dot }}
                  />
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="inline-flex gap-1 rounded-xl console-inset p-1">
            {(
              [
                { id: 'all', label: 'همه' },
                { id: 'audio', label: 'تکی' },
                { id: 'combination', label: 'ترکیبی' },
              ] as const
            ).map((opt) => {
              const active = sourceFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSourceFilter(opt.id)}
                  className={`relative rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    active ? 'text-sky-200' : 'text-[#8E867B] hover:text-[#DDD5C8]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="bankSourcePill"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-lg border border-sky-400/25 bg-sky-400/15"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] sm:flex-initial">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8E867B]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو..."
              className="w-full sm:w-44 rounded-xl console-inset py-2 pr-8 pl-3 text-xs text-[#F5F1E8] placeholder-[#6F685E] outline-none focus:border-[#EAB349]/50"
            />
          </div>

          <button
            type="button"
            onClick={onOpenQuoteBuilder}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB349]/35 bg-[#EAB349]/10 px-3 py-2 text-xs font-extrabold text-[#F8D57E] transition hover:bg-[#EAB349]/18 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            شکارچی جملات
          </button>

          <button
            type="button"
            disabled={hooks.length < 2}
            onClick={onOpenHookArena}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-xs font-extrabold text-sky-200 transition hover:bg-sky-500/18 disabled:opacity-40 cursor-pointer"
          >
            <Swords className="h-3.5 w-3.5" />
            نبرد قلاب‌ها
          </button>

          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => openHandoffSheetPreview(projectTitle, filtered)}
            title="بسته تحویل شکیل (HTML / چاپ PDF)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-bold text-[#FAF6EE] transition hover:border-[#EAB349]/45 disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#EAB349]" />
            بسته تحویل
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={filtered.length === 0}
            onClick={exportAllFiltered}
            title="دانلود فایل متنی (.txt)"
            className="rounded-xl border border-white/12 bg-white/[0.05] p-2 text-[#C7BEB0] transition hover:border-[#EAB349]/45 hover:text-[#FAF6EE] disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-[#EAB349]" />
          </motion.button>
        </div>
      </div>

      {/* #13 Quiet Viral Blueprint Filter Pills */}
      {blueprintCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ml-1 text-[11px] font-bold text-[#7D7469]">الگوی وایرال:</span>
          <button
            type="button"
            onClick={() => setBlueprintFilter('all')}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              blueprintFilter === 'all'
                ? 'border-white/25 bg-white/[0.1] text-[#FAF6EE]'
                : 'border-white/[0.06] bg-white/[0.02] text-[#8E867B] hover:text-[#DDD5C8]'
            }`}
          >
            همه الگوها
          </button>
          {blueprintCounts.map(([bpId, count]) => {
            const bp = BLUEPRINT_META[bpId];
            const active = blueprintFilter === bpId;
            return (
              <button
                key={bpId}
                type="button"
                onClick={() => setBlueprintFilter(active ? 'all' : bpId)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  active
                    ? bp.badgeClass
                    : 'border-white/[0.06] bg-white/[0.02] text-[#8E867B] hover:border-white/15 hover:text-[#DDD5C8]'
                }`}
              >
                <span>{bp.shortLabel}</span>
                <span className="opacity-70">{toFa(count)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Clean, Spacious Gallery of Hook Cards */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22 }}
          className="console-panel rounded-3xl p-16 text-center text-sm text-[#8E867B]"
        >
          موردی مطابق با فیلتر شما یافت نشد.
        </motion.div>
      ) : (
        <motion.div layout className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
          {filtered.map((hook, idx) => {
            const meta = TIER_META[hook.tier];
            const bp = BLUEPRINT_META[hook.viralBlueprint || 'myth_buster'];
            return (
              <motion.div
                key={hook.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{
                  layout: SPRING_SOFT,
                  duration: 0.26,
                  delay: Math.min(idx * 0.025, 0.16),
                  ease: STUDIO_EASE,
                }}
                whileHover={{ y: -4, transition: SPRING_SOFT }}
                whileTap={{ scale: 0.985 }}
              >
                <SpotlightSurface
                  onClick={() => onOpenHook(hook, filtered)}
                  spotlightColor={meta.glowColor}
                  className="group foil-card flex h-full cursor-pointer flex-col justify-between rounded-3xl transition-all hover:border-white/22"
                >
                  <div>
                    <div className={`h-[2.5px] w-full ${meta.accentBar}`} />
                    <div className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${meta.sealClass}`}
                          >
                            {meta.shortLabel}
                          </span>
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${bp.badgeClass}`}
                          >
                            {bp.shortLabel}
                          </span>
                        </div>

                        {hook.viralAudit && (
                          <span
                            title="امتیاز رادار وایرالیته"
                            className="inline-flex items-center gap-0.5 font-mono text-[11px] font-extrabold text-[#F6CE78]"
                          >
                            <Activity className="h-3 w-3" />
                            {toFa(hook.viralAudit.overallScore)}٪
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 line-clamp-2 text-sm font-black leading-6 text-[#FAF6EE] group-hover:text-[#F8D57E] transition">
                        {hook.title}
                      </h3>

                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[#8E867B]">
                        <span className="inline-flex items-center gap-1.5 truncate">
                          {hook.storyFormat === 'story_sequence' && (
                            <Layers className="h-3 w-3 text-[#E4834B]" />
                          )}
                          {hook.formatLabel.split('(')[0].trim()}
                        </span>
                        <span className="truncate text-[10px] text-[#6F685E] max-w-[110px]">
                          {hook.sourceType === 'combination'
                            ? 'ترکیبی'
                            : hook.hookSourceAudioTitle.split('—')[0].trim()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3.5 text-[11px]">
                    <div className="flex items-center gap-2.5 text-[#7D7469]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />~{toFa(hook.estimatedDurationSec)}ث
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Scissors className="h-3 w-3" />
                        {toFa(hook.scenarioBeats.length)}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-extrabold text-[#DDD5C8] group-hover:text-[#F8D57E] transition">
                      سناریو
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
    </div>
  );
}
