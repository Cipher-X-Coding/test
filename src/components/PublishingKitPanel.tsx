import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Hash,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageCircle,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Type,
} from 'lucide-react';
import type { HookWithScenario, StoryStickerCue } from '../types';
import { buildAdminPublishingSheet, toFa } from '../utils/format';
import { SPRING_SOFT, STUDIO_EASE, iconSwapMotion } from '../utils/motion';

interface PublishingKitPanelProps {
  hook: HookWithScenario;
  onRegenerate: () => Promise<void>;
  onRegenerateCarousel?: () => Promise<void>;
}

function CopyMiniButton({
  text,
  label = 'کپی',
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
        copied
          ? 'border-emerald-400/45 bg-emerald-500/12 text-emerald-300'
          : 'border-white/10 bg-white/[0.03] text-[#B4ABA0] hover:border-[#EAB349]/45 hover:text-[#FAF6EE]'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="copied" {...iconSwapMotion} className="inline-flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-400" />
            کپی شد
          </motion.span>
        ) : (
          <motion.span key="copy" {...iconSwapMotion} className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function StickerCard({ sticker }: { sticker: StoryStickerCue }) {
  const copyText = sticker.options?.length
    ? `${sticker.promptText}\nگزینه ۱: ${sticker.options[0]}\nگزینه ۲: ${sticker.options[1] || ''}`
    : sticker.promptText;

  return (
    <div className="console-inset rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E4834B]/18 text-[11px] font-black text-[#F5B084]">
            {toFa(sticker.slideOrder)}
          </span>
          <span className="text-xs font-extrabold text-[#EFE7DA]">
            {sticker.stickerLabel}
          </span>
        </div>
        <CopyMiniButton text={copyText} />
      </div>

      {/* Visual Instagram Sticker Preview */}
      <div className="rounded-xl border border-white/10 bg-[#1B1815] p-3.5 space-y-2.5">
        <p className="text-xs font-bold leading-6 text-[#FAF6EE]">
          {sticker.promptText}
        </p>

        {sticker.stickerType === 'poll' && sticker.options && sticker.options.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {sticker.options.map((opt, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-center text-[11px] font-extrabold text-[#DDD5C8]"
              >
                {opt}
              </div>
            ))}
          </div>
        )}

        {sticker.stickerType === 'slider' && (
          <div className="flex items-center gap-2 pt-1">
            <div className="relative h-2 flex-1 rounded-full bg-white/10">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-l from-[#EAB349] to-[#E4834B]" />
            </div>
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#EAB349]" />
          </div>
        )}

        {sticker.stickerType === 'question' && (
          <div className="rounded-lg border border-dashed border-white/15 bg-black/25 px-3 py-2 text-[11px] text-[#7D7469]">
            پاسخ مخاطب در این کادر نوشته می‌شود...
          </div>
        )}
      </div>
    </div>
  );
}

export function PublishingKitPanel({
  hook,
  onRegenerate,
  onRegenerateCarousel,
}: PublishingKitPanelProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingCarousel, setRegeneratingCarousel] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const kit = hook.publishingKit;

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRegenerateCarousel() {
    if (!onRegenerateCarousel) return;
    setRegeneratingCarousel(true);
    try {
      await onRegenerateCarousel();
    } finally {
      setRegeneratingCarousel(false);
    }
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(buildAdminPublishingSheet(hook));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1800);
  }

  if (!kit) {
    return (
      <div className="console-panel rounded-3xl p-12 text-center space-y-4">
        <Sparkles className="mx-auto h-7 w-7 text-[#EAB349]" />
        <p className="text-sm font-bold text-[#FAF6EE]">
          پکیج انتشار برای این سناریو هنوز ساخته نشده است.
        </p>
        <button
          type="button"
          disabled={regenerating}
          onClick={handleRegenerate}
          className="inline-flex items-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black cursor-pointer disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          ساخت پکیج انتشار ادمین
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8 py-8"
    >
      {/* Quiet Top Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8E867B]">
          محتوای آماده برای ادمین پیج: متن روی ویدیو، تیتر کاور، کپشن کامل و استیکرهای تعاملی.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={regenerating}
            onClick={handleRegenerate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-[#B4ABA0] transition hover:border-white/25 hover:text-[#FAF6EE] disabled:opacity-50 cursor-pointer"
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EAB349]" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            بازتولید هوشمند
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 rounded-xl seal-gold px-4 py-2 text-xs font-black cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="h-3.5 w-3.5" />
                کل پکیج کپی شد
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                کپی کل پکیج ادمین
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 1. On-Screen 3-Second Hook */}
      <section className="console-panel rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#F6CE78]">
            <Type className="h-4 w-4" />
            متن درشت ۳ ثانیه اول روی تصویر (On-Screen Hook)
          </div>
          <CopyMiniButton text={kit.onScreenHook} />
        </div>

        <div className="rounded-2xl border border-[#EAB349]/25 bg-gradient-to-b from-[#1F1A14] to-[#12100E] px-6 py-7 text-center">
          <p className="text-lg sm:text-xl font-black leading-9 text-[#FAF6EE]">
            {kit.onScreenHook}
          </p>
          <span className="mt-2 inline-block text-[10px] font-semibold text-[#8E867B]">
            پیشنهاد: فونت درشت سفید یا زرد طلایی با پس‌زمینه نیمه‌شفاف در یک‌سوم بالایی کادر
          </span>
        </div>
      </section>

      {/* 2. Cover Title Options */}
      <section className="console-panel rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-[#DDD5C8]">
          <ImageIcon className="h-4 w-4 text-[#EAB349]" />
          پیشنهاد تیتر روی کاور ریلز ({toFa(kit.coverTitles.length)} گزینه)
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {kit.coverTitles.map((title, idx) => (
            <div
              key={idx}
              className="console-inset flex flex-col justify-between gap-4 rounded-2xl p-4"
            >
              <div className="space-y-2">
                <span className="inline-block rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#9E9588]">
                  گزینه {toFa(idx + 1)}
                </span>
                <p className="text-sm font-black leading-6 text-[#FAF6EE]">
                  {title}
                </p>
              </div>
              <div className="flex justify-end">
                <CopyMiniButton text={title} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Full Caption + DM Automation Keyword */}
      <section className="console-panel rounded-3xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#DDD5C8]">
            <MessageCircle className="h-4 w-4 text-sky-300" />
            کپشن کامل آماده انتشار + کلیدواژه دایرکت هوشمند
          </div>
          <CopyMiniButton text={kit.fullCaption} label="کپی کپشن" />
        </div>

        {kit.commentCtaKeyword && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/20 px-2.5 py-1 font-black text-emerald-300">
                <Hash className="h-3 w-3" />
                کلیدواژه: «{kit.commentCtaKeyword}»
              </span>
              {kit.commentCtaLine && (
                <span className="text-[#DDD5C8]">{kit.commentCtaLine}</span>
              )}
            </div>
            <CopyMiniButton text={kit.commentCtaKeyword} label="کپی کلمه" />
          </div>
        )}

        <div className="console-inset rounded-2xl p-5">
          <p className="whitespace-pre-line text-sm leading-8 text-[#EAE2D6]">
            {kit.fullCaption}
          </p>
        </div>
      </section>

      {/* 4. Interactive Story Stickers (Per Slide) */}
      {kit.storyStickers.length > 0 && (
        <section className="console-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#F5B084]">
              <Sparkles className="h-4 w-4" />
              {hook.tier === 'bronze'
                ? `استیکرهای تعاملی استوری (به تفکیک ${toFa(kit.storyStickers.length)} اسلاید)`
                : 'استیکر پیشنهادی برای بازنشر این ریلز در استوری'}
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {kit.storyStickers.map((st, idx) => (
              <StickerCard key={`${st.slideOrder}-${idx}`} sticker={st} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Instagram Carousel Slides Deck (#6) */}
      <section className="console-panel rounded-3xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#F6CE78]">
            <Layers className="h-4 w-4" />
            تبدیل سناریو به اسلایدهای پست کاروسل
            {kit.carouselSlides && kit.carouselSlides.length > 0 && (
              <span className="rounded-md bg-[#EAB349]/15 px-2 py-0.5 text-[10px] font-black text-[#F8D57E]">
                {toFa(kit.carouselSlides.length)} اسلاید
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {kit.carouselSlides && kit.carouselSlides.length > 0 && (
              <CopyMiniButton
                label="کپی همه اسلایدها"
                text={kit.carouselSlides
                  .map(
                    (s) =>
                      `اسلاید ${toFa(s.slideNumber)} (${s.roleLabel}):\n${s.headline}\n${s.bodyText}\n🎨 طراحی: ${s.designCue}`
                  )
                  .join('\n\n──────────\n\n')}
              />
            )}

            {onRegenerateCarousel && (
              <button
                type="button"
                disabled={regeneratingCarousel}
                onClick={handleRegenerateCarousel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-[#B4ABA0] transition hover:border-white/25 hover:text-[#FAF6EE] disabled:opacity-45 cursor-pointer"
              >
                {regeneratingCarousel ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[#EAB349]" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                بازتولید کاروسل
              </button>
            )}
          </div>
        </div>

        {kit.carouselSlides && kit.carouselSlides.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {kit.carouselSlides.map((slide, sIdx) => {
              const isCover = slide.role === 'cover';
              const isCta = slide.role === 'cta';
              return (
                <motion.div
                  key={`${slide.slideNumber}-${slide.headline.slice(0, 12)}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sIdx * 0.04, duration: 0.28, ease: STUDIO_EASE }}
                  whileHover={{ y: -2.5, transition: SPRING_SOFT }}
                  className={`flex flex-col justify-between rounded-2xl border p-5 space-y-4 transition-colors ${
                    isCover
                      ? 'border-[#EAB349]/40 bg-gradient-to-br from-[#231C13] via-[#171411] to-[#12100E]'
                      : isCta
                        ? 'border-emerald-400/30 bg-gradient-to-br from-[#122019] via-[#151412] to-[#12100E]'
                        : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-[10px] font-black ${
                          isCover
                            ? 'seal-gold'
                            : isCta
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-white/[0.08] text-[#C7BEB0]'
                        }`}
                      >
                        {slide.roleLabel}
                      </span>
                      <CopyMiniButton text={`${slide.headline}\n\n${slide.bodyText}`} />
                    </div>

                    <h4 className="text-sm font-black leading-6 text-[#FAF6EE]">
                      {slide.headline}
                    </h4>

                    <p className="text-xs leading-6 text-[#C7BEB0]">{slide.bodyText}</p>
                  </div>

                  <div className="flex items-start gap-1.5 border-t border-white/[0.06] pt-3 text-[10.5px] leading-5 text-[#8E867B]">
                    <Palette className="mt-0.5 h-3 w-3 shrink-0 text-[#EAB349]/75" />
                    <span>{slide.designCue}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="console-inset rounded-2xl py-8 text-center text-xs text-[#8E867B]">
            روی «بازتولید کاروسل» بزنید تا اسلایدهای این سناریو ساخته شوند.
          </div>
        )}
      </section>
    </motion.div>
  );
}
