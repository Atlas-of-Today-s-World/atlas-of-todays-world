"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormField, Select } from "@/components/ui/field";
import { setEntryGroup } from "../actions";
import type { EntryStatus } from "../schema";
import { StatusBadge } from "./StatusBadge";

interface Article {
  id: string;
  title: string;
  status: EntryStatus;
}

/**
 * Články ve skupině zemí (globální téma / vlastní region): přidat a odebrat
 * přímo ze stránky skupiny, bez otevírání editoru každého článku.
 */
export function GroupArticles({
  slug,
  members,
  candidates,
}: {
  slug: string;
  members: Article[];
  candidates: Article[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const change = (entryId: string, group: string | null) =>
    start(async () => {
      const result = await setEntryGroup(entryId, group);
      setMessage({ ok: result.ok, text: (result.ok ? result.message : result.error) ?? "" });
      if (result.ok) {
        setPicked("");
        router.refresh();
      }
    });

  return (
    <section
      aria-labelledby="group-articles-title"
      className="rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 id="group-articles-title" className="font-display text-[18px] font-bold">
        Articles in this group
      </h2>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
        News and entries shown on this group&apos;s portrait. Published articles can only be moved
        by someone allowed to approve them.
      </p>

      {members.length ? (
        <ul className="mt-4 divide-y divide-[var(--color-line)]">
          {members.map((article) => (
            <li key={article.id} className="flex flex-wrap items-center gap-3 py-2">
              <a
                href={`/admin/content/${article.id}`}
                className="flex-1 text-[14px] font-medium hover:underline"
              >
                {article.title}
              </a>
              <StatusBadge status={article.status} />
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => change(article.id, null)}
                aria-label={`Remove ${article.title} from this group`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-[var(--color-ink-muted)]">
          No articles in this group yet.
        </p>
      )}

      {candidates.length ? (
        <div className="mt-5 flex flex-wrap items-end gap-2">
          <FormField id="group-article" label="Add an article" className="min-w-64 flex-1">
            <Select
              id="group-article"
              value={picked}
              onChange={(event) => setPicked(event.target.value)}
            >
              <option value="">— choose an article —</option>
              {candidates.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title}
                </option>
              ))}
            </Select>
          </FormField>
          <Button size="sm" disabled={!picked || pending} onClick={() => change(picked, slug)}>
            Add to group
          </Button>
        </div>
      ) : null}

      {message ? (
        <p
          role="status"
          className={`mt-3 text-[13px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
