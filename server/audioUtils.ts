import fs from 'node:fs';
import path from 'node:path';

/**
 * Generate a lightweight playable WAV file with gentle ambient pulse cues
 * at speaker transition points so demo audio playback and seeking work natively.
 */
export function generateDemoWav(
  outputPath: string,
  durationSec: number,
  transitionTimesSec: number[] = []
): number {
  const sampleRate = 8000; // compact & fast
  const numChannels = 1;
  const bitsPerSample = 16;
  const clampedDuration = Math.max(10, Math.min(durationSec, 360));
  const numSamples = Math.floor(sampleRate * clampedDuration);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const transitionSet = transitionTimesSec.map((t) => Math.floor(t * sampleRate));

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Soft warm cadence tone simulating seminar room presence (very quiet)
    const speechEnvelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.2 * t);
    let sample =
      Math.sin(2 * Math.PI * 196 * t) * 0.025 * speechEnvelope +
      Math.sin(2 * Math.PI * 293.66 * t) * 0.015 * Math.sin(2 * Math.PI * 0.7 * t);

    // Subtle chime at each speaker transition for clear timestamp seeking feedback
    for (let k = 0; k < transitionSet.length; k++) {
      const diff = i - transitionSet[k];
      if (diff >= 0 && diff < sampleRate * 0.25) {
        const decay = 1 - diff / (sampleRate * 0.25);
        const freq = k % 2 === 0 ? 523.25 : 659.25;
        sample += Math.sin(2 * Math.PI * freq * (diff / sampleRate)) * 0.14 * decay;
      }
    }

    const intVal = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return buffer.length;
}

/**
 * Inspect uploaded audio file to estimate duration in seconds.
 */
export function estimateAudioDurationSec(filePath: string, mimeType: string, fileSize: number): number {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(64);
    const bytesRead = fs.readSync(fd, header, 0, 64, 0);
    fs.closeSync(fd);

    // Exact WAV duration from RIFF header
    if (bytesRead >= 44 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE') {
      const byteRate = header.readUInt32LE(28);
      if (byteRate > 0) {
        const dataSize = Math.max(0, fileSize - 44);
        return Math.max(5, Math.round(dataSize / byteRate));
      }
    }
  } catch {
    // Fallback below
  }

  // Reasonable bitrate estimate based on mime type
  const lower = mimeType.toLowerCase();
  const bytesPerSec = lower.includes('wav')
    ? 88200
    : lower.includes('ogg') || lower.includes('webm')
      ? 12000
      : 16000; // ~128kbps mp3/m4a
  const est = Math.round(fileSize / bytesPerSec);
  return Math.max(45, Math.min(est, 7200));
}
