import { v4 as uuidv4 } from 'uuid';
import type {
  AISettings,
  CarouselSlide,
  HookTier,
  HookVariant,
  HookWithScenario,
  PublishingKit,
  ScenarioBeat,
  StoryFormat,
  StoryStickerCue,
} from './types.ts';
import { verifyAndSnapBeats, type VerifiableSegment } from './verbatimValidator.ts';
import { callOpenAICompatibleChat } from './llmClient.ts';

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/* ============================================================================
   1. A/B ALTERNATIVE VERBATIM HOOKS GENERATOR (Local + Gemini + OpenAI)
   ============================================================================ */

const VARIANT_ANGLES = [
  {
    angleLabel: 'زاویه چالشی و متضاد',
    whyItWorks:
      'با به چالش کشیدن باور رایج مخاطب در ۲ ثانیه اول، اسکرول را متوقف می‌کند؛ عالی برای تریال ریلز.',
    keywords: ['دروغ', 'اشتباه', 'خودکشی', 'گروگان', 'هیچ‌وقت', 'سوراخ', 'قفل', 'مقصر', 'نود درصد', '۸۰ درصد'],
  },
  {
    angleLabel: 'زاویه سوالی و درگیرکننده',
    whyItWorks:
      'مستقیماً ذهن کارآفرین را درگیر می‌کند تا برای شنیدن پاسخ تا انتهای ویدیو بماند.',
    keywords: ['چرا', '؟', 'فکر می‌کنید', 'چطور', 'ببخشید', 'سوال', 'مشتری', 'اعتراض', 'قیمت'],
  },
  {
    angleLabel: 'زاویه عددی و اجرایی',
    whyItWorks:
      'وعده راهکار ملموس و عدددار می‌دهد که نرخ ذخیره (Save) و اشتراک‌گذاری را بالا می‌برد.',
    keywords: ['فرمول', 'سیستم', 'پلی‌بوک', 'روز', 'دو برابر', 'درصد', 'ثانیه', 'دقیقه', 'فردا صبح', 'میلیارد'],
  },
];

export function generateAlternativeHooksLocally(params: {
  hookSegmentId: string;
  bodySegmentIds: string[];
  segments: VerifiableSegment[];
  excludeSegmentIds?: string[];
  desiredCount?: number;
}): HookVariant[] {
  const {
    hookSegmentId,
    bodySegmentIds,
    segments,
    excludeSegmentIds = [],
    desiredCount = 2,
  } = params;

  if (segments.length <= 1) return [];

  const bodySet = new Set(bodySegmentIds);
  const excludeSet = new Set([hookSegmentId, ...excludeSegmentIds]);

  // Prefer segments not currently the primary hook; prefer ones not already in the body first,
  // then fall back to any other segment in the audio/combination so we always have sharp options.
  const primaryPool = segments.filter((s) => !excludeSet.has(s.id) && !bodySet.has(s.id));
  const fallbackPool = segments.filter((s) => !excludeSet.has(s.id));
  const pool = primaryPool.length >= desiredCount ? primaryPool : fallbackPool;

  const chosenIds = new Set<string>();
  const variants: HookVariant[] = [];

  for (let angleIdx = 0; angleIdx < VARIANT_ANGLES.length && variants.length < desiredCount; angleIdx++) {
    const angle = VARIANT_ANGLES[angleIdx];
    const ranked = pool
      .filter((s) => !chosenIds.has(s.id))
      .map((seg) => {
        const kwScore = angle.keywords.reduce((acc, kw) => acc + (seg.text.includes(kw) ? 3 : 0), 0);
        const punchiness = seg.text.length >= 45 && seg.text.length <= 260 ? 2 : 1;
        return { seg, score: kwScore + punchiness };
      })
      .sort((a, b) => b.score - a.score);

    const picked = ranked[0]?.seg;
    if (!picked) break;
    chosenIds.add(picked.id);

    const { verifiedBeats } = verifyAndSnapBeats(
      [
        {
          label: angle.angleLabel,
          segmentId: picked.id,
          verbatimText: picked.text,
          editingNote: '',
        },
      ],
      segments
    );

    const snapped = verifiedBeats[0];
    if (!snapped) continue;

    variants.push({
      id: uuidv4(),
      angleLabel: angle.angleLabel,
      whyItWorks: angle.whyItWorks,
      segmentId: snapped.segmentId,
      sourceAudioId: snapped.sourceAudioId,
      sourceAudioTitle: snapped.sourceAudioTitle,
      speakerId: snapped.speakerId,
      speakerName: snapped.speakerName,
      startSec: snapped.startSec,
      endSec: snapped.endSec,
      verbatimText: snapped.verbatimText,
      verifiedVerbatim: snapped.verifiedVerbatim,
    });
  }

  return variants;
}

export async function generateAlternativeHooks(params: {
  hook: Pick<HookWithScenario, 'title' | 'tier' | 'hookSegmentId' | 'hookVerbatim' | 'scenarioBeats'>;
  segments: VerifiableSegment[];
  settings: AISettings;
  excludeSegmentIds?: string[];
}): Promise<HookVariant[]> {
  const { hook, segments, settings, excludeSegmentIds = [] } = params;
  const bodySegmentIds = hook.scenarioBeats.slice(1).map((b) => b.segmentId);

  if (settings.provider !== 'demo' && settings.apiKey && segments.length > 2) {
    try {
      const transcriptLines = segments
        .map(
          (s) =>
            `[SEG_ID=${s.id} | فایل=${s.audioTitle} | زمان=${s.startSec}s-${s.endSec}s | گوینده=${s.speakerName}]: ${s.text}`
        )
        .join('\n');

      const bodySummary = hook.scenarioBeats
        .slice(1)
        .map((b) => `- (${b.label}): ${b.verbatimText}`)
        .join('\n');

      const prompt = `شما استراتژیست ارشد تست A/B قلاب اینستاگرام (ریلز و تریال ریلز) هستید.
برای سناریوی زیر، قلاب فعلی این است:
«${hook.hookVerbatim}» (SEG_ID=${hook.hookSegmentId})

بدنه ثابت سناریو:
${bodySummary || 'همین سناریو'}

حالا ۲ قلاب جایگزین **متفاوت از SEG_ID فعلی** از داخل متن اصلی سمینار انتخاب کن که وقتی روی همین بدنه قرار می‌گیرند، برای تست A/B بهترین عملکرد را داشته باشند.
قانون مطلق: \`verbatimText\` باید **دقیقاً کلمه به کلمه بدون هیچ تغییری** از یکی از SEG_IDهای زیر کپی شود.

متن تفکیک‌شده:
${transcriptLines}

فقط JSON معتبر برگردان:
{
  "variants": [
    {
      "angleLabel": "مثلاً زاویه چالشی / زاویه سوالی / زاویه عددی",
      "whyItWorks": "توضیح کوتاه ۱ جمله‌ای چرا برای تست A/B مناسب است",
      "segmentId": "دقیقاً یکی از SEG_IDهای بالا (غیر از قلاب فعلی)",
      "verbatimText": "عین جمله از همان segmentId بدون هیچ تغییر"
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
            generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
          }),
        });
        if (!res.ok) throw new Error(`Gemini AB hook error (${res.status})`);
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        rawText = await callOpenAICompatibleChat(settings, {
          temperature: 0.3,
          jsonMode: true,
          messages: [
            { role: 'system', content: 'Output strictly valid JSON in Persian. Keep verbatimText 100% unmodified.' },
            { role: 'user', content: prompt },
          ],
        });
      }

      const parsed = safeJsonParse<{
        variants?: Array<{
          angleLabel: string;
          whyItWorks: string;
          segmentId: string;
          verbatimText: string;
        }>;
      }>(rawText);

      if (parsed?.variants?.length) {
        const verified: HookVariant[] = [];
        for (const v of parsed.variants.slice(0, 3)) {
          if (v.segmentId === hook.hookSegmentId) continue;
          const { verifiedBeats } = verifyAndSnapBeats(
            [{ label: v.angleLabel || 'قلاب جایگزین', segmentId: v.segmentId, verbatimText: v.verbatimText, editingNote: '' }],
            segments
          );
          const b = verifiedBeats[0];
          if (!b || b.segmentId === hook.hookSegmentId) continue;
          verified.push({
            id: uuidv4(),
            angleLabel: v.angleLabel || 'زاویه جایگزین',
            whyItWorks: v.whyItWorks || 'مناسب برای تست نرخ توقف مخاطب در ۳ ثانیه اول.',
            segmentId: b.segmentId,
            sourceAudioId: b.sourceAudioId,
            sourceAudioTitle: b.sourceAudioTitle,
            speakerId: b.speakerId,
            speakerName: b.speakerName,
            startSec: b.startSec,
            endSec: b.endSec,
            verbatimText: b.verbatimText,
            verifiedVerbatim: b.verifiedVerbatim,
          });
        }
        if (verified.length > 0) return verified;
      }
    } catch (err) {
      console.warn('[hookEnricher] LLM AB variant generation failed, falling back to local:', err);
    }
  }

  return generateAlternativeHooksLocally({
    hookSegmentId: hook.hookSegmentId,
    bodySegmentIds,
    segments,
    excludeSegmentIds,
    desiredCount: 2,
  });
}

/* ============================================================================
   2. PUBLISHING KIT GENERATOR (Cover Titles, On-Screen Hook, Caption, Stickers)
   ============================================================================ */

function detectTopicKeyword(fullText: string): {
  ctaKeyword: string;
  topicTag: string;
  hashtags: string[];
} {
  if (fullText.includes('پیگیری') || fullText.includes('۷ روز') || fullText.includes('دایرکت')) {
    return {
      ctaKeyword: 'پیگیری',
      topicTag: 'سیستم پیگیری و تبدیل لید',
      hashtags: ['#فروش_حرفه_ای', '#سیستم_پیگیری', '#بیزنس_کوچینگ', '#فروش_اینستاگرامی', '#افزایش_فروش'],
    };
  }
  if (fullText.includes('قیمت') || fullText.includes('گرون') || fullText.includes('تخفیف') || fullText.includes('ادمین')) {
    return {
      ctaKeyword: 'قیمت',
      topicTag: 'مدیریت اعتراض قیمت و ادمین فروش',
      hashtags: ['#اعتراض_قیمت', '#ادمین_فروش', '#آموزش_فروش', '#بیزنس_کوچینگ', '#مذاکره_فروش'],
    };
  }
  if (fullText.includes('تیم') || fullText.includes('نیرو') || fullText.includes('پلی‌بوک') || fullText.includes('سیستم')) {
    return {
      ctaKeyword: 'سیستم',
      topicTag: 'سیستم‌سازی و رشد کسب‌وکار',
      hashtags: ['#سیستم_سازی', '#مدیریت_کسب_و_کار', '#رشد_فروش', '#بیزنس_کوچینگ', '#کارآفرینی'],
    };
  }
  return {
    ctaKeyword: 'سمینار',
    topicTag: 'رشد و استراتژی فروش',
    hashtags: ['#بیزنس_کوچینگ', '#استراتژی_فروش', '#رشد_کسب_و_کار', '#کارآفرینی', '#فروش_موفق'],
  };
}

function buildCompactOnScreenHook(title: string, hookVerbatim: string): string {
  const firstClause = hookVerbatim
    .split(/[.!؟،]/)[0]
    ?.trim();
  if (firstClause && firstClause.length >= 16 && firstClause.length <= 68) {
    return firstClause;
  }
  const cleanTitle = title.replace(/^[^آ-یa-zA-Z0-9]+/, '').trim();
  return cleanTitle.length <= 65 ? cleanTitle : `${cleanTitle.slice(0, 62)}...`;
}

export function generatePublishingKitLocally(params: {
  tier: HookTier;
  storyFormat: StoryFormat | null;
  title: string;
  hookVerbatim: string;
  rationale: string;
  scenarioBeats: ScenarioBeat[];
  captionIdea: string | null;
  storyEngagementIdea: string | null;
}): PublishingKit {
  const {
    tier,
    storyFormat,
    title,
    hookVerbatim,
    scenarioBeats,
    captionIdea,
    storyEngagementIdea,
  } = params;

  const fullText = [title, hookVerbatim, ...scenarioBeats.map((b) => b.verbatimText)].join(' ');
  const { ctaKeyword, topicTag, hashtags } = detectTopicKeyword(fullText);
  const shortCoreTitle = title.split(':')[0].split('—')[0].trim();

  const coverTitles =
    tier === 'gold'
      ? [
          shortCoreTitle.length <= 36 ? shortCoreTitle : `${shortCoreTitle.slice(0, 34)}...`,
          `راز ${topicTag} که کمتر کسی میگه`,
          `چرا ۹۰٪ کسب‌وکارها اینجا گیر می‌کنن؟`,
        ]
      : tier === 'silver'
        ? [
            shortCoreTitle.length <= 36 ? shortCoreTitle : `${shortCoreTitle.slice(0, 34)}...`,
            `قبل از تصمیم بعدی این ۶۰ ثانیه رو ببین`,
            `اشتباهی که فروش پیجت رو قفل کرده`,
          ]
        : [
            shortCoreTitle.length <= 34 ? shortCoreTitle : `${shortCoreTitle.slice(0, 32)}...`,
            `پشت‌پرده واقعی از سالن سمینار`,
            `این یه نکته رو فردا صبح اجرا کن`,
          ];

  const onScreenHook = buildCompactOnScreenHook(title, hookVerbatim);

  const commentCtaLine =
    tier === 'bronze'
      ? `کلمه «${ctaKeyword}» رو ریپلای کن تا چک‌لیست اجرایی این بخش برات ارسال بشه 👇`
      : `کلمه «${ctaKeyword}» رو همین زیر کامنت کن تا چک‌لیست کامل ${topicTag} برات دایرکت بشه 👇`;

  const beatTakeaways = scenarioBeats.slice(0, 3).map((b, i) => {
    const firstLine = b.verbatimText.split(/(?<=[.!؟])\s+/)[0]?.trim() || b.verbatimText;
    const trimmed = firstLine.length > 95 ? `${firstLine.slice(0, 92)}...` : firstLine;
    return `${i === 0 ? '⚡' : i === 1 ? '🎯' : '✅'} ${trimmed}`;
  });

  const fullCaption =
    tier === 'bronze'
      ? [
          `📌 متن مکمل همراه استوری (${topicTag}):`,
          '',
          storyEngagementIdea || `این بخش از سمینار دقیقاً دست گذاشت روی یکی از مهم‌ترین چالش‌های روزمره کسب‌وکارها.`,
          '',
          commentCtaLine,
        ].join('\n')
      : [
          `${title} 🔥`,
          '',
          captionIdea ||
            `بخشی از سخنرانی زنده سمینار درباره «${topicTag}» — دقیقاً همون نقطه‌ای که فرق تیم‌های معمولی و پرفروش رو می‌سازه:`,
          '',
          ...beatTakeaways,
          '',
          `💾 این پست رو ذخیره کن که موقع اجرای تیمی دوباره ببینی و برای شریک یا ادمینت بفرست.`,
          '',
          commentCtaLine,
          '',
          hashtags.join(' '),
        ].join('\n');

  // Build slide-by-slide interactive stickers
  const storyStickers: StoryStickerCue[] = [];
  if (tier === 'bronze') {
    if (storyFormat === 'story_sequence' && scenarioBeats.length > 1) {
      scenarioBeats.forEach((beat, idx) => {
        if (idx === 0) {
          storyStickers.push({
            slideOrder: 1,
            stickerType: 'poll',
            stickerLabel: 'استیکر نظرسنجی (شروع تعامل)',
            promptText: `تو کسب‌وکار شما هم دقیقاً همین چالش وجود داره؟`,
            options: ['دقیقاً درگیرشیم ✋', 'نه، حلش کردیم ✅'],
          });
        } else if (idx === scenarioBeats.length - 1) {
          storyStickers.push({
            slideOrder: idx + 1,
            stickerType: 'dm_reply',
            stickerLabel: 'دعوت به ریپلای / دایرکت',
            promptText: `کلمه «${ctaKeyword}» رو ریپلای کن تا فایل کاملش بیاد دایرکتت`,
          });
        } else if (idx === 1) {
          storyStickers.push({
            slideOrder: 2,
            stickerType: 'slider',
            stickerLabel: 'اسلایدر واکنش',
            promptText: `این جمله چقدر با واقعیت تیم فروش شما می‌خونه؟ 🔥`,
          });
        } else {
          storyStickers.push({
            slideOrder: idx + 1,
            stickerType: 'question',
            stickerLabel: 'باکس سوال (جمع‌آوری سوژه)',
            promptText: `بزرگ‌ترین چالش شما توی «${beat.label.split('—')[0].trim()}» چیه؟`,
          });
        }
      });
    } else {
      storyStickers.push({
        slideOrder: 1,
        stickerType: 'poll',
        stickerLabel: 'استیکر نظرسنجی سریع',
        promptText: storyEngagementIdea
          ? storyEngagementIdea.slice(0, 95)
          : `شما هم تا حالا با این چالش درگیر بودین؟`,
        options: ['بله دقیقاً 🔥', 'برامون بگو چیکار کنیم 👇'],
      });
    }
  } else {
    // Promo story sticker for sharing a Gold / Silver reel to Story
    storyStickers.push({
      slideOrder: 1,
      stickerType: 'poll',
      stickerLabel: 'استوری پروموت ریلز (بازنشر)',
      promptText: `پست جدید اومد! به نظرت اصلی‌ترین دلیلش چیه؟ 👇`,
      options: ['می‌رم الان می‌بینم 🔥', 'ذخیره‌ش کردم 💾'],
    });
  }

  const carouselSlides = generateCarouselSlidesLocally({
    title,
    hookVerbatim,
    scenarioBeats,
    coverTitle: coverTitles[0] || title,
    ctaKeyword,
    commentCtaLine,
  });

  return {
    coverTitles,
    onScreenHook,
    fullCaption,
    commentCtaKeyword: ctaKeyword,
    commentCtaLine,
    storyStickers,
    carouselSlides,
  };
}

function formatSecShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Convert any verbatim seminar scenario into a punchy 5–7 slide Instagram Carousel Deck.
 */
export function generateCarouselSlidesLocally(params: {
  title: string;
  hookVerbatim: string;
  scenarioBeats: ScenarioBeat[];
  coverTitle?: string;
  ctaKeyword?: string;
  commentCtaLine?: string;
}): CarouselSlide[] {
  const { title, hookVerbatim, scenarioBeats, coverTitle, ctaKeyword, commentCtaLine } = params;
  const slides: CarouselSlide[] = [];

  // Slide 1: High-CTR Cover Slide
  const cleanCover = (coverTitle || title).split('—')[0].trim();
  const leadClause = hookVerbatim.split(/(?<=[.!؟])\s+/)[0]?.trim() || hookVerbatim;
  slides.push({
    slideNumber: 1,
    role: 'cover',
    roleLabel: 'اسلاید ۱ · کاور کلیک‌خور',
    headline: cleanCover,
    bodyText:
      leadClause.length > 105 ? `${leadClause.slice(0, 102)}...` : leadClause,
    designCue:
      'پس‌زمینه تیره با تصویر سخنران + تیتر بسیار درشت و عبارت «ورق بزن ←» در گوشه پایین',
    sourceTimecode: scenarioBeats[0]
      ? `${formatSecShort(scenarioBeats[0].startSec)}-${formatSecShort(scenarioBeats[0].endSec)}`
      : undefined,
  });

  // Middle slides: Distill each beat into clean scannable insight slides (split long beats if needed)
  let slideCounter = 2;
  for (let i = 0; i < scenarioBeats.length && slideCounter <= 6; i++) {
    const beat = scenarioBeats[i];
    const sentences = beat.verbatimText
      .split(/(?<=[.!؟])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const headline =
      sentences[0] && sentences[0].length <= 85
        ? sentences[0]
        : beat.label.split('—')[0].trim();
    const rest =
      sentences.length > 1
        ? sentences.slice(1).join(' ')
        : sentences[0] || beat.verbatimText;

    slides.push({
      slideNumber: slideCounter,
      role: i === 0 ? 'hook' : i === scenarioBeats.length - 1 ? 'example' : 'insight',
      roleLabel: `اسلاید ${slideCounter} · ${beat.label.split('—')[0].trim()}`,
      headline: headline.length > 92 ? `${headline.slice(0, 89)}...` : headline,
      bodyText: rest.length > 210 ? `${rest.slice(0, 207)}...` : rest,
      designCue:
        i % 2 === 0
          ? 'چیدمان تایپوگرافی مینیمال؛ کلمه کلیدی با رنگ طلایی هایلایت شود'
          : 'باکس نقل‌قول با نام گوینده و خط جداکننده عمودی برای خوانایی سریع',
      sourceTimecode: `${formatSecShort(beat.startSec)}-${formatSecShort(beat.endSec)}`,
    });
    slideCounter++;

    // If only 1 beat exists (e.g. Micro-Loop or Single Story) and has 2+ sentences, create an extra actionable slide
    if (scenarioBeats.length === 1 && sentences.length >= 2 && slideCounter <= 4) {
      slides.push({
        slideNumber: slideCounter,
        role: 'insight',
        roleLabel: `اسلاید ${slideCounter} · نکته اجرایی کلیدی`,
        headline: 'چطور از فردا صبح اجراش کنیم؟',
        bodyText: sentences.slice(1).join(' '),
        designCue: 'لیست کوتاه بولت‌دار با آیکون تیک برای افزایش نرخ ذخیره (Save)',
      });
      slideCounter++;
    }
  }

  // Final Slide: Save + Share + DM Keyword CTA
  slides.push({
    slideNumber: slideCounter,
    role: 'cta',
    roleLabel: `اسلاید ${slideCounter} · جمع‌بندی و دعوت به اقدام (CTA)`,
    headline: 'این اسلایدها رو ذخیره کن و برای هم‌تیمی‌هات بفرست 💾',
    bodyText:
      commentCtaLine ||
      `کلمه «${ctaKeyword || 'سمینار'}» رو زیر همین پست کامنت کن تا چک‌لیست کامل این بخش برات دایرکت بشه.`,
    designCue: 'پس‌زمینه کنتراست بالا با دکمه گرافیکی «ذخیره کن» + کلیدواژه درشت وسط کادر',
  });

  return slides;
}

export async function generateCarouselSlides(params: {
  hook: Pick<HookWithScenario, 'title' | 'hookVerbatim' | 'scenarioBeats' | 'publishingKit'>;
  settings: AISettings;
}): Promise<CarouselSlide[]> {
  const { hook, settings } = params;
  const fallback = generateCarouselSlidesLocally({
    title: hook.title,
    hookVerbatim: hook.hookVerbatim,
    scenarioBeats: hook.scenarioBeats,
    coverTitle: hook.publishingKit?.coverTitles?.[0],
    ctaKeyword: hook.publishingKit?.commentCtaKeyword || undefined,
    commentCtaLine: hook.publishingKit?.commentCtaLine || undefined,
  });

  if (settings.provider !== 'demo' && settings.apiKey) {
    try {
      const beatsText = hook.scenarioBeats
        .map((b) => `[برش ${b.beatOrder} - ${b.label}]: ${b.verbatimText}`)
        .join('\n');

      const prompt = `شما طراح محتوای پست اسلایدی (کاروسل اینستاگرام) برای پیج‌های بیزنس کوچینگ فارسی هستید.
بر اساس سناریوی زیر، یک پست کاروسل ۵ تا ۷ اسلایدی با نرخ ذخیره (Save) بسیار بالا بنویس.
اسلاید ۱ باید کاور کلیک‌خور باشد، اسلایدهای میانی نکات اصلی را با متن کوتاه و تیز منتقل کنند، و اسلاید آخر دعوت به ذخیره و کامنت کلیدواژه باشد.

عنوان: ${hook.title}
متن سناریو:
${beatsText}

فقط JSON معتبر برگردان:
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover" | "hook" | "insight" | "example" | "cta",
      "roleLabel": "اسلاید ۱ · کاور",
      "headline": "تیتر کوتاه و درشت اسلاید",
      "bodyText": "متن کوتاه و خوانای اسلاید (۱ تا ۳ خط)",
      "designCue": "پیشنهاد چیدمان گرافیکی برای طراح"
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
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
          }),
        });
        if (!res.ok) throw new Error(`Gemini carousel error (${res.status})`);
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        rawText = await callOpenAICompatibleChat(settings, {
          temperature: 0.4,
          jsonMode: true,
          messages: [
            { role: 'system', content: 'Output strictly valid JSON in Persian for Instagram carousel slides.' },
            { role: 'user', content: prompt },
          ],
        });
      }

      const parsed = safeJsonParse<{ slides?: CarouselSlide[] }>(rawText);
      if (parsed?.slides && parsed.slides.length >= 3) {
        return parsed.slides.map((s, idx) => ({
          slideNumber: idx + 1,
          role: s.role || (idx === 0 ? 'cover' : idx === parsed.slides!.length - 1 ? 'cta' : 'insight'),
          roleLabel: s.roleLabel || `اسلاید ${idx + 1}`,
          headline: String(s.headline || ''),
          bodyText: String(s.bodyText || ''),
          designCue: String(s.designCue || 'چیدمان تمیز با کنتراست بالا'),
        }));
      }
    } catch (err) {
      console.warn('[hookEnricher] LLM carousel generation failed, using local:', err);
    }
  }

  return fallback;
}

export async function generatePublishingKit(params: {
  hook: Pick<
    HookWithScenario,
    | 'tier'
    | 'storyFormat'
    | 'formatLabel'
    | 'title'
    | 'hookVerbatim'
    | 'rationale'
    | 'scenarioBeats'
    | 'captionIdea'
    | 'storyEngagementIdea'
  >;
  settings: AISettings;
}): Promise<PublishingKit> {
  const { hook, settings } = params;

  if (settings.provider !== 'demo' && settings.apiKey) {
    try {
      const beatsText = hook.scenarioBeats
        .map((b) => `[برش ${b.beatOrder} - ${b.label}]: ${b.verbatimText}`)
        .join('\n');

      const prompt = `شما ادمین ارشد و استراتژیست انتشار اینستاگرام برای پیج‌های بیزنس کوچینگ فارسی هستید.
برای سناریوی زیر (دسته: ${hook.tier} / فرمت: ${hook.formatLabel}) یک «پکیج آماده انتشار» حرفه‌ای، طبیعی، غیرکلیشه‌ای و آماده کپی تولید کن:

عنوان: ${hook.title}
قلاب: ${hook.hookVerbatim}
متن کامل سناریو:
${beatsText}

فقط JSON معتبر با ساختار زیر برگردان:
{
  "coverTitles": ["تیتر کوتاه کاور ۱ (حداکثر ۶ کلمه)", "تیتر کوتاه کاور ۲", "تیتر کوتاه کاور ۳"],
  "onScreenHook": "متن درشت ۳ ثانیه اول روی ویدیو (حداکثر ۱۰ کلمه، ضربه‌گیر و خوانا)",
  "fullCaption": "کپشن کامل و حرفه‌ای فارسی همراه با خلاصه ارزش، دعوت به ذخیره و اشتراک‌گذاری، CTA کامنتی و ۵ هشتگ مرتبط",
  "commentCtaKeyword": "یک کلمه کوتاه فارسی برای اتوماسیون دایرکت (مثلاً سیستم یا پیگیری)",
  "commentCtaLine": "جمله کامل دعوت به کامنت/ریپلای با همان کلیدواژه",
  "storyStickers": [
    {
      "slideOrder": 1,
      "stickerType": "poll" | "slider" | "question" | "dm_reply",
      "stickerLabel": "عنوان نوع استیکر به فارسی",
      "promptText": "متن دقیق روی استیکر",
      "options": ["گزینه ۱", "گزینه ۲"]
    }
  ]
}
نکته: اگر سناریو رشته استوری است، به ازای هر اسلاید (یا حداقل ۳ اسلاید کلیدی) استیکر اختصاصی پیشنهاد بده.`;

      let rawText = '';
      if (settings.provider === 'gemini') {
        const model = settings.geminiModel || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.45, responseMimeType: 'application/json' },
          }),
        });
        if (!res.ok) throw new Error(`Gemini publishing kit error (${res.status})`);
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        rawText = await callOpenAICompatibleChat(settings, {
          temperature: 0.45,
          jsonMode: true,
          messages: [
            { role: 'system', content: 'Output strictly valid JSON in Persian for Instagram publishing.' },
            { role: 'user', content: prompt },
          ],
        });
      }

      const parsed = safeJsonParse<Partial<PublishingKit>>(rawText);
      if (parsed?.coverTitles?.length && parsed.fullCaption) {
        const carouselSlides = generateCarouselSlidesLocally({
          title: hook.title,
          hookVerbatim: hook.hookVerbatim,
          scenarioBeats: hook.scenarioBeats,
          coverTitle: String(parsed.coverTitles[0]),
          ctaKeyword: parsed.commentCtaKeyword ? String(parsed.commentCtaKeyword) : undefined,
          commentCtaLine: parsed.commentCtaLine ? String(parsed.commentCtaLine) : undefined,
        });

        return {
          coverTitles: parsed.coverTitles.slice(0, 3).map(String),
          onScreenHook: String(parsed.onScreenHook || buildCompactOnScreenHook(hook.title, hook.hookVerbatim)),
          fullCaption: String(parsed.fullCaption),
          commentCtaKeyword: parsed.commentCtaKeyword ? String(parsed.commentCtaKeyword) : null,
          commentCtaLine: parsed.commentCtaLine ? String(parsed.commentCtaLine) : null,
          storyStickers: Array.isArray(parsed.storyStickers) ? parsed.storyStickers : [],
          carouselSlides,
        };
      }
    } catch (err) {
      console.warn('[hookEnricher] LLM publishing kit failed, falling back to local:', err);
    }
  }

  return generatePublishingKitLocally(hook);
}
