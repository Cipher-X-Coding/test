import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Download,
  Laptop,
  Loader2,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import type { PlatformKind } from '../hooks/usePWAInstall';
import { modalBackdropMotion, modalPanelMotion } from '../utils/motion';

interface InstallAppModalProps {
  open: boolean;
  canNativeInstall: boolean;
  isInstalled: boolean;
  installing: boolean;
  platform: PlatformKind;
  onInstallNative: () => Promise<void>;
  onClose: () => void;
}

export function InstallAppModal({
  open,
  canNativeInstall,
  isInstalled,
  installing,
  platform,
  onInstallNative,
  onClose,
}: InstallAppModalProps) {
  const isMobile = platform === 'ios' || platform === 'android';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...modalBackdropMotion}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-md"
        >
          <motion.div
            {...modalPanelMotion}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md console-panel rounded-t-3xl sm:rounded-3xl border-[#EAB349]/30 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto"
          >
            {/* Mobile Drag Pill */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/icon-192.png"
                  alt="آیکون قلاب"
                  className="h-12 w-12 rounded-2xl border border-[#EAB349]/35 shadow-lg"
                />
                <div>
                  <h2 className="text-base font-black text-[#FAF6EE]">
                    نصب اپلیکیشن «قلاب»
                  </h2>
                  <p className="mt-0.5 text-xs text-[#9E9588]">
                    اجرای تمام‌صفحه و سریع روی گوشی و کامپیوتر (PWA)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#8E867B] hover:bg-white/10 hover:text-[#FAF6EE] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {isInstalled ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/12 p-4 text-xs leading-6 text-emerald-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-black text-emerald-100">
                      اپلیکیشن قلاب روی دستگاه شما نصب شده است!
                    </div>
                    <p className="mt-0.5 opacity-85">
                      هم‌اکنون در حالت اپلیکیشن مستقل (Standalone) در حال استفاده هستید.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Highlights */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { icon: Smartphone, label: 'موبایل و تبلت' },
                      { icon: Laptop, label: 'ویندوز و مک' },
                      { icon: Sparkles, label: 'تمام‌صفحه و سریع' },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="console-inset rounded-xl px-2 py-3 flex flex-col items-center gap-1.5"
                      >
                        <Icon className="h-4 w-4 text-[#EAB349]" />
                        <span className="text-[11px] font-bold text-[#DDD5C8]">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Native One-Click Install CTA when available */}
                  {canNativeInstall ? (
                    <div className="space-y-3 rounded-2xl border border-[#EAB349]/35 bg-[#EAB349]/10 p-4">
                      <p className="text-xs leading-6 text-[#F5DFA9]">
                        مرورگر شما از نصب مستقیم پشتیبانی می‌کند. با یک کلیک آیکون <strong>قلاب</strong> به صفحه اصلی دستگاه شما اضافه می‌شود.
                      </p>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.96 }}
                        disabled={installing}
                        onClick={onInstallNative}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl seal-gold py-3 text-xs font-black cursor-pointer disabled:opacity-50"
                      >
                        {installing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            در حال نصب...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            نصب مستقیم «قلاب» روی دستگاه
                          </>
                        )}
                      </motion.button>
                    </div>
                  ) : platform === 'ios' ? (
                    /* iOS Safari Step-by-Step */
                    <div className="space-y-3 rounded-2xl console-inset p-4">
                      <div className="text-xs font-black text-[#F6CE78]">
                        راهنمای نصب روی آیفون و آیپد (Safari):
                      </div>
                      <ol className="space-y-2.5 text-xs leading-6 text-[#DDD5C8]">
                        <li className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                            ۱
                          </span>
                          <span>
                            در نوار پایین مرورگر سافاری روی آیکون{' '}
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-bold text-sky-300">
                              <Share className="h-3 w-3" /> Share
                            </span>{' '}
                            ضربه بزنید.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                            ۲
                          </span>
                          <span>
                            به پایین اسکرول کرده و گزینه{' '}
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-bold text-[#FAF6EE]">
                              <PlusSquare className="h-3 w-3 text-[#EAB349]" /> Add to Home Screen
                            </span>{' '}
                            را انتخاب کنید.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                            ۳
                          </span>
                          <span>
                            در بالا سمت راست دکمه <strong>Add</strong> را بزنید تا آیکون <strong>قلاب</strong> روی صفحه اصلی قرار گیرد.
                          </span>
                        </li>
                      </ol>
                    </div>
                  ) : (
                    /* Android / Desktop Manual Fallback Guide */
                    <div className="space-y-3 rounded-2xl console-inset p-4">
                      <div className="text-xs font-black text-[#F6CE78]">
                        {isMobile
                          ? 'راهنمای نصب روی اندروید (Chrome):'
                          : 'راهنمای نصب روی دسکتاپ (ویندوز، مک و لینوکس):'}
                      </div>

                      {isMobile ? (
                        <ol className="space-y-2.5 text-xs leading-6 text-[#DDD5C8]">
                          <li className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                              ۱
                            </span>
                            <span>
                              در بالای مرورگر Chrome روی منوی{' '}
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-white/10 px-1.5 py-0.5 font-bold">
                                <MoreVertical className="h-3 w-3" /> سه‌نقطه
                              </span>{' '}
                              ضربه بزنید.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                              ۲
                            </span>
                            <span>
                              گزینه <strong>Install app</strong> یا{' '}
                              <strong>Add to Home screen</strong> را انتخاب کنید.
                            </span>
                          </li>
                        </ol>
                      ) : (
                        <ol className="space-y-2.5 text-xs leading-6 text-[#DDD5C8]">
                          <li className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                              ۱
                            </span>
                            <span>
                              در مرورگر <strong>Chrome / Edge</strong> روی آیکون نصب{' '}
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-bold text-[#F8D57E]">
                                <Download className="h-3 w-3" />
                              </span>{' '}
                              در نوار آدرس بالا کلیک کنید و <strong>Install</strong> را بزنید.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md seal-gold text-[10px] font-black">
                              ۲
                            </span>
                            <span>
                              در <strong>Safari مک</strong> از منوی بالا مسیر{' '}
                              <strong dir="ltr">File → Add to Dock</strong> را انتخاب کنید.
                            </span>
                          </li>
                        </ol>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/12 px-4 py-2 text-xs font-bold text-[#B4ABA0] hover:bg-white/[0.05] cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
