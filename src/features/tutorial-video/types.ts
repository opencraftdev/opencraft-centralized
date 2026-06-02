export type TutorialVideoStatus = "processing" | "done" | "failed";

// One row in public.tutorial_videos.
export interface TutorialVideoRow {
  id: string;
  user_email: string | null;
  title: string | null;
  name_text: string;
  source_public_id: string;
  output_url: string | null;
  status: TutorialVideoStatus;
  error: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

// Returned by POST /api/tutorial-video/sign — everything the browser needs to
// upload the raw recording directly to Cloudinary.
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

export interface CreditUsage {
  used: number;
  limit: number;
}
