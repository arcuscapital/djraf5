import { playFanfare } from "./audio";
import { loadTrophies, saveTrophies } from "./storage";
import { addOnAir, better, etaBadge, finishShow, MEDAL_NAME, nextRecord, toGoHint, type Celebration, type Medal, type Trophies } from "./trophies";

// Records for time on air (see trophies.ts for the rule), and the fun bit when
// a show finishes: a dance party, or the record he won during the show. Short
// (about 6 seconds), and the ✕ ends it straight away.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const root = $("celebrate");
const SHOW_MS = { party: 6000, bronze: 7000, silver: 7000, gold: 7000 };
let timer: number | null = null;

export const MEDAL_COLOR: Record<Medal, string> = { bronze: "#9C5A2A", silver: "#C9CED6", gold: "#E8B62C" };
const RIBBON: Record<Medal, string> = { bronze: "Nice one, DJ!", silver: "Super DJ!", gold: "Best DJ ever!" };

let trophies: Trophies = loadTrophies();
let avgSongSeconds = 240;
let unsaved = 0;
let bestThisShow: Medal | null = null; // the record to celebrate when this show finishes

// How long his songs are, so "about 3 songs" is roughly right.
export function setSongLength(seconds: number): void {
  if (seconds > 60) avgSongSeconds = seconds;
}

export function showStarted(): void {
  bestThisShow = null;
}

// Called once a second while the show is playing (not paused). Returns the
// record won at that moment, if any.
export function onAirSecond(): Medal | null {
  const r = addOnAir(trophies, 1);
  trophies = r.trophies;
  if (r.earned) bestThisShow = better(bestThisShow, r.earned);
  if (++unsaved >= 10 || r.earned) { saveTrophies(trophies); unsaved = 0; }
  return r.earned;
}

export function saveNow(): void {
  saveTrophies(trophies);
  unsaved = 0;
}

// The little badge on the live screen: "Silver in 12 min", coloured to match.
export const badge = () => ({ text: etaBadge(trophies), medal: nextRecord(trophies) });

export function celebrateShowEnd(): void {
  const c = finishShow(trophies, bestThisShow);
  bestThisShow = null;
  saveNow();
  showCelebration(c, true);
}

// Add ?demo=party, ?demo=bronze, ?demo=silver or ?demo=gold to the address to
// watch one without playing a show. Nothing is counted; it plays until the ✕.
export function previewCelebration(kind: "party" | Medal): void {
  const c: Celebration = kind === "party" ? { kind, trophies } : { kind, trophies: { ...trophies, [kind]: trophies[kind] + 1 } };
  showCelebration(c, false);
}

function fillTally(el: HTMLElement, t: Trophies, pop: Medal | null) {
  el.querySelectorAll<HTMLElement>("b[data-medal]").forEach(b => {
    const m = b.dataset.medal as Medal;
    b.textContent = String(t[m]);
    b.parentElement!.classList.toggle("cele-pop", m === pop);
  });
}

function showCelebration(c: Celebration, autoClose: boolean): void {
  const t = c.trophies;
  $("scene-party").classList.toggle("hidden", c.kind !== "party");
  const rec = $("scene-record");
  rec.classList.toggle("hidden", c.kind === "party");
  if (c.kind === "party") {
    fillTally($("party-tally"), t, null);
    const none = t.bronze + t.silver + t.gold === 0 && t.onAir < 60;
    $("party-hint").textContent = none
      ? "Records come from time on air: bronze, then silver, then gold — 30 minutes each."
      : toGoHint(t, avgSongSeconds);
  } else {
    const m = c.kind;
    rec.className = `cele-scene medal-${m}`;
    $("record-title").textContent = `${MEDAL_NAME[m]} record!`;
    $("record-ribbon").textContent = RIBBON[m];
    fillTally($("record-tally"), t, m);
    $("record-hint").textContent = m === "gold"
      ? `That's ${t.gold} gold ${t.gold === 1 ? "record" : "records"}! New round: bronze in 30 min.`
      : `Next up: ${toGoHint(t, avgSongSeconds).toLowerCase()}`;
  }
  // Showing it again restarts all the animations from the beginning.
  root.classList.remove("closing");
  root.classList.remove("hidden");
  void playFanfare(c.kind).catch(() => {});
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
