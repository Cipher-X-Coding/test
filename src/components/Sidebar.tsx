import { motion } from 'framer-motion';
import { CheckCircle2, Download, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { AISettings, ProjectSummary } from '../types';
import { toFa } from '../utils/format';
import { StudioBadgePulse } from './StudioEffects';

interface SidebarProps {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  settings: AISettings | null;
  isPwaInstalled?: boolean;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onOpenSettings: () => void;
  onOpenInstallApp?: () => void;
}

export function Sidebar({
  projects,
  selectedProjectId,
  settings,
  isPwaInstalled = false,
  onSelectProject,
  onOpenNewProject,
  onDeleteProject,
  onOpenSettings,
  onOpenInstallApp,
}: SidebarProps) {
  const modeLabel =
    settings?.provider === 'gapgpt' && settings.hasApiKey
      ? 'متصل به GapGPT'
      : settings?.provider === 'gemini' && settings.hasApiKey
        ? 'متصل به Gemini'
        : settings?.provider === 'openai' && settings.hasApiKey
          ? 'متصل به OpenAI'
          : 'موتور محلی استودیو';

  const isLiveApi = Boolean(settings && settings.provider !== 'demo' && settings.hasApiKey);

  return (
    <aside className="relative z-10 flex h-full w-64 max-w-[82vw] shrink-0 flex-col border-l border-white/[0.07] bg-[#100F0E]/95 backdrop-blur-xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Minimal Brand Lockup */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img
            src="/icons/icon-192.png"
            alt="قلاب"
            className="h-9 w-9 rounded-xl border border-[#EAB349]/35 shadow-md"
          />
          <div>
            <h1 className="text-base font-black tracking-tight text-[#FAF6EE]">
              قلاب
            </h1>
            <p className="text-[10px] text-[#7D7469]">استودیو محتوای سمینار</p>
          </div>
        </div>
      </div>

      {/* Quiet Projects Rail */}
      <div className="flex flex-1 flex-col overflow-hidden px-3 pt-2 pb-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11px] font-bold text-[#7D7469]">
            پروژه‌ها
          </span>
          <button
            type="button"
            onClick={onOpenNewProject}
            title="ساخت پروژه جدید"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-[#F6CE78] transition hover:bg-[#EAB349]/12 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            جدید
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-[#7D7469]">
              پروژه‌ای وجود ندارد
            </div>
          ) : (
            projects.map((p, idx) => {
              const active = p.id === selectedProjectId;
              const totalHooks = p.goldCount + p.silverCount + p.bronzeCount;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onSelectProject(p.id)}
                  className={`group relative cursor-pointer rounded-xl px-3 py-2.5 transition-colors ${
                    active
                      ? 'bg-white/[0.075] text-[#FAF6EE]'
                      : 'text-[#A49B8E] hover:bg-white/[0.035] hover:text-[#EAE2D6]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="activeProjectRail"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute right-0 top-2.5 bottom-2.5 w-[2.5px] rounded-l-full bg-[#EAB349] shadow-[0_0_8px_rgba(234,179,73,0.6)]"
                    />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold">
                        {p.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#7D7469]">
                        <span>{toFa(p.audioCount)} فایل</span>
                        <span>·</span>
                        <span>{toFa(totalHooks)} قلاب</span>
                        {p.combinationCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-sky-300/80">{toFa(p.combinationCount)} ترکیب</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      title="حذف پروژه"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(p.id);
                      }}
                      className="rounded-md p-1 text-[#6F685E] opacity-70 sm:opacity-0 sm:scale-90 transition-all duration-150 hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100 group-hover:scale-100 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer: PWA Install App + Settings */}
      <div className="border-t border-white/[0.06] p-3 space-y-1.5">
        {onOpenInstallApp && (
          <motion.button
            type="button"
            whileHover={{ x: -1.5 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenInstallApp}
            className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-right transition cursor-pointer ${
              isPwaInstalled
                ? 'bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.13]'
                : 'border border-[#EAB349]/25 bg-[#EAB349]/[0.08] text-[#F8D57E] hover:border-[#EAB349]/45 hover:bg-[#EAB349]/15'
            }`}
          >
            <span className="inline-flex items-center gap-2 text-xs font-extrabold">
              {isPwaInstalled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[#EAB349]" />
              )}
              {isPwaInstalled ? 'نصب‌شده روی دستگاه' : 'نصب اپلیکیشن قلاب'}
            </span>
            {!isPwaInstalled && (
              <span className="rounded-md bg-[#EAB349]/20 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-[#FBE1A0]">
                PWA
              </span>
            )}
          </motion.button>
        )}

        <motion.button
          type="button"
          whileHover={{ x: -1.5 }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenSettings}
          className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right transition hover:bg-white/[0.045] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <StudioBadgePulse color={isLiveApi ? '#34D399' : '#EAB349'} />
            <span className="truncate text-xs font-bold text-[#C7BEB0] group-hover:text-[#FAF6EE] transition-colors">
              {modeLabel}
            </span>
          </div>
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[#7D7469] transition-transform duration-300 group-hover:rotate-45 group-hover:text-[#EAB349]" />
        </motion.button>
      </div>
    </aside>
  );
}
