import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileAudio, FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { formatFileSize } from '../utils/format';
import { SPRING_SNAPPY } from '../utils/motion';

interface AudioUploadModalProps {
  open: boolean;
  projectTitle: string;
  onClose: () => void;
  onUpload: (formData: FormData) => Promise<void>;
}

export function AudioUploadModal({
  open,
  projectTitle,
  onClose,
  onUpload,
}: AudioUploadModalProps) {
  const [mode, setMode] = useState<'audio' | 'transcript'>('audio');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rawTranscript, setRawTranscript] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'audio' && !file && rawTranscript.trim().length < 15) {
      setError('لطفاً یک فایل صوتی انتخاب کنید یا متن سمینار را وارد نمایید.');
      return;
    }
    if (mode === 'transcript' && rawTranscript.trim().length < 15) {
      setError('لطفاً حداقل چند جمله از متن سمینار را وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (title.trim()) fd.append('title', title.trim());
      if (file) fd.append('audio', file);
      if (rawTranscript.trim()) fd.append('rawTranscript', rawTranscript.trim());
      await onUpload(fd);
      setTitle('');
      setFile(null);
      setRawTranscript('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در آپلود و پردازش فایل');
    } finally {
      setSubmitting(false);
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
            className="w-full max-w-xl console-panel rounded-t-3xl sm:rounded-3xl border-[#EAB349]/25 p-5 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-base font-black text-[#F7F3EA]">
                  ارسال فایل صوتی جدید به اتاق مسترینگ
                </h2>
                <p className="mt-0.5 text-xs text-[#9E9588]">
                  پروژه: <span className="font-bold text-[#F6CE78]">{projectTitle}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#8E867B] hover:bg-white/10 hover:text-[#F5F1E8] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Toggle with Spring Sliding Pill */}
            <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl console-inset p-1">
              <button
                type="button"
                onClick={() => setMode('audio')}
                className={`relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  mode === 'audio'
                    ? 'text-[#141210]'
                    : 'text-[#9E9588] hover:text-[#F5F1E8]'
                }`}
              >
                {mode === 'audio' && (
                  <motion.span
                    layoutId="uploadModeTab"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-xl bg-[#F5F1E8]"
                  />
                )}
                <FileAudio className="relative z-10 h-4 w-4" />
                <span className="relative z-10">آپلود فایل صوتی (ویس سمینار)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('transcript')}
                className={`relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  mode === 'transcript'
                    ? 'text-[#141210]'
                    : 'text-[#9E9588] hover:text-[#F5F1E8]'
                }`}
              >
                {mode === 'transcript' && (
                  <motion.span
                    layoutId="uploadModeTab"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-xl bg-[#F5F1E8]"
                  />
                )}
                <FileText className="relative z-10 h-4 w-4" />
                <span className="relative z-10">ارسال مستقیم متن سمینار</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                  عنوان این پارت از سمینار
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: پارت ۴ — کوچینگ زنده مدیریت تیم فروش"
                  className="w-full rounded-xl console-inset px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder-[#787166] outline-none focus:border-[#EAB349]/60"
                />
              </div>

              {mode === 'audio' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                    className="hidden"
                    onChange={(e) => {
                      const picked = e.target.files?.[0] || null;
                      setFile(picked);
                      if (picked && !title) {
                        setTitle(picked.name.replace(/\.[^.]+$/, ''));
                      }
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                      dragOver
                        ? 'border-[#EAB349] bg-[#EAB349]/10'
                        : file
                          ? 'border-emerald-400/60 bg-emerald-400/[0.06]'
                          : 'border-white/15 bg-black/30 hover:border-[#EAB349]/45'
                    }`}
                  >
                    <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-white/10 bg-[#1B1917]">
                      <UploadCloud
                        className={`h-6 w-6 ${file ? 'text-emerald-400' : 'text-[#EAB349]'}`}
                      />
                    </div>
                    {file ? (
                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-[#F5F1E8]">{file.name}</div>
                        <div className="mt-1 text-xs text-emerald-300">
                          {formatFileSize(file.size)} — برای تعویض کلیک کنید
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="text-sm font-extrabold text-[#F5F1E8]">
                          فایل صوتی را اینجا بکشید یا کلیک کنید
                        </div>
                        <div className="mt-1 text-xs text-[#9E9588]">
                          پشتیبانی از MP3، WAV، M4A، OGG و WEBM تا ۱۵۰ مگابایت
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl console-inset p-3.5 text-[11px] leading-6 text-[#A89F92]">
                    پس از دریافت صدا، به صورت خودکار:{' '}
                    <span className="font-bold text-[#F5F1E8]">
                      ۱) تفکیک گویندگان و تشخیص نام از متن، ۲) استخراج قلاب‌های طلایی، نقره‌ای و برنزی، و ۳) تدوین سناریوهای ۱۰۰٪ عین متن با تایم‌کد
                    </span>{' '}
                    اجرا می‌شود.
                  </div>
                </div>
              )}

              {mode === 'transcript' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                    متن سمینار (نام گوینده یا تایم‌کد اول خط اختیاری است)
                  </label>
                  <textarea
                    rows={7}
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                    placeholder={`مثال:\nآرش راد: سلام دوستان من آرش راد هستم و امروز می‌خوام بگم چرا ۹۰ درصد تبلیغات اینستاگرامی شکست می‌خوره...\nمخاطب: ببخشید استاد من مریم حسینی هستم، ما ماهی صد میلیون تبلیغ میدیم ولی فروش ثابت مونده، دلیلش چیه؟\nآرش راد: خانم حسینی، دلیلش نبودن سیستم پیگیریه...`}
                    className="w-full rounded-xl console-inset px-3.5 py-3 text-xs leading-6 text-[#F5F1E8] placeholder-[#6E675E] outline-none focus:border-[#EAB349]/60"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="rounded-xl border border-white/12 px-4 py-2 text-xs font-bold text-[#B4ABA0] hover:bg-white/[0.05] cursor-pointer"
                >
                  انصراف
                </button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black disabled:opacity-55 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      در حال تفکیک گویندگان و استخراج قلاب‌ها...
                    </>
                  ) : (
                    'شروع پردازش و استخراج'
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
