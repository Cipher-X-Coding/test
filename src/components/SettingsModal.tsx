import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { AIProvider, AISettings } from '../types';
import { SPRING_SNAPPY, tabPanelMotion } from '../utils/motion';

interface SettingsModalProps {
  open: boolean;
  initialTab?: 'ai' | 'telegram';
  settings: AISettings | null;
  onClose: () => void;
  onSave: (payload: Partial<AISettings>) => Promise<void>;
}

const GAPGPT_BASE_PRESETS = [
  { label: 'دامنه اصلی (gapgpt.app)', url: 'https://api.gapgpt.app/v1' },
  { label: 'CDN جایگزین (gapapi.com)', url: 'https://api.gapapi.com/v1' },
  { label: 'دامنه ایران (gapgpt.ir)', url: 'https://api.gapgpt.ir/v1' },
];

const GAPGPT_LLM_PRESETS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-5',
  'gemini-2.5-flash',
];

const GAPGPT_TRANSCRIPTION_PRESETS = ['gapgpt/whisper-1', 'whisper-1'];

const OPENAI_BASE_PRESETS = [
  { label: 'OpenAI رسمی', url: 'https://api.openai.com/v1' },
  { label: 'GapGPT', url: 'https://api.gapgpt.app/v1' },
  { label: 'AvalAI', url: 'https://api.avalai.ir/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
];

function isGapGptUrl(url: string): boolean {
  return /gapgpt\.|gapapi\./i.test(url);
}

export function SettingsModal({
  open,
  initialTab = 'ai',
  settings,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [section, setSection] = useState<'ai' | 'telegram'>(initialTab);
  const [provider, setProvider] = useState<AIProvider>('demo');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [transcriptionModel, setTranscriptionModel] = useState('whisper-1');
  const [llmModel, setLlmModel] = useState('gpt-4o');

  // AI Connection test
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    ok: boolean;
    message: string;
    models: string[];
  } | null>(null);

  // Telegram Bot Settings
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramGroupName, setTelegramGroupName] = useState('');
  const [testingTg, setTestingTg] = useState(false);
  const [tgResult, setTgResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (open) {
      setSection(initialTab);
      setTgResult(null);
      setAiTestResult(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setApiKey(settings.apiKey || '');
      setBaseUrl(
        settings.baseUrl ||
          (settings.provider === 'gapgpt'
            ? 'https://api.gapgpt.app/v1'
            : 'https://api.openai.com/v1')
      );
      setGeminiModel(settings.geminiModel || 'gemini-2.5-flash');
      setTranscriptionModel(
        settings.transcriptionModel ||
          (settings.provider === 'gapgpt' ? 'gapgpt/whisper-1' : 'whisper-1')
      );
      setLlmModel(settings.llmModel || 'gpt-4o');
      setTelegramBotToken(settings.telegramBotToken || '');
      setTelegramChatId(settings.telegramChatId || '');
      setTelegramGroupName(settings.telegramGroupName || '');
    }
  }, [settings, open]);

  function handleSelectProvider(next: AIProvider) {
    setProvider(next);
    setAiTestResult(null);

    if (next === 'gapgpt') {
      if (!baseUrl || !isGapGptUrl(baseUrl)) {
        setBaseUrl('https://api.gapgpt.app/v1');
      }
      if (!transcriptionModel || transcriptionModel === 'whisper-1') {
        setTranscriptionModel('gapgpt/whisper-1');
      }
      if (!llmModel) {
        setLlmModel('gpt-4o');
      }
    } else if (next === 'openai') {
      if (!baseUrl || isGapGptUrl(baseUrl)) {
        setBaseUrl('https://api.openai.com/v1');
      }
      if (!transcriptionModel || transcriptionModel === 'gapgpt/whisper-1') {
        setTranscriptionModel('whisper-1');
      }
    }
  }

  async function handleTestAI() {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await api.testAI({
        provider,
        apiKey,
        baseUrl,
        geminiModel,
        llmModel,
      });
      setAiTestResult({
        ok: res.ok,
        message: res.message,
        models: res.models || [],
      });
    } catch (err) {
      setAiTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'خطا در تست اتصال API',
        models: [],
      });
    } finally {
      setTestingAi(false);
    }
  }

  async function handleTestTelegram() {
    setTestingTg(true);
    setTgResult(null);
    try {
      const res = await api.testTelegram({
        telegramBotToken,
        telegramChatId,
        telegramGroupName,
      });
      setTgResult({ ok: res.ok, message: res.message });
    } catch (err) {
      setTgResult({
        ok: false,
        message: err instanceof Error ? err.message : 'خطا در تست ربات تلگرام',
      });
    } finally {
      setTestingTg(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        provider,
        apiKey,
        baseUrl,
        geminiModel,
        transcriptionModel,
        llmModel,
        telegramBotToken,
        telegramChatId,
        telegramGroupName,
      });
      setSavedNotice(true);
      setTimeout(() => {
        setSavedNotice(false);
        onClose();
      }, 800);
    } finally {
      setSaving(false);
    }
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
            className="w-full max-w-lg console-panel rounded-t-3xl sm:rounded-3xl border-[#EAB349]/25 p-5 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl seal-gold">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#F7F3EA]">تنظیمات اپلیکیشن قلاب</h2>
                  <p className="text-xs text-[#9E9588]">
                    اتصال به هوش مصنوعی (GapGPT، Gemini، OpenAI) و ربات تلگرام
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

            {/* Clean 2-Tab Switcher with Spring Pill */}
            <div className="mt-4 inline-flex w-full gap-1 rounded-xl console-inset p-1">
              <button
                type="button"
                onClick={() => setSection('ai')}
                className={`relative flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-extrabold transition cursor-pointer ${
                  section === 'ai'
                    ? 'text-[#141210]'
                    : 'text-[#9E9588] hover:text-[#FAF6EE]'
                }`}
              >
                {section === 'ai' && (
                  <motion.span
                    layoutId="settingsSectionTab"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-lg bg-[#F5F1E8]"
                  />
                )}
                <SlidersHorizontal className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">موتور هوش مصنوعی</span>
              </button>
              <button
                type="button"
                onClick={() => setSection('telegram')}
                className={`relative flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-extrabold transition cursor-pointer ${
                  section === 'telegram'
                    ? 'text-[#0B1722]'
                    : 'text-[#9E9588] hover:text-[#FAF6EE]'
                }`}
              >
                {section === 'telegram' && (
                  <motion.span
                    layoutId="settingsSectionTab"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-lg bg-sky-400"
                  />
                )}
                <Bot className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">ربات تلگرام و گروه تیم</span>
                {settings?.hasTelegramBotToken && settings?.telegramChatId && (
                  <span className="relative z-10 h-2 w-2 rounded-full bg-emerald-400" />
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <AnimatePresence mode="wait" initial={false}>
              {section === 'ai' ? (
                <motion.div key="settings-ai" {...tabPanelMotion} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          id: 'demo',
                          title: 'استودیوی محلی',
                          desc: 'بدون نیاز به کلید API',
                          badge: null,
                        },
                        {
                          id: 'gapgpt',
                          title: 'GapGPT API',
                          desc: 'GPT، Claude، Gemini و Whisper',
                          badge: 'ایرانی · یکپارچه',
                        },
                        {
                          id: 'gemini',
                          title: 'Google Gemini',
                          desc: 'تفکیک بومی صدای فارسی',
                          badge: null,
                        },
                        {
                          id: 'openai',
                          title: 'OpenAI / AvalAI',
                          desc: 'سازگار با OpenAI و OpenRouter',
                          badge: null,
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectProvider(opt.id)}
                        className={`rounded-xl border p-3 text-right transition cursor-pointer ${
                          provider === opt.id
                            ? 'border-[#EAB349]/60 bg-[#EAB349]/12 text-[#F8D57E]'
                            : 'border-white/[0.08] bg-black/25 text-[#B4ABA0] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-extrabold">{opt.title}</span>
                          {opt.badge && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${
                                provider === opt.id
                                  ? 'bg-[#EAB349]/25 text-[#FBE1A0]'
                                  : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[10px] opacity-75">{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {provider === 'demo' && (
                    <div className="rounded-xl border border-[#EAB349]/25 bg-[#EAB349]/10 p-3.5 text-xs leading-6 text-[#F5DFA9]">
                      در حالت استودیوی محلی می‌توانید فایل صوتی آپلود کنید یا متن خام سمینار را وارد نمایید تا تفکیک گویندگان، تشخیص نام و استخراج قلاب‌های طلایی، نقره‌ای و برنزی با سناریوی ۱۰۰٪ عین متن اجرا شود.
                    </div>
                  )}

                  {provider === 'gapgpt' && (
                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] p-3.5 text-xs leading-6 text-emerald-100">
                      <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        اتصال مستقیم به API گپ‌جی‌پی‌تی (GapGPT)
                      </div>
                      <p className="mt-1 text-[11.5px] text-emerald-100/90">
                        با یک کلید API از <span className="font-mono" dir="ltr">gapgpt.app</span> می‌توانید همزمان از <span className="font-mono" dir="ltr">gapgpt/whisper-1</span> برای پیاده‌سازی صدای فارسی و از مدل‌های GPT، Claude یا Gemini برای استخراج قلاب و سناریو استفاده کنید.
                      </p>
                    </div>
                  )}

                  {provider !== 'demo' && (
                    <div className="space-y-3.5 rounded-2xl console-inset p-4">
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#DCD4C8]">
                          <KeyRound className="h-3.5 w-3.5 text-[#EAB349]" />
                          {provider === 'gapgpt' ? 'کلید API گپ‌جی‌پی‌تی (GapGPT API Key)' : 'کلید API (API Key)'}
                        </label>
                        <input
                          type="password"
                          dir="ltr"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={
                            provider === 'gemini'
                              ? 'AIzaSy...'
                              : provider === 'gapgpt'
                                ? 'sk-... (کلید دریافتی از پنل GapGPT)'
                                : 'sk-...'
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2 text-xs text-[#F5F1E8] outline-none focus:border-[#EAB349]/60"
                        />
                      </div>

                      {provider === 'gemini' && (
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                            مدل Gemini
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={geminiModel}
                            onChange={(e) => setGeminiModel(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2 text-xs text-[#F5F1E8] outline-none focus:border-[#EAB349]/60"
                          />
                          <p className="mt-1.5 text-[11px] text-[#8E867B]">
                            پیشنهادی: gemini-2.5-flash (پشتیبانی بومی از فایل صوتی فارسی و تفکیک گویندگان)
                          </p>
                        </div>
                      )}

                      {(provider === 'gapgpt' || provider === 'openai') && (
                        <>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                              {provider === 'gapgpt'
                                ? 'آدرس سرور GapGPT (Base URL)'
                                : 'آدرس پایه (Base URL) — سازگار با سرویس‌های ایرانی'}
                            </label>
                            <input
                              type="text"
                              dir="ltr"
                              value={baseUrl}
                              onChange={(e) => setBaseUrl(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2 text-xs text-[#F5F1E8] outline-none focus:border-[#EAB349]/60"
                            />
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(provider === 'gapgpt' ? GAPGPT_BASE_PRESETS : OPENAI_BASE_PRESETS).map(
                                (preset) => (
                                  <button
                                    key={preset.url}
                                    type="button"
                                    onClick={() => setBaseUrl(preset.url)}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] transition cursor-pointer ${
                                      baseUrl.trim().replace(/\/+$/, '') === preset.url
                                        ? 'border-[#EAB349]/60 bg-[#EAB349]/15 text-[#F8D57E]'
                                        : 'border-white/10 bg-white/[0.04] text-[#D6CEC2] hover:border-[#EAB349]/50'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                                مدل تبدیل صوت به متن
                              </label>
                              <input
                                type="text"
                                dir="ltr"
                                value={transcriptionModel}
                                onChange={(e) => setTranscriptionModel(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2 text-xs text-[#F5F1E8] outline-none focus:border-[#EAB349]/60"
                              />
                              {provider === 'gapgpt' && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {GAPGPT_TRANSCRIPTION_PRESETS.map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      dir="ltr"
                                      onClick={() => setTranscriptionModel(m)}
                                      className={`rounded-md border px-2 py-0.5 text-[10px] font-mono transition cursor-pointer ${
                                        transcriptionModel.trim() === m
                                          ? 'border-[#EAB349]/60 bg-[#EAB349]/15 text-[#F8D57E]'
                                          : 'border-white/10 bg-white/[0.03] text-[#ACA397] hover:border-white/25'
                                      }`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                                مدل تحلیل قلاب و سناریو
                              </label>
                              <input
                                type="text"
                                dir="ltr"
                                value={llmModel}
                                onChange={(e) => setLlmModel(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2 text-xs text-[#F5F1E8] outline-none focus:border-[#EAB349]/60"
                              />
                              {provider === 'gapgpt' && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {GAPGPT_LLM_PRESETS.map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      dir="ltr"
                                      onClick={() => setLlmModel(m)}
                                      className={`rounded-md border px-2 py-0.5 text-[10px] font-mono transition cursor-pointer ${
                                        llmModel.trim() === m
                                          ? 'border-[#EAB349]/60 bg-[#EAB349]/15 text-[#F8D57E]'
                                          : 'border-white/10 bg-white/[0.03] text-[#ACA397] hover:border-white/25'
                                      }`}
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Live AI Connection Test & Model Discovery */}
                      <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
                        <span className="text-[10.5px] text-[#8E867B]">
                          بررسی صحت کلید API و دریافت مدل‌های فعال
                        </span>
                        <button
                          type="button"
                          disabled={testingAi}
                          onClick={handleTestAI}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB349]/40 bg-[#EAB349]/15 px-3 py-1.5 text-[11px] font-extrabold text-[#F8D57E] transition hover:bg-[#EAB349]/25 disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          {testingAi ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PlugZap className="h-3.5 w-3.5" />
                          )}
                          تست اتصال و دریافت مدل‌ها
                        </button>
                      </div>

                      {aiTestResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={SPRING_SNAPPY}
                          className="space-y-2"
                        >
                          <div
                            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-6 ${
                              aiTestResult.ok
                                ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
                                : 'border-amber-400/30 bg-amber-500/12 text-amber-200'
                            }`}
                          >
                            {aiTestResult.ok ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span>{aiTestResult.message}</span>
                          </div>

                          {aiTestResult.models.length > 0 && (
                            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-2.5">
                              <div className="mb-1.5 text-[10.5px] font-bold text-[#9E9588]">
                                مدل‌های دریافت‌شده از سرور (برای انتخاب کلیک کنید):
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {aiTestResult.models.map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    dir="ltr"
                                    onClick={() =>
                                      provider === 'gemini' ? setGeminiModel(m) : setLlmModel(m)
                                    }
                                    className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono text-[#E8DFD2] hover:border-[#EAB349]/60 hover:text-[#F8D57E] cursor-pointer"
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="settings-tg" {...tabPanelMotion} className="space-y-4">
                  <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.08] p-3.5 text-xs leading-6 text-sky-100">
                    ربات ساخته شده در <strong className="font-mono" dir="ltr">@BotFather</strong> را داخل گروه تدوین یا تولید محتوا عضو (و ترجیحاً ادمین) کنید و توکن و Chat ID گروه را اینجا وارد نمایید تا از داخل هر سناریو با یک کلیک دکمه <strong>«ارسال به گروه تلگرام»</strong> را بزنید.
                  </div>

                  <div className="space-y-3.5 rounded-2xl console-inset p-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                        توکن ربات تلگرام (Bot Token)
                      </label>
                      <input
                        type="password"
                        dir="ltr"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        placeholder="123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2.5 text-xs text-[#F5F1E8] outline-none focus:border-sky-400/60"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                          شناسه گروه (Chat ID)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder="-1001234567890"
                          className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2.5 text-xs text-[#F5F1E8] outline-none focus:border-sky-400/60"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                          نام نمایشی گروه (اختیاری)
                        </label>
                        <input
                          type="text"
                          value={telegramGroupName}
                          onChange={(e) => setTelegramGroupName(e.target.value)}
                          placeholder="مثلاً: گروه تدوین سمینار"
                          className="w-full rounded-xl border border-white/10 bg-[#141210] px-3.5 py-2.5 text-xs text-[#F5F1E8] outline-none focus:border-sky-400/60"
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] text-[#8E867B]">
                        شناسه سوپرگروه‌ها معمولاً با <span className="font-mono" dir="ltr">-100</span> شروع می‌شود.
                      </span>

                      <button
                        type="button"
                        disabled={testingTg}
                        onClick={handleTestTelegram}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-400/15 px-3 py-1.5 text-[11px] font-extrabold text-sky-200 transition hover:bg-sky-400/25 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {testingTg ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        تست اتصال و ارسال پیام آزمایشی
                      </button>
                    </div>
                  </div>

                  {tgResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={SPRING_SNAPPY}
                      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs leading-6 ${
                        tgResult.ok
                          ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
                          : 'border-amber-400/30 bg-amber-500/12 text-amber-200'
                      }`}
                    >
                      {tgResult.ok ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{tgResult.message}</span>
                    </motion.div>
                  )}
                </motion.div>
              )}
              </AnimatePresence>

              <AnimatePresence>
                {savedNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-bold text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    تنظیمات با موفقیت ذخیره شد.
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/12 px-4 py-2 text-xs font-bold text-[#B4ABA0] hover:bg-white/[0.05] cursor-pointer"
                >
                  بستن
                </button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  disabled={saving}
                  className="rounded-xl seal-gold px-5 py-2 text-xs font-black disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
