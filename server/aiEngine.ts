import fs from 'node:fs';
import path from 'node:path';
import type {
  AIProvider,
  AISettings,
  AudioMoodGuide,
  HookTier,
  HookVariant,
  InMediaResCut,
  PublishingKit,
  ScenarioBeat,
  SpecialReelFormat,
  StoryFormat,
  ViralAudit,
  ViralBlueprintId,
} from './types.ts';
import { verifyAndSnapBeats, type VerifiableSegment } from './verbatimValidator.ts';
import {
  generateAlternativeHooksLocally,
  generatePublishingKitLocally,
} from './hookEnricher.ts';
import {
  callOpenAICompatibleChat,
  normalizeOpenAIBaseUrl,
  resolveTranscriptionModel,
} from './llmClient.ts';
import { computeViralIntelligence } from './viralEngine.ts';

export const SPEAKER_COLORS = [
  '#B45309', // warm amber/coach
  '#2563EB', // cobalt blue
  '#059669', // emerald
  '#7C3AED', // violet
  '#DB2777', // rose
  '#0891B2', // cyan
];

export interface DiarizedSpeakerOutput {
  speakerKey: string;
  displayName: string;
  detectedName: string | null;
  detectedRole: string | null;
  detectionEvidence: string | null;
  color: string;
}

export interface DiarizedSegmentOutput {
  speakerKey: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface DiarizationResult {
  speakers: DiarizedSpeakerOutput[];
  segments: DiarizedSegmentOutput[];
  usedProvider: AIProvider;
}

export interface GeneratedHookDraft {
  tier: HookTier;
  formatLabel: string;
  storyFormat: StoryFormat | null;
  title: string;
  hookVerbatim: string;
  hookSegmentId: string;
  hookSourceAudioId: string;
  hookSourceAudioTitle: string;
  hookStartSec: number;
  hookEndSec: number;
  hookSpeakerName: string;
  rationale: string;
  estimatedDurationSec: number;
  scenarioBeats: ScenarioBeat[];
  alternativeHooks?: HookVariant[];
  publishingKit?: PublishingKit | null;
  viralBlueprint?: ViralBlueprintId;
  specialFormat?: SpecialReelFormat;
  inMediaResCut?: InMediaResCut | null;
  viralAudit?: ViralAudit | null;
  audioMoodGuide?: AudioMoodGuide | null;
  storyEngagementIdea: string | null;
  captionIdea: string | null;
  verbatimScore: number;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Extracts speaker names/roles from Persian text clues.
 */
function inferSpeakerIdentityFromTexts(
  speakerKey: string,
  ownTexts: string[],
  otherTexts: string[],
  index: number
): { displayName: string; detectedName: string | null; detectedRole: string | null; detectionEvidence: string | null } {
  const joinedOwn = ownTexts.join(' ');
  const joinedOther = otherTexts.join(' ');

  // Pattern 1: Self-introduction "من [نام] هستم" / "اسمم [نام] هست"
  const selfIntroRegex =
    /(?:من|بنده|اسمم|اسم من)\s+([آ-ی]{2,14}(?:\s+[آ-ی]{2,14})?)\s+(?:هستم|ام|هست|صحبت می‌کنم)/;
  const selfMatch = joinedOwn.match(selfIntroRegex);
  if (selfMatch && selfMatch[1]) {
    const name = selfMatch[1].trim();
    const isCoach = /(?:کوچ|مشاور|سخنران|مدرس|بیزنس)/.test(joinedOwn);
    const role = isCoach ? 'بیزنس کوچ / سخنران' : index === 0 ? 'سخنران اصلی' : 'مخاطب / شرکت‌کننده';
    return {
      displayName: `${name} (${role})`,
      detectedName: name,
      detectedRole: role,
      detectionEvidence: `تشخیص از معرفی در متن: «${selfMatch[0]}»`,
    };
  }

  // Pattern 2: Addressed by other speaker "خانم/آقای/مهندس/دکتر [نام]"
  const honorificRegex = /(خانم|آقای|استاد|دکتر|مهندس)\s+([آ-ی]{2,14})/;
  if (index > 0) {
    const addressedMatch = joinedOther.match(honorificRegex);
    if (addressedMatch) {
      const fullName = `${addressedMatch[1]} ${addressedMatch[2]}`;
      return {
        displayName: `${fullName} (مخاطب)`,
        detectedName: fullName,
        detectedRole: 'شرکت‌کننده در سمینار',
        detectionEvidence: `تشخیص از خطاب گوینده دیگر: «${addressedMatch[0]}»`,
      };
    }
  } else {
    const coachMention = joinedOther.match(/(استاد|آقای|خانم|دکتر|کوچ)\s+([آ-ی]{2,14})/);
    if (coachMention) {
      const fullName = `${coachMention[1]} ${coachMention[2]}`;
      return {
        displayName: `${fullName} (بیزنس کوچ)`,
        detectedName: fullName,
        detectedRole: 'بیزنس کوچ / سخنران اصلی',
        detectionEvidence: `تشخیص از خطاب مخاطب: «${coachMention[0]}»`,
      };
    }
  }

  // Default role inference based on turn length & question ratio
  const questionCount = (joinedOwn.match(/؟|\?/g) || []).length;
  const isMainSpeaker = index === 0 || (joinedOwn.length > 260 && questionCount < 3);
  const role = isMainSpeaker ? 'بیزنس کوچ / سخنران اصلی' : 'مخاطب سمینار';
  return {
    displayName: isMainSpeaker ? `گوینده ۱ (سخنران اصلی)` : `گوینده ${index + 1} (مخاطب)`,
    detectedName: null,
    detectedRole: role,
    detectionEvidence: isMainSpeaker
      ? 'تشخیص خودکار بر اساس الگوی سخنرانی و طول صحبت'
      : 'تشخیص خودکار بر اساس الگوی پرسش و مکالمه',
  };
}

/**
 * Parse a user-provided raw Persian transcript into diarized segments with speaker detection.
 */
export function parseRawTranscriptToDiarization(
  rawTranscript: string,
  durationSec: number
): DiarizationResult {
  const lines = rawTranscript
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rawEntries: Array<{ speakerLabel: string; text: string; explicitSec?: number }> = [];
  let currentSpeaker = 'SPEAKER_1';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let explicitSec: number | undefined;

    // Optional leading timestamp like [01:20] or 01:20 -
    const timeMatch = line.match(/^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*[-–:]?\s*/);
    if (timeMatch) {
      if (timeMatch[3]) {
        explicitSec = Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3]);
      } else {
        explicitSec = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
      }
      line = line.slice(timeMatch[0].length).trim();
    }

    // Optional leading speaker label like "آرش:" or "مخاطب ۱:"
    const spkMatch = line.match(/^([^:：]{2,32})[:：]\s*(.+)$/);
    if (spkMatch) {
      currentSpeaker = spkMatch[1].trim();
      line = spkMatch[2].trim();
    } else if (i > 0 && (line.endsWith('؟') || line.startsWith('ببخشید') || line.startsWith('سلام استاد'))) {
      // Heuristic speaker switch on audience question
      currentSpeaker = currentSpeaker === 'SPEAKER_1' ? 'SPEAKER_2' : 'SPEAKER_1';
    }

    if (line) {
      rawEntries.push({ speakerLabel: currentSpeaker, text: line, explicitSec });
    }
  }

  if (rawEntries.length === 0) {
    return generateDemoSeminarTranscript('پارت سمینار', durationSec);
  }

  // Map distinct labels to speaker keys
  const labelToKey = new Map<string, string>();
  const keyToCustomLabel = new Map<string, string>();
  const textsByKey = new Map<string, string[]>();

  for (const entry of rawEntries) {
    if (!labelToKey.has(entry.speakerLabel)) {
      const key = `SPEAKER_${labelToKey.size + 1}`;
      labelToKey.set(entry.speakerLabel, key);
      if (!/^SPEAKER_\d+$/.test(entry.speakerLabel)) {
        keyToCustomLabel.set(key, entry.speakerLabel);
      }
      textsByKey.set(key, []);
    }
    const key = labelToKey.get(entry.speakerLabel)!;
    textsByKey.get(key)!.push(entry.text);
  }

  // Distribute timestamps proportionally by character count
  const totalChars = rawEntries.reduce((acc, e) => acc + Math.max(10, e.text.length), 0);
  const totalDur = Math.max(durationSec, rawEntries.length * 10);
  let cursor = 0;

  const segments: DiarizedSegmentOutput[] = rawEntries.map((entry, idx) => {
    const startSec = entry.explicitSec !== undefined ? entry.explicitSec : Math.round(cursor);
    const weight = Math.max(10, entry.text.length) / totalChars;
    const segDur = Math.max(6, Math.round(totalDur * weight));
    const nextExplicit = rawEntries[idx + 1]?.explicitSec;
    const endSec =
      nextExplicit !== undefined && nextExplicit > startSec
        ? nextExplicit
        : Math.min(totalDur, startSec + segDur);
    cursor = endSec;
    return {
      speakerKey: labelToKey.get(entry.speakerLabel)!,
      startSec,
      endSec: Math.max(startSec + 4, endSec),
      text: entry.text,
    };
  });

  const genericLabels = /^(?:مخاطب|گوینده|شرکت‌کننده|پرسشگر|سخنران|مهمان|speaker|guest)(?:\s*[\d۰-۹]+)?$/i;
  const allKeys = Array.from(textsByKey.keys());
  const speakers: DiarizedSpeakerOutput[] = allKeys.map((key, idx) => {
    const customLabel = keyToCustomLabel.get(key);
    const ownTexts = textsByKey.get(key) || [];
    const otherTexts = allKeys
      .filter((k) => k !== key)
      .flatMap((k) => textsByKey.get(k) || []);
    const inferred = inferSpeakerIdentityFromTexts(key, ownTexts, otherTexts, idx);
    const isGenericLabel = !customLabel || genericLabels.test(customLabel.trim());

    const useInferred = isGenericLabel || Boolean(inferred.detectedName && inferred.detectedName !== customLabel);

    return {
      speakerKey: key,
      displayName: useInferred ? inferred.displayName : customLabel!,
      detectedName: inferred.detectedName || (isGenericLabel ? null : customLabel || null),
      detectedRole: inferred.detectedRole,
      detectionEvidence:
        inferred.detectedName
          ? inferred.detectionEvidence
          : customLabel
            ? `برچسب مشخص‌شده در متن ورودی: «${customLabel}»`
            : inferred.detectionEvidence,
      color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
    };
  });

  return { speakers, segments, usedProvider: 'demo' };
}

/**
 * Generates a realistic multi-speaker Persian business coaching transcript for uploaded files in Demo mode.
 */
export function generateDemoSeminarTranscript(title: string, durationSec: number): DiarizationResult {
  const safeTitle = title.trim() || 'بخش جدید سمینار';
  const baseDur = Math.max(135, Math.min(durationSec, 480));
  const rawTurns: Array<{ speakerKey: string; text: string }> = [
    {
      speakerKey: 'SPEAKER_1',
      text: `سلام به همه کارآفرین‌های عزیز، من آرش راد هستم و توی بخش «${safeTitle}» می‌خوام دست بذارم روی بزرگ‌ترین دروغی که باعث شده فروش ۹۰ درصد کسب‌وکارها روی یک سقف ثابت قفل بشه.`,
    },
    {
      speakerKey: 'SPEAKER_1',
      text: 'خیلی از شما فکر می‌کنید مشکل فروشتون نداشتن لید یا کم بودن تبلیغاته، در حالی که وقتی سیستم پیگیری نداری، هر ریال بودجه تبلیغاتی عملاً پول ریختن توی سطل سوراخه.',
    },
    {
      speakerKey: 'SPEAKER_2',
      text: 'ببخشید استاد آرش، من مریم شریفی هستم و یک مجموعه خدماتی دارم. ما ماهانه بالای سیصد تا ورودی اینستاگرام داریم ولی کمتر از پنج درصدش تبدیل به خرید میشه، واقعاً نمی‌دونیم کجای کار می‌لنگه.',
    },
    {
      speakerKey: 'SPEAKER_1',
      text: 'سوال فوق‌العاده‌ای پرسیدید خانم شریفی! بذارید یک آزمایش ساده بکنیم: وقتی مشتری دایرکت میده قیمت چنده، ادمین شما دقیقاً چی جواب میده؟ قیمت رو می‌فرسته و منتظر می‌مونه، درسته؟',
    },
    {
      speakerKey: 'SPEAKER_2',
      text: 'دقیقاً همینطوره! یا قیمت می‌فرستیم و دیگه سین می‌کنن و جواب نمیدن، یا میگن گرونه و میرن.',
    },
    {
      speakerKey: 'SPEAKER_1',
      text: 'این دقیقاً قانون طلایی فروش مشاوره‌ایه: تا قبل از اینکه درد واقعی مشتری رو از زبون خودش نشنوی، اعلام کردن قیمت یعنی خودکشی در فروش! اول سه تا سوال تشخیصی بپرس، ارزش رو بساز و آخرش عدد بگو.',
    },
    {
      speakerKey: 'SPEAKER_3',
      text: 'آقای راد، من سعید کاظمی‌ام؛ اگر تیم فروش سه نفره داشته باشیم و هر کدوم ساز خودشون رو بزنن چطور این مدل رو استاندارد کنیم که وابسته به حال و حوصله کارشناس نباشه؟',
    },
    {
      speakerKey: 'SPEAKER_1',
      text: 'آقای کاظمی، بیزینسی که سیستم مکتوب نداره، کسب‌وکار نیست بلکه گروگانِ حال خوب کارمندهاشه. شما به یک پلی‌بوک دو صفحه‌ای نیاز دارید: پنج سوال استاندارد، سه پاسخ آماده به اعتراض قیمت و پیگیری هفت‌روزه در CRM.',
    },
    {
      speakerKey: 'SPEAKER_1',
      text: 'از فردا صبح فقط همین یک تغییر رو اجرا کنید: هیچ کارشناسی حق نداره توی پیام اول قیمت بده. قول میدم ظرف ۱۴ روز نرخ تبدیل فروشتون حداقل دو برابر میشه.',
    },
  ];

  const totalChars = rawTurns.reduce((sum, t) => sum + t.text.length, 0);
  let cursor = 0;
  const segments: DiarizedSegmentOutput[] = rawTurns.map((turn) => {
    const segDur = Math.max(10, Math.round((turn.text.length / totalChars) * baseDur));
    const startSec = cursor;
    const endSec = cursor + segDur;
    cursor = endSec;
    return {
      speakerKey: turn.speakerKey,
      startSec,
      endSec,
      text: turn.text,
    };
  });

  const speakers: DiarizedSpeakerOutput[] = [
    {
      speakerKey: 'SPEAKER_1',
      displayName: 'آرش راد (بیزنس کوچ)',
      detectedName: 'آرش راد',
      detectedRole: 'بیزنس کوچ / سخنران اصلی',
      detectionEvidence: 'تشخیص از معرفی در متن: «من آرش راد هستم»',
      color: SPEAKER_COLORS[0],
    },
    {
      speakerKey: 'SPEAKER_2',
      displayName: 'مریم شریفی (مخاطب)',
      detectedName: 'مریم شریفی',
      detectedRole: 'صاحب کسب‌وکار خدماتی',
      detectionEvidence: 'تشخیص از معرفی در متن: «من مریم شریفی هستم» و خطاب «خانم شریفی»',
      color: SPEAKER_COLORS[1],
    },
    {
      speakerKey: 'SPEAKER_3',
      displayName: 'سعید کاظمی (مخاطب)',
      detectedName: 'سعید کاظمی',
      detectedRole: 'مدیر تیم فروش',
      detectionEvidence: 'تشخیص از معرفی در متن: «من سعید کاظمی‌ام» و خطاب «آقای کاظمی»',
      color: SPEAKER_COLORS[2],
    },
  ];

  return { speakers, segments, usedProvider: 'demo' };
}

/**
 * Gemini API Audio Transcription + Speaker Diarization + Speaker Identity Inference
 */
async function transcribeWithGemini(
  audioPath: string,
  mimeType: string,
  settings: AISettings
): Promise<DiarizationResult> {
  const fileBuffer = fs.readFileSync(audioPath);
  const base64Audio = fileBuffer.toString('base64');
  const model = settings.geminiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  const prompt = `شما یک سیستم حرفه‌ای تبدیل گفتار به متن فارسی و تفکیک گویندگان (Speaker Diarization) برای سمینارها و همایش‌های بیزنس کوچینگ هستید.
این فایل صوتی را با دقت کامل به فارسی پیاده‌سازی کنید:
1. هر جا گوینده عوض می‌شود یک بخش (segment) جدید بسازید و زمان دقیق شروع و پایان (به ثانیه) را ثبت کنید.
2. متن باید دقیقاً همان گفتار واقعی (کلمه به کلمه، بدون خلاصه‌سازی یا بازنویسی) باشد.
3. اگر از داخل متن نام، لقب یا نقش گوینده مشخص می‌شود (مثلاً خودش را معرفی می‌کند یا دیگران صدایش می‌زنند)، آن را استخراج کنید و جمله شاهد آن را بنویسید.

فقط و فقط یک JSON معتبر با ساختار زیر برگردانید:
{
  "speakers": [
    {
      "speakerKey": "SPEAKER_1",
      "displayName": "نام و نقش تشخیص داده‌شده",
      "detectedName": "نام یا null",
      "detectedRole": "نقش یا null",
      "detectionEvidence": "دلیل تشخیص از متن یا null"
    }
  ],
  "segments": [
    {
      "speakerKey": "SPEAKER_1",
      "startSec": 0,
      "endSec": 18,
      "text": "متن دقیق گفتار"
    }
  ]
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'audio/mpeg',
                data: base64Audio,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini transcription error (${response.status}): ${errText.slice(0, 250)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = safeJsonParse<{
    speakers?: Array<Omit<DiarizedSpeakerOutput, 'color'>>;
    segments?: DiarizedSegmentOutput[];
  }>(rawText);

  if (!parsed?.segments?.length) {
    throw new Error('Gemini returned invalid diarization JSON');
  }

  const speakers: DiarizedSpeakerOutput[] = (parsed.speakers || []).map((s, idx) => ({
    speakerKey: s.speakerKey || `SPEAKER_${idx + 1}`,
    displayName: s.displayName || `گوینده ${idx + 1}`,
    detectedName: s.detectedName || null,
    detectedRole: s.detectedRole || null,
    detectionEvidence: s.detectionEvidence || null,
    color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
  }));

  return {
    speakers,
    segments: parsed.segments.map((seg) => ({
      speakerKey: seg.speakerKey || 'SPEAKER_1',
      startSec: Math.max(0, Math.round(Number(seg.startSec) || 0)),
      endSec: Math.max(1, Math.round(Number(seg.endSec) || 10)),
      text: String(seg.text || '').trim(),
    })).filter((s) => s.text.length > 0),
    usedProvider: 'gemini',
  };
}

/**
 * OpenAI-compatible Audio Transcription + LLM Speaker Diarization
 * (Works with GapGPT, OpenAI, AvalAI, OpenRouter, etc.)
 */
async function transcribeWithOpenAI(
  audioPath: string,
  mimeType: string,
  settings: AISettings
): Promise<DiarizationResult> {
  const baseUrl = normalizeOpenAIBaseUrl(settings.provider, settings.baseUrl);
  const fileBuffer = fs.readFileSync(audioPath);
  const primaryModel = resolveTranscriptionModel(settings);

  const attemptTranscription = async (
    modelName: string,
    responseFormat: 'verbose_json' | 'json'
  ) => {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType || 'audio/mpeg' });
    form.append('file', blob, path.basename(audioPath));
    form.append('model', modelName);
    form.append('language', 'fa');
    form.append('response_format', responseFormat);

    return fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      body: form,
    });
  };

  let trRes = await attemptTranscription(primaryModel, 'verbose_json');

  // If GapGPT's hosted `gapgpt/whisper-1` or `verbose_json` isn't accepted, retry gracefully
  if (!trRes.ok && (trRes.status === 400 || trRes.status === 404)) {
    if (primaryModel !== 'whisper-1') {
      trRes = await attemptTranscription('whisper-1', 'verbose_json');
    }
    if (!trRes.ok && (trRes.status === 400 || trRes.status === 422)) {
      trRes = await attemptTranscription(primaryModel, 'json');
    }
  }

  if (!trRes.ok) {
    const errText = await trRes.text();
    throw new Error(`Transcription API error (${trRes.status}): ${errText.slice(0, 250)}`);
  }

  const trData = (await trRes.json()) as {
    text?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };

  const whisperSegments =
    trData.segments && trData.segments.length > 0
      ? trData.segments
      : [{ start: 0, end: 60, text: trData.text || '' }];

  const numbered = whisperSegments
    .map((s, idx) => `[#${idx} | ${Math.round(s.start)}s-${Math.round(s.end)}s] ${s.text.trim()}`)
    .join('\n');

  const rawChatContent = await callOpenAICompatibleChat(settings, {
    temperature: 0.1,
    jsonMode: true,
    messages: [
      {
        role: 'system',
        content:
          'شما متخصص تفکیک گویندگان (Speaker Diarization) و تشخیص هویت گویندگان از متن سمینارهای فارسی هستید. متن اصلی را بدون تغییر نگه دارید و فقط گویندگان را تفکیک و ادغام‌های متوالی هم‌گوینده را مرتب کنید.',
      },
      {
        role: 'user',
        content: `بخش‌های زیر از یک فایل صوتی سمینار استخراج شده است. گویندگان را تفکیک کن، نام یا نقش هر گوینده را در صورت وجود در متن حدس بزن و دقیقاً JSON زیر را برگردان (متن گفتار را تغییر نده!):\n\n${numbered}\n\nJSON:\n{"speakers":[{"speakerKey":"SPEAKER_1","displayName":"...","detectedName":null,"detectedRole":"...","detectionEvidence":"..."}],"segments":[{"speakerKey":"SPEAKER_1","startSec":0,"endSec":20,"text":"..."}]}`,
      },
    ],
  });

  const parsed = safeJsonParse<{
    speakers?: Array<Omit<DiarizedSpeakerOutput, 'color'>>;
    segments?: DiarizedSegmentOutput[];
  }>(rawChatContent);

  if (!parsed?.segments?.length) {
    throw new Error('LLM returned invalid diarization output');
  }

  return {
    speakers: (parsed.speakers || []).map((s, idx) => ({
      speakerKey: s.speakerKey || `SPEAKER_${idx + 1}`,
      displayName: s.displayName || `گوینده ${idx + 1}`,
      detectedName: s.detectedName || null,
      detectedRole: s.detectedRole || null,
      detectionEvidence: s.detectionEvidence || null,
      color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
    })),
    segments: parsed.segments,
    usedProvider: settings.provider === 'gapgpt' ? 'gapgpt' : 'openai',
  };
}

/**
 * Main entry for transcribing + diarizing an audio file (supports Gemini, GapGPT, OpenAI-compatible, or Demo/Local).
 */
export async function transcribeAndDiarizeAudio(params: {
  audioPath: string;
  mimeType: string;
  title: string;
  durationSec: number;
  rawTranscript?: string;
  settings: AISettings;
}): Promise<DiarizationResult> {
  const { audioPath, mimeType, title, durationSec, rawTranscript, settings } = params;

  // If user directly pasted/provided a transcript, parse it cleanly with speaker detection
  if (rawTranscript && rawTranscript.trim().length > 15) {
    return parseRawTranscriptToDiarization(rawTranscript, durationSec);
  }

  if (settings.provider === 'gemini' && settings.apiKey) {
    try {
      return await transcribeWithGemini(audioPath, mimeType, settings);
    } catch (err) {
      console.warn('[aiEngine] Gemini transcription failed, falling back to demo:', err);
    }
  } else if ((settings.provider === 'openai' || settings.provider === 'gapgpt') && settings.apiKey) {
    try {
      return await transcribeWithOpenAI(audioPath, mimeType, settings);
    } catch (err) {
      console.warn(`[aiEngine] ${settings.provider} transcription failed, falling back to demo:`, err);
    }
  }

  return generateDemoSeminarTranscript(title, durationSec);
}

/**
 * Local smart Persian NLP Hook + Verbatim Scenario Extractor.
 * Works on ANY Persian seminar transcript (single file or multi-file combined sequence)
 * and strictly preserves 100% verbatim quotes with exact timestamps and source audio links.
 */
function extractHooksLocally(
  segments: VerifiableSegment[],
  options: { isCombined: boolean; combinationGoal?: string }
): GeneratedHookDraft[] {
  if (segments.length === 0) return [];

  const goldKeywords = [
    'دروغ', 'اشتباه', 'خودکشی', 'قانون طلایی', 'قفل', 'سوراخ', 'گروگان',
    'بزرگ‌ترین', 'نود درصد', '۹۰ درصد', '۸۰ درصد', 'دو برابر', 'میلیارد',
    'تضمین', 'قول میدم', 'ور شکست', 'پشت پرده', 'راز', 'هیچ‌وقت',
  ];
  const silverKeywords = [
    'چرا', 'فکر می‌کنید', 'آزمایش', 'مقایسه', 'تفاوت', 'چالش', 'کمتر از',
    'فقط', 'تغییر', 'پلی‌بوک', 'فرمول', 'سیستم', 'مکتوب', 'مشکل', 'قیمت',
  ];
  const bronzeKeywords = [
    'ببخشید', 'سوال', '؟', 'دقیقاً', 'تجربه', 'استاد', 'خانم', 'آقای',
    'فردا صبح', 'یادم', 'بذارید', 'مثال', 'تیم', 'مشتری', 'دایرکت',
  ];

  const scored = segments.map((seg, index) => {
    const t = seg.text;
    const goldScore = goldKeywords.reduce((s, kw) => s + (t.includes(kw) ? 3 : 0), 0) + (t.length > 90 ? 2 : 0);
    const silverScore = silverKeywords.reduce((s, kw) => s + (t.includes(kw) ? 2.5 : 0), 0) + (t.includes('؟') ? 1 : 0);
    const bronzeScore = bronzeKeywords.reduce((s, kw) => s + (t.includes(kw) ? 2.5 : 0), 0);
    return { seg, index, goldScore, silverScore, bronzeScore };
  });

  const distinctFiles = Array.from(new Set(segments.map((s) => s.audioFileId)));

  function pickOpeningSentence(text: string): string {
    const sentences = text
      .split(/(?<=[.!؟])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return sentences[0] || text.trim();
  }

  function buildScenarioFromAnchor(
    anchorIdx: number,
    tier: HookTier,
    storyFormat: StoryFormat | null,
    preferCrossFile: boolean
  ): {
    beats: Array<{ label: string; segmentId: string; verbatimText: string; editingNote: string }>;
    estimatedDurationSec: number;
  } {
    const chosen: VerifiableSegment[] = [segments[anchorIdx]];

    if (tier === 'bronze' && storyFormat === 'single_story') {
      // Tight 1-2 beat single story (15-30 sec)
      if (anchorIdx + 1 < segments.length && chosen[0].endSec - chosen[0].startSec < 18) {
        chosen.push(segments[anchorIdx + 1]);
      }
      const beats = chosen.map((seg, idx) => ({
        label: idx === 0 ? 'اسلاید استوری تکی — قلاب و پیام اصلی' : 'ادامه مستقیم در همان استوری',
        segmentId: seg.id,
        verbatimText: seg.text,
        editingNote:
          idx === 0
            ? 'زیرنویس درشت روی دو کلمه کلیدی + کادر چهره نزدیک سخنران (کلوزآپ) + استیکر نظرسنجی در پایین صفحه.'
            : 'کات نرم بدون موسیقی بلند برای حفظ حس صمیمی استوری و دعوت به ریپلای.',
      }));
      const dur = chosen.reduce((acc, s) => acc + Math.max(8, s.endSec - s.startSec), 0);
      return { beats, estimatedDurationSec: Math.min(45, dur) };
    }

    if (preferCrossFile && distinctFiles.length > 1) {
      // Pick verbatim segments across different source files IN THE USER'S EXACT CHOSEN ORDER
      const seenFiles = new Set<string>([segments[anchorIdx].audioFileId]);
      for (const fileId of distinctFiles) {
        if (seenFiles.has(fileId)) continue;
        const fileSegs = segments.filter((s) => s.audioFileId === fileId);
        if (fileSegs.length > 0) {
          const bestInFile = fileSegs.reduce((best, cur) =>
            cur.text.length > best.text.length ? cur : best
          );
          chosen.push(bestInFile);
          seenFiles.add(fileId);
        }
        if (chosen.length >= 4) break;
      }
      // Sort chosen beats by their order in the user's combined sequence
      const segOrderMap = new Map(segments.map((s, i) => [s.id, i]));
      chosen.sort((a, b) => (segOrderMap.get(a.id) ?? 0) - (segOrderMap.get(b.id) ?? 0));
    } else {
      // Gather adjacent coherent segments around anchor
      const desiredCount = tier === 'gold' ? 4 : tier === 'silver' ? 3 : 4;
      let nextIdx = anchorIdx + 1;
      while (chosen.length < desiredCount && nextIdx < segments.length) {
        chosen.push(segments[nextIdx]);
        nextIdx++;
      }
      let prevIdx = anchorIdx - 1;
      while (chosen.length < Math.min(desiredCount, segments.length) && prevIdx >= 0) {
        chosen.unshift(segments[prevIdx]);
        prevIdx--;
      }
    }

    if (tier === 'bronze' && storyFormat === 'story_sequence') {
      const slideLabels = [
        'اسلاید ۱ — قلاب کنجکاوی و شروع بحث',
        'اسلاید ۲ — طرح چالش یا مثال واقعی',
        'اسلاید ۳ — پاسخ و نکته کلیدی کوچ',
        'اسلاید ۴ — جمع‌بندی و دعوت به تعامل (CTA)',
      ];
      const slideNotes = [
        'تیتر بزرگ بالای صفحه با کلمه کلیدی قلاب + برچسب «ادامه در اسلاید بعد 👈».',
        'برش مستقیم از گفتگوی سالن + استیکر اسلایدر یا نظرسنجی (شما هم این مشکل رو دارید؟).',
        'زوم ملایم روی سخنران هنگام بیان قاعده اصلی + هایلایت متنی روی جمله طلایی.',
        'باکس سوال (Question Box) یا لینک دایرکت در پایین اسلاید برای گرفتن لید.',
      ];
      const beats = chosen.slice(0, 4).map((seg, i) => ({
        label: slideLabels[i] || `اسلاید ${i + 1} — ادامه رشته استوری`,
        segmentId: seg.id,
        verbatimText: seg.text,
        editingNote: slideNotes[i] || 'زیرنویس خوانا با کنتراست بالا برای مشاهده بدون صدا.',
      }));
      const dur = chosen.slice(0, 4).reduce((acc, s) => acc + Math.max(10, s.endSec - s.startSec), 0);
      return { beats, estimatedDurationSec: dur };
    }

    const reelLabels =
      tier === 'gold'
        ? [
            'قلاب طلایی آغازین (۰ تا ۳ ثانیه)',
            'باز کردن درد و موقعیت واقعی',
            'نقطه عطف و ارائه راه‌حل اصلی',
            'جمع‌بندی قدرتمند و دعوت به ذخیره/اشتراک‌گذاری',
          ]
        : [
            'قلاب تریال (جذب مخاطب غیردنبال‌کننده)',
            'اثبات سریع با مکالمه یا مثال واقعی',
            'پانچ‌لاین نهایی برای کنجکاوی و فالو',
          ];

    const reelNotes =
      tier === 'gold'
        ? [
            'کات سریع از ابتدای جمله بدون مکث + تیتر درشت دو خطی روی تصویر + افکت صوتی ظریف (Whoosh).',
            'نمایش واکنش مخاطبین یا کات به زاویه دوم دوربین + زیرنویس پویا (Dynamic Captions).',
            'بزرگ‌نمایی تدریجی (Slow Zoom-in) روی چهره سخنران + نمایش کلیدواژه‌ها روی صفحه.',
            'فریم پایانی تمیز با کال‌تو‌اکشن متنی برای سیو کردن پست و ارسال برای همکاران.',
          ]
        : [
            'شروع ناگهانی وسط تنش بحث برای متوقف کردن اسکرول مخاطبان جدید در تریال ریلز.',
            'ریتم تدوین تند (Jump Cuts) و حذف تمام مکث‌های تنفسی.',
            'پایان باز یا چالشی برای افزایش کامنت و نرخ بازپخش در تست تریال.',
          ];

    const maxBeats = tier === 'gold' ? 4 : 3;
    const beats = chosen.slice(0, maxBeats).map((seg, i) => ({
      label: reelLabels[i] || `بخش ${i + 1} سناریو`,
      segmentId: seg.id,
      verbatimText: seg.text,
      editingNote: reelNotes[i] || 'زیرنویس فارسی دقیق هماهنگ با ریتم گفتار.',
    }));
    const dur = chosen.slice(0, maxBeats).reduce((acc, s) => acc + Math.max(10, s.endSec - s.startSec), 0);
    return { beats, estimatedDurationSec: dur };
  }

  const hooks: GeneratedHookDraft[] = [];
  const usedAnchors = new Set<number>();

  const pickBest = (scoreKey: 'goldScore' | 'silverScore' | 'bronzeScore', fallbackIdx: number) => {
    const sorted = [...scored].sort((a, b) => b[scoreKey] - a[scoreKey]);
    const unused = sorted.find((s) => !usedAnchors.has(s.index));
    const picked = unused || sorted[0] || scored[fallbackIdx % scored.length];
    usedAnchors.add(picked.index);
    return picked;
  };

  const specs: Array<{
    tier: HookTier;
    scoreKey: 'goldScore' | 'silverScore' | 'bronzeScore';
    formatLabel: string;
    storyFormat: StoryFormat | null;
    titlePrefix: string;
    rationale: string;
    preferCrossFile: boolean;
    storyEngagementIdea: string | null;
    captionIdea: string | null;
  }> = [
    {
      tier: 'gold',
      scoreKey: 'goldScore',
      formatLabel: options.isCombined ? 'پست ریلز ترکیبی (اصلی پیج)' : 'پست ریلز (اصلی پیج)',
      storyFormat: null,
      titlePrefix: options.isCombined ? 'پست طلایی ترکیبی' : 'پست طلایی اصلی',
      rationale: options.isCombined
        ? `ساختار ترکیبی پیوسته مطابق ترتیب انتخابی شما (${options.combinationGoal || 'ساختار داستانی'}) با بالاترین قدرت جذب، اعتبار تخصصی و نرخ ذخیره روی پیج.`
        : 'دارای تضاد ذهنی قدرتمند، ارزش آموزشی مستقیم و قدرت بالا در ایجاد اعتماد و ذخیره (Save) برای پست اصلی پیج.',
      preferCrossFile: options.isCombined,
      storyEngagementIdea: null,
      captionIdea: 'اگر این نکته برات کاربردی بود همین الان سیوش کن و عدد ۱ رو کامنت بذار تا چک‌لیست اجراش رو برات بفرستم.',
    },
    {
      tier: 'gold',
      scoreKey: 'goldScore',
      formatLabel: 'پست ریلز (آموزشی/اقتدار)',
      storyFormat: null,
      titlePrefix: 'پست طلایی دوم',
      rationale: 'مستقیماً به یکی از دغدغه‌های مالی و اجرایی صاحبان کسب‌وکار می‌پردازد و نرخ اشتراک‌گذاری بالایی ایجاد می‌کند.',
      preferCrossFile: options.isCombined,
      storyEngagementIdea: null,
      captionIdea: 'این ویدیو رو برای مدیر فروش یا شریک کاریت بفرست تا از فردا با همین مدل جلو برید.',
    },
    {
      tier: 'silver',
      scoreKey: 'silverScore',
      formatLabel: 'تریال ریلز (تست مخاطب جدید)',
      storyFormat: null,
      titlePrefix: options.isCombined ? 'تریال ریلز ترکیبی' : 'تریال ریلز اول',
      rationale: 'زاویه دید چالشی و سریع دارد؛ عالی برای انتشار به صورت Trial Reel جهت سنجش نرخ واچ‌تایم در بین مخاطبان غیرفالوور بدون ریسک روی فید اصلی.',
      preferCrossFile: options.isCombined,
      storyEngagementIdea: null,
      captionIdea: 'موافقی یا تجربه متفاوتی داشتی؟ نظرت رو توی کامنت بنویس.',
    },
    {
      tier: 'silver',
      scoreKey: 'silverScore',
      formatLabel: 'تریال ریلز (زاویه پرسش و پاسخ)',
      storyFormat: null,
      titlePrefix: 'تریال ریلز دوم',
      rationale: 'شروع مکالمه‌محور و کنجکاوکننده؛ مناسب برای تست قلاب متفاوت روی اکسپلور و سنجش کشش موضوع پیش از تبدیل به پست اصلی.',
      preferCrossFile: false,
      storyEngagementIdea: null,
      captionIdea: 'بزرگ‌ترین چالش فعلی کسب‌وکارت توی این بخش چیه؟ زیر همین پست بنویس.',
    },
    {
      tier: 'bronze',
      scoreKey: 'bronzeScore',
      formatLabel: 'رشته استوری (۴ اسلایدی)',
      storyFormat: 'story_sequence',
      titlePrefix: options.isCombined ? 'رشته استوری ترکیبی' : 'رشته استوری تعاملی',
      rationale: 'روایت چندمرحله‌ای صمیمی از دل سمینار که مخاطب را اسلاید به اسلاید نگه می‌دارد و آماده پاسخ در دایرکت می‌کند.',
      preferCrossFile: options.isCombined,
      storyEngagementIdea: 'اسلاید ۲: نظرسنجی دوگزینه‌ای («دقیقاً مشکل من همینه / نه ما سیستم داریم») — اسلاید ۴: باکس ریپلای با کلمه کلیدی برای دریافت فایل.',
      captionIdea: null,
    },
    {
      tier: 'bronze',
      scoreKey: 'bronzeScore',
      formatLabel: 'استوری تکی (نکته فوری)',
      storyFormat: 'single_story',
      titlePrefix: 'استوری تکی سریع',
      rationale: 'یک تکه کوتاه، خودمانی و پرانرژی که برای گرم نگه‌داشتن استوری روزانه و نمایش فضای زنده سمینار فوق‌العاده است.',
      preferCrossFile: false,
      storyEngagementIdea: 'استیکر اسلایدر ایموجی آتش یا دکمه نظرسنجی سریع «این بخش از سمینار چقدر به کارت اومد؟».',
      captionIdea: null,
    },
  ];

  // If transcript is very short (<4 segments), output 1 gold, 1 silver, 2 bronze (1 sequence + 1 single)
  const activeSpecs =
    segments.length < 4 ? [specs[0], specs[2], specs[4], specs[5]] : specs;

  activeSpecs.forEach((spec, idx) => {
    const anchor = pickBest(spec.scoreKey, idx);
    const { beats, estimatedDurationSec } = buildScenarioFromAnchor(
      anchor.index,
      spec.tier,
      spec.storyFormat,
      spec.preferCrossFile
    );

    const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(beats, segments);
    const leadBeat = verifiedBeats[0];
    if (!leadBeat) return;

    const hookSentence = pickOpeningSentence(leadBeat.verbatimText);
    const shortSnippet =
      hookSentence.length > 52 ? `${hookSentence.slice(0, 52).trim()}...` : hookSentence;

    hooks.push({
      tier: spec.tier,
      formatLabel: spec.formatLabel,
      storyFormat: spec.storyFormat,
      title: `${spec.titlePrefix}: ${shortSnippet}`,
      hookVerbatim: hookSentence,
      hookSegmentId: leadBeat.segmentId,
      hookSourceAudioId: leadBeat.sourceAudioId,
      hookSourceAudioTitle: leadBeat.sourceAudioTitle,
      hookStartSec: leadBeat.startSec,
      hookEndSec: leadBeat.endSec,
      hookSpeakerName: leadBeat.speakerName,
      rationale: spec.rationale,
      estimatedDurationSec,
      scenarioBeats: verifiedBeats,
      storyEngagementIdea: spec.storyEngagementIdea,
      captionIdea: spec.captionIdea,
      verbatimScore,
    });
  });

  return hooks;
}

/**
 * LLM-powered Hook & Verbatim Scenario Extractor (Gemini or OpenAI-compatible)
 */
async function extractHooksWithLLM(
  segments: VerifiableSegment[],
  settings: AISettings,
  options: { isCombined: boolean; combinationGoal?: string }
): Promise<GeneratedHookDraft[]> {
  const transcriptLines = segments
    .map(
      (s) =>
        `[SEG_ID=${s.id} | فایل=${s.audioTitle} | زمان=${s.startSec}s-${s.endSec}s | گوینده=${s.speakerName}]: ${s.text}`
    )
    .join('\n');

  const combinedHint = options.isCombined
    ? `این متن حاصل ترکیب چند فایل صوتی به ترتیب دلخواه کاربر با هدف «${options.combinationGoal || 'ساختار بهتر محتوایی'}» است. حتماً در سناریوها از بخش‌های مختلف فایل‌های انتخاب‌شده مطابق همین ترتیب استفاده کن تا یک ساختار پیوسته و قوی ساخته شود.`
    : 'این متن مربوط به یک فایل صوتی از سمینار است.';

  const prompt = `شما استراتژیست ارشد محتوای اینستاگرام و تدوینگر سمینارهای بیزنس کوچینگ هستید.
${combinedHint}

قانون مطلق و غیرقابل نقض:
هر متن گفتاری (verbatimText و hookVerbatim) که در قلاب و سناریو می‌آورید باید **دقیقاً کلمه به کلمه و بدون کوچک‌ترین تغییر** از داخل متن استخراج‌شده زیر کپی شود و \`segmentId\` دقیق آن بخش را داشته باشد تا تدوینگر بتواند عین همان ثانیه را در فایل صوتی/ویدیویی پیدا کند و برش بزند! هیچ جمله‌ای از خودتان برای گفتار نسازید. راهنمایی‌های تدوین را فقط در \`editingNote\` بنویسید.

دسته‌بندی قلاب‌ها (حتماً از هر ۳ دسته تولید کن):
1. "gold" (طلایی): برای پست اصلی روی پیج (ریلز با بالاترین اثرگذاری، ذخیره و اشتراک‌گذاری) — ۲ عدد
2. "silver" (نقره‌ای): برای تریال ریلز (Trial Reels برای تست قلاب روی مخاطب غیردنبال‌کننده) — ۲ عدد
3. "bronze" (برنزی): برای استوری — حتماً حداقل یک "single_story" (استوری تکی) و یک "story_sequence" (رشته استوری ۳ تا ۵ اسلایدی) تولید کن.

متن تفکیک‌شده سمینار:
${transcriptLines}

فقط JSON معتبر با ساختار زیر برگردان:
{
  "hooks": [
    {
      "tier": "gold" | "silver" | "bronze",
      "storyFormat": null | "single_story" | "story_sequence",
      "formatLabel": "پست ریلز" | "تریال ریلز" | "استوری تکی" | "رشته استوری (۴ اسلاید)",
      "title": "عنوان کوتاه و جذاب برای تدوینگر",
      "hookVerbatim": "عین جمله قلاب از متن اصلی بدون تغییر",
      "rationale": "چرا این قلاب در این دسته قرار گرفته",
      "storyEngagementIdea": "ایده استیکر/تعامل برای برنزی یا null",
      "captionIdea": "ایده کپشن برای طلایی/نقره‌ای یا null",
      "beats": [
        {
          "label": "نام بخش سناریو یا شماره اسلاید",
          "segmentId": "دقیقاً یکی از SEG_IDهای بالا",
          "verbatimText": "عین متن از همان segmentId بدون هیچ تغییری",
          "editingNote": "راهنمای تدوین، زیرنویس یا استیکر"
        }
      ]
    }
  ]
}`;

  let rawText = '';

  if (settings.provider === 'gemini') {
    const model = settings.geminiModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini hook extraction failed (${res.status})`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    rawText = await callOpenAICompatibleChat(settings, {
      temperature: 0.2,
      jsonMode: true,
      messages: [
        {
          role: 'system',
          content: 'You output strictly valid JSON in Persian. Never modify verbatim spoken quotes.',
        },
        { role: 'user', content: prompt },
      ],
    });
  }

  const parsed = safeJsonParse<{
    hooks?: Array<{
      tier: HookTier;
      storyFormat?: StoryFormat | null;
      formatLabel?: string;
      title: string;
      hookVerbatim: string;
      rationale: string;
      storyEngagementIdea?: string | null;
      captionIdea?: string | null;
      beats: Array<{
        label: string;
        segmentId: string;
        verbatimText: string;
        editingNote: string;
      }>;
    }>;
  }>(rawText);

  if (!parsed?.hooks?.length) {
    throw new Error('LLM returned empty hooks array');
  }

  const results: GeneratedHookDraft[] = [];
  for (const h of parsed.hooks) {
    const tier: HookTier =
      h.tier === 'gold' || h.tier === 'silver' || h.tier === 'bronze' ? h.tier : 'silver';
    const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(h.beats || [], segments);
    if (verifiedBeats.length === 0) continue;

    const lead = verifiedBeats[0];
    const estDur = verifiedBeats.reduce((acc, b) => acc + Math.max(8, b.endSec - b.startSec), 0);

    results.push({
      tier,
      storyFormat:
        tier === 'bronze'
          ? h.storyFormat === 'single_story' || h.storyFormat === 'story_sequence'
            ? h.storyFormat
            : verifiedBeats.length > 1
              ? 'story_sequence'
              : 'single_story'
          : null,
      formatLabel:
        h.formatLabel ||
        (tier === 'gold'
          ? 'پست ریلز'
          : tier === 'silver'
            ? 'تریال ریلز'
            : verifiedBeats.length > 1
              ? `رشته استوری (${verifiedBeats.length} اسلاید)`
              : 'استوری تکی'),
      title: h.title || 'قلاب استخراج‌شده',
      hookVerbatim: lead.verbatimText,
      hookSegmentId: lead.segmentId,
      hookSourceAudioId: lead.sourceAudioId,
      hookSourceAudioTitle: lead.sourceAudioTitle,
      hookStartSec: lead.startSec,
      hookEndSec: lead.endSec,
      hookSpeakerName: lead.speakerName,
      rationale: h.rationale || '',
      estimatedDurationSec: estDur,
      scenarioBeats: verifiedBeats,
      storyEngagementIdea: h.storyEngagementIdea || null,
      captionIdea: h.captionIdea || null,
      verbatimScore,
    });
  }

  return results.length > 0 ? results : extractHooksLocally(segments, options);
}

/**
 * Main entry for extracting Gold/Silver/Bronze hooks and 100%-verbatim scenarios.
 */
export async function extractHooksAndScenarios(params: {
  segments: VerifiableSegment[];
  settings: AISettings;
  isCombined: boolean;
  combinationGoal?: string;
}): Promise<GeneratedHookDraft[]> {
  const { segments, settings, isCombined, combinationGoal } = params;

  let drafts: GeneratedHookDraft[];
  if (settings.provider !== 'demo' && settings.apiKey) {
    try {
      drafts = await extractHooksWithLLM(segments, settings, { isCombined, combinationGoal });
    } catch (err) {
      console.warn('[aiEngine] LLM hook extraction failed, falling back to local verbatim engine:', err);
      drafts = extractHooksLocally(segments, { isCombined, combinationGoal });
    }
  } else {
    drafts = extractHooksLocally(segments, { isCombined, combinationGoal });
  }

  return drafts.map((h) => {
    const intel = computeViralIntelligence({
      tier: h.tier,
      storyFormat: h.storyFormat,
      specialFormat: h.specialFormat || 'standard',
      title: h.title,
      hookVerbatim: h.hookVerbatim,
      scenarioBeats: h.scenarioBeats,
    });

    return {
      ...h,
      alternativeHooks:
        h.alternativeHooks && h.alternativeHooks.length > 0
          ? h.alternativeHooks
          : generateAlternativeHooksLocally({
              hookSegmentId: h.hookSegmentId,
              bodySegmentIds: h.scenarioBeats.slice(1).map((b) => b.segmentId),
              segments,
              desiredCount: 2,
            }),
      publishingKit:
        h.publishingKit ||
        generatePublishingKitLocally({
          tier: h.tier,
          storyFormat: h.storyFormat,
          title: h.title,
          hookVerbatim: h.hookVerbatim,
          rationale: h.rationale,
          scenarioBeats: h.scenarioBeats,
          captionIdea: h.captionIdea,
          storyEngagementIdea: h.storyEngagementIdea,
        }),
      viralBlueprint: h.viralBlueprint || intel.viralBlueprint,
      specialFormat: h.specialFormat || intel.specialFormat,
      inMediaResCut: h.inMediaResCut !== undefined ? h.inMediaResCut : intel.inMediaResCut,
      viralAudit: h.viralAudit || intel.viralAudit,
      audioMoodGuide: h.audioMoodGuide || intel.audioMoodGuide,
    };
  });
}
