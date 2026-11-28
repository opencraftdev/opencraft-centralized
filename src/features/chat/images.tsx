"use client";

// Pictures a person attaches to a chat message (docs/CHAT.md → "Pictures from the user"). They are uploaded to Google
// Drive (dashboard folder "Chat") as drive_files rows, and referenced at the end of the message text, one line each:
//   IMG: {"file_id":"<drive_files id>","name":"struk.jpg"}
// The agent reads those lines (e.g. the finance skill uses file_id as proof); the UI shows them as thumbnails.
import { BlurUpMedia } from "@/components/ui/BlurUpMedia";
import Box from "@mui/material/Box";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import { createClient } from "@/lib/supabase/client";
import { createFolder, uploadFile } from "@/features/drive/api";
import { driveContentUrl } from "@/lib/drive/links";

export interface ChatImage {
  file_id: string;
  name: string;
  type?: string; // "application/pdf" for a PDF; absent = picture
}
export const isPdf = (i: { type?: string; name?: string }) => i.type === "application/pdf" || /\.pdf$/i.test(i.name ?? "");

const LINE = /^IMG: (\{.*\})\s*$/;

/** Splits the IMG: lines off a message. */
export function splitImages(content: string): { text: string; images: ChatImage[] } {
  const images: ChatImage[] = [];
  const keep: string[] = [];
  for (const line of content.split("\n")) {
    const m = LINE.exec(line);
    if (m) {
      try {
        const v = JSON.parse(m[1]) as ChatImage;
        if (typeof v.file_id === "string") {
          images.push({ file_id: v.file_id, name: String(v.name ?? "gambar"), ...(v.type ? { type: String(v.type) } : {}) });
          continue;
        }
      } catch {
        /* not ours: keep the line */
      }
    }
    keep.push(line);
  }
  return { text: images.length ? keep.join("\n").trimEnd() : content, images };
}

/** Message text + IMG: lines. */
export function withImages(text: string, images: ChatImage[]): string {
  if (!images.length) return text;
  const body = text.trim() || (images.some(isPdf) ? "File terlampir." : "Gambar terlampir.");
  return `${body}\n\n${images.map((i) => `IMG: ${JSON.stringify({ file_id: i.file_id, name: i.name, ...(i.type ? { type: i.type } : {}) })}`).join("\n")}`;
}

let folderPromise: Promise<string> | null = null;
function chatFolder(): Promise<string> {
  folderPromise ??= (async () => {
    const { data, error } = await createClient()
      .from("drive_folders")
      .select("id")
      .eq("name", "Chat")
      .is("parent_id", null)
      .is("trashed_at", null)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0]?.id as string | undefined) ?? createFolder("Chat", null);
  })().catch((e) => {
    folderPromise = null;
    throw e;
  });
  return folderPromise;
}

export async function uploadChatImage(file: File): Promise<ChatImage> {
  const folderId = await chatFolder();
  const { data } = await createClient().auth.getUser();
  const id = await uploadFile(file, folderId, data.user?.id ?? "", { kind: "chat_image" });
  return { file_id: id, name: file.name || "gambar.png", ...(file.type === "application/pdf" ? { type: "application/pdf" } : {}) };
}

/** Thumbnails in a sent message (click opens the picture). */
export function ImageThumbs({ images }: { images: ChatImage[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
      {images.map((img) => (
        <Box
          key={img.file_id}
          component="a"
          href={driveContentUrl(img.file_id)}
          target="_blank"
          rel="noreferrer"
          title={img.name}
          sx={isPdf(img)
            ? { display: "flex", alignItems: "center", gap: 1, width: 220, height: 56, px: 1.25, borderRadius: "14px", bgcolor: "#fff", border: "1px solid #E0E3E7", textDecoration: "none", color: "#1F1F1F", "&:hover": { borderColor: "#A8C7FA" } }
            : { width: 120, height: 120, borderRadius: "16px", overflow: "hidden", bgcolor: "#E9EEF6", display: "block" }}
        >
          {isPdf(img) ? (
            <>
              <Box sx={{ width: 34, height: 34, borderRadius: "8px", bgcolor: "#FCE8E6", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <PictureAsPdfRounded sx={{ fontSize: 20, color: "#D93025" }} />
              </Box>
              <Box component="span" sx={{ fontSize: "0.8125rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</Box>
            </>
          ) : (
            <BlurUpMedia src={driveContentUrl(img.file_id)} alt={img.name} />
          )}
        </Box>
      ))}
    </Box>
  );
}
