import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { normalize, isOneMorph } from "./lib";
import { todayPuzzle, loadStats, recordWinFor, dayId as computeDayId } from "./daily";
import { warmDictAround, inDict, inDictSync } from "./dict";

type GameState = "playing" | "won";
type Mode = "daily" | "freeplay";

const SITE_URL = "https://morphonyms.vercel.app"; // update to your live URL

function App() {
  // Mode
  const [mode, setMode] = useState<Mode>("daily");

  // Daily puzzle setup (picked on mount)
  const { id: todayId, puzzle } = useMemo(() => todayPuzzle(), []);
  const [startWord, setStartWord] = useState(puzzle.start);
  const [targetWord, setTargetWord] = useState(puzzle.target);

  // Stats
  const [streak, setStreak] = useState(loadStats().streak);

  // Game state
  const [path, setPath] = useState<string[]>([startWord]);
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState<string>("");
  const [state, setState] = useState<GameState>("playing");

  // Dictionary readiness flag
  const [dictReady, setDictReady] = useState(false);

  const currentWord = path[path.length - 1];

  // ---- Dictionary preloading (for current start length, and optionally target) ----
  useEffect(() => {
    setDictReady(false);
    warmDictAround(startWord.length)
      .then(() => setDictReady(true))
      .catch(() => setDictReady(true)); // fail-open so UI doesn’t hang
  }, [startWord]);

  useEffect(() => {
    warmDictAround(targetWord.length).catch(() => {});
  }, [targetWord]);

  // ---- Mode switching ----
  function setModeDaily() {
    setMode("daily");
    const { puzzle } = todayPuzzle();
    resetGame(puzzle.start, puzzle.target);
  }
  function setModeFreeplay() {
    setMode("freeplay");
    resetGame("COLD", "WARM");
  }

  // ---- Dictionary checks (sync fast path + async fallback) ----
  function validateWordSync(w: string): boolean {
    return inDictSync(w);
  }
  async function validateWordAsync(w: string): Promise<boolean> {
    return await inDict(w);
  }

  // ---- Submit guess ----
  async function submitGuess() {
    const g = normalize(guess);
    setMessage("");

    // Rule check: add one, drop one, change one, or swap two letters
    if (!isOneMorph(currentWord, g)) {
      setMessage("Move must add one, drop one, change one, or swap two letters.");
      return;
    }

    // Dictionary required in ALL modes
    const quick = validateWordSync(g);
    let ok = quick;
    if (!quick) ok = await validateWordAsync(g);
    if (!ok) {
      setMessage("Not in dictionary.");
      return;
    }

    if (path.includes(g)) {
      setMessage("You already used that word.");
      return;
    }

    const newPath = [...path, g];
    setPath(newPath);
    setGuess("");

    if (g === targetWord) {
      setState("won");
      setMessage(`Nice! Solved in ${newPath.length - 1} moves.`);
      if (mode === "daily") {
        const updated = recordWinFor(computeDayId());
        setStreak(updated.streak);
      }
    }
  }

  // ---- Reset game ----
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

  // ---- Share result (emoji bar + path + site link) ----
  function shareResultEmoji() {
    const moves = path.length - 1;
    const header =
      mode === "daily"
        ? `Morphonyms #${todayId} — ${moves} move${moves === 1 ? "" : "s"}`
        : `Morphonyms (Freeplay) — ${moves} move${moves === 1 ? "" : "s"}`;
    const bar = "🟩".repeat(Math.max(moves, 1));
    const body = `Path: ${path.join(" → ")}`;

    const text = `${header}\n${bar}\n${body}\n${SITE_URL}`;
    navigator.clipboard
      .writeText(text)
      .then(() => setMessage("Result copied! Paste to share."))
      .catch(() => setMessage("Couldn’t copy automatically. You can copy manually."));
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

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: "0.5rem" }}>
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
        </div>
        <div>
          <small>
            {mode === "daily" ? (
              <>Streak: <strong>{streak}</strong> • Puzzle #{todayId}</>
            ) : (
              <>Freeplay mode</>
            )}
          </small>
        </div>
      </div>

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

        {state === "playing" && (
          <div className="controls">
            <input
              className="guessInput"
              placeholder="Your next word"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
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
          {state === "won" && (
            <button className="btn" onClick={shareResultEmoji}>
              Share (emoji)
            </button>
          )}
        </div>

        {mode === "freeplay" && (
          <details className="freeplay">
            <summary>Freeplay: choose your own start/target</summary>
            <div className="freeplay-inner">
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
                Freeplay & Daily both require dictionary words.
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
