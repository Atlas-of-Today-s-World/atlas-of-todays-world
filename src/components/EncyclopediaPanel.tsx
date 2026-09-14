"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SearchHit } from "@/lib/search";

type Mode = "search" | "ask";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
}

const KIND_LABEL: Record<string, string> = {
  region: "Region",
  country: "Country",
  entry: "Entry",
};

/**
 * "Global Encyclopedia" z Figmy: fulltext nad celým Atlasem a chatbot, který
 * odpovídá jen z našeho obsahu a odkazuje, kde se to dá dočíst.
 */
export default function EncyclopediaPanel() {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setHits(data.results ?? []);
      } catch {
        /* zrušený request při psaní */
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, thinking]);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || thinking) return;

    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(history);
    setQuestion("");
    setThinking(true);
    setChatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chatbot neodpověděl.");
      setMessages([
        ...history,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Neznámá chyba.");
    } finally {
      setThinking(false);
    }
  }

  return (
    <section className="glass pointer-events-auto w-[min(92vw,22rem)] rounded-[var(--radius-panel)] p-4 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold text-white">
          <BookIcon />
          Global Encyclopedia
        </h2>
        <div className="flex rounded-full border border-white/15 p-0.5 text-[11px]">
          {(["search", "ask"] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full px-2.5 py-1 transition ${
                mode === value ? "bg-white text-[#0d1324]" : "text-white/70"
              }`}
            >
              {value === "search" ? "Search" : "Ask"}
            </button>
          ))}
        </div>
      </div>

      {mode === "search" ? (
        <>
          <label className="mt-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 py-2">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search places, regions, entries…"
              className="w-full bg-transparent text-[13px] text-white placeholder:text-white/45 focus:outline-none"
            />
          </label>

          {query.trim().length >= 2 ? (
            <div className="panel-scroll mt-3 max-h-[min(50vh,22rem)] overflow-y-auto">
              {hits.length === 0 ? (
                <p className="px-1 py-3 text-[12.5px] text-white/55">
                  {searching ? "Searching…" : "Nothing found in the Atlas yet."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <Link
                        href={hit.url}
                        onClick={() => setQuery("")}
                        className="block rounded-xl px-3 py-2 transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-2">
                          <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-white/70">
                            {KIND_LABEL[hit.kind] ?? hit.kind}
                          </span>
                          <span className="text-[13.5px] font-medium text-white">
                            {hit.title}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-white/55">
                          {hit.subtitle}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-white/50">
              Try &ldquo;political situation in Russia&rdquo;, &ldquo;Ukraine&rdquo; or
              &ldquo;Eastern Europe&rdquo;.
            </p>
          )}
        </>
      ) : (
        <>
          <div
            ref={threadRef}
            className="panel-scroll mt-3 max-h-[min(46vh,20rem)] space-y-2.5 overflow-y-auto"
          >
            {messages.length === 0 ? (
              <p className="px-1 text-[11.5px] leading-relaxed text-white/50">
                Ask anything about the Atlas. The assistant answers only from
                published Atlas content and always links the source entry.
              </p>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-6 rounded-2xl rounded-br-sm bg-[var(--color-accent)] px-3 py-2 text-[12.5px] text-white"
                    : "mr-3 rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-[12.5px] leading-relaxed text-white/90"
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.sources?.length ? (
                  <ul className="mt-2 space-y-1 border-t border-white/15 pt-2">
                    {message.sources.map((source) => (
                      <li key={source.url}>
                        <Link
                          href={source.url}
                          className="text-[11.5px] text-[#9fb4ff] underline underline-offset-2"
                        >
                          {source.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}

            {thinking ? (
              <p className="mr-3 rounded-2xl bg-white/10 px-3 py-2 text-[12.5px] text-white/60">
                Reading the Atlas…
              </p>
            ) : null}
            {chatError ? (
              <p className="rounded-xl bg-red-500/15 px-3 py-2 text-[11.5px] text-red-200">
                {chatError}
              </p>
            ) : null}
          </div>

          <form onSubmit={ask} className="mt-3 flex items-center gap-2">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask the Atlas…"
              className="w-full rounded-full border border-white/15 bg-black/25 px-3.5 py-2 text-[13px] text-white placeholder:text-white/45 focus:outline-none"
            />
            <button
              type="submit"
              disabled={thinking}
              className="shrink-0 rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </>
      )}
    </section>
  );
}

function BookIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5.5A1.5 1.5 0 0 1 4.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H3V5.5ZM21 5.5A1.5 1.5 0 0 0 19.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H21V5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.7" />
      <path
        d="m16 16 4 4"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
