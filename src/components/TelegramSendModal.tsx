import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Headphones,
  Loader2,
  Send,
  Settings,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { AISettings, AudioFileSummary, HookWithScenario } from '../types';
import { stitchScenarioBeats } from '../utils/audioStitcher';
import { SPRING_SNAPPY, iconSwapMotion } from '../utils/motion';

interface TelegramSendModalProps {
  open: boolean;
  hook: HookWithScenario;
  settings: AISettings | null;
  audioFilesById: Map<string, AudioFileSummary>;
  onClose: () => void;
  onOpenTelegramSettings: () => void;
}

export function TelegramSendModal({
  open,
  hook,
  settings,
  audioFilesById,
  onClose,
  onOpenTelegramSettings,
}: TelegramSendModalProps) {
  const [includeScenario, setIncludeScenario] = useState(true);
  const [includePublishingKit, setIncludePublishingKit] = useState(true);
  const [includeViralRadar, setIncludeViralRadar] = useState(true);
  const [includeCarousel, setIncludeCarousel] = useState(false);
  const [includeAudioWav, setIncludeAudioWav] = useState(true);
  const [customNote, setCustomNote] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    plainText?: string;
  } | null>(null);
  const [copiedFallback, setCopiedFallback] = useState(false);

  const isConfigured = Boolean(
    settings?.hasTelegramBotToken && settings?.telegramChatId
  );

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('includeScenario', String(includeScenario));
      form.append('includePublishingKit', String(includePublishingKit));
      form.append('includeViralRadar', String(includeViralRadar));
      form.append('includeCarousel', String(includeCarousel));
      form.append('customNote', customNote);

      if (includeAudioWav) {
        try {
          const urlMap = new Map<string, string>();
          audioFilesById.forEach((f, id) => urlMap.set(id, f.audioUrl));
          const stitched = await stitchScenarioBeats(hook.scenarioBeats, urlMap, 150);
          const safeName = hook.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 36);
          form.append('audio', stitched.wavBlob, `rough-cut-${hook.tier}-${safeName}.wav`);
          URL.revokeObjectURL(stitched.blobUrl);
        } catch {
          // Proceed sending text even if browser audio stitching isn't available
        }
      }

      const res = await api.sendHookToTelegram(hook.id, form);
      setResult({
        ok: res.ok,
        message: res.message,
        plainText: res.plainText,
      });
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'خطا در ارسال به گروه تلگرام',
      });
    } finally {
      setSending(false);
    }
  }

  function handleCopyFallback() {
    if (!result?.plainText) return;
    navigator.clipboard.writeText(result.plainText);
    setCopiedFallback(true);
    setTimeout(() => setCopiedFallback(false), 1800);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="w-full max-w-lg console-panel rounded-t-3xl sm:rounded-3xl border-sky-400/25 p-5 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/18 text-sky-300 border border-sky-400/35">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#FAF6EE]">
                    ارسال سناریو به گروه تلگرام
                  </h2>
                  <p className="text-xs text-[#9E9588] truncate max-w-[290px]">
                    {hook.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#8E867B] hover:bg-white/10 hover:text-[#F5F1E8] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Target Group Connection Banner */}
              {isConfigured ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-200 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="truncate font-bold">
                      گروه متصل: {settings?.telegramGroupName || settings?.telegramChatId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTelegramSettings();
                    }}
                    className="text-[11px] font-bold text-[#B4ABA0] hover:text-white shrink-0 cursor-pointer"
                  >
                    تغییر گروه
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3 text-xs">
                  <span className="text-amber-200 leading-5">
                    هنوز ربات تلگرام و شناسه گروه تنظیم نشده است.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTelegramSettings();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg seal-gold px-3 py-1.5 text-[11px] font-black cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    اتصال ربات تلگرام
                  </button>
                </div>
              )}

              {/* What to Include Checkboxes */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#C7BEB0]">
                  مواردی که به گروه ارسال شود:
                </span>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      checked: includeScenario,
                      set: setIncludeScenario,
                      label: 'سناریو و تایم‌کدهای تدوین',
                    },
                    {
                      checked: includePublishingKit,
                      set: setIncludePublishingKit,
                      label: 'پکیج ادمین (کپشن، تیتر، استیکر)',
                    },
                    {
                      checked: includeViralRadar,
                      set: setIncludeViralRadar,
                      label: 'رادار وایرالیته و راهنمای موزیک',
                    },
                    {
                      checked: includeCarousel,
                      set: setIncludeCarousel,
                      label: 'اسلایدهای پست کاروسل',
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition ${
                        item.checked
                          ? 'border-sky-400/40 bg-sky-400/[0.08] text-[#FAF6EE]'
                          : 'border-white/[0.07] bg-white/[0.02] text-[#8E867B]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        className="accent-sky-400 h-3.5 w-3.5"
                      />
                      <span className="font-bold">{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* Attach Stitched Rough-Cut Audio Toggle */}
                <label
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-xs cursor-pointer transition ${
                    includeAudioWav
                      ? 'border-[#EAB349]/45 bg-[#EAB349]/[0.08] text-[#FAF6EE]'
                      : 'border-white/[0.07] bg-white/[0.02] text-[#8E867B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={includeAudioWav}
                      onChange={(e) => setIncludeAudioWav(e.target.checked)}
                      className="accent-amber-400 h-3.5 w-3.5"
                    />
                    <Headphones className="h-4 w-4 text-[#EAB349]" />
                    <span className="font-extrabold">
                      ضمیمه کردن فایل ویس پیش‌ادیت یکپارچه (.wav) در گروه
                    </span>
                  </div>
                </label>
              </div>

              {/* Optional Team Note */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#C7BEB0]">
                  یادداشت برای تدوینگر یا ادمین (اختیاری)
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="مثلاً: امیر جان این ریلز اولویت فردا شب هست..."
                  className="w-full rounded-xl console-inset px-3.5 py-2.5 text-xs text-[#F5F1E8] placeholder-[#6F685E] outline-none focus:border-sky-400/50"
                />
              </div>

              {/* Result Feedback */}
              <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={SPRING_SNAPPY}
                  className={`rounded-2xl border p-4 space-y-3 text-xs leading-6 ${
                    result.ok
                      ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
                      : 'border-amber-400/30 bg-amber-500/12 text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{result.message}</span>
                  </div>

                  {!result.ok && result.plainText && (
                    <button
                      type="button"
                      onClick={handleCopyFallback}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-[#FAF6EE] hover:bg-black/50 cursor-pointer"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {copiedFallback ? (
                          <motion.span key="ok" {...iconSwapMotion} className="inline-flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            متن آماده تلگرام کپی شد
                          </motion.span>
                        ) : (
                          <motion.span key="cp" {...iconSwapMotion} className="inline-flex items-center gap-1.5">
                            <Copy className="h-3.5 w-3.5" />
                            کپی متن آماده برای پیست در تلگرام
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  )}
                </motion.div>
              )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/12 px-4 py-2 text-xs font-bold text-[#B4ABA0] hover:bg-white/[0.05] cursor-pointer"
                >
                  بستن
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={sending}
                  onClick={handleSend}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-5 py-2 text-xs font-black text-[#0B1722] transition hover:bg-sky-300 disabled:opacity-50 cursor-pointer"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      در حال ارسال به گروه...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      ارسال در گروه تلگرام
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
