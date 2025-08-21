// src/dict.ts
import { normalize } from "./lib";

// Cache loaded sets by word length
const cache: Record<number, Set<string>> = {};
const loading: Record<number, Promise<Set<string>>> = {};

async function fetchList(len: number): Promise<Set<string>> {
  if (cache[len]) return cache[len];
  if (await loading[len]) return loading[len];

  const url = `/dict/${len}.txt`;
  loading[len] = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load ${url}`);
      const text = await res.text();
      const set = new Set<string>();
      for (const raw of text.split(/\r?\n/)) {
        const w = normalize(raw);
        if (w && w.length === len && /^[A-Z]+$/.test(w)) {
          set.add(w);
        }
      }
      cache[len] = set;
      return set;
    })
    .finally(() => {
      delete loading[len];
    });

  return loading[len]!;
}

// Warm up dicts for len, len±1 (since moves can add/drop letters)
export async function warmDictAround(len: number) {
  const tasks: Promise<Set<string>>[] = [];
  for (const L of new Set([len - 1, len, len + 1])) {
    if (L >= 2 && L <= 15) tasks.push(fetchList(L).catch(() => new Set()));
  }
  await Promise.all(tasks);
}

export async function inDict(word: string): Promise<boolean> {
  const w = normalize(word);
  const len = w.length;
  try {
    const set = await fetchList(len);
    return set.has(w);
  } catch {
    return false;
  }
}

export function inDictSync(word: string): boolean {
  const w = normalize(word);
  const len = w.length;
  const set = cache[len];
  return !!set && set.has(w);
}
