import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { normalize, isOneMorph } from "./lib";
import { todayPuzzle, loadStats, recordWinFor, dayId as computeDayId } from "./daily";
import { warmDictAround, inDict, inDictSync } from "./dict";

type GameState = "playing" | "won";
type Mode = "daily" | "freeplay" | "timed";

const SITE_URL = "https://morphonyms.vercel.app"; // set to your live URL

function App() {
  // ---- Modes
  const [mode, setMode] = useState<Mode>("daily");

  // ---- Daily puzzle setup
  const { id: todayId, puzzle } = useMemo(() => todayPuzzle(), []);
  const [startWord, setStartWord] = useState(puzzle.start);
  const [targetWord, setTargetWord] = useState(puzzle.target);

  // ---- Stats (Daily streak)
  const [streak, setStreak] = useState(loadStats().streak);

  // ---- Game state
  const [path, setPath] = useState<string[]>([startWord]);
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState<string>("");
  const [state, setState] = useState<GameState>("playing");

  // ---- Dictionary readiness
  const [dictReady, setDictReady] = useState(false);

  // ---- Freeplay randomizer
  const [freeplayLen, setFreeplayLen] = useState(4); // 3/4/5

  // ---- Timed mode
  const [timedLen, setTimedLen] = useState(4); // 3/4/5
  const [timedDuration, setTimedDuration] = useState<number>(60); // 30 or 60 seconds
  const [timedLeft, setTimedLeft] = useState<number>(60);
  const [timedRunning, setTimedRunning] = useState(false);
  const [timedScore, setTimedScore] = useState(0);
  const [timedBest, setTimedBest] = useState<number>(() => loadTimedBest(4, 60));

  const currentWord = path[path.length - 1];

  // ---------------- Dictionary preloading ----------------
  useEffect(() => {
    setDictReady(false);
    warmDictAround(startWord.length)
      .then(() => setDictReady(true))
      .catch(() => setDictReady(true));
  }, [startWord]);

  useEffect(() => {
    warmDictAround(targetWord.length).catch(() => {});
  }, [targetWord]);

  // ---------------- Helpers ----------------
  function resetGame(newStart = startWord, newTarget = targetWord) {
    const s = normalize(newStart);
    const t = normalize(newTarget);
    setStartWord(s);
    setTargetWord(t);
    setPath([s]);
    setGuess("");
    setMessage("");
    setState("playing");
  }

  function setModeDaily() {
    setMode("daily");
    const { puzzle } = todayPuzzle();
    resetGame(puzzle.start, puzzle.target);
  }
  function setModeFreeplay() {
    setMode("freeplay");
    resetGame("COLD", "WARM");
  }
  function setModeTimed() {
    setMode("timed");
    // prepare a clean board, but don't start the clock until user clicks Start
    resetGame("COLD", "WARM");
    // load PR for current (timedLen, timedDuration)
    setTimedBest(loadTimedBest(timedLen, timedDuration));
    setTimedRunning(false);
    setTimedScore(0);
    setTimedLeft(timedDuration);
  }

  // random word from /public/dict/<len>.txt
  async function randomWord(len: number): Promise<string> {
    await warmDictAround(len);
    const url = `/dict/${len}.txt`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Missing /dict/${len}.txt`);
    const text = await res.text();
    const list = text.split(/\r?\n/).filter(Boolean);
    return list[Math.floor(Math.random() * list.length)];
  }

  async function randomizeFreeplay(len: number) {
    const s = await randomWord(len);
    let t = await randomWord(len);
    for (let i = 0; i < 10 && t === s; i++) t = await randomWord(len);
    resetGame(s, t);
  }

  async function nextFreeplayRandom4() {
    setMessage("Loading next…");
    try {
      await randomizeFreeplay(4);
      setMessage("");
    } catch {
      setMessage("Couldn’t load the 4-letter dictionary.");
    }
  }

  function validateWordSync(w: string): boolean {
    return inDictSync(w);
  }
  async function validateWordAsync(w: string): Promise<boolean> {
    return await inDict(w);
  }

  // ---------------- Timed mode: PR storage ----------------
  function timedKey(len: number, dur: number) {
    return `morph_timed_pr_${len}_${dur}`;
  }
  function loadTimedBest(len: number, dur: number): number {
    try {
      const raw = localStorage.getItem(timedKey(len, dur));
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
    }
  }
  function saveTimedBest(len: number, dur: number, val: number) {
    try {
      localStorage.setItem(timedKey(len, dur), String(val));
    } catch {}
  }

  // ---------------- Timed mode: run control ----------------
  async function startTimedRun() {
    // new random start/target of chosen length
    try {
      await randomizeFreeplay(timedLen);
    } catch {
      setMessage("Couldn't load dictionary for that length.");
      return;
    }
    setTimedScore(0);
    setTimedLeft(timedDuration);
    setTimedBest(loadTimedBest(timedLen, timedDuration));
    setTimedRunning(true);
    setMode("timed");
    setMessage("Go!");
  }

  function stopTimedRun(finalMsg?: string) {
    setTimedRunning(false);
    const best = loadTimedBest(timedLen, timedDuration);
    if (timedScore > best) {
      saveTimedBest(timedLen, timedDuration, timedScore);
      setTimedBest(timedScore);
      setMessage(finalMsg ?? `Time! New PR: ${timedScore}`);
    } else {
      setMessage(finalMsg ?? `Time! Score: ${timedScore} • PR: ${best}`);
    }
  }

  // countdown tick
  useEffect(() => {
    if (!timedRunning) return;
    const id = setInterval(() => {
      setTimedLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          // time up on this ladder → end run
          stopTimedRun("⏰ Time’s up! Run ended.");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedRunning]);

  // ---------------- Submit guess ----------------
  async function submitGuess() {
    const g = normalize(guess);
    setMessage("");

    // Rule check: add one, drop one, change one, or swap two letters
    if (!isOneMorph(currentWord, g)) {
      setMessage("Move must add one, drop one, change one, or swap two letters.");
      return;
    }

    // Dictionary required (both modes)
    const quick = validateWordSync(g);
    let ok = quick;
    if (!quick) ok = await validateWordAsync(g);
    if (!ok) {
      setMessage("Not in dictionary.");
      return;
    }

    // Allow repeats now (no blocking)
    // if (path.includes(g)) { ... }

    const newPath = [...path, g];
    setPath(newPath);
    setGuess("");

    // Win condition
    if (g === targetWord) {
      setState("won");
      if (mode === "daily") {
        setMessage(`Nice! Solved in ${newPath.length - 1} moves.`);
        const updated = recordWinFor(computeDayId());
        setStreak(updated.streak);
      } else if (mode === "freeplay") {
        setMessage(`Solved in ${newPath.length - 1} moves.`);
      } else if (mode === "timed") {
        // Timed: increment score and immediately start a new random ladder with full time
        const nextScore = timedScore + 1;
        setTimedScore(nextScore);
        setMessage(`✅ ${nextScore} solved — next!`);
        // new ladder and reset timer
        try {
          await randomizeFreeplay(timedLen);
          setState("playing");
          setTimedLeft(timedDuration);
        } catch {
          stopTimedRun("Dictionary error. Run ended.");
        }
      }
    }
  }

  // ---------------- Share result ----------------
  function shareResultEmoji() {
    const moves = path.length - 1;
    const header =
      mode === "daily"
        ? `Morphonyms #${todayId} — ${moves} move${moves === 1 ? "" : "s"}`
        : `Morphonyms (${mode}) — ${moves} move${moves === 1 ? "" : "s"}`;
    const bar = "🟩".repeat(Math.max(moves, 1));
    const body = `Path: ${path.join(" → ")}`;

    const text = `${header}\n${bar}\n${body}\n${SITE_URL}`;
    navigator.clipboard
      .writeText(text)
      .then(() => setMessage("Result copied! Paste to share."))
      .catch(() => setMessage("Couldn’t copy automatically."));
  }

  return (
    <div className="wrap">
      <header className="top">
        <h1>Morphonyms</h1>
        <p className="tag">
          Each move: add one, drop one, change one, or swap two letters. Every step must be in the dictionary.
        </p>
      </header>

      {!dictReady && (
        <div className="msg" style={{ color: "#555" }}>
          Loading dictionary…
        </div>
      )}

      {/* Mode selector */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className={"btn " + (mode === "daily" ? "" : "secondary")}
            onClick={setModeDaily}
            title="The one daily puzzle everyone shares"
          >
            Daily
          </button>
          <button
            className={"btn " + (mode === "freeplay" ? "" : "secondary")}
            onClick={setModeFreeplay}
            title="Practice any time"
          >
            Freeplay
          </button>
          <button
            className={"btn " + (mode === "timed" ? "" : "secondary")}
            onClick={setModeTimed}
            title="Solve as many ladders as you can"
          >
            Timed
          </button>
        </div>
        <div>
          <small>
            {mode === "daily" ? (
              <>Streak: <strong>{streak}</strong> • Puzzle #{todayId}</>
            ) : mode === "timed" ? (
              <>Score: <strong>{timedScore}</strong> • PR: <strong>{timedBest}</strong></>
            ) : (
              <>Freeplay mode</>
            )}
          </small>
        </div>
      </div>

      {/* Board */}
      <section className="board">
        <div className="pair">
          <div className="pill start">{startWord}</div>
          <span className="arrow">→</span>
          <div className="pill target">{targetWord}</div>
        </div>

        <ol className="path">
          {path.map((w, i) => (
            <li key={i} className="path-item">{w}</li>
          ))}
        </ol>

        {/* Guess Controls */}
        {state === "playing" && (
          <div className="controls">
            <input
              className="guessInput"
              placeholder={mode === "timed" && timedRunning ? `Time: ${timedLeft}s` : "Your next word"}
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitGuess()}
            />
            <button onClick={submitGuess} className="btn">Submit</button>
          </div>
        )}

        {message && <div className="msg">{message}</div>}

        <div className="row">
          <button className="btn secondary" onClick={() => resetGame()}>
            Reset
          </button>
          {state === "won" && mode !== "timed" && (
            <button className="btn" onClick={shareResultEmoji}>
              Share (emoji)
            </button>
          )}
            {mode === "freeplay" && state === "won" && (
    <button className="btn" onClick={nextFreeplayRandom4}>
      Next
    </button>
  )}
        </div>

        {/* Freeplay controls */}
        {mode === "freeplay" && (
          <details className="freeplay" open>
            <summary>Freeplay controls</summary>
            <div className="freeplay-inner">
              <label>
                Length:{" "}
                <select
                  value={freeplayLen}
                  onChange={(event) => setFreeplayLen(Number((event.target as HTMLSelectElement).value))}
                  style={{ padding: "0.35rem 0.5rem", borderRadius: 6 }}
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>

              <button
                className="btn"
                onClick={async () => {
                  setMessage("Generating random puzzle…");
                  try {
                    await randomizeFreeplay(freeplayLen);
                    setMessage("");
                  } catch {
                    setMessage("Couldn’t load dictionary for that length.");
                  }
                }}
              >
                Random Start/End
              </button>

              <label>
                Start:{" "}
                <input
                  value={startWord}
                  onChange={(e) => setStartWord(normalize(e.target.value))}
                />
              </label>
              <label>
                Target:{" "}
                <input
                  value={targetWord}
                  onChange={(e) => setTargetWord(normalize(e.target.value))}
                />
              </label>
              <button className="btn" onClick={() => resetGame(startWord, targetWord)}>
                Start New Ladder
              </button>
              <p className="hint">
                Both modes require dictionary words.
              </p>
            </div>
          </details>
        )}

        {/* Timed controls */}
        {mode === "timed" && (
          <details className="freeplay" open>
            <summary>Timed mode controls</summary>
            <div className="freeplay-inner">
              <label>
                Length:{" "}
                <select
                  value={timedLen}
                  onChange={(event) => {
                    const v = Number((event.target as HTMLSelectElement).value);
                    setTimedLen(v);
                    setTimedBest(loadTimedBest(v, timedDuration));
                  }}
                  style={{ padding: "0.35rem 0.5rem", borderRadius: 6 }}
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>

              <label>
                Per-ladder time:{" "}
                <select
                  value={timedDuration}
                  onChange={(event) => {
                    const v = Number((event.target as HTMLSelectElement).value);
                    setTimedDuration(v);
                    setTimedLeft(v);
                    setTimedBest(loadTimedBest(timedLen, v));
                  }}
                  style={{ padding: "0.35rem 0.5rem", borderRadius: 6 }}
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </label>

              {!timedRunning ? (
                <button className="btn" onClick={startTimedRun}>
                  Start Run
                </button>
              ) : (
                <button
                  className="btn secondary"
                  onClick={() => stopTimedRun("Run stopped.")}
                >
                  Stop Run
                </button>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Timer:</strong> {timedRunning ? `${timedLeft}s` : "—"} •{" "}
                <strong>Score:</strong> {timedScore} •{" "}
                <strong>PR:</strong> {timedBest}
              </div>

              <p className="hint" style={{ gridColumn: "1 / -1" }}>
                Finish each ladder before the clock hits zero. Score +1 per ladder. Timer resets each time you finish one. Your best score (PR) is saved on this device by length and time.
              </p>
            </div>
          </details>
        )}
      </section>

      <footer className="foot">
        <small>Prototype — dictionaries load on demand per word length.</small>
      </footer>
    </div>
  );
}

export default App;
