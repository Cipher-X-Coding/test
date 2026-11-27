import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  FileAudio,
  Loader2,
  Pause,
  Play,
  Scissors,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../../api';
import type { HookTier, HookWithScenario, ProjectQuoteSegment } from '../../types';
import { formatTimecode, toFa } from '../../utils/format';
import { SPRING_SNAPPY, SPRING_SOFT, collapseMotion, iconSwapMotion } from '../../utils/motion';

interface QuoteBuilderPageProps {
  projectId: string;
  projectTitle: string;
  onBack: () => void;
  onCreatedScenario: (hook: HookWithScenario) => Promise<void>;
}

export function QuoteBuilderPage({
  projectId,
  projectTitle,
  onBack,
  onCreatedScenario,
}: QuoteBuilderPageProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAtSecRef = useRef<number | null>(null);

  const [segments, setSegments] = useState<ProjectQuoteSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [audioFilter, setAudioFilter] = useState<string>('all');
  const [speakerFilter, setSpeakerFilter] = useState<string>('all');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [tier, setTier] = useState<HookTier>('gold');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [playingSegId, setPlayingSegId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listProjectQuoteSegments(projectId)
      .then((data) => setSegments(data))
      .finally(() => setLoading(false));
  }, [projectId]);

  const byId = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  const audioOptions = useMemo(() => {
    const map = new Map<string, string>();
    segments.forEach((s) => map.set(s.audioFileId, s.audioTitle));
    return Array.from(map.entries());
  }, [segments]);

  const speakerOptions = useMemo(() => {
    const set = new Set<string>();
    segments.forEach((s) => set.add(s.speakerName));
    return Array.from(set);
  }, [segments]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return segments.filter((s) => {
      if (audioFilter !== 'all' && s.audioFileId !== audioFilter) return false;
      if (speakerFilter !== 'all' && s.speakerName !== speakerFilter) return false;
      if (q) {
        return (
          s.text.includes(q) ||
          s.speakerName.includes(q) ||
          s.audioTitle.includes(q)
        );
      }
      return true;
    });
  }, [segments, audioFilter, speakerFilter, query]);

  function toggleSegment(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function moveSelected(idx: number, delta: -1 | 1) {
    const target = idx + delta;
    if (target < 0 || target >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function playPreview(seg: ProjectQuoteSegment) {
    const el = audioRef.current;
    if (!el) return;
    if (playingSegId === seg.id) {
      el.pause();
      setPlayingSegId(null);
      return;
    }

    stopAtSecRef.current = seg.endSec;
    setPlayingSegId(seg.id);

    const startPlayback = () => {
      el.currentTime = seg.startSec;
      el.play().catch(() => setPlayingSegId(null));
    };

    if (!el.src.endsWith(seg.audioUrl)) {
      el.src = seg.audioUrl;
      el.load();
      el.addEventListener('loadedmetadata', startPlayback, { once: true });
    } else {
      startPlayback();
    }
  }

  const selectedSegments = selectedIds
    .map((id) => byId.get(id))
    .filter((s): s is ProjectQuoteSegment => Boolean(s));

  const totalEstSec = selectedSegments.reduce(
    (sum, s) => sum + Math.max(5, s.endSec - s.startSec),
    0
  );

  async function handleCreate() {
    if (selectedIds.length === 0) {
      setError('حداقل یک جمله از لیست انتخاب کنید.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const created = await api.createCustomScenario(projectId, {
        title: title.trim() || undefined,
        tier,
        segmentIds: selectedIds,
      });
      await onCreatedScenario(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ساخت سناریو');
    } finally {
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-5xl space-y-8 pb-16"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          if (
            stopAtSecRef.current !== null &&
            e.currentTarget.currentTime >= stopAtSecRef.current
          ) {
            e.currentTarget.pause();
            setPlayingSegId(null);
          }
        }}
        onEnded={() => setPlayingSegId(null)}
      />

      {/* Quiet Back Row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/40 hover:text-[#FAF6EE] cursor-pointer"
        >
          <ArrowRight className="h-3.5 w-3.5 text-[#EAB349]" />
          بازگشت به خزانه قلاب‌ها
        </button>
      </div>

      {/* Editorial Header */}
      <header className="space-y-2 border-b border-white/[0.07] pb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-[#FAF6EE]">
          شکارچی جملات طلایی و سناریوساز دستی
        </h1>
        <p className="text-xs leading-6 text-[#9E9588] max-w-2xl">
          در کل فایل‌های صوتی «{projectTitle}» بر اساس موضوع جستجو کنید، جملات دلخواهتان را از هر پارت انتخاب و مرتب کنید تا مستقیم یک سناریوی ۱۰۰٪ عین متن همراه با ویس یکپارچه ساخته شود.
        </p>
      </header>

      {/* Selected Sequence Builder Panel (Calm, Appears Smoothly When Quotes Are Picked) */}
      <AnimatePresence>
      {selectedSegments.length > 0 && (
        <motion.section
          initial={collapseMotion.initial}
          animate={collapseMotion.animate}
          exit={collapseMotion.exit}
          className="overflow-hidden"
        >
        <div className="console-panel rounded-3xl border-[#EAB349]/35 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Scissors className="h-4 w-4 text-[#EAB349]" />
              <h2 className="text-sm font-black text-[#FAF6EE]">
                سناریوی دست‌چین شما ({toFa(selectedSegments.length)} برش · ~
                {toFa(totalEstSec)} ثانیه)
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[11px] font-bold text-[#8E867B] hover:text-red-300 cursor-pointer"
            >
              پاک کردن انتخاب‌ها
            </button>
          </div>

          {/* Ordered Picked Quotes */}
          <motion.div layout className="space-y-2">
            <AnimatePresence mode="popLayout">
            {selectedSegments.map((seg, idx) => (
              <motion.div
                key={seg.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={SPRING_SOFT}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <motion.span
                    key={idx}
                    initial={{ scale: 0.75 }}
                    animate={{ scale: 1 }}
                    transition={SPRING_SNAPPY}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg seal-gold text-xs font-black"
                  >
                    {toFa(idx + 1)}
                  </motion.span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#FAF6EE]">
                      «{seg.text}»
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[#8E867B]">
                      <span>{seg.audioTitle.split('—')[0].trim()}</span>
                      <span>·</span>
                      <span>{seg.speakerName}</span>
                      <span>·</span>
                      <span className="font-mono" dir="ltr">
                        {formatTimecode(seg.startSec)}—{formatTimecode(seg.endSec)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveSelected(idx, -1)}
                    className="rounded-lg p-1 text-[#A49B8E] hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === selectedSegments.length - 1}
                    onClick={() => moveSelected(idx, 1)}
                    className="rounded-lg p-1 text-[#A49B8E] hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSegment(seg.id)}
                    className="rounded-lg p-1 text-[#7D7469] hover:text-red-400 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>

          {/* Tier + Optional Title + Generate */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان سناریو (اختیاری)"
              className="flex-1 rounded-xl console-inset px-3.5 py-2.5 text-xs text-[#F5F1E8] placeholder-[#6F685E] outline-none focus:border-[#EAB349]/50"
            />

            <div className="inline-flex gap-1 rounded-xl console-inset p-1 shrink-0">
              {(
                [
                  { id: 'gold', label: 'طلایی · پست' },
                  { id: 'silver', label: 'نقره‌ای · تریال' },
                  { id: 'bronze', label: 'برنزی · استوری' },
                ] as const
              ).map((t) => {
                const active = tier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`relative rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                      active ? 'text-[#141210]' : 'text-[#8E867B] hover:text-[#FAF6EE]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="quoteBuilderTier"
                        transition={SPRING_SNAPPY}
                        className="absolute inset-0 rounded-lg bg-[#F5F1E8]"
                      />
                    )}
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              disabled={creating}
              onClick={handleCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ساخت...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  ساخت سناریو + ویس یکپارچه
                </>
              )}
            </motion.button>
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
        </motion.section>
      )}
      </AnimatePresence>

      {/* Search & Filter Row Across All Project Audios */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E867B]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی موضوع در کل سمینار... مثلاً: قیمت، پیگیری، تیم، فروش، ادمین"
            className="w-full rounded-2xl console-inset py-3 pr-10 pl-4 text-xs text-[#F5F1E8] placeholder-[#6F685E] outline-none focus:border-[#EAB349]/50"
          />
        </div>

        <select
          value={audioFilter}
          onChange={(e) => setAudioFilter(e.target.value)}
          className="rounded-xl console-inset px-3 py-2.5 text-xs text-[#DDD5C8] outline-none"
        >
          <option value="all">همه فایل‌های صوتی ({toFa(audioOptions.length)})</option>
          {audioOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title.split('—')[0].trim()}
            </option>
          ))}
        </select>

        <select
          value={speakerFilter}
          onChange={(e) => setSpeakerFilter(e.target.value)}
          className="rounded-xl console-inset px-3 py-2.5 text-xs text-[#DDD5C8] outline-none"
        >
          <option value="all">همه گویندگان</option>
          {speakerOptions.map((sp) => (
            <option key={sp} value={sp}>
              {sp}
            </option>
          ))}
        </select>
      </div>

      {/* Quotes List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#EAB349]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="console-panel rounded-3xl p-14 text-center text-sm text-[#8E867B]">
          جمله‌ای با این جستجو در فایل‌های پروژه پیدا نشد.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((seg) => {
            const pickedIdx = selectedIds.indexOf(seg.id);
            const isPicked = pickedIdx !== -1;
            const isPlaying = playingSegId === seg.id;

            return (
              <div
                key={seg.id}
                onClick={() => toggleSegment(seg.id)}
                className={`group rounded-2xl border p-5 transition cursor-pointer ${
                  isPicked
                    ? 'border-[#EAB349]/55 bg-[#EAB349]/[0.07]'
                    : 'border-white/[0.06] bg-white/[0.018] hover:border-white/[0.16]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black transition ${
                        isPicked
                          ? 'seal-gold'
                          : 'border border-white/15 bg-black/30 text-transparent group-hover:border-white/30'
                      }`}
                    >
                      {isPicked ? toFa(pickedIdx + 1) : <Check className="h-3.5 w-3.5" />}
                    </span>

                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/10 px-2 py-0.5 font-bold text-sky-300">
                          <FileAudio className="h-3 w-3" />
                          {seg.audioTitle.split('—')[0].trim()}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#DDD5C8]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: seg.speakerColor }}
                          />
                          {seg.speakerName}
                        </span>
                        <span className="font-mono text-[#8E867B]" dir="ltr">
                          {formatTimecode(seg.startSec)} — {formatTimecode(seg.endSec)}
                        </span>
                      </div>

                      <p className="text-sm leading-8 text-[#FAF6EE]">«{seg.text}»</p>
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(seg);
                    }}
                    title="شنیدن این جمله"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
                      isPlaying
                        ? 'border-[#EAB349] bg-[#EAB349] text-[#141210] play-aura-active'
                        : 'border-white/10 bg-white/[0.04] text-[#DDD5C8] hover:border-[#EAB349]/50 hover:text-[#F8D57E]'
                    }`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isPlaying ? (
                        <motion.span key="pause" {...iconSwapMotion}>
                          <Pause className="h-3.5 w-3.5 fill-current" />
                        </motion.span>
                      ) : (
                        <motion.span key="play" {...iconSwapMotion}>
                          <Play className="h-3.5 w-3.5 fill-current translate-x-[1px]" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
