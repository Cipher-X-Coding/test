export type HookTier = 'gold' | 'silver' | 'bronze';
export type StoryFormat = 'single_story' | 'story_sequence';
export type AIProvider = 'demo' | 'gapgpt' | 'gemini' | 'openai';

export type ViralBlueprintId =
  | 'myth_buster'
  | 'before_after'
  | 'vulnerability'
  | 'framework'
  | 'amateur_vs_pro'
  | 'rapid_qa'
  | 'micro_loop';

export type SpecialReelFormat = 'standard' | 'micro_loop' | 'rapid_qa';

export interface InMediaResCut {
  hasFillerIntro: boolean;
  trimmedIntroText: string;
  punchlineVerbatim: string;
  suggestedTrimStartSec: number;
  savedSeconds: number;
  reason: string;
}

export interface DropoffWarning {
  beatOrder: number;
  atSec: number;
  severity: 'medium' | 'high';
  issue: string;
  fix: string;
}

export interface ViralAudit {
  overallScore: number;
  hookHoldScore: number;
  retentionPaceScore: number;
  shareabilityScore: number;
  saveabilityScore: number;
  dropoffWarnings: DropoffWarning[];
  quickWins: string[];
  loopSeamNote: string | null;
}

export interface AudioMoodGuide {
  moodTitle: string;
  vibeDescription: string;
  bpmRange: string;
  volumeDbGuide: string;
  musicDropBeatOrder: number | null;
  musicDropPhrase: string | null;
  musicDropReason: string;
  searchKeywords: string[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  eventDate: string;
  description: string;
  createdAt: string;
  audioCount: number;
  combinationCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
}

export interface Speaker {
  id: string;
  audioFileId: string;
  speakerKey: string;
  displayName: string;
  detectedName: string | null;
  detectedRole: string | null;
  detectionEvidence: string | null;
  color: string;
  segmentCount: number;
  totalDurationSec: number;
}

export interface TranscriptSegment {
  id: string;
  audioFileId: string;
  speakerId: string;
  speakerKey?: string;
  speakerName?: string;
  speakerColor?: string;
  orderIndex: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface ScenarioBeat {
  beatOrder: number;
  label: string;
  segmentId: string;
  sourceAudioId: string;
  sourceAudioTitle: string;
  speakerId: string;
  speakerName: string;
  startSec: number;
  endSec: number;
  combinedStartSec?: number;
  combinedEndSec?: number;
  verbatimText: string;
  verifiedVerbatim: boolean;
  editingNote: string;
}

export interface HookVariant {
  id: string;
  angleLabel: string;
  whyItWorks: string;
  segmentId: string;
  sourceAudioId: string;
  sourceAudioTitle: string;
  speakerId: string;
  speakerName: string;
  startSec: number;
  endSec: number;
  verbatimText: string;
  verifiedVerbatim: boolean;
}

export interface StoryStickerCue {
  slideOrder: number;
  stickerType: 'poll' | 'slider' | 'question' | 'dm_reply' | 'link';
  stickerLabel: string;
  promptText: string;
  options?: string[];
}

export interface CarouselSlide {
  slideNumber: number;
  role: 'cover' | 'hook' | 'insight' | 'example' | 'cta';
  roleLabel: string;
  headline: string;
  bodyText: string;
  designCue: string;
  sourceTimecode?: string;
}

export interface PublishingKit {
  coverTitles: string[];
  onScreenHook: string;
  fullCaption: string;
  commentCtaKeyword: string | null;
  commentCtaLine: string | null;
  storyStickers: StoryStickerCue[];
  carouselSlides?: CarouselSlide[];
}

export interface HookWithScenario {
  id: string;
  projectId: string;
  sourceType: 'audio' | 'combination';
  audioFileId: string | null;
  combinationId: string | null;
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
  alternativeHooks: HookVariant[];
  publishingKit: PublishingKit | null;
  viralBlueprint: ViralBlueprintId;
  specialFormat: SpecialReelFormat;
  inMediaResCut: InMediaResCut | null;
  viralAudit: ViralAudit | null;
  audioMoodGuide: AudioMoodGuide | null;
  storyEngagementIdea: string | null;
  captionIdea: string | null;
  verbatimScore: number;
  createdAt: string;
}

export interface AudioFileSummary {
  id: string;
  projectId: string;
  title: string;
  originalFilename: string;
  audioUrl: string;
  mimeType: string;
  fileSize: number;
  durationSec: number;
  status: 'processing' | 'ready' | 'error';
  analysisMode: AIProvider;
  speakerCount: number;
  segmentCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  createdAt: string;
}

export interface AudioFileDetail extends AudioFileSummary {
  speakers: Speaker[];
  segments: TranscriptSegment[];
  hooks: HookWithScenario[];
}

export interface OrderedAudioMeta {
  audioFileId: string;
  title: string;
  durationSec: number;
  offsetStartSec: number;
  offsetEndSec: number;
  color: string;
}

export interface MergedTranscriptSegment extends TranscriptSegment {
  sourceAudioTitle: string;
  combinedStartSec: number;
  combinedEndSec: number;
  speakerName: string;
  speakerColor: string;
}

export interface CombinationSummary {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  orderedAudioIds: string[];
  orderedAudioMeta: OrderedAudioMeta[];
  totalDurationSec: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  createdAt: string;
}

export interface CombinationDetail extends CombinationSummary {
  mergedSegments: MergedTranscriptSegment[];
  hooks: HookWithScenario[];
}

export interface ProjectQuoteSegment {
  id: string;
  audioFileId: string;
  audioTitle: string;
  audioUrl: string;
  speakerId: string;
  speakerName: string;
  speakerColor: string;
  orderIndex: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
  geminiModel: string;
  transcriptionModel: string;
  llmModel: string;
  telegramBotToken: string;
  hasTelegramBotToken: boolean;
  telegramChatId: string;
  telegramGroupName: string;
}
