import type {
  AISettings,
  AudioMoodGuide,
  DropoffWarning,
  HookTier,
  InMediaResCut,
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
import type { GeneratedHookDraft } from './aiEngine.ts';

/* ============================================================================
   #13 — VIRAL BLUEPRINT MATCHER
   ============================================================================ */

export function matchViralBlueprint(params: {
  title: string;
  hookVerbatim: string;
  scenarioBeats: ScenarioBeat[];
  specialFormat?: SpecialReelFormat;
}): ViralBlueprintId {
  if (params.specialFormat === 'micro_loop') return 'micro_loop';
  if (params.specialFormat === 'rapid_qa') return 'rapid_qa';

  const fullText = [
    params.title,
    params.hookVerbatim,
    ...params.scenarioBeats.map((b) => b.verbatimText),
  ].join(' ');

  const distinctSpeakers = new Set(params.scenarioBeats.map((b) => b.speakerId)).size;
  if (distinctSpeakers >= 2 && (fullText.includes('؟') || fullText.includes('ببخشید') || fullText.includes('سوال'))) {
    return 'rapid_qa';
  }

  if (
    ['دروغ', 'اشتباه', 'خودکشی', 'گروگان', 'باور', 'قفل', 'سوراخ', 'نود درصد', '۹۰ درصد', '۸۰ درصد'].some((k) =>
      fullText.includes(k)
    )
  ) {
    return 'myth_buster';
  }

  if (
    ['فرمول', 'مرحله', 'روز', 'قدم', 'قانون', 'پلی‌بوک', 'سیستم', 'چک‌لیست', '۷ روز', '۳'].some((k) =>
      fullText.includes(k)
    )
  ) {
    return 'framework';
  }

  if (
    ['تفاوت', 'حرفه‌ای', 'آماتور', 'ادمین', 'برنده', 'بازنده', 'در برابر', 'مقایسه'].some((k) =>
      fullText.includes(k)
    )
  ) {
    return 'amateur_vs_pro';
  }

  if (
    ['قبل', 'بعد', 'دو برابر', 'تغییر', 'از صفر', 'رشد', 'سقف'].some((k) => fullText.includes(k))
  ) {
    return 'before_after';
  }

  if (
    ['تجربه', 'یادم', 'شکست', 'راستش', 'اعتراف', 'خودم', 'مشتری'].some((k) => fullText.includes(k))
  ) {
    return 'vulnerability';
  }

  return 'myth_buster';
}

/* ============================================================================
   #9 — IN-MEDIA-RES MID-SENTENCE CUT DETECTOR
   ============================================================================ */

const PERSIAN_FILLER_PREFIXES: RegExp[] = [
  /^(?:سلام(?:\s+و\s+عرض\s+ادب|\s+دوستان(?:\s+عزیز)?|\s+بچه‌ها)?[\s،.!:—-]*)+/i,
  /^(?:خب[\s،.!]+)?(?:ببینید|دوستان(?:\s+عزیز)?|بچه‌ها|عزیزان|بفرمایید|بذارید\s+(?:یک|یه)\s+(?:چیزی|نکته(?:\s*ای)?)\s+(?:رو\s+)?(?:بگم|بهتون\s+بگم)|راستش\s+(?:رو\s+)?بخواید|می‌خوام\s+امروز|امروز\s+می‌خوام|ببخشید\s+(?:استاد|خانم|آقای)?\s*[^.!؟،]{0,28})[\s،.!:—-]*/i,
  /^(?:خیلی\s+خب|حالا\s+ببینید|دقت\s+کنید|گوش\s+بدید|یه\s+سوال\s+دارم)[\s،.!:—-]*/i,
];

const PUNCH_WORDS = [
  'دروغ', 'اشتباه', 'خودکشی', 'گروگان', 'قفل', 'سوراخ', '۹۰ درصد', 'نود درصد', '۸۰ درصد',
  'هیچ‌وقت', 'بزرگ‌ترین', 'قانون', 'فرمول', 'دو برابر', 'میلیارد', 'قیمت', 'تخفیف', 'گرون',
  'مشتری', 'سیستم', 'پیگیری', 'فروش', 'چرا', 'فقط',
];

export function analyzeInMediaResCut(leadBeat: ScenarioBeat | undefined): InMediaResCut | null {
  if (!leadBeat || !leadBeat.verbatimText) return null;

  const text = leadBeat.verbatimText.trim();
  const beatDur = Math.max(4, leadBeat.endSec - leadBeat.startSec);

  // Strategy 1: Strip recognizable Persian verbal warm-ups / filler prefixes
  let cursor = text;
  let stripped = '';
  for (let pass = 0; pass < 2; pass++) {
    let matchedAny = false;
    for (const rx of PERSIAN_FILLER_PREFIXES) {
      const m = cursor.match(rx);
      if (m && m[0].trim().length >= 3 && cursor.length - m[0].length >= 24) {
        stripped += m[0];
        cursor = cursor.slice(m[0].length).trim();
        matchedAny = true;
      }
    }
    if (!matchedAny) break;
  }

  // Strategy 2: If no explicit greeting prefix, check if the 1st sentence is weak warm-up
  // and the 2nd sentence holds a sharp punchword!
  if (!stripped) {
    const sentences = text.split(/(?<=[.!؟])\s+/).filter(Boolean);
    if (sentences.length >= 2) {
      const first = sentences[0];
      const second = sentences.slice(1).join(' ');
      const firstHasPunch = PUNCH_WORDS.some((w) => first.includes(w));
      const secondHasPunch = PUNCH_WORDS.some((w) => second.includes(w));
      if (!firstHasPunch && secondHasPunch && first.length <= text.length * 0.52) {
        stripped = first + ' ';
        cursor = second.trim();
      }
    }
  }

  if (!stripped.trim() || cursor.length < 18) {
    return {
      hasFillerIntro: false,
      trimmedIntroText: '',
      punchlineVerbatim: text,
      suggestedTrimStartSec: leadBeat.startSec,
      savedSeconds: 0,
      reason: 'قلاب از همان کلمه اول ضربه‌گیر و بدون مقدمه اضافی شروع می‌شود — عالی برای ۳ ثانیه اول!',
    };
  }

  const ratio = Math.min(0.55, Math.max(0.12, stripped.length / Math.max(1, text.length)));
  const savedSeconds = Math.max(1, Math.min(Math.floor(beatDur - 3), Math.round(beatDur * ratio)));
  const suggestedTrimStartSec = Math.min(
    leadBeat.endSec - 2,
    leadBeat.startSec + savedSeconds
  );

  return {
    hasFillerIntro: savedSeconds >= 1,
    trimmedIntroText: stripped.trim(),
    punchlineVerbatim: cursor,
    suggestedTrimStartSec,
    savedSeconds,
    reason: `حذف مقدمه گفتاری ابتدای جمله، ${savedSeconds} ثانیه مرده را حذف می‌کند و ویدیو دقیقاً از کلمه ضربه‌گیر وسط جمله شروع می‌شود.`,
  };
}

/* ============================================================================
   #2 — VIRAL RETENTION & DROP-OFF ANALYZER
   ============================================================================ */

export function analyzeViralRadar(params: {
  tier: HookTier;
  storyFormat: StoryFormat | null;
  specialFormat: SpecialReelFormat;
  title: string;
  hookVerbatim: string;
  scenarioBeats: ScenarioBeat[];
  inMediaResCut: InMediaResCut | null;
  viralBlueprint: ViralBlueprintId;
}): ViralAudit {
  const {
    tier,
    specialFormat,
    hookVerbatim,
    scenarioBeats,
    inMediaResCut,
    viralBlueprint,
  } = params;

  const fullText = scenarioBeats.map((b) => b.verbatimText).join(' ');
  const totalDur = scenarioBeats.reduce((sum, b) => sum + Math.max(4, b.endSec - b.startSec), 0);
  const firstTenWords = hookVerbatim.split(/\s+/).slice(0, 10).join(' ');

  // 1. Hook Hold Score (First 3 seconds)
  let hookHoldScore = 72;
  if (PUNCH_WORDS.some((w) => firstTenWords.includes(w))) hookHoldScore += 14;
  if (/[۰-۹0-9]/.test(firstTenWords)) hookHoldScore += 6;
  if (firstTenWords.includes('؟')) hookHoldScore += 5;
  if (inMediaResCut?.hasFillerIntro) hookHoldScore -= 11;
  if (specialFormat === 'micro_loop') hookHoldScore += 6;
  hookHoldScore = Math.max(48, Math.min(98, hookHoldScore));

  // 2. Retention Pace Score + Beat-by-beat Drop-off Radar
  let retentionPaceScore = 84;
  const dropoffWarnings: DropoffWarning[] = [];
  let elapsed = 0;

  if (inMediaResCut?.hasFillerIntro) {
    dropoffWarnings.push({
      beatOrder: 1,
      atSec: 0,
      severity: 'high',
      issue: `وجود مقدمه کند (${inMediaResCut.savedSeconds} ثانیه اول) باعث رد کردن ویدیو توسط مخاطب سرد می‌شود.`,
      fix: `سوییچ «برش مقدمه اضافه» را فعال کنید تا تدوین دقیقاً از «${inMediaResCut.punchlineVerbatim.slice(0, 42)}...» شروع شود.`,
    });
    retentionPaceScore -= 8;
  }

  scenarioBeats.forEach((beat) => {
    const dur = Math.max(4, beat.endSec - beat.startSec);
    if (dur >= 22) {
      dropoffWarnings.push({
        beatOrder: beat.beatOrder,
        atSec: Math.round(elapsed + 10),
        severity: 'high',
        issue: `برش ${beat.beatOrder} حدود ${dur} ثانیه یکنواخت است (ریسک افت مخاطب در میانه جمله).`,
        fix: `در ثانیه ${Math.round(elapsed + 8)} یک زوم ۱۰٪ (Punch-in) + تغییر رنگ زیرنویس یا B-Roll حضار سالن اضافه کنید.`,
      });
      retentionPaceScore -= 9;
    } else if (dur >= 15 && specialFormat !== 'micro_loop') {
      dropoffWarnings.push({
        beatOrder: beat.beatOrder,
        atSec: Math.round(elapsed + 8),
        severity: 'medium',
        issue: `مدت برش ${beat.beatOrder} (${dur} ثانیه) کمی طولانی‌تر از ریتم تند ریلز است.`,
        fix: 'حذف سکوت‌های نفس‌گیری بین جملات (Jump-cut) و گذاشتن عنوان کوتاه روی صفحه برای ریست چشم مخاطب.',
      });
      retentionPaceScore -= 4;
    }
    elapsed += dur;
  });

  if (scenarioBeats.length >= 3 && totalDur <= 65) retentionPaceScore += 6;
  if (specialFormat === 'rapid_qa') retentionPaceScore += 8;
  if (specialFormat === 'micro_loop' && totalDur <= 16) retentionPaceScore += 10;
  retentionPaceScore = Math.max(52, Math.min(98, retentionPaceScore));

  // 3. Shareability Score (DM Sends)
  let shareabilityScore = 74;
  if (['تیم', 'ادمین', 'شریک', 'مشتری', 'فروش', 'دروغ', 'اشتباه', 'قیمت'].some((w) => fullText.includes(w))) {
    shareabilityScore += 14;
  }
  if (viralBlueprint === 'myth_buster' || viralBlueprint === 'amateur_vs_pro' || viralBlueprint === 'rapid_qa') {
    shareabilityScore += 7;
  }
  if (tier === 'gold') shareabilityScore += 3;
  shareabilityScore = Math.max(55, Math.min(98, shareabilityScore));

  // 4. Saveability Score
  let saveabilityScore = 72;
  if (['فرمول', 'سیستم', 'پلی‌بوک', 'روز', 'قانون', 'مرحله', 'جواب', 'تکنیک'].some((w) => fullText.includes(w))) {
    saveabilityScore += 16;
  }
  if (viralBlueprint === 'framework' || specialFormat === 'micro_loop') {
    saveabilityScore += 8;
  }
  saveabilityScore = Math.max(54, Math.min(98, saveabilityScore));

  const overallScore = Math.round(
    hookHoldScore * 0.34 +
      retentionPaceScore * 0.26 +
      shareabilityScore * 0.22 +
      saveabilityScore * 0.18
  );

  // Actionable Viral Quick Wins
  const quickWins: string[] = [];
  if (inMediaResCut?.hasFillerIntro) {
    quickWins.push(
      `با فعال کردن برش وسط جمله (حذف ${inMediaResCut.savedSeconds} ثانیه مقدمه)، نرخ توقف ۳ ثانیه اول تا حدود ۲۰٪ تقویت می‌شود.`
    );
  }
  if (specialFormat === 'micro_loop') {
    quickWins.push(
      'ویدیو را زیر ۱۵ ثانیه نگه دارید و توضیح تکمیلی را در کپشن بگذارید تا هنگام خواندن کپشن، ویدیو ۲ تا ۳ بار لوپ شود (Watch Time > ۱۵۰٪).'
    );
  } else if (specialFormat === 'rapid_qa') {
    quickWins.push(
      'روی تغییر گوینده از تگ نام کوچک بالا-گوشه و کات صوتی تیز (۰ ثانیه) استفاده کنید تا حس گفت‌وگوی زنده حفظ شود.'
    );
  } else {
    quickWins.push(
      'از ریتم «کات تیز» در پلیر پیش‌شنید استفاده کنید تا مکث‌های خالی بین برش‌ها حذف شود و ضرب‌آهنگ ریلز زنده بماند.'
    );
  }
  if (shareabilityScore >= 82) {
    quickWins.push(
      'پتانسیل ارسال به همکار/شریک بالاست — در ۲ ثانیه پایانی جمله «بفرست برای کسی که باید اینو بشنوه» را روی صفحه بنویسید.'
    );
  } else {
    quickWins.push(
      'در کپشن یک سوال دوگزینه‌ای بگذارید تا بحث در کامنت‌ها شکل بگیرد و پخش الگوریتمی ادامه پیدا کند.'
    );
  }

  const loopSeamNote =
    specialFormat === 'micro_loop'
      ? `برش دقیق در انتهای کلمه پایانی بدون مکث اضافه باعث می‌شود تکرار ویدیو مستقیم به «${hookVerbatim.split(/\s+/).slice(0, 5).join(' ')}...» وصل شود و حس حلقه بی‌پایان بسازد.`
      : null;

  return {
    overallScore,
    hookHoldScore,
    retentionPaceScore,
    shareabilityScore,
    saveabilityScore,
    dropoffWarnings,
    quickWins,
    loopSeamNote,
  };
}

/* ============================================================================
   #12 — AUDIO MOOD & MUSIC DROP GUIDE
   ============================================================================ */

export function buildAudioMoodGuide(params: {
  tier: HookTier;
  viralBlueprint: ViralBlueprintId;
  specialFormat: SpecialReelFormat;
  scenarioBeats: ScenarioBeat[];
}): AudioMoodGuide {
  const { tier, viralBlueprint, specialFormat, scenarioBeats } = params;

  // Pick the most punchy beat & short phrase for the "Music Drop" silence moment
  const dropBeat =
    scenarioBeats.length >= 2
      ? scenarioBeats[1]
      : scenarioBeats[0] || null;
  const dropPhrase = dropBeat
    ? dropBeat.verbatimText.split(/(?<=[.!؟،])\s*/)[0]?.trim().slice(0, 75) || null
    : null;

  if (tier === 'bronze' && specialFormat !== 'rapid_qa') {
    return {
      moodTitle: 'صدای خام و مستند (بدون موزیک یا بسیار ملایم)',
      vibeDescription:
        'در استوری، صدای طبیعی سالن سمینار حس صمیمیت و اعتماد بسیار بالاتری نسبت به موزیک سنگین ایجاد می‌کند.',
      bpmRange: 'بدون موزیک یا Lo-Fi خیلی آرام (۷۵–۸۵ BPM)',
      volumeDbGuide: 'اگر موزیک گذاشتید: ۲۸- تا ۳۲- دسی‌بل (فقط در حد پر کردن فضا)',
      musicDropBeatOrder: null,
      musicDropPhrase: null,
      musicDropReason: 'در استوری نیازی به قطع نمایشی موزیک نیست؛ وضوح صدای سخنران اولویت مطلق است.',
      searchKeywords: ['Soft Ambient Room', 'Minimal Warm Lo-Fi', 'Clean Podcast Bed'],
    };
  }

  if (viralBlueprint === 'myth_buster' || viralBlueprint === 'amateur_vs_pro' || specialFormat === 'micro_loop') {
    return {
      moodTitle: 'تنش کنترل‌شده و ضرب‌آهنگ تیز (Dark Tension Pulse)',
      vibeDescription:
        'بیت مینیمال و کمی جدی که وزن کلام سخنران را بالا می‌برد و حس «افشای یک حقیقت مهم» به مخاطب می‌دهد.',
      bpmRange: '۱۰۰ تا ۱۱۵ BPM (ضرب‌آهنگ پیوسته و تمیز)',
      volumeDbGuide: '۲۰- تا ۲۴- دسی‌بل زیر صدای گوینده (با Ducking روی کلمات کلیدی)',
      musicDropBeatOrder: dropBeat?.beatOrder ?? 1,
      musicDropPhrase: dropPhrase,
      musicDropReason:
        'قطع ناگهانی موزیک برای ۱.۵ ثانیه درست قبل از این جمله + یک افکت ساب‌بیس نرم، بیشترین تمرکز و میخکوب‌شدن مخاطب را می‌سازد.',
      searchKeywords: ['Dark Minimal Tension', 'Cinematic Documentary Pulse', 'Deep Bass Business Reel'],
    };
  }

  if (viralBlueprint === 'rapid_qa') {
    return {
      moodTitle: 'ریتم مدرن و پویا (Snappy Podcast Groove)',
      vibeDescription:
        'موزیک پس‌زمینه سبک و ریتمیک که رفت‌وبرگشت سریع بین دو گوینده را جذاب‌تر می‌کند بدون اینکه روی دیالوگ بیفتد.',
      bpmRange: '۱۰۵ تا ۱۱۸ BPM (ملایم اما پرانرژی)',
      volumeDbGuide: '۲۲- تا ۲۶- دسی‌بل زیر صدای گوینده‌ها (اکولایزر میدرنج موزیک کم شود)',
      musicDropBeatOrder: dropBeat?.beatOrder ?? 2,
      musicDropPhrase: dropPhrase,
      musicDropReason:
        'در لحظه ورود پاسخ کلیدی استاد، مکث کوتاه ۰.۸ ثانیه‌ای موزیک باعث می‌شود جواب مثل ضربه نهایی بنشیند.',
      searchKeywords: ['Upbeat Podcast Background', 'Modern Corporate Groove', 'Clean Tech Beat'],
    };
  }

  if (viralBlueprint === 'vulnerability' || viralBlueprint === 'before_after') {
    return {
      moodTitle: 'الهام‌بخش و پیانوی مینیمال (Warm Cinematic Piano)',
      vibeDescription:
        'فضای احساسی و انسانی که همراه داستان واقعی و تحول کسب‌وکار، ارتباط عمیق و نرخ ذخیره/اشتراک بالا می‌سازد.',
      bpmRange: '۸۰ تا ۹۵ BPM (رشد تدریجی تا اوج پیام)',
      volumeDbGuide: '۲۱- تا ۲۵- دسی‌بل زیر صدای گوینده',
      musicDropBeatOrder: dropBeat?.beatOrder ?? 1,
      musicDropPhrase: dropPhrase,
      musicDropReason:
        'کم شدن ناگهانی موزیک هنگام بیان تجربه شخصی، لحن ویدیو را صمیمی‌تر و باورپذیرتر می‌کند.',
      searchKeywords: ['Emotional Minimal Piano', 'Inspiring Documentary Soft', 'Warm Cinematic Underscore'],
    };
  }

  return {
    moodTitle: 'هوشمند، مدرن و ساختارمند (Clean Executive Beat)',
    vibeDescription:
      'ریتم مرتب و حرفه‌ای که حس «آموزش کاربردی و سیستم‌ساز» می‌دهد و مخاطب را تا پایان مراحل فرمول نگه می‌دارد.',
    bpmRange: '۹۵ تا ۱۰۸ BPM',
    volumeDbGuide: '۲۲- دسی‌بل زیر صدای گوینده',
    musicDropBeatOrder: dropBeat?.beatOrder ?? 1,
    musicDropPhrase: dropPhrase,
    musicDropReason:
      'قطع کوتاه موزیک هنگام اعلام اصل فرمول، سیگنال ذخیره کردن (Save) را در ذهن مخاطب فعال می‌کند.',
    searchKeywords: ['Modern Business Minimal', 'Clean Startup Beat', 'Smart Explainer Background'],
  };
}

/**
 * Compute full viral intelligence bundle for any hook in one cohesive call.
 */
export function computeViralIntelligence(params: {
  tier: HookTier;
  storyFormat: StoryFormat | null;
  specialFormat?: SpecialReelFormat;
  title: string;
  hookVerbatim: string;
  scenarioBeats: ScenarioBeat[];
}): {
  viralBlueprint: ViralBlueprintId;
  specialFormat: SpecialReelFormat;
  inMediaResCut: InMediaResCut | null;
  viralAudit: ViralAudit;
  audioMoodGuide: AudioMoodGuide;
} {
  const specialFormat: SpecialReelFormat = params.specialFormat || 'standard';
  const viralBlueprint = matchViralBlueprint({
    title: params.title,
    hookVerbatim: params.hookVerbatim,
    scenarioBeats: params.scenarioBeats,
    specialFormat,
  });
  const inMediaResCut = analyzeInMediaResCut(params.scenarioBeats[0]);
  const viralAudit = analyzeViralRadar({
    tier: params.tier,
    storyFormat: params.storyFormat,
    specialFormat,
    title: params.title,
    hookVerbatim: params.hookVerbatim,
    scenarioBeats: params.scenarioBeats,
    inMediaResCut,
    viralBlueprint,
  });
  const audioMoodGuide = buildAudioMoodGuide({
    tier: params.tier,
    viralBlueprint,
    specialFormat,
    scenarioBeats: params.scenarioBeats,
  });

  return {
    viralBlueprint,
    specialFormat,
    inMediaResCut,
    viralAudit,
    audioMoodGuide,
  };
}

/* ============================================================================
   #7 — VIRAL MICRO-REEL (7–15s SEAMLESS LOOP) EXTRACTOR
   ============================================================================ */

export async function extractMicroLoopReel(params: {
  segments: VerifiableSegment[];
  existingSegmentIds?: string[];
  settings: AISettings;
}): Promise<GeneratedHookDraft> {
  const { segments, existingSegmentIds = [] } = params;
  if (segments.length === 0) {
    throw new Error('متنی برای استخراج میکرو‌ریلز وجود ندارد.');
  }

  const usedSet = new Set(existingSegmentIds);

  // Score every sentence inside every segment for 7-15 second punchiness & loopability
  interface Candidate {
    seg: VerifiableSegment;
    clause: string;
    startSec: number;
    endSec: number;
    score: number;
  }

  const candidates: Candidate[] = [];

  for (const seg of segments) {
    const segDur = Math.max(8, seg.endSec - seg.startSec);
    const sentences = seg.text
      .split(/(?<=[.!؟])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 28);

    const pieces = sentences.length > 0 ? sentences : [seg.text.trim()];
    let charOffset = 0;

    for (const piece of pieces) {
      const idx = seg.text.indexOf(piece, charOffset);
      const safeIdx = idx >= 0 ? idx : charOffset;
      charOffset = safeIdx + piece.length;

      const startRatio = safeIdx / Math.max(1, seg.text.length);
      const lenRatio = piece.length / Math.max(1, seg.text.length);
      const rawStart = seg.startSec + Math.floor(segDur * startRatio);
      const estLen = Math.max(7, Math.min(15, Math.round(segDur * lenRatio)));
      const clampedStart = Math.max(seg.startSec, Math.min(seg.endSec - 7, rawStart));
      const clampedEnd = Math.min(seg.endSec, Math.max(clampedStart + 7, clampedStart + estLen));

      let score = 0;
      if (piece.length >= 45 && piece.length <= 165) score += 5;
      score += PUNCH_WORDS.reduce((acc, w) => acc + (piece.includes(w) ? 3 : 0), 0);
      if (piece.includes('؟') || piece.includes('!')) score += 2;
      if (!usedSet.has(seg.id)) score += 3;

      candidates.push({
        seg,
        clause: piece,
        startSec: clampedStart,
        endSec: clampedEnd,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
    [
      {
        label: 'میکرو‌ریلز لوپ بی‌پایان (۷ تا ۱۵ ثانیه)',
        segmentId: best.seg.id,
        verbatimText: best.clause,
        editingNote:
          'برش دقیق بدون سکوت در ابتدا و انتها تا ویدیو به شکل حلقه بی‌پایان (Loop) پخش شود؛ متن تکمیلی را در کپشن قرار دهید تا واچ‌تایم بالای ۱۵۰٪ برود.',
      },
    ],
    segments
  );

  // Snap beat timestamps tightly to the 7-15s clause window inside the source segment
  const lead = {
    ...verifiedBeats[0],
    startSec: best.startSec,
    endSec: best.endSec,
  };
  const tightDuration = Math.max(7, Math.min(15, lead.endSec - lead.startSec));

  const shortHeadline =
    lead.verbatimText.split(/[،.!؟]/)[0]?.trim().slice(0, 46) || 'جمله کوبنده سمینار';
  const title = `میکرو‌ریلز لوپ: ${shortHeadline}`;
  const rationale =
    'برش کوتاه ۷ تا ۱۵ ثانیه‌ای با قابلیت تکرار بی‌پایان (Seamless Loop)؛ مخاطب حین خواندن کپشن ویدیو را چند بار می‌بیند و واچ‌تایم به‌شدت جهش می‌کند.';

  const intel = computeViralIntelligence({
    tier: 'silver',
    storyFormat: null,
    specialFormat: 'micro_loop',
    title,
    hookVerbatim: lead.verbatimText,
    scenarioBeats: [lead],
  });

  const publishingKit = generatePublishingKitLocally({
    tier: 'silver',
    storyFormat: null,
    title,
    hookVerbatim: lead.verbatimText,
    rationale,
    scenarioBeats: [lead],
    captionIdea:
      'این جمله فقط ۱۰ ثانیه است اما ارزش کل سمینار را دارد — جزئیات اجرایی را همین پایین بخوان 👇',
    storyEngagementIdea: null,
  });

  const alternativeHooks = generateAlternativeHooksLocally({
    hookSegmentId: lead.segmentId,
    bodySegmentIds: [],
    segments,
    desiredCount: 2,
  });

  return {
    tier: 'silver',
    formatLabel: `میکرو‌ریلز لوپ (${tightDuration} ثانیه)`,
    storyFormat: null,
    title,
    hookVerbatim: lead.verbatimText,
    hookSegmentId: lead.segmentId,
    hookSourceAudioId: lead.sourceAudioId,
    hookSourceAudioTitle: lead.sourceAudioTitle,
    hookStartSec: lead.startSec,
    hookEndSec: lead.endSec,
    hookSpeakerName: lead.speakerName,
    rationale,
    estimatedDurationSec: tightDuration,
    scenarioBeats: [lead],
    alternativeHooks,
    publishingKit,
    viralBlueprint: intel.viralBlueprint,
    specialFormat: 'micro_loop',
    inMediaResCut: intel.inMediaResCut,
    viralAudit: intel.viralAudit,
    audioMoodGuide: intel.audioMoodGuide,
    storyEngagementIdea: null,
    captionIdea: publishingKit.fullCaption,
    verbatimScore,
  };
}

/* ============================================================================
   #8 — RAPID Q&A DIALOGUE CUT EXTRACTOR (2-SPEAKER BACK-AND-FORTH)
   ============================================================================ */

export async function extractRapidQAReel(params: {
  segments: VerifiableSegment[];
  settings: AISettings;
}): Promise<GeneratedHookDraft> {
  const { segments } = params;
  if (segments.length < 2) {
    throw new Error('برای ساخت ریلز مکالمه‌ای حداقل به ۲ بخش گفتاری نیاز است.');
  }

  // Find the sharpest Speaker A -> Speaker B transition (ideally question -> answer!)
  let bestPairIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < segments.length - 1; i++) {
    const q = segments[i];
    const a = segments[i + 1];
    let score = 0;
    if (q.speakerId !== a.speakerId) score += 10;
    if (q.text.includes('؟') || q.text.includes('سوال') || q.text.includes('ببخشید') || q.text.includes('مشکل')) {
      score += 8;
    }
    if (PUNCH_WORDS.some((w) => a.text.includes(w))) score += 5;
    if (a.text.length >= 60) score += 2;
    if (score > bestScore) {
      bestScore = score;
      bestPairIdx = i;
    }
  }

  const startIdx = bestPairIdx >= 0 ? bestPairIdx : 0;
  const chosen: VerifiableSegment[] = [segments[startIdx], segments[startIdx + 1]];

  // Include 3rd rapid beat if it continues the dialogue or punchy conclusion
  if (startIdx + 2 < segments.length) {
    chosen.push(segments[startIdx + 2]);
  }

  const rawBeats = chosen.map((seg, idx) => ({
    label:
      idx === 0
        ? `سوال / چالش زنده (${seg.speakerName})`
        : idx === 1
          ? `پاسخ تیز و مستقیم (${seg.speakerName})`
          : `ضربه نهایی و جمع‌بندی (${seg.speakerName})`,
    segmentId: seg.id,
    verbatimText: seg.text,
    editingNote:
      idx === 0
        ? 'کات سریع روی چهره پرسشگر با برچسب نام؛ زیرنویس سفید برای سوال.'
        : idx === 1
          ? 'تغییر سریع زاویه به سخنران + تغییر رنگ زیرنویس به زرد طلایی بدون مکث بین کات‌ها.'
          : 'جمع‌بندی کوبنده با زوم آرام و نمایش دعوت به کامنت در ۲ ثانیه آخر.',
  }));

  const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(rawBeats, segments);
  const lead = verifiedBeats[0];
  const estDur = verifiedBeats.reduce((acc, b) => acc + Math.max(8, b.endSec - b.startSec), 0);

  const distinctSpeakers = Array.from(new Set(verifiedBeats.map((b) => b.speakerName)));
  const title =
    distinctSpeakers.length >= 2
      ? `ریلز مکالمه‌ای سریع: ${distinctSpeakers[0]} و ${distinctSpeakers[1]}`
      : `ریلز پرسش و پاسخ سریع: ${lead.verbatimText.slice(0, 36)}...`;

  const rationale =
    'ساختار دیالوگ دو نفره (سوال زنده ← پاسخ مستقیم) به دلیل تغییر صدا و ریتم مکالمه‌ای، میانگین زمان تماشا و کامنت را نسبت به تک‌گویی به‌شدت افزایش می‌دهد.';

  const intel = computeViralIntelligence({
    tier: 'gold',
    storyFormat: null,
    specialFormat: 'rapid_qa',
    title,
    hookVerbatim: lead.verbatimText,
    scenarioBeats: verifiedBeats,
  });

  const publishingKit = generatePublishingKitLocally({
    tier: 'gold',
    storyFormat: null,
    title,
    hookVerbatim: lead.verbatimText,
    rationale,
    scenarioBeats: verifiedBeats,
    captionIdea: 'پاسخ زنده وسط سمینار به یکی از پرتکرارترین چالش‌های کسب‌وکارها 👇',
    storyEngagementIdea: null,
  });

  const alternativeHooks = generateAlternativeHooksLocally({
    hookSegmentId: lead.segmentId,
    bodySegmentIds: verifiedBeats.slice(1).map((b) => b.segmentId),
    segments,
    desiredCount: 2,
  });

  return {
    tier: 'gold',
    formatLabel: 'ریلز مکالمه‌ای سریع (Q&A)',
    storyFormat: null,
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
    viralBlueprint: 'rapid_qa',
    specialFormat: 'rapid_qa',
    inMediaResCut: intel.inMediaResCut,
    viralAudit: intel.viralAudit,
    audioMoodGuide: intel.audioMoodGuide,
    storyEngagementIdea: null,
    captionIdea: publishingKit.fullCaption,
    verbatimScore,
  };
}
