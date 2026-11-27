import type { HookWithScenario } from '../types';
import { BLUEPRINT_META, TIER_META, formatTimecode, toFa } from './format';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSingleHookSection(hook: HookWithScenario, index: number, total: number): string {
  const tier = TIER_META[hook.tier];
  const bp = BLUEPRINT_META[hook.viralBlueprint || 'myth_buster'];
  const tierColor =
    hook.tier === 'gold' ? '#B45309' : hook.tier === 'silver' ? '#475569' : '#C2410C';
  const tierBg =
    hook.tier === 'gold' ? '#FEF3C7' : hook.tier === 'silver' ? '#F1F5F9' : '#FFEDD5';

  const beatsRows = hook.scenarioBeats
    .map(
      (b) => `
      <tr>
        <td class="num">${toFa(b.beatOrder)}</td>
        <td class="meta">
          <div class="beat-label">${esc(b.label)}</div>
          <div class="sub">${esc(b.sourceAudioTitle.split('—')[0].trim())} · ${esc(b.speakerName)}</div>
        </td>
        <td class="tc" dir="ltr">${formatTimecode(b.startSec)} — ${formatTimecode(b.endSec)}</td>
        <td class="quote">
          <div class="verbatim">«${esc(b.verbatimText)}»</div>
          ${b.editingNote ? `<div class="note"><strong>نکته تدوین:</strong> ${esc(b.editingNote)}</div>` : ''}
        </td>
      </tr>`
    )
    .join('');

  const auditHtml = hook.viralAudit
    ? `
    <div class="grid-4">
      <div class="stat"><div class="stat-val">${toFa(hook.viralAudit.overallScore)}٪</div><div class="stat-lbl">امتیاز وایرالیته</div></div>
      <div class="stat"><div class="stat-val">${toFa(hook.viralAudit.hookHoldScore)}٪</div><div class="stat-lbl">قدرت ۳ ثانیه اول</div></div>
      <div class="stat"><div class="stat-val">${toFa(hook.viralAudit.retentionPaceScore)}٪</div><div class="stat-lbl">ماندگاری و ریتم</div></div>
      <div class="stat"><div class="stat-val">${toFa(hook.viralAudit.shareabilityScore)}٪</div><div class="stat-lbl">پتانسیل ارسال DM</div></div>
    </div>`
    : '';

  const moodHtml = hook.audioMoodGuide
    ? `
    <div class="box">
      <h3>🎵 راهنمای موسیقی پس‌زمینه و حال‌وهوای صدا</h3>
      <p><strong>مود پیشنهادی:</strong> ${esc(hook.audioMoodGuide.moodTitle)} — ${esc(hook.audioMoodGuide.vibeDescription)}</p>
      <p><strong>ریتم و میکس:</strong> ${esc(hook.audioMoodGuide.bpmRange)} | ${esc(hook.audioMoodGuide.volumeDbGuide)}</p>
      ${
        hook.audioMoodGuide.musicDropPhrase
          ? `<p><strong>⚡ لحظه طلایی قطع موزیک (برش ${toFa(hook.audioMoodGuide.musicDropBeatOrder || 1)}):</strong> «${esc(hook.audioMoodGuide.musicDropPhrase)}...»</p>`
          : ''
      }
      <p><strong>کلیدواژه جستجوی موزیک:</strong> <span dir="ltr" class="mono">${esc(hook.audioMoodGuide.searchKeywords.join('  ·  '))}</span></p>
    </div>`
    : '';

  const kitHtml = hook.publishingKit
    ? `
    <div class="box">
      <h3>📱 پکیج انتشار ادمین پیج</h3>
      <p><strong>متن درشت ۳ ثانیه اول روی تصویر:</strong> ${esc(hook.publishingKit.onScreenHook)}</p>
      <p><strong>پیشنهادهای تیتر کاور:</strong> ${hook.publishingKit.coverTitles.map((c) => `«${esc(c)}»`).join(' · ')}</p>
      ${
        hook.publishingKit.commentCtaKeyword
          ? `<p><strong>کلیدواژه دایرکت هوشمند:</strong> <span class="kw">${esc(hook.publishingKit.commentCtaKeyword)}</span> — ${esc(hook.publishingKit.commentCtaLine || '')}</p>`
          : ''
      }
      <div class="caption-box">${esc(hook.publishingKit.fullCaption)}</div>
      ${
        hook.publishingKit.storyStickers.length > 0
          ? `<div class="stickers">
              <strong>استیکرهای استوری:</strong>
              <ul>${hook.publishingKit.storyStickers
                .map(
                  (st) =>
                    `<li>اسلاید ${toFa(st.slideOrder)} (${esc(st.stickerLabel)}): «${esc(st.promptText)}» ${
                      st.options?.length ? `[${st.options.map(esc).join(' / ')}]` : ''
                    }</li>`
                )
                .join('')}</ul>
            </div>`
          : ''
      }
    </div>`
    : '';

  const carouselHtml = hook.publishingKit?.carouselSlides?.length
    ? `
    <div class="box">
      <h3>📑 اسلایدهای پست کاروسل (${toFa(hook.publishingKit.carouselSlides.length)} اسلاید)</h3>
      <div class="slides-grid">
        ${hook.publishingKit.carouselSlides
          .map(
            (s) => `
          <div class="slide-card">
            <div class="slide-num">اسلاید ${toFa(s.slideNumber)}</div>
            <div class="slide-head">${esc(s.headline)}</div>
            <div class="slide-body">${esc(s.bodyText)}</div>
            <div class="slide-cue">🎨 ${esc(s.designCue)}</div>
          </div>`
          )
          .join('')}
      </div>
    </div>`
    : '';

  return `
  <article class="scenario-card ${index > 0 ? 'page-break' : ''}">
    <div class="card-head">
      <div>
        <div class="badges">
          <span class="badge" style="background:${tierBg};color:${tierColor};border:1px solid ${tierColor}40">${esc(tier.label)}</span>
          <span class="badge neutral">${esc(bp.label)}</span>
          <span class="badge neutral">${esc(hook.formatLabel)} · ~${toFa(hook.estimatedDurationSec)} ثانیه</span>
          <span class="badge ok">✓ تطابق ${toFa(hook.verbatimScore)}٪ عین متن</span>
        </div>
        <h2>${total > 1 ? `${toFa(index + 1)}. ` : ''}${esc(hook.title)}</h2>
        ${hook.rationale ? `<p class="rationale">${esc(hook.rationale)}</p>` : ''}
      </div>
    </div>

    ${auditHtml}

    <div class="section-title">✂️ جدول برش دقیق گفتار (برای تدوینگر — ۱۰۰٪ عین متن بدون تغییر)</div>
    <table>
      <thead>
        <tr>
          <th style="width:42px">#</th>
          <th style="width:170px">بخش / فایل و گوینده</th>
          <th style="width:115px">تایم‌کد دقیق</th>
          <th>متن دقیق گفتار و یادداشت تدوین</th>
        </tr>
      </thead>
      <tbody>${beatsRows}</tbody>
    </table>

    ${moodHtml}
    ${kitHtml}
    ${carouselHtml}
  </article>`;
}

/**
 * Generates a complete, self-contained, offline-ready RTL Persian HTML handoff sheet
 * for video editors, page admins, and clients (one-click Print to PDF or download .html).
 */
export function buildHandoffHtmlDocument(params: {
  projectTitle: string;
  hooks: HookWithScenario[];
}): string {
  const { projectTitle, hooks } = params;
  const dateStr = new Date().toLocaleDateString('fa-IR');

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>بسته تحویل سناریو | ${esc(projectTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 20px 60px;
      background: #F6F4EF;
      color: #1A1816;
      font-family: 'Vazirmatn', 'Tahoma', system-ui, -apple-system, sans-serif;
      line-height: 1.75;
    }
    .container { max-width: 920px; margin: 0 auto; }
    .toolbar {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      background: #141210; color: #FAF6EE; padding: 14px 20px; border-radius: 16px;
      margin-bottom: 24px;
    }
    .toolbar .brand { font-weight: 900; font-size: 15px; color: #F7D782; }
    .toolbar .sub { font-size: 12px; color: #A49B8E; }
    .btn {
      background: linear-gradient(135deg, #F6CE78, #D99B29); color: #141210;
      border: 0; border-radius: 10px; padding: 9px 18px; font-family: inherit;
      font-weight: 800; font-size: 12px; cursor: pointer;
    }
    .scenario-card {
      background: #FFFFFF; border: 1px solid #E7E2D8; border-radius: 20px;
      padding: 28px; margin-bottom: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.04);
    }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .badge {
      display: inline-block; padding: 3px 10px; border-radius: 8px;
      font-size: 11px; font-weight: 800;
    }
    .badge.neutral { background: #F3F0EA; color: #524B42; }
    .badge.ok { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    h2 { margin: 6px 0 8px; font-size: 20px; font-weight: 900; color: #12100E; }
    h3 { margin: 0 0 10px; font-size: 14px; font-weight: 900; color: #1E1B18; }
    .rationale { margin: 0 0 16px; font-size: 13px; color: #5C554C; }
    .grid-4 {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 22px;
    }
    .stat {
      background: #FAF8F4; border: 1px solid #ECE7DD; border-radius: 12px;
      padding: 10px 12px; text-align: center;
    }
    .stat-val { font-size: 18px; font-weight: 900; color: #B45309; }
    .stat-lbl { font-size: 11px; color: #6B6359; }
    .section-title { font-size: 13px; font-weight: 900; margin: 18px 0 10px; color: #1A1816; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12.5px; }
    th, td { border: 1px solid #E5DFD5; padding: 10px 12px; vertical-align: top; text-align: right; }
    th { background: #F7F4EE; font-weight: 800; color: #3B352E; }
    td.num { text-align: center; font-weight: 900; color: #B45309; }
    td.tc { font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 800; color: #92400E; text-align: center; white-space: nowrap; }
    .beat-label { font-weight: 800; color: #1E1B18; margin-bottom: 3px; }
    .sub { font-size: 11px; color: #78716C; }
    .verbatim { font-size: 13.5px; font-weight: 600; color: #12100E; line-height: 1.9; }
    .note { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #E7E2D8; font-size: 11.5px; color: #6B6359; }
    .box {
      background: #FAF8F4; border: 1px solid #E9E4DA; border-radius: 14px;
      padding: 16px 18px; margin-top: 16px; font-size: 12.5px;
    }
    .box p { margin: 5px 0; }
    .mono { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11.5px; }
    .kw {
      display: inline-block; background: #DCFCE7; color: #166534; font-weight: 900;
      padding: 2px 8px; border-radius: 6px;
    }
    .caption-box {
      margin-top: 10px; background: #FFFFFF; border: 1px solid #E7E2D8; border-radius: 10px;
      padding: 12px 14px; white-space: pre-line; font-size: 12.5px; color: #262320;
    }
    .stickers { margin-top: 10px; }
    .stickers ul { margin: 6px 0 0; padding-right: 18px; }
    .slides-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;
    }
    .slide-card {
      background: #FFFFFF; border: 1px solid #E7E2D8; border-radius: 12px; padding: 12px;
    }
    .slide-num { font-size: 10.5px; font-weight: 900; color: #B45309; margin-bottom: 4px; }
    .slide-head { font-size: 13px; font-weight: 900; color: #141210; margin-bottom: 5px; }
    .slide-body { font-size: 12px; color: #44403C; }
    .slide-cue { margin-top: 6px; font-size: 10.5px; color: #78716C; }
    @media print {
      body { background: #FFF; padding: 0; }
      .toolbar { display: none !important; }
      .scenario-card { box-shadow: none; border: 1px solid #DDD; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <div>
        <div class="brand">بسته تحویل تدوین و انتشار قلاب — ${esc(projectTitle)}</div>
        <div class="sub">${toFa(hooks.length)} سناریوی آماده · تاریخ خروجی: ${esc(dateStr)}</div>
      </div>
      <button class="btn" onclick="window.print()">چاپ / ذخیره PDF</button>
    </div>
    ${hooks.map((h, i) => renderSingleHookSection(h, i, hooks.length)).join('')}
  </div>
</body>
</html>`;
}

export function openHandoffSheetPreview(projectTitle: string, hooks: HookWithScenario[]): void {
  const html = buildHandoffHtmlDocument({ projectTitle, hooks });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Fallback to direct download if popup blocked
    downloadHandoffSheetFile(projectTitle, hooks);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadHandoffSheetFile(projectTitle: string, hooks: HookWithScenario[]): void {
  const html = buildHandoffHtmlDocument({ projectTitle, hooks });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (hooks.length === 1 ? hooks[0].title : projectTitle)
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 44);
  const a = document.createElement('a');
  a.href = url;
  a.download = `handoff-${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
