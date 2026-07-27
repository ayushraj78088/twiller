import { parseBuffer } from "music-metadata";

export function isWithinISTAudioWindow(date = new Date()) {

  const options = {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "numeric",
    minute: "numeric",
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(date);

  let hour = 0;
  let minute = 0;
  for (const part of parts) {
    if (part.type === "hour") hour = parseInt(part.value, 10);
    if (part.type === "minute") minute = parseInt(part.value, 10);
  }

  // Permitting users to post audio tweets only between 2:00 PM (14:00) and 7:00 PM (19:00) IST
  if (hour > 14 && hour < 19) return true;
  if (hour === 14 && minute >= 0) return true;
  if (hour === 19 && minute === 0) return true;
  return false;
}

export async function validateAudioFile(fileBuffer, mimeType, fileSize) {
  const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
  const MAX_DURATION = 300; // 5 minutes = 300 seconds

  if (fileSize > MAX_SIZE) {
    return { valid: false, error: "Audio file size exceeds maximum limit of 100 MB." };
  }

  try {
    const metadata = await parseBuffer(fileBuffer, mimeType);
    const duration = metadata.format.duration;
    if (duration && duration > MAX_DURATION) {
      return { valid: false, error: "Audio file duration exceeds maximum limit of 5 minutes (300 seconds)." };
    }
  } catch (err) {
    console.warn("Audio metadata parsing fallback:", err.message);
    // If metadata parser cannot extract duration directly (e.g. raw webm stream), we rely on buffer checks/client validation
  }

  return { valid: true };
}
