import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Download,
  FolderOpen,
  Layers,
  LayoutGrid,
  Menu,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  SlidersHorizontal,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from './api';
import { SPRING_GENTLE, SPRING_SNAPPY, pageTransition } from './utils/motion';
import { usePWAInstall } from './hooks/usePWAInstall';
import type {
  AISettings,
  AudioFileDetail,
  AudioFileSummary,
  CombinationDetail,
  CombinationSummary,
  HookWithScenario,
  ProjectSummary,
} from './types';
import { toFa } from './utils/format';
import { Sidebar } from './components/Sidebar';
import { NewProjectModal } from './components/NewProjectModal';
import { SettingsModal } from './components/SettingsModal';
import { AudioUploadModal } from './components/AudioUploadModal';
import { InstallAppModal } from './components/InstallAppModal';
import { AudioPartList } from './components/AudioPartList';
import { ContentBank } from './components/ContentBank';
import { EqualizerBars } from './components/StudioEffects';
import { HookGalleryPage } from './components/pages/HookGalleryPage';
import { ScenarioDetailPage } from './components/pages/ScenarioDetailPage';
import { TranscriptPage } from './components/pages/TranscriptPage';
import { CombinerListPage } from './components/pages/CombinerListPage';
import { CombinationBuilderPage } from './components/pages/CombinationBuilderPage';
import { QuoteBuilderPage } from './components/pages/QuoteBuilderPage';
import { HookArenaPage } from './components/pages/HookArenaPage';

type ProjectTab = 'audio' | 'combine' | 'bank';

type PageRoute =
  | { view: 'project'; tab: ProjectTab }
  | { view: 'audio-overview'; audioId: string }
  | { view: 'audio-transcript'; audioId: string; highlightSegmentId?: string | null }
  | { view: 'combo-overview'; combinationId: string }
  | { view: 'combo-transcript'; combinationId: string; highlightSegmentId?: string | null }
  | { view: 'quote-builder' }
  | { view: 'hook-arena' }
  | {
      view: 'combo-builder';
      editingCombinationId?: string | null;
      preselectedAudioIds?: string[];
      backRoute: PageRoute;
    }
  | {
      view: 'scenario';
      hookId: string;
      contextHooks: HookWithScenario[];
      backRoute: PageRoute;
      backLabel: string;
      transcriptTarget?:
        | { type: 'audio'; id: string }
        | { type: 'combo'; id: string };
    };

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AISettings | null>(null);

  const [audioFiles, setAudioFiles] = useState<AudioFileSummary[]>([]);
  const [combinations, setCombinations] = useState<CombinationSummary[]>([]);
  const [projectHooks, setProjectHooks] = useState<HookWithScenario[]>([]);

  const [activeAudioDetail, setActiveAudioDetail] = useState<AudioFileDetail | null>(null);
  const [activeComboDetail, setActiveComboDetail] = useState<CombinationDetail | null>(null);

  const [route, setRoute] = useState<PageRoute>({ view: 'project', tab: 'audio' });

  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'ai' | 'telegram'>('ai');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pwa = usePWAInstall();

  async function handleInstallTrigger() {
    if (pwa.canNativeInstall) {
      const outcome = await pwa.triggerNativeInstall();
      if (outcome === 'accepted') {
        setInstallModalOpen(false);
        showToast('اپلیکیشن «قلاب» با موفقیت روی دستگاه شما نصب شد!');
        return;
      }
    }
    setInstallModalOpen(true);
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3200);
  }

  const audioFilesById = useMemo(
    () => new Map(audioFiles.map((f) => [f.id, f])),
    [audioFiles]
  );

  const refreshProjectsList = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list);
    return list;
  }, []);

  const loadProjectData = useCallback(async (projectId: string) => {
    setLoadingProject(true);
    try {
      const [files, combos, hooks] = await Promise.all([
        api.listAudioFiles(projectId),
        api.listCombinations(projectId),
        api.listProjectHooks(projectId),
      ]);
      setAudioFiles(files);
      setCombinations(combos);
      setProjectHooks(hooks);
    } finally {
      setLoadingProject(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [projs, cfg] = await Promise.all([api.listProjects(), api.getSettings()]);
        setProjects(projs);
        setSettings(cfg);
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id);
          await loadProjectData(projs[0].id);
        }
      } finally {
        setLoadingBoot(false);
      }
    })();
  }, [loadProjectData]);

  const currentProject = projects.find((p) => p.id === selectedProjectId) || null;
  const isRootProjectPage = route.view === 'project';

  async function openAudioOverview(audioId: string) {
    setLoadingPage(true);
    try {
      const detail = await api.getAudioDetail(audioId);
      setActiveAudioDetail(detail);
      setRoute({ view: 'audio-overview', audioId });
    } finally {
      setLoadingPage(false);
    }
  }

  async function openComboOverview(combinationId: string) {
    setLoadingPage(true);
    try {
      const detail = await api.getCombinationDetail(combinationId);
      setActiveComboDetail(detail);
      setRoute({ view: 'combo-overview', combinationId });
    } finally {
      setLoadingPage(false);
    }
  }

  async function navigateToRoute(next: PageRoute) {
    if (
      (next.view === 'audio-overview' || next.view === 'audio-transcript') &&
      activeAudioDetail?.id !== next.audioId
    ) {
      setLoadingPage(true);
      try {
        const detail = await api.getAudioDetail(next.audioId);
        setActiveAudioDetail(detail);
      } finally {
        setLoadingPage(false);
      }
    } else if (
      (next.view === 'combo-overview' || next.view === 'combo-transcript') &&
      activeComboDetail?.id !== next.combinationId
    ) {
      setLoadingPage(true);
      try {
        const detail = await api.getCombinationDetail(next.combinationId);
        setActiveComboDetail(detail);
      } finally {
        setLoadingPage(false);
      }
    }
    setRoute(next);
  }

  async function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveAudioDetail(null);
    setActiveComboDetail(null);
    setRoute({ view: 'project', tab: 'audio' });
    setMobileMenuOpen(false);
    await loadProjectData(projectId);
  }

  async function handleCreateProject(data: {
    title: string;
    eventDate: string;
    description: string;
  }) {
    const created = await api.createProject(data);
    await refreshProjectsList();
    setSelectedProjectId(created.id);
    setActiveAudioDetail(null);
    setActiveComboDetail(null);
    setRoute({ view: 'project', tab: 'audio' });
    await loadProjectData(created.id);
    showToast(`پروژه «${created.title}» ساخته شد.`);
  }

  async function handleDeleteProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!window.confirm(`آیا از حذف پروژه «${proj?.title || ''}» و تمام فایل‌های آن مطمئن هستید؟`)) {
      return;
    }
    await api.deleteProject(projectId);
    const nextList = await refreshProjectsList();
    if (selectedProjectId === projectId) {
      setActiveAudioDetail(null);
      setActiveComboDetail(null);
      setRoute({ view: 'project', tab: 'audio' });
      if (nextList.length > 0) {
        setSelectedProjectId(nextList[0].id);
        await loadProjectData(nextList[0].id);
      } else {
        setSelectedProjectId(null);
        setAudioFiles([]);
        setCombinations([]);
        setProjectHooks([]);
      }
    }
    showToast('پروژه حذف شد.');
  }

  async function handleUploadAudio(formData: FormData) {
    if (!selectedProjectId) return;
    const detail = await api.uploadAudio(selectedProjectId, formData);
    await Promise.all([refreshProjectsList(), loadProjectData(selectedProjectId)]);
    setActiveAudioDetail(detail);
    setRoute({ view: 'audio-overview', audioId: detail.id });
    showToast(`فایل «${detail.title}» پردازش و قلاب‌ها استخراج شدند.`);
  }

  async function handleRenameSpeaker(speakerId: string, newName: string) {
    await api.renameSpeaker(speakerId, newName);
    if (activeAudioDetail && selectedProjectId) {
      const updated = await api.getAudioDetail(activeAudioDetail.id);
      setActiveAudioDetail(updated);
      const hooks = await api.listProjectHooks(selectedProjectId);
      setProjectHooks(hooks);
    }
    showToast('نام گوینده به‌روزرسانی شد.');
  }

  async function handleEditSegment(segmentId: string, newText: string) {
    await api.updateSegmentText(segmentId, newText);
    if (activeAudioDetail) {
      const updated = await api.getAudioDetail(activeAudioDetail.id);
      setActiveAudioDetail(updated);
    }
    showToast('متن ذخیره شد.');
  }

  async function handleReanalyzeAudio() {
    if (!activeAudioDetail || !selectedProjectId) return;
    setReanalyzing(true);
    try {
      const updated = await api.reanalyzeAudio(activeAudioDetail.id);
      setActiveAudioDetail(updated);
      await Promise.all([refreshProjectsList(), loadProjectData(selectedProjectId)]);
      showToast('قلاب‌ها و سناریوها مجدداً استخراج شدند.');
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleDeleteAudio() {
    if (!activeAudioDetail || !selectedProjectId) return;
    if (!window.confirm(`فایل «${activeAudioDetail.title}» حذف شود؟`)) return;
    await api.deleteAudio(activeAudioDetail.id);
    setActiveAudioDetail(null);
    setRoute({ view: 'project', tab: 'audio' });
    await Promise.all([refreshProjectsList(), loadProjectData(selectedProjectId)]);
    showToast('فایل صوتی حذف شد.');
  }

  async function handleSubmitCombination(payload: {
    combinationId?: string;
    title: string;
    goal: string;
    orderedAudioIds: string[];
  }) {
    if (!selectedProjectId) return;
    const detail = payload.combinationId
      ? await api.updateCombination(payload.combinationId, {
          title: payload.title,
          goal: payload.goal,
          orderedAudioIds: payload.orderedAudioIds,
        })
      : await api.createCombination(selectedProjectId, {
          title: payload.title,
          goal: payload.goal,
          orderedAudioIds: payload.orderedAudioIds,
        });
    setActiveComboDetail(detail);
    await Promise.all([refreshProjectsList(), loadProjectData(selectedProjectId)]);
    setRoute({ view: 'combo-overview', combinationId: detail.id });
    showToast(
      payload.combinationId
        ? 'ترتیب ترکیب به‌روزرسانی و سناریوها بازتولید شدند.'
        : 'ترکیب ساخته شد و قلاب‌ها استخراج شدند.'
    );
  }

  async function handleDeleteCombination() {
    if (!activeComboDetail || !selectedProjectId) return;
    if (!window.confirm('این ترکیب حذف شود؟')) return;
    await api.deleteCombination(activeComboDetail.id);
    setActiveComboDetail(null);
    setRoute({ view: 'project', tab: 'combine' });
    await Promise.all([refreshProjectsList(), loadProjectData(selectedProjectId)]);
    showToast('ترکیب حذف شد.');
  }

  async function handleSaveSettings(payload: Partial<AISettings>) {
    const next = await api.saveSettings(payload);
    setSettings(next);
    showToast('تنظیمات ذخیره شد.');
  }

  function syncUpdatedHook(updated: HookWithScenario) {
    setProjectHooks((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    setActiveAudioDetail((prev) =>
      prev
        ? { ...prev, hooks: prev.hooks.map((h) => (h.id === updated.id ? updated : h)) }
        : prev
    );
    setActiveComboDetail((prev) =>
      prev
        ? { ...prev, hooks: prev.hooks.map((h) => (h.id === updated.id ? updated : h)) }
        : prev
    );
    setRoute((prev) =>
      prev.view === 'scenario'
        ? {
            ...prev,
            contextHooks: prev.contextHooks.map((h) => (h.id === updated.id ? updated : h)),
          }
        : prev
    );
  }

  async function handleGenerateHookVariants(hookId: string) {
    const updated = await api.generateHookVariants(hookId);
    syncUpdatedHook(updated);
    showToast('قلاب‌های جایگزین جدید (عین متن) آماده شدند.');
  }

  async function handleApplyHookVariant(hookId: string, variantId: string) {
    const updated = await api.applyHookVariant(hookId, variantId);
    syncUpdatedHook(updated);
    showToast('قلاب انتخابی به عنوان قلاب اصلی سناریو تثبیت شد.');
  }

  async function handleRegeneratePublishingKit(hookId: string) {
    const updated = await api.regeneratePublishingKit(hookId);
    syncUpdatedHook(updated);
    showToast('پکیج انتشار ادمین به‌روزرسانی شد.');
  }

  async function handleRegenerateCarousel(hookId: string) {
    const updated = await api.regenerateCarouselSlides(hookId);
    syncUpdatedHook(updated);
    showToast('اسلایدهای پست کاروسل به‌روزرسانی شدند.');
  }

  async function handleCreateSpecialReel(
    sourceType: 'audio' | 'combination',
    sourceId: string,
    kind: 'micro' | 'qa'
  ) {
    const created =
      kind === 'micro'
        ? await api.createMicroLoopReel(sourceType, sourceId)
        : await api.createRapidQAReel(sourceType, sourceId);

    if (selectedProjectId) {
      await Promise.all([refreshProjectsList(), loadProjectData(selectedProjectId)]);
    }

    if (sourceType === 'audio') {
      const updatedAudio = await api.getAudioDetail(sourceId);
      setActiveAudioDetail(updatedAudio);
      setRoute({
        view: 'scenario',
        hookId: created.id,
        contextHooks: updatedAudio.hooks,
        backRoute: { view: 'audio-overview', audioId: sourceId },
        backLabel: updatedAudio.title.split('—')[0].trim(),
        transcriptTarget: { type: 'audio', id: sourceId },
      });
    } else {
      const updatedCombo = await api.getCombinationDetail(sourceId);
      setActiveComboDetail(updatedCombo);
      setRoute({
        view: 'scenario',
        hookId: created.id,
        contextHooks: updatedCombo.hooks,
        backRoute: { view: 'combo-overview', combinationId: sourceId },
        backLabel: 'ترکیب صوتی',
        transcriptTarget: { type: 'combo', id: sourceId },
      });
    }

    showToast(
      kind === 'micro'
        ? 'میکرو‌ریلز لوپ (۷ تا ۱۵ ثانیه) ساخته شد!'
        : 'ریلز مکالمه‌ای سریع (Q&A) ساخته شد!'
    );
  }

  if (loadingBoot) {
    return (
      <div className="studio-ambient studio-grain flex h-[100dvh] items-center justify-center text-[#F5F1E8]">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3.5"
        >
          <img
            src="/icons/icon-192.png"
            alt="قلاب"
            className="h-14 w-14 rounded-2xl border border-[#EAB349]/35 shadow-xl"
          />
          <EqualizerBars active color="#F6CE78" bars={4} height={16} />
          <p className="text-xs font-bold text-[#A49B8E]">قلاب در حال آماده‌سازی است...</p>
        </motion.div>
      </div>
    );
  }

  // Resolve active hook when on Scenario Detail Page
  const activeScenarioHook =
    route.view === 'scenario'
      ? route.contextHooks.find((h) => h.id === route.hookId) ||
        projectHooks.find((h) => h.id === route.hookId) ||
        route.contextHooks[0] ||
        null
      : null;

  const comboSourceTitleMap = new Map<string, string>();
  if (activeComboDetail) {
    for (const m of activeComboDetail.orderedAudioMeta) {
      comboSourceTitleMap.set(m.audioFileId, m.title);
    }
  }

  const routeKey =
    route.view === 'project'
      ? `project-${route.tab}`
      : route.view === 'scenario'
        ? `scenario-${route.hookId}`
        : route.view === 'audio-overview'
          ? `audio-ov-${route.audioId}`
          : route.view === 'audio-transcript'
            ? `audio-tr-${route.audioId}`
            : route.view === 'combo-overview'
              ? `combo-ov-${route.combinationId}`
              : route.view === 'combo-transcript'
                ? `combo-tr-${route.combinationId}`
                : route.view === 'quote-builder'
                  ? 'quote-builder'
                  : route.view === 'hook-arena'
                    ? 'hook-arena'
                    : `combo-builder-${route.editingCombinationId || 'new'}`;

  return (
    <MotionConfig reducedMotion="user">
    <div className="studio-ambient studio-grain flex h-[100dvh] overflow-hidden">
      {/* Collapsible Desktop Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block h-full overflow-hidden shrink-0"
          >
            <Sidebar
              projects={projects}
              selectedProjectId={selectedProjectId}
              settings={settings}
              isPwaInstalled={pwa.isInstalled}
              onSelectProject={handleSelectProject}
              onOpenNewProject={() => setNewProjectOpen(true)}
              onDeleteProject={handleDeleteProject}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenInstallApp={() => setInstallModalOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex lg:hidden"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="relative z-50 h-full"
            >
              <Sidebar
                projects={projects}
                selectedProjectId={selectedProjectId}
                settings={settings}
                isPwaInstalled={pwa.isInstalled}
                onSelectProject={handleSelectProject}
                onOpenNewProject={() => {
                  setMobileMenuOpen(false);
                  setNewProjectOpen(true);
                }}
                onDeleteProject={handleDeleteProject}
                onOpenSettings={() => {
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                onOpenInstallApp={() => {
                  setMobileMenuOpen(false);
                  setInstallModalOpen(true);
                }}
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute left-3 top-[calc(1rem+env(safe-area-inset-top))] rounded-xl border border-white/10 bg-[#1B1917] p-1.5 text-[#F5F1E8]"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
            <div
              className="flex-1 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Spacious Canvas */}
      <main className="relative z-10 flex-1 overflow-y-auto overscroll-y-contain">
        {/* Sticky Native-Feel Mobile Header */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.07] bg-[#11100F]/92 px-3.5 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-[#F5F1E8] cursor-pointer"
          >
            <Menu className="h-4 w-4 text-[#EAB349]" />
            پروژه‌ها
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/icons/icon-192.png"
              alt="قلاب"
              className="h-6 w-6 rounded-lg border border-[#EAB349]/35"
            />
            <span className="text-sm font-black tracking-tight text-[#FAF6EE]">قلاب</span>
          </div>

          <div className="flex items-center gap-1.5">
            {!pwa.isInstalled && (
              <button
                type="button"
                onClick={handleInstallTrigger}
                title="نصب اپلیکیشن قلاب"
                className="inline-flex items-center gap-1 rounded-xl border border-[#EAB349]/35 bg-[#EAB349]/12 px-2.5 py-1.5 text-[11px] font-extrabold text-[#F8D57E] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                نصب
              </button>
            )}
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="rounded-xl seal-gold px-2.5 py-1.5 text-xs font-black cursor-pointer"
            >
              + صدا
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-7 sm:py-7 lg:px-12 lg:pb-12">
          {!currentProject ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-20 flex flex-col items-center justify-center rounded-3xl console-panel p-14 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl seal-gold">
                <FolderOpen className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-lg font-black text-[#FAF6EE]">
                اولین پروژه سمینار خود را بسازید
              </h2>
              <p className="mt-2 max-w-sm text-xs leading-6 text-[#8E867B]">
                برای هر همایش یک فضای اختصاصی باز کنید و فایل‌های صوتی آن روز را به سناریوهای آماده تدوین تبدیل کنید.
              </p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setNewProjectOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl seal-gold px-5 py-2.5 text-xs font-black cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                ایجاد پروژه جدید
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {/* Calm Topbar on Root Project Views ONLY */}
              {isRootProjectPage && (
                <header className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSidebarOpen((v) => !v)}
                        title={sidebarOpen ? 'بستن منو' : 'باز کردن منو'}
                        className="hidden lg:inline-flex mt-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-[#9E9588] transition hover:border-white/20 hover:text-[#F5F1E8] cursor-pointer"
                      >
                        {sidebarOpen ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <h2 className="truncate text-2xl sm:text-3xl font-black tracking-tight text-[#FAF6EE]">
                          {currentProject.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-3.5 text-xs text-[#8E867B]">
                          {currentProject.eventDate && (
                            <span className="font-mono">{currentProject.eventDate}</span>
                          )}
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#F6CE78]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#EAB349]" />
                            {toFa(currentProject.goldCount)} طلایی
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#CBD5E1]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#CBD5E1]" />
                            {toFa(currentProject.silverCount)} نقره‌ای
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#F5B084]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#E4834B]" />
                            {toFa(currentProject.bronzeCount)} برنزی
                          </span>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setUploadOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl seal-gold px-4.5 py-2.5 text-xs font-black cursor-pointer"
                    >
                      <UploadCloud className="h-4 w-4 stroke-[2.3]" />
                      افزودن فایل صوتی
                    </motion.button>
                  </div>

                  {/* Clean Sliding 3-Tab Project Switcher (Desktop/Tablet; Mobile uses Native Bottom Dock) */}
                  <div className="hidden sm:block border-b border-white/[0.07] pb-4">
                    <nav className="inline-flex max-w-full overflow-x-auto no-scrollbar items-center gap-1 rounded-xl console-inset p-1">
                      {(
                        [
                          {
                            id: 'audio',
                            label: `فایل‌های صوتی (${toFa(audioFiles.length)})`,
                            icon: Mic,
                          },
                          {
                            id: 'combine',
                            label: `ترکیب صداها (${toFa(combinations.length)})`,
                            icon: Layers,
                          },
                          {
                            id: 'bank',
                            label: `خزانه قلاب‌ها (${toFa(projectHooks.length)})`,
                            icon: LayoutGrid,
                          },
                        ] as const
                      ).map((tab) => {
                        const Icon = tab.icon;
                        const active = route.tab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setRoute({ view: 'project', tab: tab.id })}
                            className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-extrabold transition cursor-pointer ${
                              active ? 'text-[#141210]' : 'text-[#9E9588] hover:text-[#F5F1E8]'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="primaryStudioTab"
                                transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                                className="absolute inset-0 rounded-lg bg-[#F5F1E8]"
                              />
                            )}
                            <Icon className="relative z-10 h-3.5 w-3.5" />
                            <span className="relative z-10">{tab.label}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </header>
              )}

              {/* Subtle Zen Sidebar Toggle on Drill-Down Sub-Pages */}
              {!isRootProjectPage && (
                <div className="hidden lg:flex items-center justify-end -mb-5">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#7D7469] transition hover:bg-white/[0.04] hover:text-[#DDD5C8] cursor-pointer"
                  >
                    {sidebarOpen ? (
                      <>
                        <PanelRightClose className="h-3.5 w-3.5" />
                        حالت تمرکز کامل
                      </>
                    ) : (
                      <>
                        <PanelRightOpen className="h-3.5 w-3.5" />
                        منوی پروژه‌ها
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Page Router Stage */}
              <AnimatePresence mode="wait">
                {loadingProject || loadingPage ? (
                  <motion.div
                    key="page-loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="flex flex-col items-center justify-center gap-3 py-28"
                  >
                    <EqualizerBars active color="#EAB349" bars={4} height={20} />
                    <span className="text-[11px] font-semibold text-[#8E867B]">
                      در حال آماده‌سازی...
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={routeKey}
                    initial={pageTransition.initial}
                    animate={pageTransition.animate}
                    exit={pageTransition.exit}
                  >
                    {/* 1. ROOT PROJECT TABS */}
                    {route.view === 'project' && route.tab === 'audio' && (
                      <AudioPartList
                        audioFiles={audioFiles}
                        onOpenAudio={openAudioOverview}
                        onOpenUpload={() => setUploadOpen(true)}
                        onCombineSelected={(ids) =>
                          setRoute({
                            view: 'combo-builder',
                            preselectedAudioIds: ids,
                            backRoute: { view: 'project', tab: 'audio' },
                          })
                        }
                      />
                    )}

                    {route.view === 'project' && route.tab === 'combine' && (
                      <CombinerListPage
                        combinations={combinations}
                        canCreate={audioFiles.length >= 2}
                        onOpenCombination={openComboOverview}
                        onCreateNew={() =>
                          setRoute({
                            view: 'combo-builder',
                            backRoute: { view: 'project', tab: 'combine' },
                          })
                        }
                      />
                    )}

                    {route.view === 'project' && route.tab === 'bank' && (
                      <ContentBank
                        projectTitle={currentProject.title}
                        hooks={projectHooks}
                        onOpenHook={(hook, filteredList) =>
                          setRoute({
                            view: 'scenario',
                            hookId: hook.id,
                            contextHooks: filteredList,
                            backRoute: { view: 'project', tab: 'bank' },
                            backLabel: 'خزانه قلاب‌ها',
                            transcriptTarget:
                              hook.sourceType === 'combination' && hook.combinationId
                                ? { type: 'combo', id: hook.combinationId }
                                : hook.audioFileId
                                  ? { type: 'audio', id: hook.audioFileId }
                                  : undefined,
                          })
                        }
                        onOpenQuoteBuilder={() => setRoute({ view: 'quote-builder' })}
                        onOpenHookArena={() => setRoute({ view: 'hook-arena' })}
                      />
                    )}

                    {/* 2. AUDIO OVERVIEW PAGE (Minimal Hook Cards Gallery) */}
                    {route.view === 'audio-overview' && activeAudioDetail && (
                      <HookGalleryPage
                        title={activeAudioDetail.title}
                        subtitle={currentProject.title}
                        backLabel="بازگشت به فایل‌های صوتی"
                        hooks={activeAudioDetail.hooks}
                        speakerCount={activeAudioDetail.speakers.length}
                        segmentCount={activeAudioDetail.segments.length}
                        durationSec={activeAudioDetail.durationSec}
                        previewAudio={audioFilesById.get(activeAudioDetail.id) || null}
                        previewSegments={activeAudioDetail.segments}
                        onBack={() => setRoute({ view: 'project', tab: 'audio' })}
                        onOpenHook={(hook) =>
                          setRoute({
                            view: 'scenario',
                            hookId: hook.id,
                            contextHooks: activeAudioDetail.hooks,
                            backRoute: {
                              view: 'audio-overview',
                              audioId: activeAudioDetail.id,
                            },
                            backLabel: activeAudioDetail.title.split('—')[0].trim(),
                            transcriptTarget: { type: 'audio', id: activeAudioDetail.id },
                          })
                        }
                        onOpenTranscript={() =>
                          setRoute({
                            view: 'audio-transcript',
                            audioId: activeAudioDetail.id,
                          })
                        }
                        onCreateMicroLoop={() =>
                          handleCreateSpecialReel('audio', activeAudioDetail.id, 'micro')
                        }
                        onCreateRapidQA={() =>
                          handleCreateSpecialReel('audio', activeAudioDetail.id, 'qa')
                        }
                        onDelete={handleDeleteAudio}
                      />
                    )}

                    {/* 3. DEDICATED AUDIO TRANSCRIPT & SPEAKERS PAGE */}
                    {route.view === 'audio-transcript' && activeAudioDetail && (
                      <TranscriptPage
                        title={activeAudioDetail.title}
                        breadcrumbParent={activeAudioDetail.title.split('—')[0].trim()}
                        segments={activeAudioDetail.segments}
                        speakers={activeAudioDetail.speakers}
                        hooks={activeAudioDetail.hooks}
                        audioFilesById={audioFilesById}
                        initialAudioId={activeAudioDetail.id}
                        initialHighlightSegmentId={route.highlightSegmentId}
                        onBack={() =>
                          setRoute({
                            view: 'audio-overview',
                            audioId: activeAudioDetail.id,
                          })
                        }
                        onRenameSpeaker={handleRenameSpeaker}
                        onEditSegment={handleEditSegment}
                        onReanalyze={handleReanalyzeAudio}
                        onOpenHook={(hook) =>
                          setRoute({
                            view: 'scenario',
                            hookId: hook.id,
                            contextHooks: activeAudioDetail.hooks,
                            backRoute: {
                              view: 'audio-transcript',
                              audioId: activeAudioDetail.id,
                            },
                            backLabel: 'متن کامل',
                            transcriptTarget: { type: 'audio', id: activeAudioDetail.id },
                          })
                        }
                        reanalyzing={reanalyzing}
                      />
                    )}

                    {/* 4. COMBINATION OVERVIEW PAGE (Minimal Hook Cards Gallery) */}
                    {route.view === 'combo-overview' && activeComboDetail && (
                      <HookGalleryPage
                        title={activeComboDetail.title}
                        subtitle={activeComboDetail.goal}
                        backLabel="بازگشت به ترکیب صداها"
                        hooks={activeComboDetail.hooks}
                        segmentCount={activeComboDetail.mergedSegments.length}
                        durationSec={activeComboDetail.totalDurationSec}
                        orderedAudioMeta={activeComboDetail.orderedAudioMeta}
                        onBack={() => setRoute({ view: 'project', tab: 'combine' })}
                        onOpenHook={(hook) =>
                          setRoute({
                            view: 'scenario',
                            hookId: hook.id,
                            contextHooks: activeComboDetail.hooks,
                            backRoute: {
                              view: 'combo-overview',
                              combinationId: activeComboDetail.id,
                            },
                            backLabel: 'ترکیب صوتی',
                            transcriptTarget: { type: 'combo', id: activeComboDetail.id },
                          })
                        }
                        onOpenTranscript={() =>
                          setRoute({
                            view: 'combo-transcript',
                            combinationId: activeComboDetail.id,
                          })
                        }
                        onCreateMicroLoop={() =>
                          handleCreateSpecialReel('combination', activeComboDetail.id, 'micro')
                        }
                        onCreateRapidQA={() =>
                          handleCreateSpecialReel('combination', activeComboDetail.id, 'qa')
                        }
                        onEditCombination={() =>
                          setRoute({
                            view: 'combo-builder',
                            editingCombinationId: activeComboDetail.id,
                            backRoute: {
                              view: 'combo-overview',
                              combinationId: activeComboDetail.id,
                            },
                          })
                        }
                        onDelete={handleDeleteCombination}
                      />
                    )}

                    {/* 5. DEDICATED COMBINED TRANSCRIPT PAGE */}
                    {route.view === 'combo-transcript' && activeComboDetail && (
                      <TranscriptPage
                        title={activeComboDetail.title}
                        breadcrumbParent="ترکیب صوتی"
                        segments={activeComboDetail.mergedSegments}
                        speakers={[]}
                        hooks={activeComboDetail.hooks}
                        audioFilesById={audioFilesById}
                        initialHighlightSegmentId={route.highlightSegmentId}
                        showSourceAudioBadge
                        mergedSourceTitles={comboSourceTitleMap}
                        onBack={() =>
                          setRoute({
                            view: 'combo-overview',
                            combinationId: activeComboDetail.id,
                          })
                        }
                        onOpenHook={(hook) =>
                          setRoute({
                            view: 'scenario',
                            hookId: hook.id,
                            contextHooks: activeComboDetail.hooks,
                            backRoute: {
                              view: 'combo-transcript',
                              combinationId: activeComboDetail.id,
                            },
                            backLabel: 'متن یکپارچه',
                            transcriptTarget: { type: 'combo', id: activeComboDetail.id },
                          })
                        }
                      />
                    )}

                    {/* 6. DEDICATED COMBINATION BUILDER / REORDER PAGE */}
                    {route.view === 'combo-builder' && (
                      <CombinationBuilderPage
                        audioFiles={audioFiles}
                        initialCombination={
                          route.editingCombinationId &&
                          activeComboDetail?.id === route.editingCombinationId
                            ? activeComboDetail
                            : null
                        }
                        preselectedAudioIds={route.preselectedAudioIds}
                        onBack={() => navigateToRoute(route.backRoute)}
                        onSubmit={handleSubmitCombination}
                      />
                    )}

                    {/* 7. DEDICATED EDITORIAL SCENARIO PAGE */}
                    {route.view === 'scenario' && activeScenarioHook && (
                      <ScenarioDetailPage
                        projectTitle={currentProject.title}
                        breadcrumbParent={route.backLabel}
                        hook={activeScenarioHook}
                        allHooksInContext={route.contextHooks}
                        audioFilesById={audioFilesById}
                        settings={settings}
                        segments={
                          route.transcriptTarget?.type === 'audio' &&
                          activeAudioDetail?.id === route.transcriptTarget.id
                            ? activeAudioDetail.segments
                            : route.transcriptTarget?.type === 'combo' &&
                                activeComboDetail?.id === route.transcriptTarget.id
                              ? activeComboDetail.mergedSegments
                              : []
                        }
                        onBack={() => navigateToRoute(route.backRoute)}
                        onSelectHook={(nextHook) =>
                          setRoute({ ...route, hookId: nextHook.id })
                        }
                        onOpenTranscriptAtSegment={
                          route.transcriptTarget
                            ? (segmentId) => {
                                const target = route.transcriptTarget!;
                                if (target.type === 'audio') {
                                  navigateToRoute({
                                    view: 'audio-transcript',
                                    audioId: target.id,
                                    highlightSegmentId: segmentId,
                                  });
                                } else {
                                  navigateToRoute({
                                    view: 'combo-transcript',
                                    combinationId: target.id,
                                    highlightSegmentId: segmentId,
                                  });
                                }
                              }
                            : undefined
                        }
                        onOpenTelegramSettings={() => {
                          setSettingsTab('telegram');
                          setSettingsOpen(true);
                        }}
                        onGenerateVariants={handleGenerateHookVariants}
                        onApplyVariant={handleApplyHookVariant}
                        onRegeneratePublishingKit={handleRegeneratePublishingKit}
                        onRegenerateCarousel={handleRegenerateCarousel}
                      />
                    )}

                    {/* 8. CROSS-AUDIO QUOTE BUILDER PAGE */}
                    {route.view === 'quote-builder' && (
                      <QuoteBuilderPage
                        projectId={currentProject.id}
                        projectTitle={currentProject.title}
                        onBack={() => setRoute({ view: 'project', tab: 'bank' })}
                        onCreatedScenario={async (created) => {
                          await Promise.all([
                            refreshProjectsList(),
                            loadProjectData(currentProject.id),
                          ]);
                          const updatedHooks = await api.listProjectHooks(currentProject.id);
                          setProjectHooks(updatedHooks);
                          setRoute({
                            view: 'scenario',
                            hookId: created.id,
                            contextHooks: updatedHooks,
                            backRoute: { view: 'project', tab: 'bank' },
                            backLabel: 'خزانه قلاب‌ها',
                            transcriptTarget: created.audioFileId
                              ? { type: 'audio', id: created.audioFileId }
                              : undefined,
                          });
                          showToast('سناریوی دست‌چین با ویس یکپارچه ساخته شد!');
                        }}
                      />
                    )}

                    {/* 9. HOOK ARENA TOURNAMENT PAGE */}
                    {route.view === 'hook-arena' && (
                      <HookArenaPage
                        projectTitle={currentProject.title}
                        hooks={projectHooks}
                        audioFilesById={audioFilesById}
                        onBack={() => setRoute({ view: 'project', tab: 'bank' })}
                        onOpenHook={(hook) =>
                          setRoute({
                            view: 'scenario',
                            hookId: hook.id,
                            contextHooks: projectHooks,
                            backRoute: { view: 'hook-arena' },
                            backLabel: 'نبرد قلاب‌ها',
                            transcriptTarget:
                              hook.sourceType === 'combination' && hook.combinationId
                                ? { type: 'combo', id: hook.combinationId }
                                : hook.audioFileId
                                  ? { type: 'audio', id: hook.audioFileId }
                                  : undefined,
                          })
                        }
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        settings={settings}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsTab('ai');
        }}
        onSave={handleSaveSettings}
      />

      {currentProject && (
        <AudioUploadModal
          open={uploadOpen}
          projectTitle={currentProject.title}
          onClose={() => setUploadOpen(false)}
          onUpload={handleUploadAudio}
        />
      )}

      <InstallAppModal
        open={installModalOpen}
        canNativeInstall={pwa.canNativeInstall}
        isInstalled={pwa.isInstalled}
        installing={pwa.installing}
        platform={pwa.platform}
        onInstallNative={async () => {
          const outcome = await pwa.triggerNativeInstall();
          if (outcome === 'accepted') {
            setInstallModalOpen(false);
            showToast('اپلیکیشن «قلاب» با موفقیت روی دستگاه شما نصب شد!');
          }
        }}
        onClose={() => setInstallModalOpen(false)}
      />

      {/* Native-Feel Mobile Bottom Navigation Bar (< sm) */}
      {currentProject && (
        <nav
          aria-label="ناوبری موبایل"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.09] bg-[#11100F]/95 px-2 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
            {(
              [
                { id: 'audio', label: 'فایل‌ها', icon: Mic },
                { id: 'combine', label: 'ترکیب', icon: Layers },
                { id: 'bank', label: 'خزانه', icon: LayoutGrid },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = route.view === 'project' && route.tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoute({ view: 'project', tab: item.id })}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10.5px] font-extrabold transition cursor-pointer ${
                    active ? 'text-[#F8D57E]' : 'text-[#8E867B]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mobileBottomNavPill"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-x-2 inset-y-0.5 rounded-xl bg-[#EAB349]/14 border border-[#EAB349]/30"
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10.5px] font-extrabold text-[#8E867B] transition hover:text-[#FAF6EE] cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>تنظیمات</span>
            </button>
          </div>
        </nav>
      )}

      {/* Quiet Broadcast Toast with Auto-Dismiss Progress Bar */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={SPRING_GENTLE}
            className="fixed bottom-20 sm:bottom-5 left-4 right-4 sm:right-auto sm:left-5 z-50 overflow-hidden rounded-xl border border-[#EAB349]/35 bg-[#191613]/95 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#FAF6EE]">
              <EqualizerBars active color="#EAB349" bars={3} height={12} />
              <span>{toast}</span>
            </div>
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 3.1, ease: 'linear' }}
              style={{ transformOrigin: 'right' }}
              className="h-[2px] w-full bg-gradient-to-l from-[#EAB349] to-[#E4834B]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

export default App;
