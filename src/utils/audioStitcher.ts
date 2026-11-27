import type { ScenarioBeat } from '../types';

export interface StitchedBeatSlice {
  beatIndex: number;
  beatOrder: number;
  segmentId: string;
  label: string;
  speakerName: string;
  sourceAudioId: string;
  sourceAudioTitle: string;
  sourceStartSec: number;
  sourceEndSec: number;
  stitchedStartSec: number;
  stitchedEndSec: number;
  durationSec: number;
}

export interface StitchedScenarioAudio {
  wavBlob: Blob;
  blobUrl: string;
  totalDurationSec: number;
  slices: StitchedBeatSlice[];
  waveformPeaks: number[];
  gapMs: number;
}

// In-memory cache of decoded AudioBuffers keyed by audioUrl
const decodedBufferCache = new Map<string, Promise<AudioBuffer>>();
let sharedDecodeCtx: AudioContext | null = null;

function getDecodeContext(): AudioContext {
  if (!sharedDecodeCtx || sharedDecodeCtx.state === 'closed') {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedDecodeCtx = new AudioCtx();
  }
  return sharedDecodeCtx;
}

async function fetchAndDecodeAudio(audioUrl: string): Promise<AudioBuffer> {
  const cached = decodedBufferCache.get(audioUrl);
  if (cached) return cached;

  const promise = (async () => {
    const res = await fetch(audioUrl);
    if (!res.ok) {
      throw new Error(`خطا در دریافت فایل صوتی (${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const ctx = getDecodeContext();
    // Clone arrayBuffer because decodeAudioData detaches it
    return ctx.decodeAudioData(arrayBuffer.slice(0));
  })();

  decodedBufferCache.set(audioUrl, promise);
  promise.catch(() => {
    decodedBufferCache.delete(audioUrl);
  });
  return promise;
}

/**
 * Encode an AudioBuffer into a standard 16-bit PCM WAV Blob.
 */
function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeAscii(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk length
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Extract normalized visual waveform bars directly from the stitched AudioBuffer.
 */
function extractWaveformPeaks(buffer: AudioBuffer, barCount = 96): number[] {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  if (totalSamples === 0) return Array.from({ length: barCount }, () => 24);

  const samplesPerBar = Math.max(1, Math.floor(totalSamples / barCount));
  const rawRms: number[] = [];
  let maxRms = 0.0001;

  for (let b = 0; b < barCount; b++) {
    const start = b * samplesPerBar;
    const end = Math.min(totalSamples, start + samplesPerBar);
    // Stride sampling for speed on long buffers
    const step = Math.max(1, Math.floor((end - start) / 200));
    let sumSq = 0;
    let count = 0;
    for (let i = start; i < end; i += step) {
      const v = channelData[i];
      sumSq += v * v;
      count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    rawRms.push(rms);
    if (rms > maxRms) maxRms = rms;
  }

  return rawRms.map((rms) => {
    const normalized = Math.pow(rms / maxRms, 0.72);
    return Math.round(16 + normalized * 82);
  });
}

/**
 * Stitch all scenario beats in exact order into one continuous rough-cut WAV preview
 * with smooth micro-fades at cut boundaries so users can hear the edited flow before editing.
 */
export async function stitchScenarioBeats(
  beats: ScenarioBeat[],
  audioUrlById: Map<string, string>,
  gapMs = 150
): Promise<StitchedScenarioAudio> {
  if (!beats.length) {
    throw new Error('این سناریو برش صوتی ندارد.');
  }

  // Decode all unique source audio files referenced by the scenario beats
  const uniqueIds = Array.from(new Set(beats.map((b) => b.sourceAudioId)));
  const buffersById = new Map<string, AudioBuffer>();

  await Promise.all(
    uniqueIds.map(async (audioId) => {
      const url = audioUrlById.get(audioId);
      if (!url) return;
      const buf = await fetchAndDecodeAudio(url);
      buffersById.set(audioId, buf);
    })
  );

  // Pick a sensible output sample rate & channel count from the decoded sources
  const firstBuf = buffersById.values().next().value as AudioBuffer | undefined;
  if (!firstBuf) {
    throw new Error('فایل صوتی منبع این سناریو در دسترس نیست.');
  }

  const targetSampleRate = Math.min(44100, Math.max(16000, firstBuf.sampleRate));
  const targetChannels = Math.min(
    2,
    Math.max(...Array.from(buffersById.values()).map((b) => b.numberOfChannels))
  );

  const gapSec = Math.max(0, gapMs) / 1000;
  const slices: StitchedBeatSlice[] = [];
  let cursorSec = 0;

  beats.forEach((beat, beatIndex) => {
    const buf = buffersById.get(beat.sourceAudioId);
    if (!buf || buf.duration <= 0.1) return;

    const maxStart = Math.max(0, buf.duration - 0.35);
    const sourceStartSec = Math.max(0, Math.min(beat.startSec, maxStart));
    const rawEnd = beat.endSec > sourceStartSec + 0.25 ? beat.endSec : sourceStartSec + 2.5;
    const sourceEndSec = Math.max(sourceStartSec + 0.3, Math.min(rawEnd, buf.duration));
    const durationSec = sourceEndSec - sourceStartSec;

    if (slices.length > 0 && gapSec > 0) {
      cursorSec += gapSec;
    }

    const stitchedStartSec = cursorSec;
    const stitchedEndSec = cursorSec + durationSec;
    cursorSec = stitchedEndSec;

    slices.push({
      beatIndex,
      beatOrder: beat.beatOrder,
      segmentId: beat.segmentId,
      label: beat.label,
      speakerName: beat.speakerName,
      sourceAudioId: beat.sourceAudioId,
      sourceAudioTitle: beat.sourceAudioTitle,
      sourceStartSec,
      sourceEndSec,
      stitchedStartSec,
      stitchedEndSec,
      durationSec,
    });
  });

  if (slices.length === 0 || cursorSec <= 0) {
    throw new Error('برش قابل پخشی برای ترکیب یافت نشد.');
  }

  const totalDurationSec = cursorSec;
  const totalFrames = Math.max(1, Math.ceil(totalDurationSec * targetSampleRate));
  const offline = new OfflineAudioContext(targetChannels, totalFrames, targetSampleRate);

  for (const slice of slices) {
    const buf = buffersById.get(slice.sourceAudioId);
    if (!buf) continue;

    const src = offline.createBufferSource();
    src.buffer = buf;

    const gain = offline.createGain();
    const fadeSec = Math.min(0.022, slice.durationSec * 0.15);

    // Smooth micro fade-in & fade-out to eliminate pops/clicks on jump cuts
    gain.gain.setValueAtTime(0.0001, slice.stitchedStartSec);
    gain.gain.linearRampToValueAtTime(1, slice.stitchedStartSec + fadeSec);
    gain.gain.setValueAtTime(1, Math.max(slice.stitchedStartSec + fadeSec, slice.stitchedEndSec - fadeSec));
    gain.gain.linearRampToValueAtTime(0.0001, slice.stitchedEndSec);

    src.connect(gain);
    gain.connect(offline.destination);
    src.start(slice.stitchedStartSec, slice.sourceStartSec, slice.durationSec);
  }

  const rendered = await offline.startRendering();
  const wavBlob = encodeAudioBufferToWav(rendered);
  const blobUrl = URL.createObjectURL(wavBlob);
  const waveformPeaks = extractWaveformPeaks(rendered, 96);

  return {
    wavBlob,
    blobUrl,
    totalDurationSec,
    slices,
    waveformPeaks,
    gapMs,
  };
}
