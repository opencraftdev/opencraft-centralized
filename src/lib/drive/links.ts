// Links for a drive_files row (docs/DRIVE.md → "Preview without a Google session").
// Preview + download go through our server (no Google session needed in the browser);
// "Buka di Google Drive" still opens drive.google.com.

export const driveContentUrl = (fileId: string, download = false) =>
  `/api/drive/files/${encodeURIComponent(fileId)}/content${download ? "?download=1" : ""}`;
export const driveViewUrl = (googleFileId: string) =>
  `https://drive.google.com/file/d/${encodeURIComponent(googleFileId)}/view`;
export const driveFolderUrl = (googleFolderId: string) =>
  `https://drive.google.com/drive/folders/${encodeURIComponent(googleFolderId)}`;
