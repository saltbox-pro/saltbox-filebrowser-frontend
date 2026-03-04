export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

import type { MaterialSymbol } from "@material-symbols/font-300";

export function getFileIcon(type: string): MaterialSymbol {
  if (type === "directory") return "folder";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "movie";
  if (type.startsWith("audio/")) return "audio_file";
  if (type.startsWith("text/")) return "description";
  if (type.includes("pdf")) return "picture_as_pdf";
  if (type.includes("zip") || type.includes("tar") || type.includes("compressed")) return "folder_zip";
  return "draft";
}

export function getParentPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}

export function joinPath(...segments: string[]): string {
  return segments
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "/";
}
