// The reward rule: time on air earns stars, stars earn gold records.
//
// Every 30 minutes on air (songs, jingles, news, recordings — anything playing,
// not paused) earns a ⭐. Five stars make a gold record, awarded when a show
// finishes. Minutes aren't lost when a show stops early; a 3-second show earns
// nothing. (It used to be "5 finished shows = gold", which 3-second shows beat.)

export const STAR_MINUTES = 30;
export const STARS_PER_GOLD = 5;
const STAR_SECONDS = STAR_MINUTES * 60;
const GOLD_SECONDS = STARS_PER_GOLD * STAR_SECONDS;

export interface Trophies {
  onAir: number; // seconds on air towards the next gold record
  golds: number; // gold records won so far
}

export interface Celebration {
  kind: "party" | "gold";
  trophies: Trophies; // the new totals, to show and save
}

export function normalize(t: Partial<Trophies> | null | undefined): Trophies {
  return { onAir: Math.max(0, Math.floor(t?.onAir ?? 0) || 0), golds: Math.max(0, Math.floor(t?.golds ?? 0) || 0) };
}

// Stars earned so far towards the next gold record (0–5).
export function stars(t: Trophies): number {
  return Math.min(STARS_PER_GOLD, Math.floor(t.onAir / STAR_SECONDS));
}

// Another second on air. `newStar` is true the moment a star is earned.
export function addOnAir(t: Trophies, seconds: number): { trophies: Trophies; newStar: boolean } {
  const before = stars(t);
  const trophies = { ...t, onAir: t.onAir + Math.max(0, seconds) };
  return { trophies, newStar: stars(trophies) > before };
}

// The show finished: a gold record if he has five stars, else a dance party.
// Time past the five stars carries over towards the next gold record.
export function finishShow(t: Trophies): Celebration {
  if (stars(t) >= STARS_PER_GOLD) return { kind: "gold", trophies: { onAir: t.onAir - GOLD_SECONDS, golds: t.golds + 1 } };
  return { kind: "party", trophies: t };
}

// Seconds until the next star (0 when he already has all five).
export function toNextStar(t: Trophies): number {
  const s = stars(t);
  return s >= STARS_PER_GOLD ? 0 : (s + 1) * STAR_SECONDS - t.onAir;
}

// ⭐⭐☆☆☆
export function starRow(t: Trophies): string {
  const s = stars(t);
  return "⭐".repeat(s) + "☆".repeat(STARS_PER_GOLD - s);
}

// What to say under the stars so he knows how far off the next one is — in
// minutes and in songs, never a fraction he'd have to work out.
export function toGoHint(t: Trophies, avgSongSeconds = 240): string {
  const left = toNextStar(t);
  if (left <= 0) return "Five stars! Finish a show for your gold record!";
  const min = Math.max(1, Math.ceil(left / 60));
  const songs = Math.max(1, Math.round(left / Math.max(60, avgSongSeconds)));
  return `Next star in ${min} min · about ${songs} ${songs === 1 ? "song" : "songs"}`;
}

// The short version for the live screen's badge.
export function etaBadge(t: Trophies): string {
  const left = toNextStar(t);
  if (left <= 0) return "🏆 Gold at the end!";
  return `⭐ in ${Math.max(1, Math.ceil(left / 60))} min`;
}
