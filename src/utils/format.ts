import type { HookTier, HookWithScenario, ViralBlueprintId } from '../types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFa(value: number | string): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function formatTimecode(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(rem).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatTimecodeRange(startSec: number, endSec: number): string {
  return `${formatTimecode(startSec)} تا ${formatTimecode(endSec)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${toFa(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toFa((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toFa((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

export interface TierMeta {
  label: string;
  shortLabel: string;
  purpose: string;
  sealClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentBar: string;
  softPanel: string;
  glowColor: string;
  dotColor: string;
}

export const BLUEPRINT_META: Record<
  ViralBlueprintId,
  {
    label: string;
    shortLabel: string;
    enLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  myth_buster: {
    label: 'تخریب باور رایج',
    shortLabel: 'تخریب باور',
    enLabel: 'Myth Buster',
    description: 'به چالش کشیدن باور غلط مخاطب در ۳ ثانیه اول برای توقف اسکرول و بحث در کامنت',
    badgeClass: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
  },
  before_after: {
    label: 'تضاد قبل و بعد',
    shortLabel: 'قبل و بعد',
    enLabel: 'Before / After',
    description: 'نمایش فاصله وضعیت فعلی با نتیجه مطلوب برای ایجاد انگیزه ذخیره و اجرا',
    badgeClass: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  },
  vulnerability: {
    label: 'اعتراف و تجربه واقعی',
    shortLabel: 'تجربه واقعی',
    enLabel: 'Vulnerability Story',
    description: 'روایت صادقانه از یک شکست یا چالش واقعی که اعتماد سریع و تعامل عاطفی می‌سازد',
    badgeClass: 'border-purple-400/30 bg-purple-500/10 text-purple-300',
  },
  framework: {
    label: 'فرمول شماره‌دار سریع',
    shortLabel: 'فرمول اجرایی',
    enLabel: 'Step Framework',
    description: 'ارائه سیستم یا مراحل مشخص با بالاترین نرخ ذخیره (Saveability)',
    badgeClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  },
  amateur_vs_pro: {
    label: 'آماتور در برابر حرفه‌ای',
    shortLabel: 'آماتور vs حرفه‌ای',
    enLabel: 'Amateur vs Pro',
    description: 'مقایسه رفتار معمولی با رفتار حرفه‌ای‌ها؛ بسیار مناسب ارسال به همکار و تیم',
    badgeClass: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  },
  rapid_qa: {
    label: 'پرسش و پاسخ دو نفره',
    shortLabel: 'مکالمه‌ای Q&A',
    enLabel: 'Rapid Q&A Cut',
    description: 'دیالوگ سریع بین دو گوینده که با تغییر صدا، افت مخاطب را به حداقل می‌رساند',
    badgeClass: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300',
  },
  micro_loop: {
    label: 'میکرو‌ریلز لوپ بی‌پایان',
    shortLabel: 'میکرو لوپ',
    enLabel: '7–15s Seamless Loop',
    description: 'برش کوبنده ۷ تا ۱۵ ثانیه‌ای با پایان متصل به شروع برای Watch Time بالای ۱۲۰٪',
    badgeClass: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300',
  },
};

export const TIER_META: Record<HookTier, TierMeta> = {
  gold: {
    label: 'طلایی — پست روی پیج',
    shortLabel: 'طلایی · پست',
    purpose: 'مناسب برای پست اصلی ریلز روی پیج (بالاترین اعتبار، ذخیره و اشتراک‌گذاری)',
    sealClass: 'seal-gold',
    badgeBg: 'bg-[#EAB349]/12',
    badgeText: 'text-[#F6CE78]',
    badgeBorder: 'border-[#EAB349]/35',
    accentBar: 'bg-gradient-to-l from-[#F7D782] via-[#D8992C] to-[#8C5A11]',
    softPanel: 'bg-gradient-to-br from-[#EAB349]/[0.09] via-[#1B1712] to-[#141210]',
    glowColor: 'rgba(234, 179, 73, 0.16)',
    dotColor: '#EAB349',
  },
  silver: {
    label: 'نقره‌ای — تریال ریلز',
    shortLabel: 'نقره‌ای · تریال',
    purpose: 'مناسب برای Trial Reels جهت تست قلاب روی مخاطب غیردنبال‌کننده',
    sealClass: 'seal-silver',
    badgeBg: 'bg-[#CBD5E1]/10',
    badgeText: 'text-[#E2E8F0]',
    badgeBorder: 'border-[#CBD5E1]/30',
    accentBar: 'bg-gradient-to-l from-[#F1F5F9] via-[#94A3B8] to-[#475569]',
    softPanel: 'bg-gradient-to-br from-[#CBD5E1]/[0.07] via-[#17191D] to-[#131315]',
    glowColor: 'rgba(203, 213, 225, 0.12)',
    dotColor: '#CBD5E1',
  },
  bronze: {
    label: 'برنزی — استوری / رشته استوری',
    shortLabel: 'برنزی · استوری',
    purpose: 'مناسب برای استوری تکی یا رشته استوری تعاملی',
    sealClass: 'seal-bronze',
    badgeBg: 'bg-[#E4834B]/12',
    badgeText: 'text-[#F5B084]',
    badgeBorder: 'border-[#E4834B]/35',
    accentBar: 'bg-gradient-to-l from-[#F5B384] via-[#CF6D37] to-[#7D3412]',
    softPanel: 'bg-gradient-to-br from-[#E4834B]/[0.09] via-[#1B1411] to-[#141110]',
    glowColor: 'rgba(228, 131, 75, 0.16)',
    dotColor: '#E4834B',
  },
};

/**
 * Generates an editor-ready Cut Sheet with exact source audio names, timecodes,
 * speakers, and 100%-verbatim spoken text separated clearly from visual/editing notes.
 */
export function buildEditorCutSheet(hook: HookWithScenario): string {
  const tierInfo = TIER_META[hook.tier];
  const lines: string[] = [
    `══════════════════════════════════════════════`,
    `🎬 سناریوی آماده تدوین | ${tierInfo.label}`,
    `📌 عنوان: ${hook.title}`,
    `🎯 فرمت پیشنهادی: ${hook.formatLabel} (مدت تقریبی: ~${toFa(hook.estimatedDurationSec)} ثانیه)`,
    `✅ تطابق دقیق با متن اصلی: ${toFa(hook.verbatimScore)}٪ (بدون تغییر در گفتار)`,
    `══════════════════════════════════════════════`,
    '',
    `🪝 قلاب آغازین (عین گفتار):`,
    `«${hook.hookVerbatim}»`,
    `📍 منبع قلاب: ${hook.hookSourceAudioTitle} | تایم‌کد ${formatTimecodeRange(hook.hookStartSec, hook.hookEndSec)} | گوینده: ${hook.hookSpeakerName}`,
    '',
    `📋 جدول برش و سناریوی دقیق (برای تدوینگر):`,
  ];

  hook.scenarioBeats.forEach((beat) => {
    lines.push(
      `──────────────────────────────────────────────`,
      `${toFa(beat.beatOrder)}. ${beat.label}`,
      `   📁 فایل مبدا: ${beat.sourceAudioTitle}`,
      `   ⏱️ تایم‌کد دقیق در فایل مبدا: ${formatTimecode(beat.startSec)} تا ${formatTimecode(beat.endSec)}`,
      `   🎙️ گوینده: ${beat.speakerName}`,
      `   🗣️ متن دقیق گفتار (بدون تغییر):`,
      `   «${beat.verbatimText}»`,
      `   🎨 یادداشت تدوین (غیرگفتاری): ${beat.editingNote}`
    );
  });

  if (hook.audioMoodGuide) {
    lines.push(
      '',
      `🎵 راهنمای موسیقی پس‌زمینه و حال‌وهوای صدا:`,
      `   مود: ${hook.audioMoodGuide.moodTitle}`,
      `   ریتم و صدا: ${hook.audioMoodGuide.bpmRange} | ${hook.audioMoodGuide.volumeDbGuide}`,
      ...(hook.audioMoodGuide.musicDropPhrase
        ? [
            `   ⚡ لحظه قطع موزیک (Music Drop) در برش ${toFa(hook.audioMoodGuide.musicDropBeatOrder || 1)}: «${hook.audioMoodGuide.musicDropPhrase}»`,
          ]
        : []),
      `   کلیدواژه جستجو: ${hook.audioMoodGuide.searchKeywords.join(' / ')}`
    );
  }
  if (hook.storyEngagementIdea) {
    lines.push('', `💬 ایده استیکر و تعامل استوری:`, hook.storyEngagementIdea);
  }
  if (hook.captionIdea) {
    lines.push('', `✍️ پیشنهاد کپشن (متن زیر پست - نه گفتار):`, hook.captionIdea);
  }

  return lines.join('\n');
}

export function buildAdminPublishingSheet(hook: HookWithScenario): string {
  const kit = hook.publishingKit;
  if (!kit) return buildEditorCutSheet(hook);

  const tierInfo = TIER_META[hook.tier];
  const lines: string[] = [
    `══════════════════════════════════════════════`,
    `📱 پکیج آماده انتشار برای ادمین پیج | ${tierInfo.label}`,
    `📌 موضوع: ${hook.title}`,
    `══════════════════════════════════════════════`,
    '',
    `⚡ متن درشت ۳ ثانیه اول روی تصویر (On-Screen Hook):`,
    kit.onScreenHook,
    '',
    `🖼️ پیشنهادهای تیتر روی کاور:`,
    ...kit.coverTitles.map((t, i) => `  ${toFa(i + 1)}. ${t}`),
    '',
  ];

  if (kit.commentCtaKeyword) {
    lines.push(
      `🤖 کلیدواژه اتوماسیون دایرکت: «${kit.commentCtaKeyword}»`,
      kit.commentCtaLine ? `   ${kit.commentCtaLine}` : '',
      ''
    );
  }

  lines.push(`✍️ کپشن کامل آماده انتشار:`, kit.fullCaption);

  if (kit.storyStickers.length > 0) {
    lines.push('', `✨ استیکرهای تعاملی استوری:`);
    kit.storyStickers.forEach((st) => {
      lines.push(
        `  • اسلاید ${toFa(st.slideOrder)} — ${st.stickerLabel}:`,
        `    «${st.promptText}»`,
        ...(st.options?.length ? [`    گزینه‌ها: ${st.options.join('  |  ')}`] : [])
      );
    });
  }

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
