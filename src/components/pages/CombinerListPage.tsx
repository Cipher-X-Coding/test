import { motion } from 'framer-motion';
import { ArrowLeft, Layers, Plus } from 'lucide-react';
import type { CombinationSummary } from '../../types';
import { formatTimecode, toFa } from '../../utils/format';
import { SpotlightSurface } from '../StudioEffects';

interface CombinerListPageProps {
  combinations: CombinationSummary[];
  canCreate: boolean;
  onOpenCombination: (combinationId: string) => void;
  onCreateNew: () => void;
}

const TRACK_COLORS = ['#EAB349', '#38BDF8', '#34D399', '#E4834B', '#C084FC'];

export function CombinerListPage({
  combinations,
  canCreate,
  onOpenCombination,
  onCreateNew,
}: CombinerListPageProps) {
  if (!canCreate) {
    return (
      <div className="console-panel rounded-3xl p-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10 text-sky-300">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-base font-black text-[#FAF6EE]">
          برای ترکیب صداها، حداقل ۲ فایل صوتی نیاز است
        </h3>
        <p className="mt-2 mx-auto max-w-sm text-xs leading-6 text-[#8E867B]">
          فایل‌های بخش‌های مختلف سمینار را اضافه کنید تا بتوانید ترتیب دلخواهشان را بچینید و سناریوی پیوسته بگیرید.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtle Top Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8E867B]">
          هر ترکیب چند فایل صوتی را به ترتیب دلخواه شما کنار هم می‌گذارد و سناریوهای پیوسته می‌سازد.
        </p>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onCreateNew}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-extrabold text-[#FAF6EE] transition hover:border-[#EAB349]/50 hover:bg-[#EAB349]/12 hover:text-[#F8D57E] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          ساخت ترکیب جدید
        </motion.button>
      </div>

      {combinations.length === 0 ? (
        <div className="console-panel rounded-3xl p-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10 text-sky-300">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="mt-5 text-base font-black text-[#FAF6EE]">
            هنوز ترکیبی نساخته‌اید
          </h3>
          <p className="mt-2 mx-auto max-w-sm text-xs leading-6 text-[#8E867B]">
            چند پارت از سمینار را انتخاب کنید و ترتیبشان را مشخص کنید تا ساختار محتوایی قوی‌تری در خروجی بگیرید.
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onCreateNew}
            className="mt-6 inline-flex items-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            ساخت اولین ترکیب
          </motion.button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {combinations.map((combo, idx) => (
            <motion.div
              key={combo.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.34 }}
              whileHover={{ y: -3 }}
            >
              <SpotlightSurface
                onClick={() => onOpenCombination(combo.id)}
                spotlightColor="rgba(56, 189, 248, 0.14)"
                className="group foil-card flex h-full cursor-pointer flex-col justify-between rounded-3xl p-6 transition-all hover:border-white/20"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-black leading-7 text-[#FAF6EE] group-hover:text-[#F8D57E] transition">
                      {combo.title}
                    </h3>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[#9E9588] transition group-hover:bg-[#EAB349]/15 group-hover:text-[#F8D57E]">
                      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                    </span>
                  </div>

                  {/* Clean Sequence Chain */}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {combo.orderedAudioMeta.map((meta, i) => (
                      <div key={`${meta.audioFileId}-${i}`} className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1 text-[11px] font-bold text-[#DDD5C8]">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length] }}
                          />
                          {meta.title.split('—')[0].trim()}
                        </span>
                        {i < combo.orderedAudioMeta.length - 1 && (
                          <span className="text-[10px] text-[#6F685E]">←</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calm Footer */}
                <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[11px]">
                  <span className="font-mono text-[#8E867B]" dir="ltr">
                    {formatTimecode(combo.totalDurationSec)}
                  </span>

                  <div className="flex items-center gap-3.5 font-bold">
                    <span className="inline-flex items-center gap-1 text-[#F6CE78]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#EAB349]" />
                      {toFa(combo.goldCount)} طلایی
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#CBD5E1]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#CBD5E1]" />
                      {toFa(combo.silverCount)} نقره‌ای
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#F5B084]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E4834B]" />
                      {toFa(combo.bronzeCount)} برنزی
                    </span>
                  </div>
                </div>
              </SpotlightSurface>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
