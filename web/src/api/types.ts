export type Language = 'sw' | 'en';
export type PartState = 'draft' | 'ready' | 'scheduled' | 'public' | 'unpublished' | 'removed';
export type ReleasePlan = 'all_at_once' | 'daily' | 'weekly' | 'manual';
export type WorkStatus = 'draft' | 'ongoing' | 'completed' | 'hiatus';
export type ContentRating = 'general' | 'teen' | 'mature';
export type PartKind = 'chapter' | 'poem' | 'essay';
export type WorkAccess = 'public' | 'preview' | 'members';

export interface Me {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  role: 'reader' | 'moderator' | 'admin';
  uiLanguage: Language;
  bio: string | null;
  profilePublic: boolean;
  mature?: boolean;
}

export interface AuthResponse {
  user: Me;
  accessToken: string;
  refreshToken: string;
}

export interface WorkCard {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  language: Language;
  kind: 'single' | 'series';
  genre: string | null;
  tags: string[];
  rating: ContentRating;
  status: WorkStatus;
  access: WorkAccess;
  previewParts: number;
  coverKey: string | null;
  releasePlan: ReleasePlan;
  releaseTime: string;
  releaseWeekdays: number[];
  firstPublicAt: string | null;
  lastPublicAt: string | null;
  owner: { id: string; handle: string; displayName: string };
  _count: { follows: number; parts: number };
}

export interface PartSummary {
  id: string;
  workId: string;
  position: number;
  title: string;
  kind: PartKind;
  state: PartState;
  wordCount: number;
  readMinutes: number;
  version: number;
  publicAt: string | null;
  releasedAt: string | null;
  updatedAt: string;
}

export interface Progress {
  partId?: string;
  paragraphIndex: number;
  fraction: number;
  finished: boolean;
  updatedAt?: string;
}

export interface WorkPage extends WorkCard {
  parts: (PartSummary & { likes?: number | string; progress: Progress | null; locked: boolean })[];
  following: boolean;
  followers: number | string;
  readers: string;
  nextRelease: { position: number; title: string; publicAt: string | null } | null;
  isOwner: boolean;
}

export interface PartPage {
  work: { id: string; slug: string; title: string; rating: ContentRating; language: Language; owner: { handle: string; displayName: string } };
  part: PartSummary & { bodyHtml: string };
  prev: { position: number; title: string } | null;
  next: { position: number; title: string; state: PartState; publicAt: string | null } | null;
  progress: Progress | null;
  liked: boolean;
}

export interface LibraryItem {
  work: WorkCard;
  current: { position: number; title: string; paragraphIndex: number; fraction: number; finished: boolean; updatedAt: string } | null;
  finishedParts: number;
  totalParts: number;
  unread: number;
  done: boolean;
}

export interface StudioWork extends Omit<WorkCard, 'owner' | '_count'> {
  ownerId: string;
  timezone: string;
  _count?: { parts: number; follows: number };
  parts?: (PartSummary & { hasDraft: boolean })[];
  nextSlot?: string | null;
  followers?: number;
}

export interface StudioPart extends PartSummary {
  draftJson: unknown | null;
  bodyJson: unknown | null;
  bodyHtml: string;
  work: StudioWork;
}

export interface Comment {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  user: { handle: string; displayName: string };
}
