import type { HookWithScenario } from './types.ts';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtSec(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TIER_LABEL: Record<string, string> = {
  gold: '🥇 طلایی · پست اصلی روی پیج',
  silver: '🥈 نقره‌ای · تریال ریلز',
  bronze: '🥉 برنزی · استوری / رشته استوری',
};

export interface TelegramSendOptions {
  includeScenario: boolean;
  includePublishingKit: boolean;
  includeViralRadar: boolean;
  includeCarousel: boolean;
  customNote?: string;
}

/**
 * Build a crisp, editor- & admin-ready Telegram HTML message (plus plain text copy fallback).
 */
export function formatScenarioForTelegram(
  hook: HookWithScenario,
  opts: TelegramSendOptions
): { htmlChunks: string[]; plainText: string } {
  const htmlParts: string[] = [];
  const plainParts: string[] = [];

  const tierLabel = TIER_LABEL[hook.tier] || hook.tier;
  htmlParts.push(
    `🎬 <b>${escapeHtml(hook.title)}</b>`,
    `${tierLabel} | ${escapeHtml(hook.formatLabel)} (~${hook.estimatedDurationSec} ثانیه)`,
    `✅ تطابق دقیق با متن اصلی: <b>${hook.verbatimScore}٪</b>`
  );
  plainParts.push(
    `🎬 ${hook.title}`,
    `${tierLabel} | ${hook.formatLabel} (~${hook.estimatedDurationSec} ثانیه)`,
    `✅ تطابق دقیق با متن اصلی: ${hook.verbatimScore}٪`
  );

  if (opts.customNote && opts.customNote.trim()) {
    htmlParts.push('', `📌 <b>یادداشت مدیر محتوا:</b>\n${escapeHtml(opts.customNote.trim())}`);
    plainParts.push('', `📌 یادداشت مدیر محتوا:\n${opts.customNote.trim()}`);
  }

  if (opts.includeScenario) {
    htmlParts.push('', `✂️ <b>جدول برش و سناریوی دقیق (عین گفتار):</b>`);
    plainParts.push('', `✂️ جدول برش و سناریوی دقیق (عین گفتار):`);

    hook.scenarioBeats.forEach((b) => {
      const tc = `${fmtSec(b.startSec)} تا ${fmtSec(b.endSec)}`;
      const src = b.sourceAudioTitle.split('—')[0].trim();
      htmlParts.push(
        `\n<b>${b.beatOrder}. ${escapeHtml(b.label)}</b>`,
        `📁 <i>${escapeHtml(src)}</i> | ⏱ <code>${tc}</code> | 🎙 ${escapeHtml(b.speakerName)}`,
        `«${escapeHtml(b.verbatimText)}»`,
        ...(b.editingNote ? [`🎨 <i>تدوین: ${escapeHtml(b.editingNote)}</i>`] : [])
      );
      plainParts.push(
        `\n${b.beatOrder}. ${b.label}`,
        `📁 ${src} | ⏱ ${tc} | 🎙 ${b.speakerName}`,
        `«${b.verbatimText}»`,
        ...(b.editingNote ? [`🎨 تدوین: ${b.editingNote}`] : [])
      );
    });
  }

  if (opts.includeViralRadar && (hook.viralAudit || hook.audioMoodGuide)) {
    htmlParts.push('', `📊 <b>رادار وایرالیته و راهنمای موزیک:</b>`);
    plainParts.push('', `📊 رادار وایرالیته و راهنمای موزیک:`);

    if (hook.viralAudit) {
      htmlParts.push(
        `🔥 امتیاز وایرالیته: <b>${hook.viralAudit.overallScore}٪</b> (قلاب: ${hook.viralAudit.hookHoldScore}٪ · ماندگاری: ${hook.viralAudit.retentionPaceScore}٪ · ارسال: ${hook.viralAudit.shareabilityScore}٪)`
      );
      plainParts.push(
        `🔥 امتیاز وایرالیته: ${hook.viralAudit.overallScore}٪ (قلاب: ${hook.viralAudit.hookHoldScore}٪ · ماندگاری: ${hook.viralAudit.retentionPaceScore}٪ · ارسال: ${hook.viralAudit.shareabilityScore}٪)`
      );
    }

    if (hook.audioMoodGuide) {
      htmlParts.push(
        `🎵 مود موزیک: ${escapeHtml(hook.audioMoodGuide.moodTitle)} (${escapeHtml(hook.audioMoodGuide.bpmRange)})`,
        ...(hook.audioMoodGuide.musicDropPhrase
          ? [`⚡ لحظه قطع موزیک: «${escapeHtml(hook.audioMoodGuide.musicDropPhrase)}»`]
          : []),
        `🔎 کلیدواژه موزیک: <code>${escapeHtml(hook.audioMoodGuide.searchKeywords.join(' / '))}</code>`
      );
      plainParts.push(
        `🎵 مود موزیک: ${hook.audioMoodGuide.moodTitle} (${hook.audioMoodGuide.bpmRange})`,
        ...(hook.audioMoodGuide.musicDropPhrase
          ? [`⚡ لحظه قطع موزیک: «${hook.audioMoodGuide.musicDropPhrase}»`]
          : []),
        `🔎 کلیدواژه موزیک: ${hook.audioMoodGuide.searchKeywords.join(' / ')}`
      );
    }
  }

  if (opts.includePublishingKit && hook.publishingKit) {
    const kit = hook.publishingKit;
    htmlParts.push(
      '',
      `📱 <b>پکیج انتشار ادمین:</b>`,
      `⚡ متن روی تصویر (۳ ثانیه اول): <b>${escapeHtml(kit.onScreenHook)}</b>`,
      `🖼️ تیتر کاور پیشنهادی: ${escapeHtml(kit.coverTitles.join(' | '))}`,
      ...(kit.commentCtaKeyword
        ? [`🤖 کلیدواژه دایرکت: <code>${escapeHtml(kit.commentCtaKeyword)}</code>`]
        : []),
      '',
      `✍️ <b>کپشن آماده:</b>`,
      escapeHtml(kit.fullCaption)
    );
    plainParts.push(
      '',
      `📱 پکیج انتشار ادمین:`,
      `⚡ متن روی تصویر: ${kit.onScreenHook}`,
      `🖼️ تیتر کاور: ${kit.coverTitles.join(' | ')}`,
      ...(kit.commentCtaKeyword ? [`🤖 کلیدواژه دایرکت: ${kit.commentCtaKeyword}`] : []),
      '',
      `✍️ کپشن آماده:`,
      kit.fullCaption
    );

    if (kit.storyStickers.length > 0) {
      htmlParts.push('', `✨ <b>استیکرهای استوری:</b>`);
      plainParts.push('', `✨ استیکرهای استوری:`);
      kit.storyStickers.forEach((st) => {
        const optsStr = st.options?.length ? ` (${st.options.join(' / ')})` : '';
        htmlParts.push(`• اسلاید ${st.slideOrder}: ${escapeHtml(st.promptText)}${escapeHtml(optsStr)}`);
        plainParts.push(`• اسلاید ${st.slideOrder}: ${st.promptText}${optsStr}`);
      });
    }
  }

  if (opts.includeCarousel && hook.publishingKit?.carouselSlides?.length) {
    htmlParts.push('', `📑 <b>اسلایدهای پست کاروسل:</b>`);
    plainParts.push('', `📑 اسلایدهای پست کاروسل:`);
    hook.publishingKit.carouselSlides.forEach((s) => {
      htmlParts.push(
        `\n<b>اسلاید ${s.slideNumber}: ${escapeHtml(s.headline)}</b>`,
        escapeHtml(s.bodyText)
      );
      plainParts.push(`\nاسلاید ${s.slideNumber}: ${s.headline}`, s.bodyText);
    });
  }

  htmlParts.push('', `— <i>ارسال‌شده از اپلیکیشن قلاب</i>`);
  plainParts.push('', `— ارسال‌شده از اپلیکیشن قلاب`);

  // Split safely under Telegram's 4096-char message limit
  const fullHtml = htmlParts.join('\n');
  const htmlChunks: string[] = [];
  if (fullHtml.length <= 3900) {
    htmlChunks.push(fullHtml);
  } else {
    let current = '';
    for (const line of htmlParts) {
      if ((current + '\n' + line).length > 3800 && current.length > 0) {
        htmlChunks.push(current);
        current = line;
      } else {
        current = current ? `${current}\n${line}` : line;
      }
    }
    if (current) htmlChunks.push(current);
  }

  return { htmlChunks, plainText: plainParts.join('\n') };
}

function explainTelegramNetworkError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('network')
  ) {
    return 'دسترسی مستقیم سرور فعلی به api.telegram.org مسدود یا قطع است (در محیط سرور دارای اینترنت آزاد یا با پروکسی تلگرام، پیام بلافاصله ارسال می‌شود). می‌توانید متن آماده تلگرام را با یک کلیک کپی کنید.';
  }
  return `خطا در ارتباط با ربات تلگرام: ${msg}`;
}

export async function testTelegramConnection(params: {
  botToken: string;
  chatId: string;
  groupName?: string;
}): Promise<{ ok: boolean; botUsername?: string; message: string }> {
  const token = params.botToken.trim();
  const chatId = params.chatId.trim();

  if (!token) {
    return { ok: false, message: 'لطفاً توکن ربات تلگرام (از BotFather) را وارد کنید.' };
  }
  if (!chatId) {
    return { ok: false, message: 'لطفاً شناسه گروه یا کانال تلگرام (Chat ID) را وارد کنید.' };
  }

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    const meData = (await meRes.json()) as {
      ok: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
    };

    if (!meData.ok) {
      return {
        ok: false,
        message: `توکن ربات معتبر نیست: ${meData.description || 'Unauthorized'}`,
      };
    }

    const botUsername = meData.result?.username || meData.result?.first_name || 'Bot';
    const sendRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `✅ <b>اتصال اپلیکیشن قلاب به گروه برقرار شد!</b>\n🤖 ربات: @${escapeHtml(botUsername)}${
            params.groupName ? `\n👥 گروه: ${escapeHtml(params.groupName)}` : ''
          }\nاز این پس می‌توانید سناریوها و ویس‌های پیش‌ادیت را مستقیم به همین گروه ارسال کنید.`,
        }),
      }
    );

    const sendData = (await sendRes.json()) as { ok: boolean; description?: string };
    if (!sendData.ok) {
      return {
        ok: false,
        botUsername,
        message: `ربات (@${botUsername}) معتبر است اما ارسال به گروه ناموفق بود: ${sendData.description || 'بررسی کنید ربات در گروه عضو و ادمین باشد و Chat ID درست باشد.'}`,
      };
    }

    return {
      ok: true,
      botUsername,
      message: `اتصال موفق! پیام آزمایشی توسط ربات @${botUsername} در گروه ارسال شد.`,
    };
  } catch (err) {
    return { ok: false, message: explainTelegramNetworkError(err) };
  }
}

export async function sendScenarioToTelegramGroup(params: {
  botToken: string;
  chatId: string;
  hook: HookWithScenario;
  options: TelegramSendOptions;
  audioBuffer?: Buffer;
  audioFilename?: string;
}): Promise<{
  ok: boolean;
  sentMessages: number;
  sentAudio: boolean;
  message: string;
  plainText: string;
}> {
  const { botToken, chatId, hook, options, audioBuffer, audioFilename } = params;
  const { htmlChunks, plainText } = formatScenarioForTelegram(hook, options);

  if (!botToken.trim() || !chatId.trim()) {
    return {
      ok: false,
      sentMessages: 0,
      sentAudio: false,
      message: 'ابتدا از بخش «تنظیمات ← ربات تلگرام»، توکن ربات و شناسه گروه (Chat ID) را ذخیره کنید.',
      plainText,
    };
  }

  let sentMessages = 0;
  let sentAudio = false;

  try {
    for (const chunk of htmlChunks) {
      const res = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            chat_id: chatId.trim(),
            parse_mode: 'HTML',
            text: chunk,
            disable_web_page_preview: true,
          }),
        }
      );
      const data = (await res.json()) as { ok: boolean; description?: string };
      if (!data.ok) {
        return {
          ok: false,
          sentMessages,
          sentAudio,
          message: `ارسال پیام به گروه تلگرام ناموفق بود: ${data.description || 'خطای ناشناخته'}`,
          plainText,
        };
      }
      sentMessages++;
    }

    // Optionally upload the stitched rough-cut .wav preview straight into the group!
    if (audioBuffer && audioBuffer.length > 44) {
      const form = new FormData();
      form.append('chat_id', chatId.trim());
      form.append(
        'audio',
        new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' }),
        audioFilename || `rough-cut-${hook.tier}.wav`
      );
      form.append('title', hook.title.slice(0, 60));
      form.append('performer', hook.hookSpeakerName || 'قلاب');
      form.append('caption', `🎧 ویس پیش‌ادیت یکپارچه: ${hook.title}`);

      const audioRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendAudio`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(25000),
          body: form,
        }
      );
      const audioData = (await audioRes.json()) as { ok: boolean; description?: string };
      if (audioData.ok) {
        sentAudio = true;
      }
    }

    return {
      ok: true,
      sentMessages,
      sentAudio,
      message: sentAudio
        ? 'سناریو و ویس پیش‌ادیت با موفقیت در گروه تلگرام ارسال شدند!'
        : 'اطلاعات کامل سناریو با موفقیت در گروه تلگرام ارسال شد!',
      plainText,
    };
  } catch (err) {
    return {
      ok: false,
      sentMessages,
      sentAudio,
      message: explainTelegramNetworkError(err),
      plainText,
    };
  }
}
