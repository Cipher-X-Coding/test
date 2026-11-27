import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Edit3,
  FileAudio,
  Play,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  AudioFileSummary,
  HookTier,
  HookWithScenario,
  Speaker,
  TranscriptSegment,
} from '../../types';
import { TIER_META, formatTimecode, toFa } from '../../utils/format';
import { EqualizerBars } from '../StudioEffects';
import {
  BottomTransportDeck,
  type BottomTransportHandle,
} from '../BottomTransportDeck';

interface TranscriptPageProps {
  title: string;
  breadcrumbParent: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  hooks: HookWithScenario[];
  audioFilesById: Map<string, AudioFileSummary>;
  initialAudioId?: string;
  initialHighlightSegmentId?: string | null;
  showSourceAudioBadge?: boolean;
  mergedSourceTitles?: Map<string, string>;
  onBack: () => void;
  onRenameSpeaker?: (speakerId: string, newName: string) => Promise<void>;
  onEditSegment?: (segmentId: string, newText: string) => Promise<void>;
  onReanalyze?: () => Promise<void>;
  onOpenHook?: (hook: HookWithScenario) => void;
  reanalyzing?: boolean;
}

export function TranscriptPage({
  title,
  breadcrumbParent,
  segments,
  speakers,
  hooks,
  audioFilesById,
  initialAudioId,
  initialHighlightSegmentId,
  showSourceAudioBadge = false,
  mergedSourceTitles,
  onBack,
  onRenameSpeaker,
  onEditSegment,
  onReanalyze,
  onOpenHook,
  reanalyzing,
}: TranscriptPageProps) {
  const deckRef = useRef<BottomTransportHandle>(null);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [inspectingSpeaker, setInspectingSpeaker] = useState<Speaker | null>(null);
  const [speakerDraftName, setSpeakerDraftName] = useState('');
  const [savingSpeaker, setSavingSpeaker] = useState(false);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [segDraft, setSegDraft] = useState('');
  const [savingSeg, setSavingSeg] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(
    initialHighlightSegmentId || null
  );
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  const defaultAudio =
    (initialAudioId ? audioFilesById.get(initialAudioId) : undefined) ||
    (segments[0] ? audioFilesById.get(segments[0].audioFileId) : undefined) ||
    null;
  const [activeAudio, setActiveAudio] = useState<AudioFileSummary | null>(defaultAudio);

  useEffect(() => {
    if (!initialHighlightSegmentId) return;
    setHighlightedId(initialHighlightSegmentId);
    const t1 = setTimeout(() => {
      document
        .getElementById(`page-seg-${initialHighlightSegmentId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
    const t2 = setTimeout(() => setHighlightedId(null), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [initialHighlightSegmentId]);

  // Map segmentId -> hooks referencing it
  const segHooksMap = new Map<string, HookWithScenario[]>();
  for (const h of hooks) {
    for (const beat of h.scenarioBeats) {
      if (!segHooksMap.has(beat.segmentId)) segHooksMap.set(beat.segmentId, []);
      const list = segHooksMap.get(beat.segmentId)!;
      if (!list.some((x) => x.id === h.id)) list.push(h);
    }
  }

  function playSegment(seg: TranscriptSegment) {
    const file = audioFilesById.get(seg.audioFileId);
    if (!file) return;
    const switched = activeAudio?.id !== file.id;
    setActiveAudio(file);
    setTimeout(() => {
      deckRef.current?.seekAndPlay(seg.startSec);
    }, switched ? 100 : 20);
  }

  async function submitSpeakerRename() {
    if (!inspectingSpeaker || !onRenameSpeaker || !speakerDraftName.trim()) return;
    setSavingSpeaker(true);
    try {
      await onRenameSpeaker(inspectingSpeaker.id, speakerDraftName.trim());
      setInspectingSpeaker(null);
    } finally {
      setSavingSpeaker(false);
    }
  }

  async function submitSegEdit(segId: string) {
    if (!onEditSegment || !segDraft.trim()) return;
    setSavingSeg(true);
    try {
      await onEditSegment(segId, segDraft.trim());
      setEditingSegId(null);
    } finally {
      setSavingSeg(false);
    }
  }

  const filtered = segments.filter((seg) => {
    if (speakerFilter && seg.speakerId !== speakerFilter) return false;
    if (query.trim()) {
      const q = query.trim();
      return seg.text.includes(q) || (seg.speakerName && seg.speakerName.includes(q));
    }
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.26 }}
      className="mx-auto max-w-3xl pb-8"
    >
      {/* Top Quiet Navigation Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/40 hover:text-[#FAF6EE] cursor-pointer"
        >
          <ArrowRight className="h-3.5 w-3.5 text-[#EAB349]" />
          بازگشت به {breadcrumbParent}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              searchOpen || query
                ? 'border-[#EAB349]/40 bg-[#EAB349]/12 text-[#F6CE78]'
                : 'border-white/10 bg-white/[0.03] text-[#B4ABA0] hover:text-[#FAF6EE]'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            جستجو
          </button>

          {onReanalyze && (
            <button
              type="button"
              disabled={reanalyzing}
              onClick={onReanalyze}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-[#E8E0D4] transition hover:border-[#EAB349]/45 disabled:opacity-45 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#EAB349] ${reanalyzing ? 'animate-spin' : ''}`} />
              {reanalyzing ? 'در حال استخراج مجدد...' : 'استخراج مجدد قلاب‌ها'}
            </button>
          )}
        </div>
      </div>

      {/* Serene Title & Speaker Chips */}
      <header className="space-y-5 pb-7 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-[#8E867B]">
            متن کامل تفکیک‌شده و گویندگان · {toFa(filtered.length)} بخش
          </span>
          <h1 className="mt-1.5 text-2xl font-black text-[#FAF6EE]">{title}</h1>
        </div>

        {/* Search drawer */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="عبارت یا نام گوینده را بنویسید..."
                  className="w-full rounded-xl console-inset py-2.5 pr-4 pl-10 text-xs text-[#F5F1E8] placeholder-[#6F685E] outline-none focus:border-[#EAB349]/50"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E867B] hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clean Speaker Roster Pills */}
        {speakers.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSpeakerFilter(null)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  speakerFilter === null
                    ? 'bg-[#F5F1E8] text-[#141210]'
                    : 'border border-white/10 bg-white/[0.03] text-[#A49B8E] hover:text-[#FAF6EE]'
                }`}
              >
                همه گویندگان ({toFa(speakers.length)})
              </button>

              {speakers.map((sp) => {
                const active = speakerFilter === sp.id;
                return (
                  <div key={sp.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setSpeakerFilter(active ? null : sp.id)}
                      className={`inline-flex items-center gap-2 rounded-r-xl border border-l-0 px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'border-[#EAB349]/50 bg-[#EAB349]/15 text-[#FAF6EE]'
                          : 'border-white/10 bg-white/[0.03] text-[#D6CEC2] hover:bg-white/[0.07]'
                      } ${onRenameSpeaker ? '' : 'rounded-l-xl border-l'}`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: sp.color }}
                      />
                      <span>{sp.displayName}</span>
                    </button>

                    {onRenameSpeaker && (
                      <button
                        type="button"
                        title="نحوه تشخیص نام و ویرایش"
                        onClick={() => {
                          setInspectingSpeaker(sp);
                          setSpeakerDraftName(sp.displayName);
                        }}
                        className="rounded-l-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[#8E867B] transition hover:bg-white/10 hover:text-[#FAF6EE] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline Speaker Identity Clue & Rename Drawer */}
            <AnimatePresence>
              {inspectingSpeaker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl console-panel p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 font-bold text-emerald-400">
                        <UserCheck className="h-4 w-4" />
                        اطلاعات تشخیص گوینده از متن
                      </span>
                      <button
                        type="button"
                        onClick={() => setInspectingSpeaker(null)}
                        className="text-[#8E867B] hover:text-white cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {inspectingSpeaker.detectionEvidence && (
                      <p className="text-xs leading-6 text-[#B4ABA0]">
                        {inspectingSpeaker.detectionEvidence}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={speakerDraftName}
                        onChange={(e) => setSpeakerDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitSpeakerRename();
                        }}
                        className="flex-1 rounded-xl console-inset px-3.5 py-2 text-xs text-[#F5F1E8] outline-none focus:border-[#EAB349]/50"
                      />
                      <button
                        type="button"
                        disabled={savingSpeaker}
                        onClick={submitSpeakerRename}
                        className="rounded-xl seal-gold px-4 py-2 text-xs font-black cursor-pointer"
                      >
                        ذخیره نام
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      {/* Spacious Editorial Transcript Reading Room */}
      <section className="divide-y divide-white/[0.06] py-4">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#8E867B]">
            بخشی مطابق جستجو یافت نشد.
          </div>
        ) : (
          filtered.map((seg) => {
            const linkedHooks = segHooksMap.get(seg.id) || [];
            const isHighlighted = highlightedId === seg.id;
            const isPlayingHere =
              activeAudio?.id === seg.audioFileId &&
              currentTimeSec >= seg.startSec &&
              currentTimeSec < seg.endSec;
            const isEditing = editingSegId === seg.id;
            const sourceTitle = mergedSourceTitles?.get(seg.audioFileId);

            return (
              <div
                key={seg.id}
                id={`page-seg-${seg.id}`}
                className={`group relative py-6 px-3 -mx-3 rounded-2xl transition ${
                  isHighlighted
                    ? 'segment-highlight bg-[#EAB349]/12'
                    : isPlayingHere
                      ? 'bg-white/[0.035]'
                      : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: seg.speakerColor || '#EAB349' }}
                    />
                    <span className="font-extrabold text-[#FAF6EE]">
                      {seg.speakerName || 'گوینده'}
                    </span>

                    {showSourceAudioBadge && sourceTitle && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300">
                        <FileAudio className="h-3 w-3" />
                        {sourceTitle.split('—')[0].trim()}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => playSegment(seg)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] font-bold text-[#F7D782] transition hover:bg-[#EAB349] hover:text-[#141210] cursor-pointer"
                      dir="ltr"
                    >
                      {isPlayingHere ? (
                        <EqualizerBars active color="#EAB349" bars={3} height={10} />
                      ) : (
                        <Play className="h-2.5 w-2.5 fill-current" />
                      )}
                      {formatTimecode(seg.startSec)} — {formatTimecode(seg.endSec)}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {linkedHooks.map((lh) => {
                      const tierColor = TIER_META[lh.tier as HookTier].dotColor;
                      return (
                        <button
                          key={lh.id}
                          type="button"
                          onClick={() => onOpenHook?.(lh)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-[#DDD5C8] transition hover:border-[#EAB349]/45 cursor-pointer"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: tierColor }}
                          />
                          {TIER_META[lh.tier].shortLabel} ↗
                        </button>
                      );
                    })}

                    {onEditSegment && !isEditing && (
                      <button
                        type="button"
                        title="ویرایش متن"
                        onClick={() => {
                          setEditingSegId(seg.id);
                          setSegDraft(seg.text);
                        }}
                        className="rounded-lg p-1 text-[#7D7469] opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {isEditing ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 space-y-2.5"
                    >
                      <textarea
                        rows={3}
                        value={segDraft}
                        onChange={(e) => setSegDraft(e.target.value)}
                        className="w-full rounded-xl console-inset p-3.5 text-sm leading-8 text-[#F5F1E8] outline-none focus:border-[#EAB349]/60"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingSegId(null)}
                          className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-[#A49B8E] cursor-pointer"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          disabled={savingSeg}
                          onClick={() => submitSegEdit(seg.id)}
                          className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-black text-zinc-950 cursor-pointer"
                        >
                          ذخیره متن
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="read"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-3 text-[15px] leading-9 text-[#E5DDD0]"
                    >
                      {seg.text}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </section>

      {/* Quiet Floating Bottom Waveform Transport */}
      {activeAudio && (
        <BottomTransportDeck
          ref={deckRef}
          audioUrl={activeAudio.audioUrl}
          title={activeAudio.title}
          durationSec={activeAudio.durationSec}
          segments={segments.filter((s) => s.audioFileId === activeAudio.id)}
          onTimeChange={setCurrentTimeSec}
        />
      )}
    </motion.div>
  );
}
