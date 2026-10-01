"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { newGame, QUESTIONS_PER_GAME, verdict, type CountryShape, type Question } from "./game";

/** Jak dlouho zůstane vidět, jestli odpověď byla správně, než přijde další otázka. */
const NEXT_AFTER_MS = 1600;

type Phase = "idle" | "loading" | "playing" | "done";

/**
 * Easter egg na stránce 404: poznej stát podle obrysu. Deset náhodných států
 * z padesáti, čtyři možnosti, na konci skóre. Obrysy (~25 kB gzip) se načtou
 * až po kliknutí na „Play“ — samotná 404 zůstane lehká.
 */
export function CountryQuiz() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [game, setGame] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const shapes = useRef<CountryShape[] | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Po přechodu na další otázku nebo výsledek přesunout fokus na nadpis,
  // ať čtečka i klávesnice začínají u nové otázky.
  useEffect(() => {
    if (phase === "playing" || phase === "done") heading.current?.focus();
  }, [phase, index]);

  const start = async () => {
    if (!shapes.current) {
      setPhase("loading");
      shapes.current = (await import("./shapes.generated.json")).default as CountryShape[];
    }
    setGame(newGame(shapes.current));
    setIndex(0);
    setScore(0);
    setPicked(null);
    setPhase("playing");
  };

  const next = () => {
    clearTimeout(timer.current);
    setPicked(null);
    if (index + 1 >= game.length) setPhase("done");
    else setIndex((current) => current + 1);
  };

  const answer = (iso3: string) => {
    if (picked) return;
    setPicked(iso3);
    if (iso3 === game[index].answer.iso3) setScore((current) => current + 1);
    timer.current = setTimeout(next, NEXT_AFTER_MS);
  };

  if (phase === "idle" || phase === "loading") {
    return (
      <Panel>
        <p className="font-display text-[17px] font-bold text-[var(--color-ink)]">
          While you&rsquo;re here: can you name a country by its outline?
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">
          Ten shapes, four choices each. A different set every time.
        </p>
        <Button size="sm" className="mt-4" onClick={start} disabled={phase === "loading"}>
          {phase === "loading" ? "Loading the shapes…" : "Play the outline quiz"}
        </Button>
      </Panel>
    );
  }

  if (phase === "done") {
    return (
      <Panel>
        <h2
          ref={heading}
          tabIndex={-1}
          className="font-display text-[20px] font-bold text-[var(--color-ink)] focus:outline-none"
        >
          You scored {score} out of {QUESTIONS_PER_GAME}
        </h2>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">{verdict(score)}</p>
        <Button size="sm" className="mt-4" onClick={start}>
          Play again with new countries
        </Button>
      </Panel>
    );
  }

  const question = game[index];
  const correct = picked === question.answer.iso3;
  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-3">
        <h2
          ref={heading}
          tabIndex={-1}
          className="font-display text-[17px] font-bold text-[var(--color-ink)] focus:outline-none"
        >
          Which country is this?
        </h2>
        <p className="shrink-0 text-[12px] whitespace-nowrap text-[var(--color-ink-muted)]">
          {index + 1} / {game.length} · Score {score}
        </p>
      </div>

      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Outline of country number ${index + 1}`}
        className="mx-auto mt-4 block size-48 sm:size-56"
      >
        <path d={question.answer.path} fill="var(--color-accent)" fillRule="evenodd" />
      </svg>

      <div role="group" aria-label="Choices" className="mt-4 grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const isAnswer = option.iso3 === question.answer.iso3;
          const isPicked = option.iso3 === picked;
          return (
            <button
              key={option.iso3}
              type="button"
              onClick={() => answer(option.iso3)}
              aria-disabled={picked ? true : undefined}
              className={cn(
                "min-h-(--touch-min) rounded-xl border px-4 text-left text-[14px] font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
                !picked &&
                  "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)]",
                picked && isAnswer && "border-green-600 bg-green-50 text-green-900",
                picked && isPicked && !isAnswer && "border-red-600 bg-red-50 text-red-900",
                picked && !isAnswer && !isPicked && "border-[var(--color-line)] opacity-60",
              )}
            >
              {option.name}
              {picked && isAnswer ? <span className="sr-only"> (correct answer)</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex min-h-(--touch-min) items-center justify-between gap-3">
        <p aria-live="polite" className="text-[13.5px] font-medium">
          {picked ? (
            correct ? (
              <span className="text-green-800">Correct!</span>
            ) : (
              <span className="text-red-800">Not quite — it&rsquo;s {question.answer.name}.</span>
            )
          ) : null}
        </p>
        {picked ? (
          <Button size="sm" variant="outline" onClick={next}>
            {index + 1 >= game.length ? "See your score" : "Next"}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Outline quiz"
      className="mx-6 mb-12 rounded-2xl border border-[var(--color-line)] bg-[var(--color-accent-soft)]/40 p-5"
    >
      {children}
    </section>
  );
}
