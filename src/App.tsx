import { useEffect, useMemo, useState } from "react";
import { WORDS } from "./words4";
import { isOneMorph, normalize } from "./lib";
import {
  todayPuzzle,
  loadStats,
  recordWinFor,
  dayId as computeDayId,
} from "./daily";
import "./App.css";

type GameState = "playing" | "won";
type Mode = "daily" | "freeplay";

function App() {
  // Mode
  const [mode, setMode] = useState<Mode>("daily");

  // Daily puzzle setup
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

  // const wordLen = useMemo(() => startWord.length, [startWord]);
  const currentWord = path[path.length - 1];
  const isValidWord = (w: string) =>
    mode === "freeplay" ? /^[A-Z]+$/.test(w) : WORDS.includes(w);  

  // If user switches to Freeplay, keep UI but don't tie to daily/streaks.
  function setModeDaily() {
    setMode("daily");
    const { puzzle } = todayPuzzle();
    resetGame(puzzle.start, puzzle.target);
  }
  function setModeFreeplay() {
    setMode("freeplay");
    resetGame("COLD", "WARM");
  }

  function submitGuess() {
    const g = normalize(guess);
    setMessage("");

    // lengths can differ by -1/0/+1 now; we validate by rule engine
if (!isOneMorph(currentWord, g)) {
  setMessage("Move must add one, drop one, change one, or swap two letters.");
  return;
}
if (!isValidWord(g)) {
  setMessage(
    mode === "freeplay"
      ? "Use only A–Z letters."
      : "That’s not in today’s dictionary."
  );
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

      // If this is the daily, record streak
      if (mode === "daily") {
        const updated = recordWinFor(computeDayId());
        setStreak(updated.streak);
      }
    }
  }

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

  function shareResultEmoji() {
    const moves = path.length - 1;
    const header =
      mode === "daily"
        ? `Morphonyms #${todayId} — ${moves} move${moves === 1 ? "" : "s"}`
        : `Morphonyms (Freeplay) — ${moves} move${moves === 1 ? "" : "s"}`;

    // Simple single-line emoji “bar” equal to number of moves
    const bar = "🟩".repeat(Math.max(moves, 1));
    const body = `Path: ${path.join(" → ")}`;

    const text = `${header}\n${bar}\n${body}\nhttps://morphonyms.vercel.app`;
    navigator.clipboard
      .writeText(text)
      .then(() => setMessage("Result copied! Paste to share."))
      .catch(() =>
        setMessage("Couldn’t copy automatically. You can copy manually from below.")
      );
  }

  // Make sure daily puzzle is set if user reloads while in daily mode
  useEffect(() => {
    if (mode === "daily") {
      const { puzzle } = todayPuzzle();
      resetGame(puzzle.start, puzzle.target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="wrap">
     <header className="top">
  <h1>Morphonyms</h1>
  <p className="tag">
    Each move: add one, drop one, change one, or swap two letters. Every step must be a real word.
  </p>
</header>


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
  placeholder={`Your next word`}
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
            <>
              <button className="btn" onClick={shareResultEmoji}>Share (emoji)</button>
            </>
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
              <button
                className="btn"
                onClick={() => resetGame(startWord, targetWord)}
              >
                Start New Ladder
              </button>
              <p className="hint">
                 Tip: start/target can be any real words in the dictionary.
              </p>
            </div>
          </details>
        )}
      </section>

      <footer className="foot">
        <small>Prototype demo — local dictionary only. Daily puzzles and streaks are stored on your device.</small>
      </footer>
    </div>
  );
}

export default App;
