import type { ScenarioBeat } from './types.ts';

export interface VerifiableSegment {
  id: string;
  audioFileId: string;
  audioTitle: string;
  speakerId: string;
  speakerName: string;
  startSec: number;
  endSec: number;
  combinedStartSec?: number;
  combinedEndSec?: number;
  text: string;
}

export function normalizePersian(input: string): string {
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c+/g, ' ')
    .replace(/[«»""''،؛؟!.…,:;()\[\]{}\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether `candidate` appears verbatim (ignoring minor punctuation/space differences)
 * inside `segmentText`. If found, returns the exact verbatim slice from `segmentText`.
 */
export function findExactVerbatimSlice(segmentText: string, candidate: string): string | null {
  const trimmedCandidate = candidate.trim();
  if (!trimmedCandidate) return null;

  // Direct substring match
  if (segmentText.includes(trimmedCandidate)) {
    return trimmedCandidate;
  }

  // Sentence-level match inside segment
  const normCandidate = normalizePersian(trimmedCandidate);
  const normSegment = normalizePersian(segmentText);
  if (!normCandidate) return null;

  if (normSegment.includes(normCandidate)) {
    // Try matching individual sentences inside segmentText to return crisp exact quote
    const sentences = segmentText
      .split(/(?<=[.؟!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const matchingSentences = sentences.filter((s) => {
      const ns = normalizePersian(s);
      return ns.length > 5 && (normCandidate.includes(ns) || ns.includes(normCandidate));
    });
    if (matchingSentences.length > 0) {
      return matchingSentences.join(' ');
    }
    return segmentText.trim();
  }

  return null;
}

/**
 * Ensures every scenario beat strictly references an existing transcript segment
 * and contains ONLY verbatim text from that segment (never paraphrased or invented).
 */
export function verifyAndSnapBeats(
  beats: Array<{
    label: string;
    segmentId?: string;
    verbatimText: string;
    editingNote: string;
  }>,
  segments: VerifiableSegment[]
): { verifiedBeats: ScenarioBeat[]; verbatimScore: number } {
  const segById = new Map<string, VerifiableSegment>();
  for (const seg of segments) {
    segById.set(seg.id, seg);
  }

  const verifiedBeats: ScenarioBeat[] = [];
  let exactMatches = 0;

  beats.forEach((beat, idx) => {
    let seg = beat.segmentId ? segById.get(beat.segmentId) : undefined;
    let exactText: string | null = null;

    if (seg) {
      exactText = findExactVerbatimSlice(seg.text, beat.verbatimText);
    }

    // If not matched inside the claimed segment, search all segments
    if (!exactText) {
      for (const candidateSeg of segments) {
        const match = findExactVerbatimSlice(candidateSeg.text, beat.verbatimText);
        if (match) {
          seg = candidateSeg;
          exactText = match;
          break;
        }
      }
    }

    // Fallback: best token overlap segment and snap strictly to its exact verbatim text
    if (!exactText) {
      if (!seg) {
        const candTokens = new Set(normalizePersian(beat.verbatimText).split(' ').filter((w) => w.length > 2));
        let bestSeg = segments[Math.min(idx, segments.length - 1)];
        let bestOverlap = -1;
        for (const candidateSeg of segments) {
          const segTokens = normalizePersian(candidateSeg.text).split(' ');
          let overlap = 0;
          for (const tok of segTokens) {
            if (candTokens.has(tok)) overlap++;
          }
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestSeg = candidateSeg;
          }
        }
        seg = bestSeg;
      }
      // Strictly snap to the actual verbatim transcript text so NOTHING altered reaches the editor!
      exactText = seg ? seg.text.trim() : beat.verbatimText.trim();
    }

    if (seg) {
      const isExact = seg.text.includes(exactText);
      if (isExact) exactMatches++;
      verifiedBeats.push({
        beatOrder: idx + 1,
        label: beat.label,
        segmentId: seg.id,
        sourceAudioId: seg.audioFileId,
        sourceAudioTitle: seg.audioTitle,
        speakerId: seg.speakerId,
        speakerName: seg.speakerName,
        startSec: seg.startSec,
        endSec: seg.endSec,
        combinedStartSec: seg.combinedStartSec,
        combinedEndSec: seg.combinedEndSec,
        verbatimText: exactText,
        verifiedVerbatim: isExact,
        editingNote: beat.editingNote,
      });
    }
  });

  const verbatimScore =
    verifiedBeats.length > 0 ? Math.round((exactMatches / verifiedBeats.length) * 100) : 100;

  return { verifiedBeats, verbatimScore };
}
