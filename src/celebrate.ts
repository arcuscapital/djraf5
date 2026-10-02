import { playFanfare } from "./audio";
import { loadTrophies, saveTrophies } from "./storage";
import { addOnAir, etaBadge, finishShow, starRow, stars, STARS_PER_GOLD, toGoHint, type Celebration, type Trophies } from "./trophies";

// Stars and gold records (see trophies.ts for the rule), and the fun bit when a
// show finishes: a dance party, or a gold record when he has five stars. Short
// (about 6 seconds), and the ✕ ends it straight away.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const root = $("celebrate");
const SHOW_MS = { party: 6000, gold: 7000 };
let timer: number | null = null;

let trophies: Trophies = loadTrophies();
let avgSongSeconds = 240;
let unsaved = 0;

// How long his songs are, so "about 3 songs" is roughly right.
export function setSongLength(seconds: number): void {
  if (seconds > 60) avgSongSeconds = seconds;
}

// Called once a second while the show is playing (not paused). True the
// moment a star is earned.
export function onAirSecond(): boolean {
  const r = addOnAir(trophies, 1);
  trophies = r.trophies;
  if (++unsaved >= 10 || r.newStar) { saveTrophies(trophies); unsaved = 0; }
  return r.newStar;
}

export function saveNow(): void {
  saveTrophies(trophies);
  unsaved = 0;
}

// The little badge on the live screen: "⭐ in 12 min".
export const starBadge = () => etaBadge(trophies);

export function celebrateShowEnd(): void {
  const c = finishShow(trophies);
  trophies = c.trophies;
  saveNow();
  showCelebration(c, true);
}

// Add ?demo=party or ?demo=gold to the address to watch one without playing a
// show. Nothing is counted, and it keeps playing until the ✕.
export function previewCelebration(kind: "party" | "gold"): void {
  const c: Celebration = kind === "gold"
    ? { kind, trophies: { onAir: 0, golds: trophies.golds + 1 } }
    : { kind, trophies };
  showCelebration(c, false);
}

function showCelebration(c: Celebration, autoClose: boolean): void {
  const gold = c.kind === "gold";
  $("scene-party").classList.toggle("hidden", gold);
  $("scene-gold").classList.toggle("hidden", !gold);
  if (gold) {
    $("gold-golds").textContent = String(c.trophies.golds);
    $("gold-hint").textContent = c.trophies.golds === 1 ? "Your first gold record!" : `That's ${c.trophies.golds} gold records!`;
  } else {
    $("party-stars").textContent = starRow(c.trophies);
    $("party-golds").textContent = String(c.trophies.golds);
    $("party-hint").textContent = stars(c.trophies) === 0 && c.trophies.onAir < 60
      ? `Stars come from time on air — 30 minutes each, ${STARS_PER_GOLD} for a gold record.`
      : toGoHint(c.trophies, avgSongSeconds);
  }
  // Showing it again restarts all the animations from the beginning.
  root.classList.remove("closing");
  root.classList.remove("hidden");
  void playFanfare(gold).catch(() => {});
  if (timer !== null) clearTimeout(timer);
  timer = autoClose ? window.setTimeout(() => closeCelebration(), SHOW_MS[c.kind]) : null;
}

export function closeCelebration(immediately = false): void {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (root.classList.contains("hidden")) return;
  if (immediately) { root.classList.add("hidden"); return; }
  root.classList.add("closing");
  window.setTimeout(() => { if (root.classList.contains("closing")) root.classList.add("hidden"); }, 400);
}

$("celebrate-close").addEventListener("click", () => closeCelebration());
