import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderPlus, X } from 'lucide-react';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; eventDate: string; description: string }) => Promise<void>;
}

export function NewProjectModal({ open, onClose, onCreate }: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('لطفاً عنوان پروژه را وارد کنید.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreate({ title: title.trim(), eventDate: eventDate.trim(), description: description.trim() });
      setTitle('');
      setEventDate('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ایجاد پروژه');
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
            className="w-full max-w-md console-panel rounded-t-3xl sm:rounded-3xl border-[#EAB349]/25 p-5 sm:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl seal-gold">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#F7F3EA]">ساخت پروژه جدید</h2>
                  <p className="text-xs text-[#9E9588]">مثلاً سمینار تیر ماه یا همایش رشد فروش</p>
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

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                  نام پروژه / سمینار *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: سمینار تیر ماه — استراتژی رشد تیم"
                  className="w-full rounded-xl console-inset px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder-[#787166] outline-none focus:border-[#EAB349]/60"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                  تاریخ برگزاری (اختیاری)
                </label>
                <input
                  type="text"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="مثلاً: ۱۴۰۵/۰۴/۱۲"
                  className="w-full rounded-xl console-inset px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder-[#787166] outline-none focus:border-[#EAB349]/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#DCD4C8]">
                  توضیحات پروژه (اختیاری)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="موضوع کلی همایش، مخاطبین یا هدف محتوایی این سمینار..."
                  className="w-full rounded-xl console-inset px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder-[#787166] outline-none focus:border-[#EAB349]/60"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/12 px-4 py-2 text-xs font-bold text-[#B4ABA0] hover:bg-white/[0.05] cursor-pointer"
                >
                  انصراف
                </button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  className="rounded-xl seal-gold px-5 py-2 text-xs font-black disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'در حال ایجاد...' : 'ایجاد پروژه'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
