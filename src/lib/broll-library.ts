/**
 * Curated b-roll library.
 *
 * Rather than paying Veo per post (cheap tier = occasional incoherent clips,
 * and the footage sits under a dark scrim anyway), we generate a small set of
 * abstract, on-brand clips ONCE (scripts/veo-broll-library.ts), hand-pick the
 * good ones into `assets/video/broll-library.json`, and the engine rotates
 * through them as backgrounds — near-zero ongoing cost, full quality control.
 *
 * Empty library → callers fall back to the free gradient / Flux poster.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface BrollClip {
  url: string;
  label?: string;
}

interface LibraryFile {
  clips?: BrollClip[];
}

function libraryPath(): string {
  return (
    process.env.LOCKSAFE_BROLL_LIBRARY ||
    path.join(process.cwd(), "assets", "video", "broll-library.json")
  );
}

/** Load the approved clips (empty array if none / unreadable). */
export async function loadBrollLibrary(): Promise<BrollClip[]> {
  try {
    const raw = await readFile(libraryPath(), "utf8");
    const parsed = JSON.parse(raw) as LibraryFile;
    return (parsed.clips ?? []).filter((c) => c && typeof c.url === "string" && c.url);
  } catch {
    return [];
  }
}

/** Pick one approved clip URL at random, or null if the library is empty. */
export async function pickBrollUrl(): Promise<string | null> {
  const clips = await loadBrollLibrary();
  if (!clips.length) return null;
  return clips[Math.floor(Math.random() * clips.length)].url;
}
