import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Disc3,
  Layers,
  UploadCloud,
} from 'lucide-react';
import type { AudioFileSummary } from '../types';
import { formatTimecode, toFa } from '../utils/format';
import { MiniWaveformStrip, SpotlightSurface } from './StudioEffects';
import { SPRING_SNAPPY, SPRING_SOFT, STUDIO_EASE, collapseMotion } from '../utils/motion';

interface AudioPartListProps {
  audioFiles: AudioFileSummary[];
  onOpenAudio: (audioId: string) => void;
  onOpenUpload: () => void;
  onCombineSelected: (selectedIds: string[]) => void;
}

export function AudioPartList({
  audioFiles,
  onOpenAudio,
  onOpenUpload,
  onCombineSelected,
}: AudioPartListProps) {
  const [selectedForCombine, setSelectedForCombine] = useState<string[]>([]);

  function toggleSelect(id: string) {
    setSelectedForCombine((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (audioFiles.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-3xl console-panel p-16 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#EAB349]/30 bg-[#EAB349]/10 text-[#F6CE78]">
          <Disc3 className="h-7 w-7 animate-[spin_10s_linear_infinite]" />
        </div>
        <h3 className="mt-5 text-base font-black text-[#F5F1E8]">
          اولین فایل صوتی سمینار را اضافه کنید
        </h3>
        <p className="mt-1.5 max-w-sm text-xs leading-6 text-[#8E867B]">
          پس از ارسال، گویندگان تفکیک می‌شوند و قلاب‌های طلایی، نقره‌ای و برنزی با سناریوی دقیق تدوین آماده می‌شوند.
        </p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onOpenUpload}
          className="mt-6 inline-flex items-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black cursor-pointer"
        >
          <UploadCloud className="h-4 w-4" />
          افزودن فایل صوتی
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Contextual Floating Action Bar when selecting files to combine */}
      <AnimatePresence>
        {selectedForCombine.length > 0 && (
          <motion.div
            initial={collapseMotion.initial}
            animate={collapseMotion.animate}
            exit={collapseMotion.exit}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAB349]/35 bg-[#201B14] px-4 py-3">
              <div className="flex items-center gap-2.5 text-xs font-bold text-[#F7E5B7]">
                <Layers className="h-4 w-4 text-[#EAB349]" />
                <span>
                  <motion.span
                    key={selectedForCombine.length}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING_SNAPPY}
                    className="inline-block ml-1 font-black text-[#F8D57E]"
                  >
                    {toFa(selectedForCombine.length)}
                  </motion.span>
                  فایل برای ترکیب انتخاب شده
                  {selectedForCombine.length < 2 && ' (حداقل ۱ فایل دیگر انتخاب کنید)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedForCombine([])}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#A49B8E] hover:text-white cursor-pointer"
                >
                  لغو
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={selectedForCombine.length < 2}
                  onClick={() => {
                    onCombineSelected(selectedForCombine);
                    setSelectedForCombine([]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl seal-gold px-4 py-1.5 text-xs font-black disabled:opacity-40 cursor-pointer"
                >
                  ترکیب و تعیین ترتیب
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean Spacious Audio Reels List */}
      <div className="grid gap-4 md:grid-cols-2">
        {audioFiles.map((file, idx) => {
          const isChecked = selectedForCombine.includes(file.id);
          return (
            <motion.div
              key={file.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.34, delay: Math.min(idx * 0.045, 0.2), ease: STUDIO_EASE }}
              whileHover={{ y: -3, transition: SPRING_SOFT }}
              whileTap={{ scale: 0.99 }}
            >
              <SpotlightSurface
                onClick={() => onOpenAudio(file.id)}
                className={`group foil-card cursor-pointer rounded-3xl p-5 sm:p-6 transition-all duration-200 ${
                  isChecked
                    ? 'border-[#EAB349]/60 ring-1 ring-[#EAB349]/40 shadow-[0_0_28px_-12px_rgba(234,179,73,0.4)]'
                    : 'hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      title="انتخاب برای ترکیب چند صدا"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(file.id);
                      }}
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition cursor-pointer ${
                        isChecked
                          ? 'seal-gold border-transparent'
                          : 'border-white/15 bg-black/30 text-transparent hover:border-[#EAB349]/60'
                      }`}
                    >
                      <AnimatePresence>
                        {isChecked && (
                          <motion.span
                            initial={{ scale: 0, rotate: -25 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={SPRING_SNAPPY}
                          >
                            <Check className="h-3 w-3 stroke-[3]" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>

                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black leading-7 text-[#FAF6EE] group-hover:text-[#F8D57E] transition">
                        {file.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#8E867B]">
                        <span className="font-mono" dir="ltr">
                          {formatTimecode(file.durationSec)}
                        </span>
                        <span>·</span>
                        <span>{toFa(file.speakerCount)} گوینده</span>
                        <span>·</span>
                        <span>{toFa(file.goldCount + file.silverCount + file.bronzeCount)} قلاب</span>
                      </div>
                    </div>
                  </div>

                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[#9E9588] transition group-hover:bg-[#EAB349]/15 group-hover:text-[#F8D57E]">
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  </span>
                </div>

                {/* Subtle Acoustic Strip */}
                <div className="mt-5 opacity-75 group-hover:opacity-100 transition-opacity">
                  <MiniWaveformStrip seed={file.id + file.title} barCount={44} />
                </div>

                {/* Whisper-Clean Metallic Tier Summary */}
                <div className="mt-4 flex items-center gap-4 text-[11px] font-bold">
                  <span className="inline-flex items-center gap-1.5 text-[#F6CE78]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EAB349]" />
                    {toFa(file.goldCount)} طلایی
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#CBD5E1]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#CBD5E1]" />
                    {toFa(file.silverCount)} نقره‌ای
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#F5B084]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E4834B]" />
                    {toFa(file.bronzeCount)} برنزی
                  </span>
                </div>
              </SpotlightSurface>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
