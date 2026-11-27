import path from 'node:path';
import {
  UPLOADS_DIR,
  buildMergedTimeline,
  createAudioWithDiarization,
  createCombinationRecord,
  createProject,
  listProjects,
  replaceHooksForSource,
} from './db.ts';
import { generateDemoWav } from './audioUtils.ts';
import { SPEAKER_COLORS, type GeneratedHookDraft } from './aiEngine.ts';
import { verifyAndSnapBeats, type VerifiableSegment } from './verbatimValidator.ts';
import type { TranscriptSegment } from './types.ts';

function toVerifiable(
  segments: TranscriptSegment[],
  audioTitle: string
): VerifiableSegment[] {
  return segments.map((s) => ({
    id: s.id,
    audioFileId: s.audioFileId,
    audioTitle,
    speakerId: s.speakerId,
    speakerName: s.speakerName || 'گوینده',
    startSec: s.startSec,
    endSec: s.endSec,
    text: s.text,
  }));
}

export function seedInitialDataIfEmpty(): void {
  const existing = listProjects();
  if (existing.length > 0) return;

  const project = createProject({
    title: 'سمینار خرداد ماه ۱۴۰۵ — معماری فروش و سیستم‌سازی',
    eventDate: '۱۴۰۵/۰۳/۱۸',
    description:
      'همایش یک‌روزه بیزنس کوچینگ با حضور ۲۴۰ صاحب کسب‌وکار در سالن همایش‌های رازی؛ شامل سه پارت سخنرانی اصلی، کوچینگ زنده و پرسش و پاسخ.',
  });

  // ---------------- PART 1 ----------------
  const part1Filename = 'seed-khordad-part1.wav';
  const part1Path = path.join(UPLOADS_DIR, part1Filename);
  const part1Size = generateDemoWav(part1Path, 168, [0, 22, 46, 68, 94, 122, 146]);

  const part1Title = 'پارت ۱ — افتتاحیه و شکستن سقف شیشه‌ای فروش';
  const p1 = createAudioWithDiarization({
    projectId: project.id,
    title: part1Title,
    originalFilename: 'khordad-seminar-part1-opening.wav',
    storedFilename: part1Filename,
    mimeType: 'audio/wav',
    fileSize: part1Size,
    durationSec: 168,
    analysisMode: 'demo',
    speakers: [
      {
        speakerKey: 'SPEAKER_1',
        displayName: 'آرش راد (بیزنس کوچ)',
        detectedName: 'آرش راد',
        detectedRole: 'بیزنس کوچ / سخنران اصلی',
        detectionEvidence: 'تشخیص از معرفی در متن: «من آرش راد هستم و دوازده ساله...»',
        color: SPEAKER_COLORS[0],
      },
      {
        speakerKey: 'SPEAKER_2',
        displayName: 'امیرحسین نادری (مخاطب)',
        detectedName: 'امیرحسین نادری',
        detectedRole: 'صاحب برند پوشاک',
        detectionEvidence: 'تشخیص از معرفی در متن: «من امیرحسین نادری هستم» و خطاب «آقای نادری»',
        color: SPEAKER_COLORS[1],
      },
    ],
    segments: [
      {
        speakerKey: 'SPEAKER_1',
        startSec: 0,
        endSec: 22,
        text: 'سلام به همه کارآفرین‌های جسور سالن؛ من آرش راد هستم و دوازده ساله کنار صاحبان کسب‌وکار می‌شینم. بذارید همین اول یک حقیقت تلخ بگم: ۹۰ درصد کسب‌وکارها به خاطر کمبود مشتری ورشکست نمیشن، به خاطر مدیریت اشتباهِ همین مشتری‌های فعلی زمین می‌خورن.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 22,
        endSec: 46,
        text: 'وقتی خودِ صاحب کسب‌وکار هم فروشنده است، هم مدیر مالیه، هم پاسخگوی دایرکته، عملاً کسب‌وکار نساخته؛ فقط برای خودش یک شغلِ پر استرس با ساعت کاری ۱۶ ساعته درست کرده.',
      },
      {
        speakerKey: 'SPEAKER_2',
        startSec: 46,
        endSec: 68,
        text: 'ببخشید استاد آرش، من امیرحسین نادری هستم و تولیدی پوشاک دارم. دقیقاً همین وضعیت رو دارم؛ هر وقت سه روز از کارگاه میرم سفر، فروشمون نصف میشه و همه کارها می‌خوابه.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 68,
        endSec: 94,
        text: 'دمت گرم آقای نادری که انقدر شفاف گفتی. بچه‌ها به جمله آقای نادری دقت کنید: «سه روز میرم سفر، فروش نصف میشه». این یعنی کسب‌وکار شما به سیستم وصل نیست، به رگِ حیاتیِ شخصِ شما وصله.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 94,
        endSec: 122,
        text: 'تفاوت یک مغازه‌دار پرکار با یک کارآفرینِ مقیاس‌پذیر دقیقاً همین‌جاست: کارآفرین اول فرآیند تکرارپذیر می‌سازه، بعد آدم می‌ذاره پشت سیستم، نه اینکه خودش ۲۴ ساعته آتیش خاموش کنه.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 122,
        endSec: 146,
        text: 'یک تست ساده بهتون میدم که همین امشب انجام بدید: اگر همین الان موبایلتون رو ۴۸ ساعت خاموش کنید، کدوم بخش کسب‌وکارتون اول از همه می‌پاشه؟ دقیقاً همون نقطه، اولین گلوگاه سیستم‌سازی شماست.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 146,
        endSec: 168,
        text: 'یادتون نره؛ رشد واقعی از روزی شروع میشه که از «همه‌کاره بودن» استعفا بدید و تبدیل بشید به معمار سیستمِ کسب‌وکارتون.',
      },
    ],
  });

  const p1Segs = p1.insertedSegments;
  const p1Verifiable = toVerifiable(p1Segs, part1Title);

  const p1HookDrafts: GeneratedHookDraft[] = [
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب طلایی آغازین (۰ تا ۳ ثانیه)',
            segmentId: p1Segs[0].id,
            verbatimText:
              'بذارید همین اول یک حقیقت تلخ بگم: ۹۰ درصد کسب‌وکارها به خاطر کمبود مشتری ورشکست نمیشن، به خاطر مدیریت اشتباهِ همین مشتری‌های فعلی زمین می‌خورن.',
            editingNote: 'کات مستقیم از کلمه «بذارید» با تیتر بزرگ زرد روی تصویر: «دلیل واقعی ورشکستگی ۹۰٪ بیزینس‌ها».',
          },
          {
            label: 'تشدید درد مخاطب (آینه واقعی)',
            segmentId: p1Segs[1].id,
            verbatimText: p1Segs[1].text,
            editingNote: 'شمارش گرافیکی روی صفحه: ۱. فروشنده ۲. مدیر مالی ۳. ادمین دایرکت — با ریتم تند.',
          },
          {
            label: 'تفاوت کلیدی و تغییر زاویه دید',
            segmentId: p1Segs[4].id,
            verbatimText: p1Segs[4].text,
            editingNote: 'کلوزآپ روی سخنران + هایلایت روی عبارت «معمار سیستم» و «فرآیند تکرارپذیر».',
          },
          {
            label: 'جمع‌بندی ماندگار (پانچ‌لاین سیو)',
            segmentId: p1Segs[6].id,
            verbatimText: p1Segs[6].text,
            editingNote: 'کارت پایانی مینیمال برای ذخیره پست + دعوت به کامنت.',
          },
        ],
        p1Verifiable
      );
      return {
        tier: 'gold',
        formatLabel: 'پست ریلز (اصلی پیج)',
        storyFormat: null,
        title: 'چرا ۹۰٪ کسب‌وکارها واقعاً زمین می‌خورن؟ (پست اقتدار)',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p1.audioFileId,
        hookSourceAudioTitle: part1Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'شروع ضدهنجار با آمار ملموس (۹۰ درصد) و لمس مستقیم درد کارآفرینان همه‌کاره؛ بهترین گزینه برای پست اصلی با نرخ ذخیره (Save) و اشتراک‌گذاری بسیار بالا.',
        estimatedDurationSec: 52,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea:
          'تو کدوم مرحله‌ای؟ هنوز خودت همه‌کاره بیزینسی یا سیستم‌سازی رو شروع کردی؟ برام توی کامنت بنویس.',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب تریال (چالش ۴۸ ساعته)',
            segmentId: p1Segs[5].id,
            verbatimText: p1Segs[5].text,
            editingNote: 'شروع بی‌مقدمه با زیرنویس درشت: «تست ۴۸ ساعته خاموش کردن موبایل!».',
          },
          {
            label: 'مثال واقعی از مخاطب سالن',
            segmentId: p1Segs[2].id,
            verbatimText: p1Segs[2].text,
            editingNote: 'کات به مخاطب سالن برای حس مستند و باورپذیری بالا در تریال ریلز.',
          },
          {
            label: 'تشخیص سریع کوچ (پانچ‌لاین)',
            segmentId: p1Segs[3].id,
            verbatimText: p1Segs[3].text,
            editingNote: 'تاکید صوتی روی جمله «به رگ حیاتی شخص شما وصله» و پایان سریع برای ریپلی.',
          },
        ],
        p1Verifiable
      );
      return {
        tier: 'silver',
        formatLabel: 'تریال ریلز (تست مخاطب جدید)',
        storyFormat: null,
        title: 'تست ۴۸ ساعته موبایل خاموش — گلوگاه بیزینست کجاست؟',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p1.audioFileId,
        hookSourceAudioTitle: part1Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'سوال چالشی و کاربردی که مخاطب غیردنبال‌کننده را فوری درگیر تفکر درباره کسب‌وکار خودش می‌کند؛ ایده‌آل برای Trial Reels و جذب فالوور هدفمند.',
        estimatedDurationSec: 44,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea: 'جرات داری این تست ۴۸ ساعته رو انجام بدی؟ کدوم بخش اول می‌خوابه؟',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'اسلاید ۱ — طرح مشکل واقعی در سالن',
            segmentId: p1Segs[2].id,
            verbatimText: p1Segs[2].text,
            editingNote: 'متن بالای اسلاید: «ببینید یکی از شرکت‌کننده‌های سمینار خرداد چی گفت 👇» + استیکر نظرسنجی.',
          },
          {
            label: 'اسلاید ۲ — واکنش و تشخیص ریشه‌ای کوچ',
            segmentId: p1Segs[3].id,
            verbatimText: p1Segs[3].text,
            editingNote: 'زیرنویس رنگی روی «به سیستم وصل نیست، به رگ حیاتی شخص شما وصله».',
          },
          {
            label: 'اسلاید ۳ — تمرین عملی امشب و دعوت به دایرکت',
            segmentId: p1Segs[5].id,
            verbatimText: p1Segs[5].text,
            editingNote: 'قرار دادن باکس سوال (Question Box): «کدوم بخش بیزینست بدون تو می‌خوابه؟ بنویس تا راهنماییت کنم».',
          },
        ],
        p1Verifiable
      );
      return {
        tier: 'bronze',
        formatLabel: 'رشته استوری (۳ اسلاید)',
        storyFormat: 'story_sequence',
        title: 'رشته استوری: وقتی ۳ روز میری سفر، فروشت نصف میشه!',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p1.audioFileId,
        hookSourceAudioTitle: part1Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'مکالمه واقعی با شرکت‌کننده در سالن فضای بسیار صمیمی و مستند برای یک رشته استوری ۳ اسلایدی با نرخ ریپلای بالا می‌سازد.',
        estimatedDurationSec: 54,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea:
          'اسلاید ۱: نظرسنجی («منم همینطورم / نه تیمم مستقله») — اسلاید ۳: باکس پاسخ برای مشاوره کوتاه در دایرکت.',
        captionIdea: null,
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'استوری تکی — جمله انگیزشی و تلنگر پایانی',
            segmentId: p1Segs[6].id,
            verbatimText: p1Segs[6].text,
            editingNote: 'ویدیوی عمودی ۱۵ ثانیه‌ای خام از صحنه سمینار با زیرنویس سفید تمیز و اسلایدر ایموجی آتش.',
          },
        ],
        p1Verifiable
      );
      return {
        tier: 'bronze',
        formatLabel: 'استوری تکی (۱۵ ثانیه‌ای)',
        storyFormat: 'single_story',
        title: 'استوری تکی: از همه‌کاره بودن استعفا بده!',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p1.audioFileId,
        hookSourceAudioTitle: part1Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'کوتاه، پانچی و کامل در یک استوری تکی؛ مناسب برای پایان روز یا شروع رشته استوری‌های بعدی.',
        estimatedDurationSec: 18,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: 'استیکر ری‌اکشن یا نظرسنجی سریع: «وقتشه از همه‌کاره بودن استعفا بدی؟ آره / هنوز زوده».',
        captionIdea: null,
        verbatimScore,
      };
    })(),
  ];

  replaceHooksForSource({
    projectId: project.id,
    sourceType: 'audio',
    audioFileId: p1.audioFileId,
    hooks: p1HookDrafts,
  });

  // ---------------- PART 2 ----------------
  const part2Filename = 'seed-khordad-part2.wav';
  const part2Path = path.join(UPLOADS_DIR, part2Filename);
  const part2Size = generateDemoWav(part2Path, 152, [0, 26, 52, 76, 102, 128]);

  const part2Title = 'پارت ۲ — پرسش و پاسخ زنده: اعتراض قیمت و ادمین فروش';
  const p2 = createAudioWithDiarization({
    projectId: project.id,
    title: part2Title,
    originalFilename: 'khordad-seminar-part2-qa.wav',
    storedFilename: part2Filename,
    mimeType: 'audio/wav',
    fileSize: part2Size,
    durationSec: 152,
    analysisMode: 'demo',
    speakers: [
      {
        speakerKey: 'SPEAKER_1',
        displayName: 'آرش راد (بیزنس کوچ)',
        detectedName: 'آرش راد',
        detectedRole: 'بیزنس کوچ / سخنران اصلی',
        detectionEvidence: 'تشخیص از خطاب مخاطبین: «استاد آرش» و «آقای راد»',
        color: SPEAKER_COLORS[0],
      },
      {
        speakerKey: 'SPEAKER_2',
        displayName: 'سارا رضایی (مخاطب)',
        detectedName: 'سارا رضایی',
        detectedRole: 'مدیر کلینیک زیبایی',
        detectionEvidence: 'تشخیص از معرفی در متن: «من سارا رضایی هستم» و خطاب «خانم رضایی»',
        color: SPEAKER_COLORS[1],
      },
      {
        speakerKey: 'SPEAKER_3',
        displayName: 'پوریا کریمی (مخاطب)',
        detectedName: 'پوریا کریمی',
        detectedRole: 'موسس آژانس دیجیتال مارکتینگ',
        detectionEvidence: 'تشخیص از معرفی در متن: «پوریا کریمی هستم» و خطاب «مهندس کریمی»',
        color: SPEAKER_COLORS[2],
      },
    ],
    segments: [
      {
        speakerKey: 'SPEAKER_2',
        startSec: 0,
        endSec: 26,
        text: 'سلام استاد آرش، من سارا رضایی هستم و یک کلینیک تخصصی دارم. روزی بالای هشتاد تا دایرکت میاد که فقط می‌پرسن قیمت چنده، ادمین ما قیمت رو می‌فرسته و ۷۵ درصدشون حتی سین می‌کنن و غیبشون می‌زنه!',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 26,
        endSec: 52,
        text: 'خانم رضایی، وقتی مشتری می‌پرسه «قیمت چنده» و شما فوری عدد می‌فرستید، عملاً خودتون رو انداختید توی قفسِ مقایسه قیمتی با ارزان‌فروش‌ترین رقیب بازار! مشتری هنوز نفهمیده چرا باید پیش شما بیاد، فقط یک عدد جلوی چشمشه.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 52,
        endSec: 76,
        text: 'قانون طلایی دایرکت اینه: هیچ‌وقت قبل از تشخیص نیاز، قیمت نده! به جای عدد، با این جمله برگرد: «برای اینکه دقیق‌ترین هزینه رو بهتون بگم، اول بفرمایید هدفتون دقیقاً کدوم نتیجه است؟»',
      },
      {
        speakerKey: 'SPEAKER_3',
        startSec: 76,
        endSec: 102,
        text: 'آقای راد، من پوریا کریمی هستم؛ اگر مشتری اصرار کرد که نه اول قیمت رو بگو بعد حرف می‌زنیم، اونجا چیکار کنیم که هم لج نکنه هم ما نبازیم؟',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 102,
        endSec: 128,
        text: 'سوال هوشمندانه‌ایه مهندس کریمی. اونجا بازه قیمتی بده نه عدد ثابت! بگو پکیج‌های ما بسته به نیاز شما از ایکس تا وای متغیره، دو تا سوال بپرسم تا دقیق بگم کدومش برای شما به‌صرفه‌تره. اینجوری هم احترام گذاشتی هم فرمان مکالمه دست خودته.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 128,
        endSec: 152,
        text: 'همین یک تغییر ساده توی اسکریپت دایرکت، ماه گذشته برای یکی از مراجعین ما نرخ تبدیل دایرکت به نوبت حضوری رو از ۸ درصد رسوند به ۲۷ درصد بدون یک ریال تبلیغات اضافه.',
      },
    ],
  });

  const p2Segs = p2.insertedSegments;
  const p2Verifiable = toVerifiable(p2Segs, part2Title);

  const p2HookDrafts: GeneratedHookDraft[] = [
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب طلایی (پاسخ به سوال پرتکرار دایرکت)',
            segmentId: p2Segs[1].id,
            verbatimText: p2Segs[1].text,
            editingNote: 'تیتر روی ویدیو: «جواب «قیمت چنده؟» رو اینجوری نده! ❌».',
          },
          {
            label: 'اسکریپت جایگزین دقیق (ارزش عملی فوری)',
            segmentId: p2Segs[2].id,
            verbatimText: p2Segs[2].text,
            editingNote: 'نمایش متن جمله جایگزین داخل باکس گرافیکی شبیه چت دایرکت اینستاگرام.',
          },
          {
            label: 'اثبات عددی و نتیجه واقعی',
            segmentId: p2Segs[5].id,
            verbatimText: p2Segs[5].text,
            editingNote: 'نمایش انیمیشن عدد «۸٪ ← ۲۷٪» روی صفحه برای قدرت اثبات اجتماعی.',
          },
        ],
        p2Verifiable
      );
      return {
        tier: 'gold',
        formatLabel: 'پست ریلز (آموزشی پرفروش)',
        storyFormat: null,
        title: 'وقتی مشتری میگه «قیمت چنده؟» دقیقاً چی جواب بدیم؟',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p2.audioFileId,
        hookSourceAudioTitle: part2Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'پرتکرارترین دغدغه کل پیج‌های فروش اینستاگرامی + ارائه جمله آماده اجرا + عدد نتیجه واقعی (۸٪ به ۲۷٪)؛ تضمینی برای سیو و اشتراک‌گذاری بالا.',
        estimatedDurationSec: 55,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea: 'کلمه «دایرکت» رو کامنت کن تا کل اسکریپت ۷ مرحله‌ای پاسخ به مشتری رو برات بفرستم.',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب تریال (سوال چالشی مخاطب)',
            segmentId: p2Segs[3].id,
            verbatimText: p2Segs[3].text,
            editingNote: 'شروع مستقیم با صدای مخاطب + تیتر: «وقتی مشتری لج می‌کنه فقط قیمت بگو!»',
          },
          {
            label: 'تکنیک بازه قیمتی (پاسخ سریع کوچ)',
            segmentId: p2Segs[4].id,
            verbatimText: p2Segs[4].text,
            editingNote: 'تاکید متنی روی «بازه قیمتی بده نه عدد ثابت!» با کات‌های پرانرژی.',
          },
        ],
        p2Verifiable
      );
      return {
        tier: 'silver',
        formatLabel: 'تریال ریلز (پرسش و پاسخ سریع)',
        storyFormat: null,
        title: 'اگه مشتری اصرار کرد اول قیمت رو بگو چیکار کنیم؟',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p2.audioFileId,
        hookSourceAudioTitle: part2Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'سوال بسیار تیز و کوتاه از دل سالن؛ مناسب برای تریال ریلز جهت آزمایش واکنش فروشنده‌ها و مدیران پیج‌های جدید.',
        estimatedDurationSec: 36,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea: 'توی بیزینس تو هم مشتری‌ها فقط می‌پرسن قیمت چنده و میرن؟',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'اسلاید ۱ — چالش ۸۰ دایرکت بدون خرید',
            segmentId: p2Segs[0].id,
            verbatimText: p2Segs[0].text,
            editingNote: 'تیتر بالای اسلاید: «روزی ۸۰ تا دایرکت، ۷۵٪ سین و غیب! 😱»',
          },
          {
            label: 'اسلاید ۲ — اشتباه قفس مقایسه قیمتی',
            segmentId: p2Segs[1].id,
            verbatimText: p2Segs[1].text,
            editingNote: 'استیکر نظرسنجی: «ادمین شما هم سریع قیمت می‌فرسته؟ بله / نه».',
          },
          {
            label: 'اسلاید ۳ — جمله طلایی جایگزین',
            segmentId: p2Segs[2].id,
            verbatimText: p2Segs[2].text,
            editingNote: 'جمله طلایی رو با فونت خوانا وسط کادر بنویس تا اسکرین‌شات بگیرن.',
          },
          {
            label: 'اسلاید ۴ — نتیجه واقعی (۸٪ به ۲۷٪)',
            segmentId: p2Segs[5].id,
            verbatimText: p2Segs[5].text,
            editingNote: 'باکس ریپلای: «کلمه اسکریپت رو بفرست تا نسخه کاملش رو برات ارسال کنم».',
          },
        ],
        p2Verifiable
      );
      return {
        tier: 'bronze',
        formatLabel: 'رشته استوری (۴ اسلاید)',
        storyFormat: 'story_sequence',
        title: 'رشته استوری: تبدیل دایرکت‌های «قیمت چنده» به خرید',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p2.audioFileId,
        hookSourceAudioTitle: part2Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'یک مینی‌کیس‌استادی کامل در ۴ اسلاید از مشکل تا راهکار و عدد نتیجه؛ فوق‌العاده برای گرفتن دایرکت و فروش محصول آموزشی.',
        estimatedDurationSec: 72,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: 'اسلاید ۲ نظرسنجی + اسلاید ۴ دعوت به ریپلای با کلمه «اسکریپت».',
        captionIdea: null,
        verbatimScore,
      };
    })(),
  ];

  replaceHooksForSource({
    projectId: project.id,
    sourceType: 'audio',
    audioFileId: p2.audioFileId,
    hooks: p2HookDrafts,
  });

  // ---------------- PART 3 ----------------
  const part3Filename = 'seed-khordad-part3.wav';
  const part3Path = path.join(UPLOADS_DIR, part3Filename);
  const part3Size = generateDemoWav(part3Path, 126, [0, 28, 56, 86, 108]);

  const part3Title = 'پارت ۳ — فرمول پیگیری ۷ روزه و جمع‌بندی نهایی';
  const p3 = createAudioWithDiarization({
    projectId: project.id,
    title: part3Title,
    originalFilename: 'khordad-seminar-part3-closing.wav',
    storedFilename: part3Filename,
    mimeType: 'audio/wav',
    fileSize: part3Size,
    durationSec: 126,
    analysisMode: 'demo',
    speakers: [
      {
        speakerKey: 'SPEAKER_1',
        displayName: 'آرش راد (بیزنس کوچ)',
        detectedName: 'آرش راد',
        detectedRole: 'بیزنس کوچ / سخنران اصلی',
        detectionEvidence: 'سخنران اصلی در طول بخش جمع‌بندی',
        color: SPEAKER_COLORS[0],
      },
      {
        speakerKey: 'SPEAKER_2',
        displayName: 'نیما تهرانی (مجری همایش)',
        detectedName: 'نیما تهرانی',
        detectedRole: 'مجری و تسهیل‌گر همایش',
        detectionEvidence: 'تشخیص از معرفی در متن: «من نیما تهرانی از طرف تیم اجرایی...»',
        color: SPEAKER_COLORS[3],
      },
    ],
    segments: [
      {
        speakerKey: 'SPEAKER_1',
        startSec: 0,
        endSec: 28,
        text: 'بچه‌ها یک آمار جهانی هست که خیلی‌ها باورش نمی‌کنن: ۸۰ درصد فروش‌های بزرگ بین تماس پنجم تا هشتم اتفاق می‌افته، اما ۹۲ درصد فروشنده‌های ایرانی بعد از اولین «بذار فکر کنم» مشتری رو رها می‌کنن!',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 28,
        endSec: 56,
        text: 'پیگیری کردن یعنی مزاحم شدن نیست؛ پیگیری حرفه‌ای یعنی هر بار با یک ارزش جدید برگردی: روز اول خلاصه گفتگو، روز سوم یک نمونه کار مشابه، و روز هفتم یک پیشنهاد زمان‌دار محترمانه.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 56,
        endSec: 86,
        text: 'ثروتِ پنهانِ کسب‌وکار شما توی تبلیغاتِ ماه آینده نیست؛ توی لیستِ شماره‌هایی خوابیده که شش ماه گذشته بهتون پیام دادن و کسی پیگیریشون نکرده.',
      },
      {
        speakerKey: 'SPEAKER_2',
        startSec: 86,
        endSec: 108,
        text: 'فوق‌العاده بود استاد! من نیما تهرانی از طرف تیم اجرایی واقعاً حس کردم این جمله آخر کل سالن رو تکون داد. بچه‌ها همین الان یادداشت کنید برای فردا صبح.',
      },
      {
        speakerKey: 'SPEAKER_1',
        startSec: 108,
        endSec: 126,
        text: 'ممنون نیما جان. قول بدید فردا قبل از ساعت ده صبح، فقط به بیست تا از مشتری‌های قدیمی‌تون یک پیام پیگیری ارزشمند بفرستید و نتیجه‌اش رو آخر هفته ببینید.',
      },
    ],
  });

  const p3Segs = p3.insertedSegments;
  const p3Verifiable = toVerifiable(p3Segs, part3Title);

  const p3HookDrafts: GeneratedHookDraft[] = [
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب طلایی (آمار شوکه‌کننده پیگیری)',
            segmentId: p3Segs[0].id,
            verbatimText: p3Segs[0].text,
            editingNote: 'نمایش بزرگ اعداد «۸۰٪ در برابر ۹۲٪» روی صفحه با صدای کوبنده ملایم.',
          },
          {
            label: 'فرمول ۳ مرحله‌ای پیگیری حرفه‌ای',
            segmentId: p3Segs[1].id,
            verbatimText: p3Segs[1].text,
            editingNote: 'تایم‌لاین گرافیکی روی تصویر: روز ۱ ← روز ۳ ← روز ۷.',
          },
          {
            label: 'جمله طلایی پایانی (نقل‌قول ویروسی)',
            segmentId: p3Segs[2].id,
            verbatimText: p3Segs[2].text,
            editingNote: 'سکوت ۱ ثانیه‌ای موسیقی هنگام گفتن «ثروت پنهان کسب‌وکار شما» برای اثرگذاری حداکثری.',
          },
        ],
        p3Verifiable
      );
      return {
        tier: 'gold',
        formatLabel: 'پست ریلز (وایرال و آموزشی)',
        storyFormat: null,
        title: 'ثروت پنهان بیزینست توی تبلیغات جدید نیست! (فرمول پیگیری ۷ روزه)',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p3.audioFileId,
        hookSourceAudioTitle: part3Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'ترکیب آمار تکان‌دهنده + فرمول اجرایی دقیق (روز ۱، ۳، ۷) + یک جمله پایانی فوق‌العاده نقل‌قول‌شدنی برای وایرال شدن در اکسپلور.',
        estimatedDurationSec: 58,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea: 'تیم فروش تو بعد از «بذار فکر کنم» تا چند بار مشتری رو پیگیری می‌کنه؟',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب تریال (جمله ضربه‌ای ثروت پنهان)',
            segmentId: p3Segs[2].id,
            verbatimText: p3Segs[2].text,
            editingNote: 'شروع بلافاصله با جمله طلایی به عنوان قلاب اول برای تست واچ‌تایم در تریال.',
          },
          {
            label: 'چالش عملی فردا صبح',
            segmentId: p3Segs[4].id,
            verbatimText: p3Segs[4].text,
            editingNote: 'زیرنویس درشت روی «۲۰ مشتری قدیمی قبل از ساعت ۱۰ صبح».',
          },
        ],
        p3Verifiable
      );
      return {
        tier: 'silver',
        formatLabel: 'تریال ریلز (کوتاه ۲۵ ثانیه‌ای)',
        storyFormat: null,
        title: 'چالش ساعت ۱۰ صبح با ۲۰ مشتری قدیمی',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p3.audioFileId,
        hookSourceAudioTitle: part3Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'ریلز کوتاه و چالشی ۲۵ ثانیه‌ای با نرخ تمام‌بینی (Completion Rate) بالا؛ عالی برای تست در Trial Reels.',
        estimatedDurationSec: 32,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea: 'همین الان از دایرکت‌های قدیمیت شروع کن و نتیجه‌شو برام بنویس.',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'استوری تکی — چالش صبحگاهی فالوورها',
            segmentId: p3Segs[4].id,
            verbatimText: p3Segs[4].text,
            editingNote: 'انتشار صبح ساعت ۹ در استوری به همراه استیکر شمارش معکوس یا تیک «انجامش میدم ✅».',
          },
        ],
        p3Verifiable
      );
      return {
        tier: 'bronze',
        formatLabel: 'استوری تکی (چالش صبحگاهی)',
        storyFormat: 'single_story',
        title: 'استوری تکی: چالش پیگیری ۲۰ مشتری قدیمی قبل از ساعت ۱۰',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: p3.audioFileId,
        hookSourceAudioTitle: part3Title,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'یک اکشن مشخص و فوری برای استوری صبح که تعامل مخاطب را بالا می‌برد.',
        estimatedDurationSec: 18,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: 'نظرسنجی صبحگاهی: «توی چالش ۲۰ پیام امروز هستی؟ 💪 حتماً / بعداً».',
        captionIdea: null,
        verbatimScore,
      };
    })(),
  ];

  replaceHooksForSource({
    projectId: project.id,
    sourceType: 'audio',
    audioFileId: p3.audioFileId,
    hooks: p3HookDrafts,
  });

  // ---------------- SAVED MULTI-FILE COMBINATION ----------------
  const comboId = createCombinationRecord({
    projectId: project.id,
    title: 'ساختار ترکیبی طلایی: از مشکل فروش تا اسکریپت و پیگیری (پارت ۱ ← ۲ ← ۳)',
    goal: 'ساختار داستانی و قیف فروش پیوسته از کل روز سمینار',
    orderedAudioIds: [p1.audioFileId, p2.audioFileId, p3.audioFileId],
  });

  const { mergedSegments } = buildMergedTimeline([p1.audioFileId, p2.audioFileId, p3.audioFileId]);
  const comboVerifiable: VerifiableSegment[] = mergedSegments.map((s) => ({
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

  const comboHooks: GeneratedHookDraft[] = [
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'بخش ۱ (از پارت ۱) — قلاب شکستن باور غلط',
            segmentId: p1Segs[0].id,
            verbatimText:
              'بذارید همین اول یک حقیقت تلخ بگم: ۹۰ درصد کسب‌وکارها به خاطر کمبود مشتری ورشکست نمیشن، به خاطر مدیریت اشتباهِ همین مشتری‌های فعلی زمین می‌خورن.',
            editingNote: 'برش از پارت ۱ (۰:۰۰ تا ۰:۲۲) — شروع طوفانی ریلز جامع سمینار.',
          },
          {
            label: 'بخش ۲ (از پارت ۲) — اثبات در دایرکت و قیمت',
            segmentId: p2Segs[2].id,
            verbatimText: p2Segs[2].text,
            editingNote: 'کات مستقیم به پارت ۲ (۰:۵۲ تا ۱:۱۶) — ارائه راهکار فوری مکالمه فروش.',
          },
          {
            label: 'بخش ۳ (از پارت ۳) — تکمیل قیف با سیستم پیگیری',
            segmentId: p3Segs[1].id,
            verbatimText: p3Segs[1].text,
            editingNote: 'کات به پارت ۳ (۰:۲۸ تا ۰:۵۶) — نمایش تایم‌لاین روز ۱، ۳ و ۷ روی تصویر.',
          },
          {
            label: 'بخش ۴ (از پارت ۳) — پانچ‌لاین ماندگار پایانی',
            segmentId: p3Segs[2].id,
            verbatimText: p3Segs[2].text,
            editingNote: 'پایان‌بندی قدرتمند از پارت ۳ (۰:۵۶ تا ۱:۲۶) با کال‌تو‌اکشن ذخیره پست.',
          },
        ],
        comboVerifiable
      );
      return {
        tier: 'gold',
        formatLabel: 'پست ریلز ترکیبی (۳ پارت در یک سناریو)',
        storyFormat: null,
        title: 'نقشه کامل دو برابر کردن فروش بدون تبلیغات جدید (ترکیب پارت ۱+۲+۳)',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: verifiedBeats[0].sourceAudioId,
        hookSourceAudioTitle: verifiedBeats[0].sourceAudioTitle,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'این سناریو دقیقاً قدرت قابلیت ترکیب صداهاست: از پارت ۱ باور غلط را می‌شکند، از پارت ۲ راهکار دایرکت را می‌دهد و از پارت ۳ با سیستم پیگیری ۷ روزه یک مینی‌دوره ۶۰ ثانیه‌ای بی‌نقص می‌سازد.',
        estimatedDurationSec: 65,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea:
          'این یک دقیقه، عصاره کل سمینار خرداد ماهه! همین الان سیوش کن و برای تیمت بفرست.',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'قلاب تریال (از پارت ۲) — صدای واقعی مخاطب',
            segmentId: p2Segs[0].id,
            verbatimText: p2Segs[0].text,
            editingNote: 'شروع مستند با صدای خانم رضایی از پارت ۲ برای جلب توجه صاحبان پیج.',
          },
          {
            label: 'پاسخ ریشه‌ای (از پارت ۳) — آمار پیگیری',
            segmentId: p3Segs[0].id,
            verbatimText: p3Segs[0].text,
            editingNote: 'جامپ‌کات سریع به پارت ۳ برای وصل کردن مشکل دایرکت به ضعف پیگیری.',
          },
          {
            label: 'نتیجه عددی (از پارت ۲) — جهش به ۲۷٪',
            segmentId: p2Segs[5].id,
            verbatimText: p2Segs[5].text,
            editingNote: 'برگشت سریع به نتیجه عددی از پارت ۲ به عنوان پانچ‌لاین نهایی.',
          },
        ],
        comboVerifiable
      );
      return {
        tier: 'silver',
        formatLabel: 'تریال ریلز ترکیبی (پارت ۲ + ۳)',
        storyFormat: null,
        title: 'چرا ۷۵٪ دایرکت‌ها سین می‌کنن و میرن؟ (ترکیب سوال و آمار)',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: verifiedBeats[0].sourceAudioId,
        hookSourceAudioTitle: verifiedBeats[0].sourceAudioTitle,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'پیوند مستقیم سوال واقعی مخاطب (پارت ۲) به آمار ۹۲٪ رها کردن مشتری (پارت ۳)؛ یک زاویه تازه و فوق‌العاده برای تست در Trial Reels.',
        estimatedDurationSec: 48,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: null,
        captionIdea: 'مشکل از قیمت نیست؛ مشکل از نبودِ اسکریپت و پیگیریه.',
        verbatimScore,
      };
    })(),
    (() => {
      const { verifiedBeats, verbatimScore } = verifyAndSnapBeats(
        [
          {
            label: 'اسلاید ۱ (پارت ۱) — تلنگر وابستگی به شخص',
            segmentId: p1Segs[1].id,
            verbatimText: p1Segs[1].text,
            editingNote: 'شروع رشته استوری گزارش سمینار خرداد: «سه نکته طلایی که امروز سالن رو منفجر کرد 👇».',
          },
          {
            label: 'اسلاید ۲ (پارت ۲) — قانون طلایی دایرکت',
            segmentId: p2Segs[2].id,
            verbatimText: p2Segs[2].text,
            editingNote: 'برش از پارت ۲ با برچسب «نکته ۲ از ۳».',
          },
          {
            label: 'اسلاید ۳ (پارت ۳) — ثروت پنهان لیست قدیمی',
            segmentId: p3Segs[2].id,
            verbatimText: p3Segs[2].text,
            editingNote: 'برش از پارت ۳ با برچسب «نکته ۳ از ۳».',
          },
          {
            label: 'اسلاید ۴ (پارت ۳) — چالش فردا صبح و CTA',
            segmentId: p3Segs[4].id,
            verbatimText: p3Segs[4].text,
            editingNote: 'باکس ریپلای برای دریافت فایل جمع‌بندی سمینار خرداد.',
          },
        ],
        comboVerifiable
      );
      return {
        tier: 'bronze',
        formatLabel: 'رشته استوری ترکیبی (۴ اسلاید از کل همایش)',
        storyFormat: 'story_sequence',
        title: 'رشته استوری خلاصه کل سمینار خرداد (۳ نکته طلایی)',
        hookVerbatim: verifiedBeats[0].verbatimText,
        hookSegmentId: verifiedBeats[0].segmentId,
        hookSourceAudioId: verifiedBeats[0].sourceAudioId,
        hookSourceAudioTitle: verifiedBeats[0].sourceAudioTitle,
        hookStartSec: verifiedBeats[0].startSec,
        hookEndSec: verifiedBeats[0].endSec,
        hookSpeakerName: verifiedBeats[0].speakerName,
        rationale:
          'ساختار ایده‌آل برای رشته استوری جمع‌بندی بعد از همایش که مخاطبان غایب را به ثبت‌نام در دوره یا سمینار بعدی ترغیب می‌کند.',
        estimatedDurationSec: 75,
        scenarioBeats: verifiedBeats,
        storyEngagementIdea: 'اسلاید ۴: باکس سوال «کدوم یکی از این ۳ نکته الان اولویت کسب‌وکار توئه؟».',
        captionIdea: null,
        verbatimScore,
      };
    })(),
  ];

  replaceHooksForSource({
    projectId: project.id,
    sourceType: 'combination',
    combinationId: comboId,
    hooks: comboHooks,
  });
}
