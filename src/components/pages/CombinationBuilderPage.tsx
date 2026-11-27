import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Layers,
  Loader2,
  X,
} from 'lucide-react';
import type { AudioFileSummary, CombinationDetail } from '../../types';
import { formatTimecode, toFa } from '../../utils/format';
import { SPRING_SNAPPY, SPRING_SOFT } from '../../utils/motion';

interface CombinationBuilderPageProps {
  audioFiles: AudioFileSummary[];
  initialCombination?: CombinationDetail | null;
  preselectedAudioIds?: string[];
  onBack: () => void;
  onSubmit: (payload: {
    combinationId?: string;
    title: string;
    goal: string;
    orderedAudioIds: string[];
  }) => Promise<void>;
}

const GOAL_PRESETS = [
  'ساختار داستانی و قیف فروش پیوسته',
  'ترکیب سخنرانی اصلی با پرسش و پاسخ مخاطبین',
  'چالش ← راهکار اجرایی ← جمع‌بندی و CTA',
  'خلاصه طلایی کل سمینار برای رشته استوری و ریلز',
];

const TRACK_COLORS = ['#EAB349', '#38BDF8', '#34D399', '#E4834B', '#C084FC'];

export function CombinationBuilderPage({
  audioFiles,
  initialCombination,
  preselectedAudioIds,
  onBack,
  onSubmit,
}: CombinationBuilderPageProps) {
  const audioById = new Map(audioFiles.map((f) => [f.id, f]));

  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (initialCombination) {
      return initialCombination.orderedAudioIds.filter((id) => audioById.has(id));
    }
    if (preselectedAudioIds && preselectedAudioIds.length > 0) {
      return preselectedAudioIds.filter((id) => audioById.has(id));
    }
    return audioFiles.slice(0, Math.min(2, audioFiles.length)).map((a) => a.id);
  });

  const [title, setTitle] = useState(initialCombination?.title || '');
  const [goal, setGoal] = useState(initialCombination?.goal || GOAL_PRESETS[0]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleAudio(id: string) {
    setOrderedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= orderedIds.length) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function handleDragDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
  }

  async function handleSave() {
    if (orderedIds.length < 2) {
      setError('حداقل ۲ فایل صوتی برای ترکیب انتخاب کنید.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const finalTitle =
        title.trim() ||
        `ترکیب ${orderedIds.map((id) => audioById.get(id)?.title.split('—')[0]?.trim() || 'پارت').join(' ← ')}`;
      await onSubmit({
        combinationId: initialCombination?.id,
        title: finalTitle,
        goal,
        orderedAudioIds: orderedIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ترکیب فایل‌ها');
    } finally {
      setSubmitting(false);
    }
  }

  const totalDur = orderedIds.reduce(
    (sum, id) => sum + (audioById.get(id)?.durationSec || 0),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.26 }}
      className="mx-auto max-w-3xl space-y-9 pb-12"
    >
      {/* Top Quiet Back Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/40 hover:text-[#FAF6EE] cursor-pointer"
        >
          <ArrowRight className="h-3.5 w-3.5 text-[#EAB349]" />
          بازگشت
        </button>
      </div>

      {/* Editorial Header */}
      <header className="space-y-2 border-b border-white/[0.07] pb-6">
        <h1 className="text-2xl font-black text-[#FAF6EE]">
          {initialCombination ? 'ویرایش ترتیب ترکیب صوتی' : 'ساخت ترکیب صوتی جدید'}
        </h1>
        <p className="text-xs leading-6 text-[#9E9588]">
          فایل‌های صوتی مورد نظرتان را انتخاب کنید و ترتیب قرارگیریشان را بچینید تا قلاب‌ها و سناریوها مطابق همین ساختار نوشته شوند.
        </p>
      </header>

      {/* Step 1: Pick Audio Parts */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#FAF6EE]">۱. انتخاب صداها</h2>
          <span className="text-xs text-[#8E867B]">
            {toFa(orderedIds.length)} از {toFa(audioFiles.length)} انتخاب شده
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {audioFiles.map((file) => {
            const idx = orderedIds.indexOf(file.id);
            const selected = idx !== -1;
            return (
              <motion.button
                key={file.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => toggleAudio(file.id)}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition cursor-pointer ${
                  selected
                    ? 'border-[#EAB349]/50 bg-[#EAB349]/10 shadow-[0_0_24px_-12px_rgba(234,179,73,0.45)]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <motion.span
                    key={selected ? `sel-${idx}` : 'unsel'}
                    initial={{ scale: 0.75 }}
                    animate={{ scale: 1 }}
                    transition={SPRING_SNAPPY}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      selected
                        ? 'seal-gold'
                        : 'border border-white/15 bg-black/30 text-transparent'
                    }`}
                  >
                    {selected ? toFa(idx + 1) : <Check className="h-3.5 w-3.5" />}
                  </motion.span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-[#FAF6EE]">
                      {file.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[#8E867B]" dir="ltr">
                      {formatTimecode(file.durationSec)}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Order Timeline */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#FAF6EE]">
            ۲. تعیین ترتیب دقیق (بکشید یا جابه‌جا کنید)
          </h2>
          {orderedIds.length > 0 && (
            <span className="font-mono text-xs font-bold text-[#F6CE78]" dir="ltr">
              {formatTimecode(totalDur)}
            </span>
          )}
        </div>

        {orderedIds.length === 0 ? (
          <div className="console-inset rounded-2xl py-12 text-center text-xs text-[#7D7469]">
            حداقل ۲ فایل از مرحله بالا انتخاب کنید.
          </div>
        ) : (
          <div className="console-panel rounded-2xl p-5">
            <motion.div layout className="flex flex-wrap items-center gap-3">
              <AnimatePresence mode="popLayout">
              {orderedIds.map((id, idx) => {
                const file = audioById.get(id);
                if (!file) return null;
                const color = TRACK_COLORS[idx % TRACK_COLORS.length];
                return (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={SPRING_SOFT}
                    className="flex items-center gap-3"
                  >
                    <div
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDragDrop(idx)}
                      className={`flex items-center gap-2.5 rounded-2xl border bg-[#151311] px-3.5 py-3 transition ${
                        dragIdx === idx
                          ? 'border-[#EAB349] opacity-60 scale-[0.98]'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <GripVertical className="h-4 w-4 cursor-grab text-[#6F685E]" />
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black text-[#12100E]"
                        style={{ backgroundColor: color }}
                      >
                        {toFa(idx + 1)}
                      </span>
                      <div className="min-w-0 max-w-[170px]">
                        <div className="truncate text-xs font-extrabold text-[#FAF6EE]">
                          {file.title}
                        </div>
                        <div className="font-mono text-[10px] text-[#8E867B]" dir="ltr">
                          {formatTimecode(file.durationSec)}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 mr-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, -1)}
                          title="جلوتر"
                          className="rounded-md p-1 text-[#A49B8E] hover:bg-white/10 hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedIds.length - 1}
                          onClick={() => moveItem(idx, 1)}
                          title="عقب‌تر"
                          className="rounded-md p-1 text-[#A49B8E] hover:bg-white/10 hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAudio(id)}
                          title="حذف"
                          className="rounded-md p-1 text-[#7D7469] hover:text-red-400 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {idx < orderedIds.length - 1 && (
                      <span className="hidden sm:inline-block h-[2px] w-7 patch-signal rounded-full" />
                    )}
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </section>

      {/* Step 3: Name & Structure */}
      <section className="space-y-4">
        <h2 className="text-sm font-black text-[#FAF6EE]">۳. عنوان و ساختار خروجی</h2>
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="نام ترکیب (اختیاری) — مثلاً: از درد فروش تا سیستم پیگیری"
            className="w-full rounded-xl console-inset px-4 py-3 text-xs text-[#F5F1E8] placeholder-[#6F685E] outline-none focus:border-[#EAB349]/50"
          />

          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setGoal(preset)}
                className={`rounded-xl border px-3 py-2 text-xs transition cursor-pointer ${
                  goal === preset
                    ? 'border-[#EAB349]/50 bg-[#EAB349]/15 text-[#F8D57E] font-bold'
                    : 'border-white/[0.08] bg-white/[0.02] text-[#9E9588] hover:text-[#EAE2D6]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/12 px-5 py-2.5 text-xs font-bold text-[#A49B8E] hover:bg-white/[0.05] cursor-pointer"
        >
          انصراف
        </button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={submitting || orderedIds.length < 2}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl seal-gold px-6 py-2.5 text-xs font-black disabled:opacity-40 cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال ترکیب و تولید سناریوها...
            </>
          ) : (
            <>
              <Layers className="h-4 w-4" />
              {initialCombination ? 'ذخیره ترتیب و بازتولید' : 'ساخت ترکیب و تولید قلاب‌ها'}
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
