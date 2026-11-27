import type {
  AISettings,
  AudioFileDetail,
  AudioFileSummary,
  CombinationDetail,
  CombinationSummary,
  HookTier,
  HookWithScenario,
  ProjectQuoteSegment,
  ProjectSummary,
  Speaker,
} from './types';

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `خطای سرور (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Settings
  getSettings: () => fetch('/api/settings').then((r) => handleJson<AISettings>(r)),
  saveSettings: (payload: Partial<AISettings>) =>
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<AISettings>(r)),
  testAI: (payload: {
    provider: AISettings['provider'];
    apiKey?: string;
    baseUrl?: string;
    geminiModel?: string;
    llmModel?: string;
  }) =>
    fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) =>
      handleJson<{
        ok: boolean;
        provider: AISettings['provider'];
        endpoint: string;
        models: string[];
        message: string;
      }>(r)
    ),

  // Projects
  listProjects: () => fetch('/api/projects').then((r) => handleJson<ProjectSummary[]>(r)),
  createProject: (payload: { title: string; eventDate?: string; description?: string }) =>
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<ProjectSummary>(r)),
  deleteProject: (projectId: string) =>
    fetch(`/api/projects/${projectId}`, { method: 'DELETE' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),
  listProjectHooks: (projectId: string) =>
    fetch(`/api/projects/${projectId}/hooks`).then((r) => handleJson<HookWithScenario[]>(r)),

  // Audio files
  listAudioFiles: (projectId: string) =>
    fetch(`/api/projects/${projectId}/audio`).then((r) => handleJson<AudioFileSummary[]>(r)),
  uploadAudio: (projectId: string, formData: FormData) =>
    fetch(`/api/projects/${projectId}/audio`, {
      method: 'POST',
      body: formData,
    }).then((r) => handleJson<AudioFileDetail>(r)),
  getAudioDetail: (audioId: string) =>
    fetch(`/api/audio/${audioId}`).then((r) => handleJson<AudioFileDetail>(r)),
  deleteAudio: (audioId: string) =>
    fetch(`/api/audio/${audioId}`, { method: 'DELETE' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),
  reanalyzeAudio: (audioId: string) =>
    fetch(`/api/audio/${audioId}/reanalyze`, { method: 'POST' }).then((r) =>
      handleJson<AudioFileDetail>(r)
    ),

  // Speakers & Segments
  renameSpeaker: (speakerId: string, displayName: string) =>
    fetch(`/api/speakers/${speakerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    }).then((r) => handleJson<Speaker>(r)),
  updateSegmentText: (segmentId: string, text: string) =>
    fetch(`/api/segments/${segmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => handleJson<{ ok: boolean }>(r)),

  // Combinations
  listCombinations: (projectId: string) =>
    fetch(`/api/projects/${projectId}/combinations`).then((r) =>
      handleJson<CombinationSummary[]>(r)
    ),
  createCombination: (
    projectId: string,
    payload: { title: string; goal: string; orderedAudioIds: string[] }
  ) =>
    fetch(`/api/projects/${projectId}/combinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<CombinationDetail>(r)),
  getCombinationDetail: (combinationId: string) =>
    fetch(`/api/combinations/${combinationId}`).then((r) => handleJson<CombinationDetail>(r)),
  updateCombination: (
    combinationId: string,
    payload: { title: string; goal: string; orderedAudioIds: string[] }
  ) =>
    fetch(`/api/combinations/${combinationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<CombinationDetail>(r)),
  deleteCombination: (combinationId: string) =>
    fetch(`/api/combinations/${combinationId}`, { method: 'DELETE' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),

  // Hook A/B Testing & Publishing Kit
  generateHookVariants: (hookId: string) =>
    fetch(`/api/hooks/${hookId}/ab-variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => handleJson<HookWithScenario>(r)),
  applyHookVariant: (hookId: string, variantId: string) =>
    fetch(`/api/hooks/${hookId}/apply-variant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId }),
    }).then((r) => handleJson<HookWithScenario>(r)),
  regeneratePublishingKit: (hookId: string) =>
    fetch(`/api/hooks/${hookId}/publishing-kit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => handleJson<HookWithScenario>(r)),

  // On-demand Viral Special Reels (#7 Micro-Loop & #8 Rapid Q&A)
  createMicroLoopReel: (sourceType: 'audio' | 'combination', sourceId: string) =>
    fetch('/api/sources/micro-loop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType, sourceId }),
    }).then((r) => handleJson<HookWithScenario>(r)),
  createRapidQAReel: (sourceType: 'audio' | 'combination', sourceId: string) =>
    fetch('/api/sources/rapid-qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType, sourceId }),
    }).then((r) => handleJson<HookWithScenario>(r)),

  // Carousel Slides
  regenerateCarouselSlides: (hookId: string) =>
    fetch(`/api/hooks/${hookId}/carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => handleJson<HookWithScenario>(r)),

  // Cross-Audio Quote Builder
  listProjectQuoteSegments: (projectId: string) =>
    fetch(`/api/projects/${projectId}/segments`).then((r) =>
      handleJson<ProjectQuoteSegment[]>(r)
    ),
  createCustomScenario: (
    projectId: string,
    payload: { title?: string; tier: HookTier; segmentIds: string[] }
  ) =>
    fetch(`/api/projects/${projectId}/custom-scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<HookWithScenario>(r)),

  // Telegram Bot Integration
  testTelegram: (payload: {
    telegramBotToken?: string;
    telegramChatId?: string;
    telegramGroupName?: string;
  }) =>
    fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) =>
      handleJson<{ ok: boolean; botUsername?: string; message: string }>(r)
    ),
  sendHookToTelegram: (hookId: string, formData: FormData) =>
    fetch(`/api/hooks/${hookId}/send-telegram`, {
      method: 'POST',
      body: formData,
    }).then((r) =>
      handleJson<{
        ok: boolean;
        sentMessages: number;
        sentAudio: boolean;
        message: string;
        plainText: string;
      }>(r)
    ),
};
