// Read-only mirror of public.news_briefs. The video-materials agent
// (agents/video-materials/) writes these rows with the service-role key; the
// dashboard only ever SELECTs them (RLS allows SELECT for signed-in viewers).

// One source story used to build the brief.
export interface NewsPick {
  title: string;
  url: string;
  source: string;
  score?: number | null;
  summary?: string | null;
}

// One spoken segment of the ≤2-minute script — a flowing paragraph, not bullets.
export interface ScriptSegment {
  title: string;
  narration: string;
  seconds: number;
}

export interface BriefScript {
  hook: string;
  segments: ScriptSegment[];
  outro: string;
  total_words: number;
  est_seconds: number;
}

export interface BriefCaption {
  text: string;
  hashtags: string[];
}

export interface BriefThumbnail {
  headline: string;
  subtext: string;
}

// One row in public.news_briefs.
export interface NewsBriefRow {
  id: string;
  title: string | null;
  // Null when the brief is presenter-neutral — the presenter is picked in the
  // Record Video UI instead of being baked into the brief.
  presenter_id: string | null;
  presenter_name: string | null;
  picks: NewsPick[];
  script: BriefScript;
  caption: BriefCaption;
  thumbnail: BriefThumbnail;
  thumbnail_url: string | null;
  est_seconds: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}
