import { extname } from "node:path"

const MIME: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".amr": "audio/amr",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
}

/** Meta checks a file's type against its own list, so the part says it. */
export const mimeOf = (name: string): string => MIME[extname(name).toLowerCase()] ?? "application/octet-stream"
