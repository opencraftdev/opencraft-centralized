// Google Drive links for a drive_files.google_file_id (docs/DRIVE.md → "Preview/download").
// The team's browsers are signed in to Google as the Drive account, so these private links just work.

export const drivePreviewUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
export const driveDownloadUrl = (id: string) =>
  `https://drive.google.com/uc?id=${encodeURIComponent(id)}&export=download`;
