// src/daily.ts
export type Puzzle = { start: string; target: string };

export const PUZZLES: Puzzle[] = [
  { start: "COLD", target: "WARM" }, // classic ladder
  { start: "FOOL", target: "FOUR" }, // 2 moves in our mini-list
  { start: "CODE", target: "RODE" }, // 1 move "gimme"
];

// A simple, timezone-friendly "day id" (changes at local midnight)
export function dayId(date = new Date()): number {
  // normalize to local midnight
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(d.getTime() / 86_400_000); // days since Unix epoch
}

export function todayPuzzle(): { id: number; puzzle: Puzzle } {
  const id = dayId();
  const puzzle = PUZZLES[id % PUZZLES.length];
  return { id, puzzle };
}

type Stats = { lastWinDayId: number | null; streak: number };

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem("morph_stats");
    if (!raw) return { lastWinDayId: null, streak: 0 };
    return JSON.parse(raw) as Stats;
  } catch {
    return { lastWinDayId: null, streak: 0 };
  }
}

export function saveStats(s: Stats) {
  localStorage.setItem("morph_stats", JSON.stringify(s));
}

export function recordWinFor(day: number) {
  const s = loadStats();
  // If already recorded today, don't double count
  if (s.lastWinDayId === day) return s;

  // If yesterday was last win, streak++, else reset to 1
  const yesterday = day - 1;
  const next =
    s.lastWinDayId === yesterday
      ? { lastWinDayId: day, streak: (s.streak || 0) + 1 }
      : { lastWinDayId: day, streak: 1 };

  saveStats(next);
  return next;
}
