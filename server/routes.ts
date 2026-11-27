import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  UPLOADS_DIR,
  appendHookForSource,
  applyAlternativeHookVariant,
  buildMergedTimeline,
  createAudioWithDiarization,
  createCombinationRecord,
  createProject,
  deleteAudioFile,
  deleteCombination,
  deleteProject,
  getAudioFileDetail,
  getCombinationDetail,
  getHookById,
  getPublicSettings,
  getRawSettings,
  getVerifiableSegmentsForHook,
  listAudioFilesByProject,
  listCombinationsByProject,
  listProjectHooks,
  listProjectQuoteSegments,
  listProjects,
  replaceHooksForSource,
  saveSettings,
  updateCombinationOrderRecord,
  updateHookAlternativeHooks,
  updateHookPublishingKit,
  updateSpeakerDisplayName,
  updateTranscriptSegmentText,
} from './db.ts';
import { estimateAudioDurationSec, generateDemoWav } from './audioUtils.ts';
import { extractHooksAndScenarios, transcribeAndDiarizeAudio } from './aiEngine.ts';
import {
  generateAlternativeHooks,
  generateAlternativeHooksLocally,
  generateCarouselSlides,
  generatePublishingKit,
  generatePublishingKitLocally,
} from './hookEnricher.ts';
import {
  computeViralIntelligence,
  extractMicroLoopReel,
  extractRapidQAReel,
} from './viralEngine.ts';
import {
  sendScenarioToTelegramGroup,
  testTelegramConnection,
} from './telegramClient.ts';
import { testAIConnection } from './llmClient.ts';
import { verifyAndSnapBeats, type VerifiableSegment } from './verbatimValidator.ts';
import type { AIProvider, HookTier, StoryFormat } from './types.ts';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.mp3';
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB stitched WAV for Telegram
});

export const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gholab-api' });
});

/* ================= SETTINGS ================= */

router.get('/settings', (_req, res) => {
  res.json(getPublicSettings());
});

router.put('/settings', (req, res) => {
  const updated = saveSettings(req.body || {});
  res.json(updated);
});

router.post('/ai/test', async (req, res) => {
  const saved = getRawSettings();
  const provider = ((req.body?.provider as AIProvider) || saved.provider) as AIProvider;
  const rawKey =
    typeof req.body?.apiKey === 'string' &&
    req.body.apiKey.trim() &&
    !req.body.apiKey.includes('••••')
      ? req.body.apiKey.trim()
      : saved.apiKey;
  const baseUrl =
    typeof req.body?.baseUrl === 'string' && req.body.baseUrl.trim()
      ? req.body.baseUrl.trim()
      : saved.baseUrl;
  const geminiModel =
    typeof req.body?.geminiModel === 'string' && req.body.geminiModel.trim()
      ? req.body.geminiModel.trim()
      : saved.geminiModel;
  const llmModel =
    typeof req.body?.llmModel === 'string' && req.body.llmModel.trim()
      ? req.body.llmModel.trim()
      : saved.llmModel;

  const result = await testAIConnection({
    provider,
    apiKey: rawKey,
    baseUrl,
    geminiModel,
    llmModel,
  });
  res.json(result);
});

/* ================= PROJECTS ================= */

router.get('/projects', (_req, res) => {
  res.json(listProjects());
});

router.post('/projects', (req, res) => {
  const { title, eventDate, description } = req.body || {};
  if (!title || !String(title).trim()) {
    res.status(400).json({ error: 'عنوان پروژه الزامی است.' });
    return;
  }
  const project = createProject({ title: String(title), eventDate, description });
  res.status(201).json(project);
});

router.delete('/projects/:projectId', (req, res) => {
  deleteProject(req.params.projectId);
  res.json({ ok: true });
});

router.get('/projects/:projectId/hooks', (req, res) => {
  res.json(listProjectHooks(req.params.projectId));
});

/* ================= AUDIO FILES ================= */

router.get('/projects/:projectId/audio', (req, res) => {
  res.json(listAudioFilesByProject(req.params.projectId));
});

router.post('/projects/:projectId/audio', upload.single('audio'), async (req, res) => {
  try {
    const projectId = String(req.params.projectId);
    const rawTranscript = typeof req.body?.rawTranscript === 'string' ? req.body.rawTranscript : '';
    const customTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

    let storedFilename = '';
    let originalFilename = '';
    let mimeType = 'audio/wav';
    let fileSize = 0;
    let durationSec = 150;
    let filePath = '';

    if (req.file) {
      storedFilename = req.file.filename;
      // Handle UTF-8 Persian original filenames safely
      originalFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      mimeType = req.file.mimetype || 'audio/mpeg';
      fileSize = req.file.size;
      filePath = req.file.path;
      durationSec = estimateAudioDurationSec(filePath, mimeType, fileSize);
    } else if (rawTranscript.trim().length > 15) {
      // Allow creating a part directly from pasted transcript with a generated playable audio track
      storedFilename = `${Date.now()}-${uuidv4().slice(0, 8)}.wav`;
      originalFilename = `${customTitle || 'seminar-part'}.wav`;
      filePath = path.join(UPLOADS_DIR, storedFilename);
      const wordCount = rawTranscript.trim().split(/\s+/).length;
      durationSec = Math.max(45, Math.min(300, Math.round(wordCount * 0.6)));
      fileSize = generateDemoWav(filePath, durationSec, [0, Math.round(durationSec * 0.35), Math.round(durationSec * 0.7)]);
    } else {
      res.status(400).json({ error: 'لطفاً یک فایل صوتی انتخاب کنید یا متن پیاده‌سازی‌شده را وارد نمایید.' });
      return;
    }

    const title = customTitle || originalFilename.replace(/\.[^.]+$/, '') || 'فایل صوتی سمینار';
    const settings = getRawSettings();

    const diarization = await transcribeAndDiarizeAudio({
      audioPath: filePath,
      mimeType,
      title,
      durationSec,
      rawTranscript,
      settings,
    });

    const maxSegEnd = diarization.segments.reduce((m, s) => Math.max(m, s.endSec), 0);
    const finalDuration = Math.max(durationSec, maxSegEnd);

    const { audioFileId, insertedSegments } = createAudioWithDiarization({
      projectId,
      title,
      originalFilename,
      storedFilename,
      mimeType,
      fileSize,
      durationSec: finalDuration,
      analysisMode: diarization.usedProvider,
      speakers: diarization.speakers,
      segments: diarization.segments,
    });

    const verifiableSegments: VerifiableSegment[] = insertedSegments.map((s) => ({
      id: s.id,
      audioFileId,
      audioTitle: title,
      speakerId: s.speakerId,
      speakerName: s.speakerName || 'گوینده',
      startSec: s.startSec,
      endSec: s.endSec,
      text: s.text,
    }));

    const generatedHooks = await extractHooksAndScenarios({
      segments: verifiableSegments,
      settings,
      isCombined: false,
    });

    replaceHooksForSource({
      projectId,
      sourceType: 'audio',
      audioFileId,
      hooks: generatedHooks,
    });

    const detail = getAudioFileDetail(audioFileId);
    res.status(201).json(detail);
  } catch (err) {
    console.error('[POST /audio] error:', err);
    res.status(500).json({ error: 'خطا در پردازش فایل صوتی. لطفاً دوباره تلاش کنید.' });
  }
});

router.get('/audio/:audioId', (req, res) => {
  const detail = getAudioFileDetail(req.params.audioId);
  if (!detail) {
    res.status(404).json({ error: 'فایل صوتی یافت نشد.' });
    return;
  }
  res.json(detail);
});

router.delete('/audio/:audioId', (req, res) => {
  deleteAudioFile(req.params.audioId);
  res.json({ ok: true });
});

router.post('/audio/:audioId/reanalyze', async (req, res) => {
  try {
    const detail = getAudioFileDetail(req.params.audioId);
    if (!detail) {
      res.status(404).json({ error: 'فایل صوتی یافت نشد.' });
      return;
    }
    const settings = getRawSettings();
    const verifiableSegments: VerifiableSegment[] = detail.segments.map((s) => ({
      id: s.id,
      audioFileId: detail.id,
      audioTitle: detail.title,
      speakerId: s.speakerId,
      speakerName: s.speakerName || 'گوینده',
      startSec: s.startSec,
      endSec: s.endSec,
      text: s.text,
    }));

    const generatedHooks = await extractHooksAndScenarios({
      segments: verifiableSegments,
      settings,
      isCombined: false,
    });

    replaceHooksForSource({
      projectId: detail.projectId,
      sourceType: 'audio',
      audioFileId: detail.id,
      hooks: generatedHooks,
    });

    res.json(getAudioFileDetail(detail.id));
  } catch (err) {
    console.error('[POST /audio/:audioId/reanalyze] error:', err);
    res.status(500).json({ error: 'خطا در تحلیل مجدد فایل.' });
  }
});

/* ================= SPEAKERS & SEGMENTS ================= */

router.patch('/speakers/:speakerId', (req, res) => {
  const { displayName } = req.body || {};
  if (!displayName || !String(displayName).trim()) {
    res.status(400).json({ error: 'نام گوینده نمی‌تواند خالی باشد.' });
    return;
  }
  const updated = updateSpeakerDisplayName(req.params.speakerId, String(displayName));
  if (!updated) {
    res.status(404).json({ error: 'گوینده یافت نشد.' });
    return;
  }
  res.json(updated);
});

router.patch('/segments/:segmentId', (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    res.status(400).json({ error: 'متن بخش نمی‌تواند خالی باشد.' });
    return;
  }
  const ok = updateTranscriptSegmentText(req.params.segmentId, String(text));
  if (!ok) {
    res.status(404).json({ error: 'بخش متن یافت نشد.' });
    return;
  }
  res.json({ ok: true });
});

/* ================= COMBINATIONS ================= */

router.get('/projects/:projectId/combinations', (req, res) => {
  res.json(listCombinationsByProject(req.params.projectId));
});

router.post('/projects/:projectId/combinations', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { title, goal, orderedAudioIds } = req.body || {};

    if (!Array.isArray(orderedAudioIds) || orderedAudioIds.length < 2) {
      res.status(400).json({ error: 'برای ساخت ترکیب، حداقل ۲ فایل صوتی انتخاب کنید.' });
      return;
    }

    const comboTitle =
      String(title || '').trim() || `ترکیب ${orderedAudioIds.length} فایل صوتی`;
    const comboGoal =
      String(goal || '').trim() || 'ساختار داستانی پیوسته بین بخش‌های انتخاب‌شده';

    const combinationId = createCombinationRecord({
      projectId,
      title: comboTitle,
      goal: comboGoal,
      orderedAudioIds: orderedAudioIds.map(String),
    });

    const { mergedSegments } = buildMergedTimeline(orderedAudioIds.map(String));
    const verifiableSegments: VerifiableSegment[] = mergedSegments.map((s) => ({
      id: s.id,
      audioFileId: s.audioFileId,
      audioTitle: s.sourceAudioTitle,
      speakerId: s.speakerId,
      speakerName: s.speakerName,
      startSec: s.startSec,
      endSec: s.endSec,
      combinedStartSec: s.combinedStartSec,
      combinedEndSec: s.combinedEndSec,
      text: s.text,
    }));

    const settings = getRawSettings();
    const hooks = await extractHooksAndScenarios({
      segments: verifiableSegments,
      settings,
      isCombined: true,
      combinationGoal: comboGoal,
    });

    replaceHooksForSource({
      projectId,
      sourceType: 'combination',
      combinationId,
      hooks,
    });

    res.status(201).json(getCombinationDetail(combinationId));
  } catch (err) {
    console.error('[POST /combinations] error:', err);
    res.status(500).json({ error: 'خطا در ترکیب فایل‌ها و تولید سناریو.' });
  }
});

router.get('/combinations/:combinationId', (req, res) => {
  const detail = getCombinationDetail(req.params.combinationId);
  if (!detail) {
    res.status(404).json({ error: 'ترکیب مورد نظر یافت نشد.' });
    return;
  }
  res.json(detail);
});

router.put('/combinations/:combinationId', async (req, res) => {
  try {
    const existing = getCombinationDetail(req.params.combinationId);
    if (!existing) {
      res.status(404).json({ error: 'ترکیب مورد نظر یافت نشد.' });
      return;
    }

    const { title, goal, orderedAudioIds } = req.body || {};
    const nextIds: string[] =
      Array.isArray(orderedAudioIds) && orderedAudioIds.length >= 2
        ? orderedAudioIds.map(String)
        : existing.orderedAudioIds;
    const nextTitle = String(title || existing.title).trim();
    const nextGoal = String(goal || existing.goal).trim();

    updateCombinationOrderRecord(existing.id, nextTitle, nextGoal, nextIds);

    const { mergedSegments } = buildMergedTimeline(nextIds);
    const verifiableSegments: VerifiableSegment[] = mergedSegments.map((s) => ({
      id: s.id,
      audioFileId: s.audioFileId,
      audioTitle: s.sourceAudioTitle,
      speakerId: s.speakerId,
      speakerName: s.speakerName,
      startSec: s.startSec,
      endSec: s.endSec,
      combinedStartSec: s.combinedStartSec,
      combinedEndSec: s.combinedEndSec,
      text: s.text,
    }));

    const settings = getRawSettings();
    const hooks = await extractHooksAndScenarios({
      segments: verifiableSegments,
      settings,
      isCombined: true,
      combinationGoal: nextGoal,
    });

    replaceHooksForSource({
      projectId: existing.projectId,
      sourceType: 'combination',
      combinationId: existing.id,
      hooks,
    });

    res.json(getCombinationDetail(existing.id));
  } catch (err) {
    console.error('[PUT /combinations/:id] error:', err);
    res.status(500).json({ error: 'خطا در به‌روزرسانی ترکیب.' });
  }
});

router.delete('/combinations/:combinationId', (req, res) => {
  deleteCombination(req.params.combinationId);
  res.json({ ok: true });
});

/* ================= HOOK A/B TESTING & PUBLISHING KIT ================= */

router.post('/hooks/:hookId/ab-variants', async (req, res) => {
  try {
    const hook = getHookById(req.params.hookId);
    if (!hook) {
      res.status(404).json({ error: 'قلاب مورد نظر یافت نشد.' });
      return;
    }

    const segments = getVerifiableSegmentsForHook(hook);
    const settings = getRawSettings();
    const excludeIds = Array.isArray(req.body?.excludeSegmentIds)
      ? req.body.excludeSegmentIds.map(String)
      : hook.alternativeHooks.map((v) => v.segmentId);

    let variants = await generateAlternativeHooks({
      hook,
      segments,
      settings,
      excludeSegmentIds: excludeIds,
    });

    // If excluding previous variants left too few options, allow cycling across full pool
    if (variants.length === 0) {
      variants = await generateAlternativeHooks({
        hook,
        segments,
        settings,
        excludeSegmentIds: [],
      });
    }

    const updated = updateHookAlternativeHooks(hook.id, variants);
    res.json(updated);
  } catch (err) {
    console.error('[POST /hooks/:id/ab-variants] error:', err);
    res.status(500).json({ error: 'خطا در تولید قلاب‌های جایگزین.' });
  }
});

router.post('/hooks/:hookId/apply-variant', (req, res) => {
  const variantId = String(req.body?.variantId || '').trim();
  if (!variantId) {
    res.status(400).json({ error: 'شناسه قلاب جایگزین الزامی است.' });
    return;
  }
  const updated = applyAlternativeHookVariant(req.params.hookId, variantId);
  if (!updated) {
    res.status(404).json({ error: 'قلاب مورد نظر یافت نشد.' });
    return;
  }
  res.json(updated);
});

router.post('/hooks/:hookId/publishing-kit', async (req, res) => {
  try {
    const hook = getHookById(req.params.hookId);
    if (!hook) {
      res.status(404).json({ error: 'قلاب مورد نظر یافت نشد.' });
      return;
    }

    const settings = getRawSettings();
    const kit = await generatePublishingKit({ hook, settings });
    const updated = updateHookPublishingKit(hook.id, kit);
    res.json(updated);
  } catch (err) {
    console.error('[POST /hooks/:id/publishing-kit] error:', err);
    res.status(500).json({ error: 'خطا در تولید پکیج انتشار.' });
  }
});

/* ================= ON-DEMAND VIRAL SPECIAL REELS (#7 MICRO-LOOP & #8 RAPID Q&A) ================= */

async function resolveSourceSegments(sourceType: 'audio' | 'combination', sourceId: string): Promise<{
  projectId: string;
  segments: VerifiableSegment[];
  existingHookSegmentIds: string[];
} | null> {
  if (sourceType === 'audio') {
    const detail = getAudioFileDetail(sourceId);
    if (!detail) return null;
    return {
      projectId: detail.projectId,
      segments: detail.segments.map((s) => ({
        id: s.id,
        audioFileId: detail.id,
        audioTitle: detail.title,
        speakerId: s.speakerId,
        speakerName: s.speakerName || 'گوینده',
        startSec: s.startSec,
        endSec: s.endSec,
        text: s.text,
      })),
      existingHookSegmentIds: detail.hooks
        .filter((h) => h.specialFormat === 'micro_loop')
        .map((h) => h.hookSegmentId),
    };
  }

  const combo = getCombinationDetail(sourceId);
  if (!combo) return null;
  return {
    projectId: combo.projectId,
    segments: combo.mergedSegments.map((s) => ({
      id: s.id,
      audioFileId: s.audioFileId,
      audioTitle: s.sourceAudioTitle,
      speakerId: s.speakerId,
      speakerName: s.speakerName,
      startSec: s.startSec,
      endSec: s.endSec,
      combinedStartSec: s.combinedStartSec,
      combinedEndSec: s.combinedEndSec,
      text: s.text,
    })),
    existingHookSegmentIds: combo.hooks
      .filter((h) => h.specialFormat === 'micro_loop')
      .map((h) => h.hookSegmentId),
  };
}

router.post('/sources/micro-loop', async (req, res) => {
  try {
    const sourceType = req.body?.sourceType === 'combination' ? 'combination' : 'audio';
    const sourceId = String(req.body?.sourceId || '').trim();
    if (!sourceId) {
      res.status(400).json({ error: 'شناسه منبع الزامی است.' });
      return;
    }

    const resolved = await resolveSourceSegments(sourceType, sourceId);
    if (!resolved) {
      res.status(404).json({ error: 'فایل یا ترکیب مورد نظر یافت نشد.' });
      return;
    }

    const settings = getRawSettings();
    const draft = await extractMicroLoopReel({
      segments: resolved.segments,
      existingSegmentIds: resolved.existingHookSegmentIds,
      settings,
    });

    const created = appendHookForSource({
      projectId: resolved.projectId,
      sourceType,
      audioFileId: sourceType === 'audio' ? sourceId : undefined,
      combinationId: sourceType === 'combination' ? sourceId : undefined,
      hook: draft,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /sources/micro-loop] error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در ساخت میکرو‌ریلز لوپ.' });
  }
});

router.post('/sources/rapid-qa', async (req, res) => {
  try {
    const sourceType = req.body?.sourceType === 'combination' ? 'combination' : 'audio';
    const sourceId = String(req.body?.sourceId || '').trim();
    if (!sourceId) {
      res.status(400).json({ error: 'شناسه منبع الزامی است.' });
      return;
    }

    const resolved = await resolveSourceSegments(sourceType, sourceId);
    if (!resolved) {
      res.status(404).json({ error: 'فایل یا ترکیب مورد نظر یافت نشد.' });
      return;
    }

    const settings = getRawSettings();
    const draft = await extractRapidQAReel({
      segments: resolved.segments,
      settings,
    });

    const created = appendHookForSource({
      projectId: resolved.projectId,
      sourceType,
      audioFileId: sourceType === 'audio' ? sourceId : undefined,
      combinationId: sourceType === 'combination' ? sourceId : undefined,
      hook: draft,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /sources/rapid-qa] error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'خطا در ساخت ریلز مکالمه‌ای.' });
  }
});

/* ================= CAROUSEL SLIDES GENERATOR ================= */

router.post('/hooks/:hookId/carousel', async (req, res) => {
  try {
    const hook = getHookById(req.params.hookId);
    if (!hook) {
      res.status(404).json({ error: 'قلاب مورد نظر یافت نشد.' });
      return;
    }

    const settings = getRawSettings();
    const slides = await generateCarouselSlides({ hook, settings });
    const baseKit =
      hook.publishingKit ||
      generatePublishingKitLocally({
        tier: hook.tier,
        storyFormat: hook.storyFormat,
        title: hook.title,
        hookVerbatim: hook.hookVerbatim,
        rationale: hook.rationale,
        scenarioBeats: hook.scenarioBeats,
        captionIdea: hook.captionIdea,
        storyEngagementIdea: hook.storyEngagementIdea,
      });

    const updated = updateHookPublishingKit(hook.id, {
      ...baseKit,
      carouselSlides: slides,
    });
    res.json(updated);
  } catch (err) {
    console.error('[POST /hooks/:id/carousel] error:', err);
    res.status(500).json({ error: 'خطا در تولید اسلایدهای کاروسل.' });
  }
});

/* ================= CROSS-AUDIO QUOTE BUILDER ================= */

router.get('/projects/:projectId/segments', (req, res) => {
  res.json(listProjectQuoteSegments(req.params.projectId));
});

router.post('/projects/:projectId/custom-scenario', (req, res) => {
  try {
    const projectId = String(req.params.projectId);
    const orderedSegmentIds: string[] = Array.isArray(req.body?.segmentIds)
      ? req.body.segmentIds.map(String)
      : [];

    if (orderedSegmentIds.length === 0) {
      res.status(400).json({ error: 'حداقل یک جمله برای ساخت سناریو انتخاب کنید.' });
      return;
    }

    const allSegs = listProjectQuoteSegments(projectId);
    const byId = new Map(allSegs.map((s) => [s.id, s]));
    const picked = orderedSegmentIds
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    if (picked.length === 0) {
      res.status(400).json({ error: 'جملات انتخابی یافت نشدند.' });
      return;
    }

    const tierRaw = String(req.body?.tier || 'gold');
    const tier: HookTier =
      tierRaw === 'gold' || tierRaw === 'silver' || tierRaw === 'bronze' ? tierRaw : 'gold';
    const storyFormat: StoryFormat | null =
      tier === 'bronze'
        ? picked.length > 1
          ? 'story_sequence'
          : 'single_story'
        : null;

    const verifiable: VerifiableSegment[] = allSegs.map((s) => ({
      id: s.id,
      audioFileId: s.audioFileId,
      audioTitle: s.audioTitle,
      speakerId: s.speakerId,
      speakerName: s.speakerName,
      startSec: s.startSec,
      endSec: s.endSec,
      text: s.text,
    }));

    const rawBeats = picked.map((seg, idx) => ({
      label:
        tier === 'bronze'
          ? picked.length > 1
            ? `اسلاید ${idx + 1} — ${idx === 0 ? 'شروع و قلاب' : idx === picked.length - 1 ? 'جمع‌بندی و CTA' : 'ادامه روایت'}`
            : 'اسلاید استوری تکی'
          : idx === 0
            ? 'قلاب آغازین (انتخاب دستی)'
            : idx === picked.length - 1
              ? 'ضربه نهایی و جمع‌بندی'
              : `بدنه سناریو — بخش ${idx + 1}`,
      segmentId: seg.id,
      verbatimText: seg.text,
      editingNote:
        idx === 0
          ? 'ورود سریع بدون مکث اضافی + زیرنویس درشت کلمات کلیدی.'
          : 'کات تیز و پیوسته؛ در تغییر گوینده یا فایل از برچسب نام استفاده شود.',
    }));

    const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(rawBeats, verifiable);
    const lead = verifiedBeats[0];
    const estDur = verifiedBeats.reduce((acc, b) => acc + Math.max(6, b.endSec - b.startSec), 0);

    const distinctAudioIds = Array.from(new Set(verifiedBeats.map((b) => b.sourceAudioId)));
    const customTitle = String(req.body?.title || '').trim();
    const fallbackTitle =
      lead.verbatimText.split(/[،.!؟]/)[0]?.trim().slice(0, 48) || 'سناریوی دست‌چین سمینار';
    const title = customTitle || `سناریوی دست‌چین: ${fallbackTitle}`;

    const formatLabel =
      tier === 'gold'
        ? 'پست ریلز (دست‌چین)'
        : tier === 'silver'
          ? 'تریال ریلز (دست‌چین)'
          : picked.length > 1
            ? `رشته استوری (${picked.length} اسلاید)`
            : 'استوری تکی';

    const rationale =
      distinctAudioIds.length > 1
        ? `سناریوی اختصاصی چیده‌شده از ${picked.length} جمله طلایی در ${distinctAudioIds.length} فایل صوتی مختلف با حفظ ۱۰۰٪ عین متن.`
        : `سناریوی دست‌چین‌شده از ${picked.length} جمله منتخب با چیدمان دلخواه و حفظ ۱۰۰٪ عین متن.`;

    const intel = computeViralIntelligence({
      tier,
      storyFormat,
      specialFormat: 'standard',
      title,
      hookVerbatim: lead.verbatimText,
      scenarioBeats: verifiedBeats,
    });

    const publishingKit = generatePublishingKitLocally({
      tier,
      storyFormat,
      title,
      hookVerbatim: lead.verbatimText,
      rationale,
      scenarioBeats: verifiedBeats,
      captionIdea: null,
      storyEngagementIdea: null,
    });

    const alternativeHooks = generateAlternativeHooksLocally({
      hookSegmentId: lead.segmentId,
      bodySegmentIds: verifiedBeats.slice(1).map((b) => b.segmentId),
      segments: verifiable,
      desiredCount: 2,
    });

    const created = appendHookForSource({
      projectId,
      sourceType: 'audio',
      audioFileId: lead.sourceAudioId,
      hook: {
        tier,
        formatLabel,
        storyFormat,
        title,
        hookVerbatim: lead.verbatimText,
        hookSegmentId: lead.segmentId,
        hookSourceAudioId: lead.sourceAudioId,
        hookSourceAudioTitle: lead.sourceAudioTitle,
        hookStartSec: lead.startSec,
        hookEndSec: lead.endSec,
        hookSpeakerName: lead.speakerName,
        rationale,
        estimatedDurationSec: estDur,
        scenarioBeats: verifiedBeats,
        alternativeHooks,
        publishingKit,
        viralBlueprint: intel.viralBlueprint,
        specialFormat: 'standard',
        inMediaResCut: intel.inMediaResCut,
        viralAudit: intel.viralAudit,
        audioMoodGuide: intel.audioMoodGuide,
        storyEngagementIdea:
          tier === 'bronze'
            ? 'در اسلاید اول استیکر نظرسنجی بگذارید و در اسلاید آخر از مخاطب بخواهید کلیدواژه را ریپلای کند.'
            : null,
        captionIdea: publishingKit.fullCaption,
        verbatimScore,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /projects/:id/custom-scenario] error:', err);
    res.status(500).json({ error: 'خطا در ساخت سناریوی دستی.' });
  }
});

/* ================= TELEGRAM BOT GROUP INTEGRATION ================= */

router.post('/telegram/test', async (req, res) => {
  const saved = getRawSettings();
  const rawToken =
    typeof req.body?.telegramBotToken === 'string' &&
    req.body.telegramBotToken.trim() &&
    !req.body.telegramBotToken.includes('••••')
      ? req.body.telegramBotToken.trim()
      : saved.telegramBotToken;
  const chatId =
    typeof req.body?.telegramChatId === 'string' && req.body.telegramChatId.trim()
      ? req.body.telegramChatId.trim()
      : saved.telegramChatId;
  const groupName =
    typeof req.body?.telegramGroupName === 'string'
      ? req.body.telegramGroupName.trim()
      : saved.telegramGroupName;

  const result = await testTelegramConnection({
    botToken: rawToken,
    chatId,
    groupName,
  });
  res.json(result);
});

router.post('/hooks/:hookId/send-telegram', memoryUpload.single('audio'), async (req, res) => {
  try {
    const hook = getHookById(String(req.params.hookId));
    if (!hook) {
      res.status(404).json({ error: 'قلاب مورد نظر یافت نشد.' });
      return;
    }

    const saved = getRawSettings();
    const parseBool = (val: unknown, fallback: boolean): boolean => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val !== 'false' && val !== '0';
      return fallback;
    };

    const result = await sendScenarioToTelegramGroup({
      botToken: saved.telegramBotToken,
      chatId: saved.telegramChatId,
      hook,
      options: {
        includeScenario: parseBool(req.body?.includeScenario, true),
        includePublishingKit: parseBool(req.body?.includePublishingKit, true),
        includeViralRadar: parseBool(req.body?.includeViralRadar, true),
        includeCarousel: parseBool(req.body?.includeCarousel, false),
        customNote: typeof req.body?.customNote === 'string' ? req.body.customNote : '',
      },
      audioBuffer: req.file?.buffer,
      audioFilename: req.file?.originalname,
    });

    res.json(result);
  } catch (err) {
    console.error('[POST /hooks/:id/send-telegram] error:', err);
    res.status(500).json({ error: 'خطا در ارسال به گروه تلگرام.' });
  }
});

