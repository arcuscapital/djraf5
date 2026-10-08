import { ClipPlayer, MusicPlayer, pauseAll, playChime, resumeAll } from "./audio";
import { SongRun } from "./songRun";
import * as sp from "./spotify";
import { loadRecording } from "./storage";
import type { Block, Track } from "./types";

export const TYPE_LABELS: Record<Block["type"], string> = {
  songs: "Songs",
  jingle: "Jingle",
  talk: "Weather, Traffic, News",
  bed: "DJ Talk",
  commercial: "Commercial Break"
};

const QUIET_COPY: Partial<Record<Block["type"], [string, string]>> = {
  jingle: ["🎶 Jingle time!", "Sing your jingle! Press green when you're done."],
  talk: ["🎙️ You're on air, DJ!", "Tell us the weather, news & traffic! Press green when you're done."],
  commercial: ["📢 Your ad, DJ!", "Tell everyone about your product! Press green when you're done."]
};

export interface ShowUI {
  status(label: string, main: string, sub: string): void;
  progress(elapsedSec: number, durationSec: number | null): void;
  buttons(kind: "songs" | "talk" | "clip"): void;
  music(state: boolean | null): void; // the background music button: off / on, or null to hide it
  current(index: number): void;
  trouble(message: string | null): void;
  notice(message: string): void; // a friendly reminder that goes away by itself
  songList(tracks: Track[] | null, playingIndex: number): void; // this block's songs, or null to hide
  finished(): void;
}

interface Segment {
  pause(): Promise<unknown> | void;
  resume(): Promise<unknown> | void;
  stop(): void;
  skip?(): Promise<void> | void; // "Skip this song"
  seek?(ms: number): Promise<void> | void; // dragging the progress bar (songs only)
  done?(): void; // "I'm finished talking"
  toggleMusic?(): void; // the background music button while he talks
}

export class Show {
  index = 0;
  paused = false;
  running = false;
  private seg: Segment | null = null;
  private token = 0; // guards against a stale segment finishing after we moved on
  // the songs block that's on now (if any): its run, its songs, and which one is playing
  private songRun: SongRun | null = null;
  private songList: Track[] = [];
  private songIdx = -1;

  constructor(
    private blocks: Block[],
    private tracks: Map<string, Track[]>,
    private deviceId: string | null,
    private ui: ShowUI,
    private loop: () => Map<string, Track[]> | null // returns fresh songs to loop with, or null to finish
  ) {}

  async start(from = 0): Promise<void> {
    this.running = true;
    this.paused = false;
    if (this.deviceId) await sp.pauseVerified(this.deviceId); // stop whatever Spotify was already playing
    this.run(from);
  }

  private run(i: number): void {
    this.seg?.stop();
    this.seg = null;
    this.songRun = null;
    this.songList = [];
    this.songIdx = -1;
    this.ui.trouble(null);
    if (!this.running) return;
    if (i >= this.blocks.length) {
      const again = this.loop();
      if (again) {
        this.tracks = again;
        return this.run(0);
      }
      this.running = false;
      this.ui.finished();
      return;
    }
    this.index = i;
    this.ui.current(i);
    const token = ++this.token;
    const next = () => { if (token === this.token && this.running) this.run(i + 1); };
    const b = this.blocks[i];
    this.ui.music(null);
    if (b.type !== "songs") this.ui.songList(null, -1);
    if (b.type === "songs") this.seg = this.songs(b, next);
    else if (b.mode === "record") this.seg = this.clip(b, next, token);
    else this.seg = this.talk(b, next); // "talk" (and anything older)
    if (this.paused) void this.seg?.pause();
  }

  // ---------- songs: exact track list handed to Spotify ----------
  private songs(b: Block, next: () => void): Segment | null {
    const list = this.tracks.get(b.id) ?? [];
    if (!list.length || !this.deviceId) {
      this.ui.status("Songs", "No songs to play", "Skipping…");
      const t = setTimeout(next, 1500);
      return { pause() {}, resume() {}, stop: () => clearTimeout(t) };
    }
    this.ui.buttons("songs");
    this.ui.songList(list, 0);
    this.ui.status("Now Playing", `Song 1 of ${list.length}`, "Starting…");
    this.ui.progress(0, list[0].durationMs / 1000);
    this.songList = list;
    const run = new SongRun(this.deviceId, list, {
      onTrack: (idx, t) => {
        this.songIdx = idx;
        this.ui.trouble(null);
        this.ui.songList(this.songList, idx);
        this.ui.status("Now Playing", `Song ${idx + 1} of ${this.songList.length}`, `${t.name} – ${t.artist}`);
      },
      onProgress: (ms, dur) => this.ui.progress(ms / 1000, dur / 1000),
      onEnd: next,
      onTrouble: msg => this.ui.trouble(msg)
    });
    this.songRun = run;
    void run.start();
    return { pause: () => run.pause(), resume: () => run.resume(), stop: () => run.stop(), skip: () => run.skip(), seek: ms => run.seek(ms) };
  }

  // ---------- he talks ----------
  // No timer: it waits for the green "I'm finished" button, so he's never cut
  // off mid-sentence. Background music is off until he taps its button, then
  // loops for as long as he talks.
  private talk(b: Block, next: () => void): Segment {
    const music = new MusicPlayer();
    const label = TYPE_LABELS[b.type];
    const [main, sub] = QUIET_COPY[b.type] ?? ["🎤 Your turn, DJ!", "Speak to your listeners! Press green when you're done."];
    this.ui.status(label, main, sub);
    if (b.type === "jingle") void playChime();
    this.ui.buttons("talk");
    this.ui.music(false);
    let over = false;
    let elapsed = 0;
    this.ui.progress(0, null);
    let timer: number | null = null;
    const tick = () => { elapsed++; this.ui.progress(elapsed, null); timer = window.setTimeout(tick, 1000); };
    const finish = () => {
      if (over) return;
      over = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      music.stop(1200);
      this.ui.music(null);
      next();
    };
    timer = window.setTimeout(tick, 1000);
    return {
      pause: () => { if (timer !== null) { clearTimeout(timer); timer = null; } return pauseAll(); },
      resume: () => { if (timer === null) timer = window.setTimeout(tick, 1000); return resumeAll(); },
      stop: () => { over = true; if (timer !== null) clearTimeout(timer); timer = null; music.stop(600); },
      done: finish,
      toggleMusic: () => {
        if (over) return;
        if (music.wanted) { music.stop(800); this.ui.music(false); return; }
        this.ui.music(true);
        void music.start().then(ok => { if (!ok && !over && !music.wanted) this.ui.music(false); });
        if (this.paused) void pauseAll(); // tapped while paused: it starts when he resumes
      }
    };
  }

  // ---------- his recording, with the background music under it if he recorded with it on ----------
  private clip(b: Block, next: () => void, token: number): Segment {
    const label = TYPE_LABELS[b.type];
    const clip = new ClipPlayer();
    const music = b.music ? new MusicPlayer() : null;
    let progressTimer: number | null = null;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      if (progressTimer !== null) clearInterval(progressTimer);
      clip.stop();
      if (music) { music.stop(1200); setTimeout(next, 900); }
      else next();
    };
    this.ui.buttons("clip");
    this.ui.status(label, "▶ Playing recording...", music ? "Recording + background music" : "Listen up!");
    this.ui.progress(0, null);
    void (async () => {
      const blob = await loadRecording(b.id).catch(() => null);
      if (token !== this.token) return;
      if (!blob) {
        this.ui.status(label, "🤫 ...", "(no recording found)");
        setTimeout(finish, 2500);
        return;
      }
      if (music) { await music.start(0.035); await sp.sleep(700); } // softly, under his voice
      if (token !== this.token || over) return;
      const ok = await clip.play(blob, finish);
      if (!ok) { setTimeout(finish, 1500); return; }
      progressTimer = window.setInterval(() => this.ui.progress(clip.position, clip.duration), 250);
    })();
    return {
      pause: () => pauseAll(),
      resume: () => resumeAll(),
      stop: () => { over = true; if (progressTimer !== null) clearInterval(progressTimer); clip.stop(); music?.stop(600); },
      done: finish
    };
  }

  // ---------- reordering the songs mid-show ----------
  // Songs already played, and the one playing now. These can't be moved.
  playedSongs(): Track[] {
    const out: Track[] = [];
    for (let j = 0; j < this.index && j < this.blocks.length; j++) {
      const b = this.blocks[j];
      if (b.type === "songs") out.push(...(this.tracks.get(b.id) ?? []));
    }
    if (this.blocks[this.index]?.type === "songs") out.push(...this.songList.slice(0, this.songIdx + 1));
    return out;
  }
  // This songs block's songs so far: the ones played and the one playing.
  blockSoFar(): Track[] {
    return this.blocks[this.index]?.type === "songs" ? this.songList.slice(0, this.songIdx + 1) : [];
  }
  // The new running order after he moved songs around. Blocks still to come
  // simply use it; in the songs block that's on now, the songs after the one
  // playing are swapped in.
  updateTracks(tracks: Map<string, Track[]>): void {
    this.tracks = tracks;
    const b = this.blocks[this.index];
    if (!this.running || b?.type !== "songs" || !this.songRun) return;
    const keep = this.songIdx + 1;
    this.songList = [...this.songList.slice(0, keep), ...(tracks.get(b.id) ?? []).slice(keep)];
    void this.songRun.replaceUpcoming(this.songList);
    this.ui.songList(this.songList, this.songIdx);
  }

  // ---------- controls ----------
  async togglePause(): Promise<void> {
    if (!this.seg) return;
    this.paused = !this.paused;
    await (this.paused ? this.seg.pause() : this.seg.resume());
  }

  skipSong(): void { void this.seg?.skip?.(); }
  seekSong(ms: number): void { void this.seg?.seek?.(ms); }
  get canSeek(): boolean { return !!this.seg?.seek; }
  finishedTalking(): void { this.seg?.done?.(); }
  toggleMusic(): void { this.seg?.toggleMusic?.(); }

  stop(): void {
    this.running = false;
    this.token++;
    this.seg?.stop();
    this.seg = null;
    void resumeAll();
  }
}
