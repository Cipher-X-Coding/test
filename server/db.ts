import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import type {
  AIProvider,
  AISettings,
  AudioFileDetail,
  AudioFileSummary,
  AudioMoodGuide,
  CombinationDetail,
  CombinationSummary,
  HookTier,
  HookVariant,
  HookWithScenario,
  InMediaResCut,
  MergedTranscriptSegment,
  OrderedAudioMeta,
  ProjectQuoteSegment,
  ProjectSummary,
  PublishingKit,
  ScenarioBeat,
  Speaker,
  SpecialReelFormat,
  StoryFormat,
  TranscriptSegment,
  ViralAudit,
  ViralBlueprintId,
} from './types.ts';
import type { DiarizedSegmentOutput, DiarizedSpeakerOutput, GeneratedHookDraft } from './aiEngine.ts';
import {
  generateAlternativeHooksLocally,
  generateCarouselSlidesLocally,
  generatePublishingKitLocally,
} from './hookEnricher.ts';
import { computeViralIntelligence } from './viralEngine.ts';
import type { VerifiableSegment } from './verbatimValidator.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'sedagholab.db');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audio_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'ready',
    analysis_mode TEXT NOT NULL DEFAULT 'demo',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS speakers (
    id TEXT PRIMARY KEY,
    audio_file_id TEXT NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    speaker_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    detected_name TEXT,
    detected_role TEXT,
    detection_evidence TEXT,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transcript_segments (
    id TEXT PRIMARY KEY,
    audio_file_id TEXT NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    start_sec INTEGER NOT NULL,
    end_sec INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS combinations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    ordered_audio_ids TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hooks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    audio_file_id TEXT REFERENCES audio_files(id) ON DELETE CASCADE,
    combination_id TEXT REFERENCES combinations(id) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    format_label TEXT NOT NULL,
    story_format TEXT,
    title TEXT NOT NULL,
    hook_verbatim TEXT NOT NULL,
    hook_segment_id TEXT NOT NULL,
    hook_source_audio_id TEXT NOT NULL,
    hook_source_audio_title TEXT NOT NULL,
    hook_start_sec INTEGER NOT NULL,
    hook_end_sec INTEGER NOT NULL,
    hook_speaker_name TEXT NOT NULL,
    rationale TEXT NOT NULL,
    estimated_duration_sec INTEGER NOT NULL DEFAULT 30,
    scenario_beats_json TEXT NOT NULL,
    alternative_hooks_json TEXT,
    publishing_kit_json TEXT,
    viral_intel_json TEXT,
    story_engagement_idea TEXT,
    caption_idea TEXT,
    verbatim_score INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL
  );
`);

// Safe non-destructive schema migration for existing SQLite databases
{
  const cols = db.prepare('PRAGMA table_info(hooks)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('alternative_hooks_json')) {
    db.exec('ALTER TABLE hooks ADD COLUMN alternative_hooks_json TEXT;');
  }
  if (!colNames.has('publishing_kit_json')) {
    db.exec('ALTER TABLE hooks ADD COLUMN publishing_kit_json TEXT;');
  }
  if (!colNames.has('viral_intel_json')) {
    db.exec('ALTER TABLE hooks ADD COLUMN viral_intel_json TEXT;');
  }
}

const COMBINATION_FILE_COLORS = ['#B45309', '#2563EB', '#059669', '#7C3AED', '#DB2777', '#0891B2'];

/* ================= SETTINGS ================= */

export function getRawSettings(): AISettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const provider = (map.get('provider') as AIProvider) || 'demo';
  const apiKey = map.get('apiKey') || '';
  const telegramBotToken = map.get('telegramBotToken') || '';
  return {
    provider,
    apiKey,
    hasApiKey: apiKey.length > 0,
    baseUrl:
      map.get('baseUrl') ||
      (provider === 'gapgpt' ? 'https://api.gapgpt.app/v1' : 'https://api.openai.com/v1'),
    geminiModel: map.get('geminiModel') || 'gemini-2.5-flash',
    transcriptionModel:
      map.get('transcriptionModel') ||
      (provider === 'gapgpt' ? 'gapgpt/whisper-1' : 'whisper-1'),
    llmModel: map.get('llmModel') || 'gpt-4o',
    telegramBotToken,
    hasTelegramBotToken: telegramBotToken.length > 0,
    telegramChatId: map.get('telegramChatId') || '',
    telegramGroupName: map.get('telegramGroupName') || '',
  };
}

export function getPublicSettings(): AISettings {
  const raw = getRawSettings();
  return {
    ...raw,
    apiKey: raw.apiKey ? `${raw.apiKey.slice(0, 4)}••••••••${raw.apiKey.slice(-4)}` : '',
    telegramBotToken: raw.telegramBotToken
      ? `${raw.telegramBotToken.slice(0, 6)}••••••••${raw.telegramBotToken.slice(-4)}`
      : '',
  };
}

export function saveSettings(input: Partial<AISettings>): AISettings {
  const current = getRawSettings();
  const next: Record<string, string> = {
    provider: input.provider || current.provider,
    baseUrl: input.baseUrl !== undefined ? input.baseUrl : current.baseUrl,
    geminiModel: input.geminiModel !== undefined ? input.geminiModel : current.geminiModel,
    transcriptionModel:
      input.transcriptionModel !== undefined ? input.transcriptionModel : current.transcriptionModel,
    llmModel: input.llmModel !== undefined ? input.llmModel : current.llmModel,
    telegramChatId:
      input.telegramChatId !== undefined ? input.telegramChatId.trim() : current.telegramChatId,
    telegramGroupName:
      input.telegramGroupName !== undefined
        ? input.telegramGroupName.trim()
        : current.telegramGroupName,
  };

  if (input.apiKey !== undefined && !input.apiKey.includes('••••')) {
    next.apiKey = input.apiKey.trim();
  } else {
    next.apiKey = current.apiKey;
  }

  if (input.telegramBotToken !== undefined && !input.telegramBotToken.includes('••••')) {
    next.telegramBotToken = input.telegramBotToken.trim();
  } else {
    next.telegramBotToken = current.telegramBotToken;
  }

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [k, v] of Object.entries(next)) {
    upsert.run(k, v);
  }
  return getPublicSettings();
}

/* ================= PROJECTS ================= */

export function listProjects(): ProjectSummary[] {
  const rows = db
    .prepare('SELECT id, title, event_date, description, created_at FROM projects ORDER BY created_at DESC')
    .all() as Array<{
    id: string;
    title: string;
    event_date: string;
    description: string;
    created_at: string;
  }>;

  return rows.map((p) => {
    const audioCount = (
      db.prepare('SELECT COUNT(*) as c FROM audio_files WHERE project_id = ?').get(p.id) as { c: number }
    ).c;
    const combinationCount = (
      db.prepare('SELECT COUNT(*) as c FROM combinations WHERE project_id = ?').get(p.id) as { c: number }
    ).c;
    const tierCounts = db
      .prepare('SELECT tier, COUNT(*) as c FROM hooks WHERE project_id = ? GROUP BY tier')
      .all(p.id) as Array<{ tier: HookTier; c: number }>;
    const tc = new Map(tierCounts.map((t) => [t.tier, t.c]));

    return {
      id: p.id,
      title: p.title,
      eventDate: p.event_date,
      description: p.description,
      createdAt: p.created_at,
      audioCount,
      combinationCount,
      goldCount: tc.get('gold') || 0,
      silverCount: tc.get('silver') || 0,
      bronzeCount: tc.get('bronze') || 0,
    };
  });
}

export function createProject(input: { title: string; eventDate?: string; description?: string }): ProjectSummary {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects (id, title, event_date, description, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.title.trim(), (input.eventDate || '').trim(), (input.description || '').trim(), createdAt);

  return {
    id,
    title: input.title.trim(),
    eventDate: (input.eventDate || '').trim(),
    description: (input.description || '').trim(),
    createdAt,
    audioCount: 0,
    combinationCount: 0,
    goldCount: 0,
    silverCount: 0,
    bronzeCount: 0,
  };
}

export function deleteProject(projectId: string): void {
  const files = db
    .prepare('SELECT stored_filename FROM audio_files WHERE project_id = ?')
    .all(projectId) as Array<{ stored_filename: string }>;
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  for (const f of files) {
    const fp = path.join(UPLOADS_DIR, f.stored_filename);
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

/* ================= HOOKS HELPERS ================= */

function loadVerifiableSegmentsForHookSource(
  sourceType: 'audio' | 'combination',
  audioFileId: string | null,
  combinationId: string | null
): VerifiableSegment[] {
  const speakerRows = db.prepare('SELECT id, display_name FROM speakers').all() as Array<{
    id: string;
    display_name: string;
  }>;
  const speakerMap = new Map(speakerRows.map((s) => [s.id, s.display_name]));

  if (sourceType === 'combination' && combinationId) {
    const combo = db
      .prepare('SELECT ordered_audio_ids FROM combinations WHERE id = ?')
      .get(combinationId) as { ordered_audio_ids: string } | undefined;
    const orderedIds = combo ? (JSON.parse(combo.ordered_audio_ids || '[]') as string[]) : [];
    const results: VerifiableSegment[] = [];
    for (const aid of orderedIds) {
      const af = db.prepare('SELECT id, title FROM audio_files WHERE id = ?').get(aid) as
        | { id: string; title: string }
        | undefined;
      if (!af) continue;
      const segs = db
        .prepare('SELECT * FROM transcript_segments WHERE audio_file_id = ? ORDER BY order_index ASC')
        .all(aid) as Array<Record<string, unknown>>;
      for (const s of segs) {
        results.push({
          id: String(s.id),
          audioFileId: af.id,
          audioTitle: af.title,
          speakerId: String(s.speaker_id),
          speakerName: speakerMap.get(String(s.speaker_id)) || 'گوینده',
          startSec: Number(s.start_sec),
          endSec: Number(s.end_sec),
          text: String(s.text),
        });
      }
    }
    return results;
  }

  if (audioFileId) {
    const af = db.prepare('SELECT id, title FROM audio_files WHERE id = ?').get(audioFileId) as
      | { id: string; title: string }
      | undefined;
    if (!af) return [];
    const segs = db
      .prepare('SELECT * FROM transcript_segments WHERE audio_file_id = ? ORDER BY order_index ASC')
      .all(audioFileId) as Array<Record<string, unknown>>;
    return segs.map((s) => ({
      id: String(s.id),
      audioFileId: af.id,
      audioTitle: af.title,
      speakerId: String(s.speaker_id),
      speakerName: speakerMap.get(String(s.speaker_id)) || 'گوینده',
      startSec: Number(s.start_sec),
      endSec: Number(s.end_sec),
      text: String(s.text),
    }));
  }

  return [];
}

function hydrateHooks(rows: Array<Record<string, unknown>>): HookWithScenario[] {
  // Build live speaker name map so renamed speakers immediately reflect everywhere
  const speakerRows = db.prepare('SELECT id, display_name FROM speakers').all() as Array<{
    id: string;
    display_name: string;
  }>;
  const speakerMap = new Map(speakerRows.map((s) => [s.id, s.display_name]));

  return rows.map((r) => {
    const id = String(r.id);
    const sourceType = (r.source_type as 'audio' | 'combination') || 'audio';
    const audioFileId = r.audio_file_id ? String(r.audio_file_id) : null;
    const combinationId = r.combination_id ? String(r.combination_id) : null;
    const tier = r.tier as HookTier;
    const storyFormat = (r.story_format as StoryFormat) || null;
    const title = String(r.title);
    const hookVerbatim = String(r.hook_verbatim);
    const hookSegmentId = String(r.hook_segment_id);
    const rationale = String(r.rationale);
    const storyEngagementIdea = r.story_engagement_idea ? String(r.story_engagement_idea) : null;
    const captionIdea = r.caption_idea ? String(r.caption_idea) : null;

    const rawBeats = JSON.parse(String(r.scenario_beats_json || '[]')) as ScenarioBeat[];
    const beats = rawBeats.map((b) => ({
      ...b,
      speakerName: speakerMap.get(b.speakerId) || b.speakerName,
    }));
    const leadSpeakerName =
      beats[0]?.speakerName || String(r.hook_speaker_name || '');

    // Lazy backfill A/B variants if missing on pre-existing DB rows
    let alternativeHooks: HookVariant[] = [];
    if (r.alternative_hooks_json) {
      const parsed = JSON.parse(String(r.alternative_hooks_json)) as HookVariant[];
      alternativeHooks = parsed.map((v) => ({
        ...v,
        speakerName: speakerMap.get(v.speakerId) || v.speakerName,
      }));
    } else {
      const segs = loadVerifiableSegmentsForHookSource(sourceType, audioFileId, combinationId);
      alternativeHooks = generateAlternativeHooksLocally({
        hookSegmentId,
        bodySegmentIds: beats.slice(1).map((b) => b.segmentId),
        segments: segs,
        desiredCount: 2,
      });
      db.prepare('UPDATE hooks SET alternative_hooks_json = ? WHERE id = ?').run(
        JSON.stringify(alternativeHooks),
        id
      );
    }

    // Lazy backfill Publishing Kit (and Carousel Slides) if missing on pre-existing DB rows
    let publishingKit: PublishingKit | null = null;
    if (r.publishing_kit_json) {
      publishingKit = JSON.parse(String(r.publishing_kit_json)) as PublishingKit;
      if (!publishingKit.carouselSlides || publishingKit.carouselSlides.length === 0) {
        publishingKit.carouselSlides = generateCarouselSlidesLocally({
          title,
          hookVerbatim,
          scenarioBeats: beats,
          coverTitle: publishingKit.coverTitles?.[0],
          ctaKeyword: publishingKit.commentCtaKeyword || undefined,
          commentCtaLine: publishingKit.commentCtaLine || undefined,
        });
        db.prepare('UPDATE hooks SET publishing_kit_json = ? WHERE id = ?').run(
          JSON.stringify(publishingKit),
          id
        );
      }
    } else {
      publishingKit = generatePublishingKitLocally({
        tier,
        storyFormat,
        title,
        hookVerbatim,
        rationale,
        scenarioBeats: beats,
        captionIdea,
        storyEngagementIdea,
      });
      db.prepare('UPDATE hooks SET publishing_kit_json = ? WHERE id = ?').run(
        JSON.stringify(publishingKit),
        id
      );
    }

    // Lazy backfill Viral Intelligence if missing on pre-existing DB rows
    interface StoredViralIntel {
      viralBlueprint: ViralBlueprintId;
      specialFormat: SpecialReelFormat;
      inMediaResCut: InMediaResCut | null;
      viralAudit: ViralAudit | null;
      audioMoodGuide: AudioMoodGuide | null;
    }

    let viralIntel: StoredViralIntel;
    if (r.viral_intel_json) {
      viralIntel = JSON.parse(String(r.viral_intel_json)) as StoredViralIntel;
    } else {
      viralIntel = computeViralIntelligence({
        tier,
        storyFormat,
        specialFormat: 'standard',
        title,
        hookVerbatim,
        scenarioBeats: beats,
      });
      db.prepare('UPDATE hooks SET viral_intel_json = ? WHERE id = ?').run(
        JSON.stringify(viralIntel),
        id
      );
    }

    return {
      id,
      projectId: String(r.project_id),
      sourceType,
      audioFileId,
      combinationId,
      tier,
      formatLabel: String(r.format_label),
      storyFormat,
      title,
      hookVerbatim,
      hookSegmentId,
      hookSourceAudioId: String(r.hook_source_audio_id),
      hookSourceAudioTitle: String(r.hook_source_audio_title),
      hookStartSec: Number(r.hook_start_sec),
      hookEndSec: Number(r.hook_end_sec),
      hookSpeakerName: leadSpeakerName,
      rationale,
      estimatedDurationSec: Number(r.estimated_duration_sec),
      scenarioBeats: beats,
      alternativeHooks,
      publishingKit,
      viralBlueprint: viralIntel.viralBlueprint,
      specialFormat: viralIntel.specialFormat || 'standard',
      inMediaResCut: viralIntel.inMediaResCut,
      viralAudit: viralIntel.viralAudit,
      audioMoodGuide: viralIntel.audioMoodGuide,
      storyEngagementIdea,
      captionIdea,
      verbatimScore: Number(r.verbatim_score ?? 100),
      createdAt: String(r.created_at),
    };
  });
}

export function getHookById(hookId: string): HookWithScenario | null {
  const row = db.prepare('SELECT * FROM hooks WHERE id = ?').get(hookId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return hydrateHooks([row])[0] || null;
}

export function getVerifiableSegmentsForHook(hook: HookWithScenario): VerifiableSegment[] {
  return loadVerifiableSegmentsForHookSource(
    hook.sourceType,
    hook.audioFileId,
    hook.combinationId
  );
}

export function updateHookAlternativeHooks(
  hookId: string,
  variants: HookVariant[]
): HookWithScenario | null {
  db.prepare('UPDATE hooks SET alternative_hooks_json = ? WHERE id = ?').run(
    JSON.stringify(variants),
    hookId
  );
  return getHookById(hookId);
}

export function applyAlternativeHookVariant(
  hookId: string,
  variantId: string
): HookWithScenario | null {
  const hook = getHookById(hookId);
  if (!hook) return null;

  const chosen = hook.alternativeHooks.find((v) => v.id === variantId);
  if (!chosen || hook.scenarioBeats.length === 0) return hook;

  const prevLead = hook.scenarioBeats[0];
  const prevVariant: HookVariant = {
    id: uuidv4(),
    angleLabel: 'قلاب قبلی (نسخه پیش‌فرض)',
    whyItWorks: 'نسخه اصلی اولیه قبل از تغییر قلاب در تست A/B.',
    segmentId: prevLead.segmentId,
    sourceAudioId: prevLead.sourceAudioId,
    sourceAudioTitle: prevLead.sourceAudioTitle,
    speakerId: prevLead.speakerId,
    speakerName: prevLead.speakerName,
    startSec: prevLead.startSec,
    endSec: prevLead.endSec,
    verbatimText: prevLead.verbatimText,
    verifiedVerbatim: prevLead.verifiedVerbatim,
  };

  const nextBeats: ScenarioBeat[] = [
    {
      ...prevLead,
      segmentId: chosen.segmentId,
      sourceAudioId: chosen.sourceAudioId,
      sourceAudioTitle: chosen.sourceAudioTitle,
      speakerId: chosen.speakerId,
      speakerName: chosen.speakerName,
      startSec: chosen.startSec,
      endSec: chosen.endSec,
      verbatimText: chosen.verbatimText,
      verifiedVerbatim: chosen.verifiedVerbatim,
    },
    ...hook.scenarioBeats.slice(1),
  ];

  const nextAlternatives = [
    prevVariant,
    ...hook.alternativeHooks.filter((v) => v.id !== variantId),
  ];

  const estDur = nextBeats.reduce((acc, b) => acc + Math.max(6, b.endSec - b.startSec), 0);
  const nextIntel = computeViralIntelligence({
    tier: hook.tier,
    storyFormat: hook.storyFormat,
    specialFormat: hook.specialFormat,
    title: hook.title,
    hookVerbatim: chosen.verbatimText,
    scenarioBeats: nextBeats,
  });

  db.prepare(
    `UPDATE hooks
     SET hook_verbatim = ?,
         hook_segment_id = ?,
         hook_source_audio_id = ?,
         hook_source_audio_title = ?,
         hook_start_sec = ?,
         hook_end_sec = ?,
         hook_speaker_name = ?,
         estimated_duration_sec = ?,
         scenario_beats_json = ?,
         alternative_hooks_json = ?,
         viral_intel_json = ?
     WHERE id = ?`
  ).run(
    chosen.verbatimText,
    chosen.segmentId,
    chosen.sourceAudioId,
    chosen.sourceAudioTitle,
    chosen.startSec,
    chosen.endSec,
    chosen.speakerName,
    estDur,
    JSON.stringify(nextBeats),
    JSON.stringify(nextAlternatives),
    JSON.stringify(nextIntel),
    hookId
  );

  return getHookById(hookId);
}

export function updateHookPublishingKit(
  hookId: string,
  kit: PublishingKit
): HookWithScenario | null {
  db.prepare('UPDATE hooks SET publishing_kit_json = ? WHERE id = ?').run(
    JSON.stringify(kit),
    hookId
  );
  return getHookById(hookId);
}

export function appendHookForSource(params: {
  projectId: string;
  sourceType: 'audio' | 'combination';
  audioFileId?: string;
  combinationId?: string;
  hook: GeneratedHookDraft;
}): HookWithScenario {
  const id = uuidv4();
  const now = new Date().toISOString();
  const h = params.hook;
  const intel = {
    viralBlueprint: h.viralBlueprint || 'myth_buster',
    specialFormat: h.specialFormat || 'standard',
    inMediaResCut: h.inMediaResCut ?? null,
    viralAudit: h.viralAudit ?? null,
    audioMoodGuide: h.audioMoodGuide ?? null,
  };

  db.prepare(`
    INSERT INTO hooks (
      id, project_id, source_type, audio_file_id, combination_id,
      tier, format_label, story_format, title,
      hook_verbatim, hook_segment_id, hook_source_audio_id, hook_source_audio_title,
      hook_start_sec, hook_end_sec, hook_speaker_name,
      rationale, estimated_duration_sec, scenario_beats_json,
      alternative_hooks_json, publishing_kit_json, viral_intel_json,
      story_engagement_idea, caption_idea, verbatim_score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.projectId,
    params.sourceType,
    params.audioFileId || null,
    params.combinationId || null,
    h.tier,
    h.formatLabel,
    h.storyFormat || null,
    h.title,
    h.hookVerbatim,
    h.hookSegmentId,
    h.hookSourceAudioId,
    h.hookSourceAudioTitle,
    h.hookStartSec,
    h.hookEndSec,
    h.hookSpeakerName,
    h.rationale,
    h.estimatedDurationSec,
    JSON.stringify(h.scenarioBeats),
    h.alternativeHooks ? JSON.stringify(h.alternativeHooks) : null,
    h.publishingKit ? JSON.stringify(h.publishingKit) : null,
    JSON.stringify(intel),
    h.storyEngagementIdea || null,
    h.captionIdea || null,
    h.verbatimScore,
    now
  );

  return getHookById(id)!;
}

export function replaceHooksForSource(params: {
  projectId: string;
  sourceType: 'audio' | 'combination';
  audioFileId?: string;
  combinationId?: string;
  hooks: GeneratedHookDraft[];
}): HookWithScenario[] {
  if (params.sourceType === 'audio' && params.audioFileId) {
    db.prepare('DELETE FROM hooks WHERE audio_file_id = ?').run(params.audioFileId);
  } else if (params.sourceType === 'combination' && params.combinationId) {
    db.prepare('DELETE FROM hooks WHERE combination_id = ?').run(params.combinationId);
  }

  const insert = db.prepare(`
    INSERT INTO hooks (
      id, project_id, source_type, audio_file_id, combination_id,
      tier, format_label, story_format, title,
      hook_verbatim, hook_segment_id, hook_source_audio_id, hook_source_audio_title,
      hook_start_sec, hook_end_sec, hook_speaker_name,
      rationale, estimated_duration_sec, scenario_beats_json,
      alternative_hooks_json, publishing_kit_json, viral_intel_json,
      story_engagement_idea, caption_idea, verbatim_score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const h of params.hooks) {
    const intel =
      h.viralBlueprint || h.viralAudit
        ? JSON.stringify({
            viralBlueprint: h.viralBlueprint || 'myth_buster',
            specialFormat: h.specialFormat || 'standard',
            inMediaResCut: h.inMediaResCut ?? null,
            viralAudit: h.viralAudit ?? null,
            audioMoodGuide: h.audioMoodGuide ?? null,
          })
        : null;

    insert.run(
      uuidv4(),
      params.projectId,
      params.sourceType,
      params.audioFileId || null,
      params.combinationId || null,
      h.tier,
      h.formatLabel,
      h.storyFormat || null,
      h.title,
      h.hookVerbatim,
      h.hookSegmentId,
      h.hookSourceAudioId,
      h.hookSourceAudioTitle,
      h.hookStartSec,
      h.hookEndSec,
      h.hookSpeakerName,
      h.rationale,
      h.estimatedDurationSec,
      JSON.stringify(h.scenarioBeats),
      h.alternativeHooks ? JSON.stringify(h.alternativeHooks) : null,
      h.publishingKit ? JSON.stringify(h.publishingKit) : null,
      intel,
      h.storyEngagementIdea || null,
      h.captionIdea || null,
      h.verbatimScore,
      now
    );
  }

  if (params.sourceType === 'audio' && params.audioFileId) {
    const rows = db
      .prepare('SELECT * FROM hooks WHERE audio_file_id = ? ORDER BY CASE tier WHEN \'gold\' THEN 1 WHEN \'silver\' THEN 2 ELSE 3 END, created_at ASC')
      .all(params.audioFileId) as Array<Record<string, unknown>>;
    return hydrateHooks(rows);
  }

  const rows = db
    .prepare('SELECT * FROM hooks WHERE combination_id = ? ORDER BY CASE tier WHEN \'gold\' THEN 1 WHEN \'silver\' THEN 2 ELSE 3 END, created_at ASC')
    .all(params.combinationId || '') as Array<Record<string, unknown>>;
  return hydrateHooks(rows);
}

export function listProjectHooks(projectId: string): HookWithScenario[] {
  const rows = db
    .prepare(
      `SELECT * FROM hooks WHERE project_id = ?
       ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END, created_at DESC`
    )
    .all(projectId) as Array<Record<string, unknown>>;
  return hydrateHooks(rows);
}

export function listProjectQuoteSegments(projectId: string): ProjectQuoteSegment[] {
  const rows = db
    .prepare(
      `SELECT
         ts.id, ts.audio_file_id, ts.speaker_id, ts.order_index, ts.start_sec, ts.end_sec, ts.text,
         af.title AS audio_title, af.stored_filename,
         sp.display_name AS speaker_name, sp.color AS speaker_color
       FROM transcript_segments ts
       INNER JOIN audio_files af ON af.id = ts.audio_file_id
       INNER JOIN speakers sp ON sp.id = ts.speaker_id
       WHERE af.project_id = ?
       ORDER BY af.created_at ASC, ts.order_index ASC`
    )
    .all(projectId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    audioFileId: String(r.audio_file_id),
    audioTitle: String(r.audio_title),
    audioUrl: `/uploads/${String(r.stored_filename)}`,
    speakerId: String(r.speaker_id),
    speakerName: String(r.speaker_name),
    speakerColor: String(r.speaker_color),
    orderIndex: Number(r.order_index),
    startSec: Number(r.start_sec),
    endSec: Number(r.end_sec),
    text: String(r.text),
  }));
}

/* ================= AUDIO FILES ================= */

export function listAudioFilesByProject(projectId: string): AudioFileSummary[] {
  const rows = db
    .prepare('SELECT * FROM audio_files WHERE project_id = ? ORDER BY created_at ASC')
    .all(projectId) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const id = String(r.id);
    const speakerCount = (
      db.prepare('SELECT COUNT(*) as c FROM speakers WHERE audio_file_id = ?').get(id) as { c: number }
    ).c;
    const segmentCount = (
      db.prepare('SELECT COUNT(*) as c FROM transcript_segments WHERE audio_file_id = ?').get(id) as { c: number }
    ).c;
    const tierCounts = db
      .prepare('SELECT tier, COUNT(*) as c FROM hooks WHERE audio_file_id = ? GROUP BY tier')
      .all(id) as Array<{ tier: HookTier; c: number }>;
    const tc = new Map(tierCounts.map((t) => [t.tier, t.c]));

    return {
      id,
      projectId: String(r.project_id),
      title: String(r.title),
      originalFilename: String(r.original_filename),
      audioUrl: `/uploads/${String(r.stored_filename)}`,
      mimeType: String(r.mime_type),
      fileSize: Number(r.file_size),
      durationSec: Number(r.duration_sec),
      status: r.status as 'processing' | 'ready' | 'error',
      analysisMode: (r.analysis_mode as AIProvider) || 'demo',
      speakerCount,
      segmentCount,
      goldCount: tc.get('gold') || 0,
      silverCount: tc.get('silver') || 0,
      bronzeCount: tc.get('bronze') || 0,
      createdAt: String(r.created_at),
    };
  });
}

export function getAudioFileDetail(audioFileId: string): AudioFileDetail | null {
  const r = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(audioFileId) as
    | Record<string, unknown>
    | undefined;
  if (!r) return null;

  const segRows = db
    .prepare(
      `SELECT ts.id, ts.audio_file_id, ts.speaker_id, ts.order_index, ts.start_sec, ts.end_sec, ts.text,
              sp.speaker_key, sp.display_name, sp.color
       FROM transcript_segments ts
       JOIN speakers sp ON sp.id = ts.speaker_id
       WHERE ts.audio_file_id = ?
       ORDER BY ts.order_index ASC`
    )
    .all(audioFileId) as Array<Record<string, unknown>>;

  const segments: TranscriptSegment[] = segRows.map((s) => ({
    id: String(s.id),
    audioFileId: String(s.audio_file_id),
    speakerId: String(s.speaker_id),
    speakerKey: String(s.speaker_key),
    speakerName: String(s.display_name),
    speakerColor: String(s.color),
    orderIndex: Number(s.order_index),
    startSec: Number(s.start_sec),
    endSec: Number(s.end_sec),
    text: String(s.text),
  }));

  const speakerRows = db
    .prepare('SELECT * FROM speakers WHERE audio_file_id = ?')
    .all(audioFileId) as Array<Record<string, unknown>>;

  const speakers: Speaker[] = speakerRows.map((sp) => {
    const spId = String(sp.id);
    const spSegs = segments.filter((seg) => seg.speakerId === spId);
    const totalDurationSec = spSegs.reduce((acc, s) => acc + Math.max(1, s.endSec - s.startSec), 0);
    return {
      id: spId,
      audioFileId: String(sp.audio_file_id),
      speakerKey: String(sp.speaker_key),
      displayName: String(sp.display_name),
      detectedName: sp.detected_name ? String(sp.detected_name) : null,
      detectedRole: sp.detected_role ? String(sp.detected_role) : null,
      detectionEvidence: sp.detection_evidence ? String(sp.detection_evidence) : null,
      color: String(sp.color),
      segmentCount: spSegs.length,
      totalDurationSec,
    };
  });

  const hookRows = db
    .prepare(
      `SELECT * FROM hooks WHERE audio_file_id = ?
       ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END, created_at ASC`
    )
    .all(audioFileId) as Array<Record<string, unknown>>;
  const hooks = hydrateHooks(hookRows);

  return {
    id: String(r.id),
    projectId: String(r.project_id),
    title: String(r.title),
    originalFilename: String(r.original_filename),
    audioUrl: `/uploads/${String(r.stored_filename)}`,
    mimeType: String(r.mime_type),
    fileSize: Number(r.file_size),
    durationSec: Number(r.duration_sec),
    status: r.status as 'processing' | 'ready' | 'error',
    analysisMode: (r.analysis_mode as AIProvider) || 'demo',
    speakerCount: speakers.length,
    segmentCount: segments.length,
    goldCount: hooks.filter((h) => h.tier === 'gold').length,
    silverCount: hooks.filter((h) => h.tier === 'silver').length,
    bronzeCount: hooks.filter((h) => h.tier === 'bronze').length,
    createdAt: String(r.created_at),
    speakers,
    segments,
    hooks,
  };
}

export function createAudioWithDiarization(params: {
  id?: string;
  projectId: string;
  title: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  durationSec: number;
  analysisMode: AIProvider;
  speakers: DiarizedSpeakerOutput[];
  segments: DiarizedSegmentOutput[];
}): { audioFileId: string; insertedSegments: TranscriptSegment[] } {
  const audioFileId = params.id || uuidv4();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO audio_files (
      id, project_id, title, original_filename, stored_filename,
      mime_type, file_size, duration_sec, status, analysis_mode, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`
  ).run(
    audioFileId,
    params.projectId,
    params.title,
    params.originalFilename,
    params.storedFilename,
    params.mimeType,
    params.fileSize,
    params.durationSec,
    params.analysisMode,
    createdAt
  );

  const keyToSpeakerId = new Map<string, { id: string; displayName: string; color: string }>();
  const insertSpeaker = db.prepare(
    `INSERT INTO speakers (id, audio_file_id, speaker_key, display_name, detected_name, detected_role, detection_evidence, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const sp of params.speakers) {
    const spId = uuidv4();
    insertSpeaker.run(
      spId,
      audioFileId,
      sp.speakerKey,
      sp.displayName,
      sp.detectedName,
      sp.detectedRole,
      sp.detectionEvidence,
      sp.color
    );
    keyToSpeakerId.set(sp.speakerKey, { id: spId, displayName: sp.displayName, color: sp.color });
  }

  const fallbackSpeaker = Array.from(keyToSpeakerId.values())[0];
  const insertSeg = db.prepare(
    `INSERT INTO transcript_segments (id, audio_file_id, speaker_id, order_index, start_sec, end_sec, text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const insertedSegments: TranscriptSegment[] = [];
  params.segments.forEach((seg, idx) => {
    const sp = keyToSpeakerId.get(seg.speakerKey) || fallbackSpeaker;
    if (!sp) return;
    const segId = uuidv4();
    insertSeg.run(segId, audioFileId, sp.id, idx, seg.startSec, seg.endSec, seg.text);
    insertedSegments.push({
      id: segId,
      audioFileId,
      speakerId: sp.id,
      speakerKey: seg.speakerKey,
      speakerName: sp.displayName,
      speakerColor: sp.color,
      orderIndex: idx,
      startSec: seg.startSec,
      endSec: seg.endSec,
      text: seg.text,
    });
  });

  return { audioFileId, insertedSegments };
}

export function updateSpeakerDisplayName(speakerId: string, displayName: string): Speaker | null {
  db.prepare('UPDATE speakers SET display_name = ? WHERE id = ?').run(displayName.trim(), speakerId);
  const sp = db.prepare('SELECT * FROM speakers WHERE id = ?').get(speakerId) as
    | Record<string, unknown>
    | undefined;
  if (!sp) return null;
  return {
    id: String(sp.id),
    audioFileId: String(sp.audio_file_id),
    speakerKey: String(sp.speaker_key),
    displayName: String(sp.display_name),
    detectedName: sp.detected_name ? String(sp.detected_name) : null,
    detectedRole: sp.detected_role ? String(sp.detected_role) : null,
    detectionEvidence: sp.detection_evidence ? String(sp.detection_evidence) : null,
    color: String(sp.color),
    segmentCount: 0,
    totalDurationSec: 0,
  };
}

export function updateTranscriptSegmentText(segmentId: string, text: string): boolean {
  const res = db.prepare('UPDATE transcript_segments SET text = ? WHERE id = ?').run(text.trim(), segmentId);
  return Number(res.changes) > 0;
}

export function deleteAudioFile(audioFileId: string): void {
  const row = db
    .prepare('SELECT stored_filename FROM audio_files WHERE id = ?')
    .get(audioFileId) as { stored_filename: string } | undefined;
  db.prepare('DELETE FROM audio_files WHERE id = ?').run(audioFileId);
  if (row) {
    const fp = path.join(UPLOADS_DIR, row.stored_filename);
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch {
        // ignore
      }
    }
  }
}

/* ================= COMBINATIONS ================= */

export function buildMergedTimeline(orderedAudioIds: string[]): {
  orderedAudioMeta: OrderedAudioMeta[];
  mergedSegments: MergedTranscriptSegment[];
  totalDurationSec: number;
} {
  let offset = 0;
  const orderedAudioMeta: OrderedAudioMeta[] = [];
  const mergedSegments: MergedTranscriptSegment[] = [];

  orderedAudioIds.forEach((audioId, fileIdx) => {
    const detail = getAudioFileDetail(audioId);
    if (!detail) return;

    const maxSegEnd = detail.segments.reduce((m, s) => Math.max(m, s.endSec), 0);
    const effectiveDur = Math.max(detail.durationSec, maxSegEnd, 30);
    const offsetStartSec = offset;
    const offsetEndSec = offset + effectiveDur;

    orderedAudioMeta.push({
      audioFileId: detail.id,
      title: detail.title,
      durationSec: effectiveDur,
      offsetStartSec,
      offsetEndSec,
      color: COMBINATION_FILE_COLORS[fileIdx % COMBINATION_FILE_COLORS.length],
    });

    for (const seg of detail.segments) {
      mergedSegments.push({
        ...seg,
        sourceAudioTitle: detail.title,
        combinedStartSec: offsetStartSec + seg.startSec,
        combinedEndSec: offsetStartSec + seg.endSec,
        speakerName: seg.speakerName || 'گوینده',
        speakerColor: seg.speakerColor || '#B45309',
      });
    }

    offset = offsetEndSec;
  });

  return { orderedAudioMeta, mergedSegments, totalDurationSec: offset };
}

export function listCombinationsByProject(projectId: string): CombinationSummary[] {
  const rows = db
    .prepare('SELECT * FROM combinations WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const id = String(r.id);
    const orderedAudioIds = JSON.parse(String(r.ordered_audio_ids || '[]')) as string[];
    const { orderedAudioMeta, totalDurationSec } = buildMergedTimeline(orderedAudioIds);
    const tierCounts = db
      .prepare('SELECT tier, COUNT(*) as c FROM hooks WHERE combination_id = ? GROUP BY tier')
      .all(id) as Array<{ tier: HookTier; c: number }>;
    const tc = new Map(tierCounts.map((t) => [t.tier, t.c]));

    return {
      id,
      projectId: String(r.project_id),
      title: String(r.title),
      goal: String(r.goal),
      orderedAudioIds,
      orderedAudioMeta,
      totalDurationSec,
      goldCount: tc.get('gold') || 0,
      silverCount: tc.get('silver') || 0,
      bronzeCount: tc.get('bronze') || 0,
      createdAt: String(r.created_at),
    };
  });
}

export function getCombinationDetail(combinationId: string): CombinationDetail | null {
  const r = db.prepare('SELECT * FROM combinations WHERE id = ?').get(combinationId) as
    | Record<string, unknown>
    | undefined;
  if (!r) return null;

  const orderedAudioIds = JSON.parse(String(r.ordered_audio_ids || '[]')) as string[];
  const { orderedAudioMeta, mergedSegments, totalDurationSec } = buildMergedTimeline(orderedAudioIds);
  const hookRows = db
    .prepare(
      `SELECT * FROM hooks WHERE combination_id = ?
       ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END, created_at ASC`
    )
    .all(combinationId) as Array<Record<string, unknown>>;
  const hooks = hydrateHooks(hookRows);

  return {
    id: String(r.id),
    projectId: String(r.project_id),
    title: String(r.title),
    goal: String(r.goal),
    orderedAudioIds,
    orderedAudioMeta,
    totalDurationSec,
    goldCount: hooks.filter((h) => h.tier === 'gold').length,
    silverCount: hooks.filter((h) => h.tier === 'silver').length,
    bronzeCount: hooks.filter((h) => h.tier === 'bronze').length,
    createdAt: String(r.created_at),
    mergedSegments,
    hooks,
  };
}

export function createCombinationRecord(params: {
  projectId: string;
  title: string;
  goal: string;
  orderedAudioIds: string[];
}): string {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO combinations (id, project_id, title, goal, ordered_audio_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, params.projectId, params.title.trim(), params.goal.trim(), JSON.stringify(params.orderedAudioIds), createdAt);
  return id;
}

export function updateCombinationOrderRecord(
  combinationId: string,
  title: string,
  goal: string,
  orderedAudioIds: string[]
): void {
  db.prepare(
    'UPDATE combinations SET title = ?, goal = ?, ordered_audio_ids = ? WHERE id = ?'
  ).run(title.trim(), goal.trim(), JSON.stringify(orderedAudioIds), combinationId);
}

export function deleteCombination(combinationId: string): void {
  db.prepare('DELETE FROM combinations WHERE id = ?').run(combinationId);
}
