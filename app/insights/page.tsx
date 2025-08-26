"use client";

import { useMemo, useState } from "react";
import { toFrontmatter } from "@/lib/yaml";

type Doc = {
  yaml: {
    date: string | null;
    location: string | null;
    tags: string[];
    tasks: { done: string[]; todo: string[] };
    keystone_pattern: string | null;
    productivity_score: "low" | "med" | "high" | null;
  };
  analysis: {
    meta: string[];
    mindset: string[];
    body: string[];
    action: { shipped: string[]; planned: string[] };
  };
  nudge: string;
  saved: {
    songs: string[];
    story_ideas: string[];
    product_ideas: string[];
    quotes: string[];
  };
  aligned_goals?: string[];
};

const tabs = ["YAML", "Nudge", "Saved", "JSON"] as const;
type Tab = (typeof tabs)[number];

export default function InsightsPage() {
  const [md, setMd] = useState<string>("");
  const [result, setResult] = useState<Doc | null>(null);
  const [active, setActive] = useState<Tab>("YAML");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yamlText = useMemo(() => {
    try {
      return result ? toFrontmatter(result) : "YAML content goes here.";
    } catch {
      return "YAML rendering error.";
    }
  }, [result]);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 1) Extract
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journal: md }),
      });
      const extracted = await extractRes.json();
      if (!extractRes.ok) throw new Error(extracted?.error || "Extract failed");

      // 2) Nudge (dummy — echo or placeholder)
      const nudgeRes = await fetch("/api/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extracted),
      });
      const nudged = await nudgeRes.json();
      if (!nudgeRes.ok) throw new Error(nudged?.error || "Nudge failed");

      setResult(nudged as Doc);
      setActive("YAML");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setMd(text);
    };
    reader.readAsText(file);
    // comment: clear selection so same file can be re-selected if needed
    e.target.value = "";
  }

  function formatTimestamp(d = new Date()) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}${mm}${dd}-${hh}${min}`;
  }

  function downloadMd() {
    if (!result) return; // comment: need frontmatter
    const front = yamlText.trimEnd();
    const content = `${front}\n\n${md}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-${formatTimestamp()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyYaml() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(yamlText);
    } catch {
      // ignore copy errors in MVP
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Actionable Insights</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: input */}
        <div>
          <label className="block text-sm mb-2">
            <span className="mr-2">Upload .md</span>
            <input
              type="file"
              accept=".md"
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1 file:bg-gray-100 file:border-gray-300"
            />
          </label>

          <textarea
            className="w-full h-[320px] p-3 border rounded bg-black/60 text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste Obsidian markdown here..."
            value={md}
            onChange={(e) => setMd(e.target.value)}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={generate}
              disabled={loading || !md.trim()}
              className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? "Processing..." : "Generate"}
            </button>

            <button
              onClick={downloadMd}
              disabled={!result}
              className="inline-flex items-center rounded border px-3 py-2 text-sm disabled:opacity-50"
              title={result ? "Download .md with YAML frontmatter" : "Generate first to enable"}
            >
              Download .md
            </button>

            {error && <p className="text-sm text-red-400">Error: {error}</p>}
          </div>
        </div>

        {/* Right: results */}
        <div>
          {/* Tabs */}
          <div className="flex gap-4 text-sm">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActive(t)}
                className={`pb-2 border-b-2 ${
                  active === t ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Panels */}
          <div className="mt-3">
            {active === "YAML" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">YAML frontmatter</span>
                  <button
                    onClick={copyYaml}
                    disabled={!result}
                    className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Copy YAML
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-auto whitespace-pre-wrap">
                  {yamlText}
                </pre>
              </div>
            )}

            {active === "Nudge" && (
              <div className="space-y-2">
                <div className="p-3 rounded border">
                  {result?.nudge ? (
                    <>
                      <p className="font-semibold">{result.nudge}</p>
                      {result.aligned_goals?.length ? (
                        <p className="text-xs mt-2 text-gray-400">
                          Supports: {result.aligned_goals.join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      Nudge will appear after we enable the OpenAI key.
                    </p>
                  )}
                </div>
              </div>
            )}

            {active === "Saved" && (
              <div className="space-y-3">
                <Block title="songs" data={result?.saved?.songs} />
                <Block title="story_ideas" data={result?.saved?.story_ideas} />
                <Block title="product_ideas" data={result?.saved?.product_ideas} />
                <Block title="quotes" data={result?.saved?.quotes} />
              </div>
            )}

            {active === "JSON" && (
              <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-auto whitespace-pre-wrap text-xs">
                {result ? JSON.stringify(result, null, 2) : "No JSON yet."}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ title, data }: { title: string; data?: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      {data && data.length ? (
        <ul className="list-disc pl-5 space-y-1">
          {data.map((s, i) => (
            <li key={`${title}-${i}`}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm">None yet.</p>
      )}
    </div>
  );
}

// comment: Upload reads .md into textarea; nothing is sent to the server until you click Generate.
// comment: Download includes the YAML frontmatter followed by your original textarea body.
// comment: Button disables prevent accidental clicks when not ready.
