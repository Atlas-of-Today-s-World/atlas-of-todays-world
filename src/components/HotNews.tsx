"use client";

import { useState } from "react";
import Link from "next/link";

export interface HotNewsItem {
  slug: string;
  title: string;
  /** Země, region nebo problematika, ke které se novinka váže. */
  scope: string;
  /** "country" | "region" | "topic" – jen pro barvu štítku. */
  scopeKind: "country" | "region" | "topic";
  published: string | null;
  hero?: string;
}

const SCOPE_STYLE: Record<HotNewsItem["scopeKind"], string> = {
  country: "bg-[#3b4ce0]/25 text-[#b9c4ff]",
  region: "bg-[#e08585]/25 text-[#ffc2c2]",
  topic: "bg-white/15 text-white/75",
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Hot News pod panelem Global Encyclopedia: jen náhledy nejnovějších novinek –
 * štítek (země / region / problematika), titulek a datum. Celý článek se
 * otevře až kliknutím na vlastní stránce.
 */
export default function HotNews({ items }: { items: HotNewsItem[] }) {
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="glass glass-hover flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] whitespace-nowrap text-white/90 transition"
      >
        <FlameIcon />
        Hot News
        <span className="rounded-full bg-white/15 px-1.5 text-[10.5px] tabular-nums">
          {items.length}
        </span>
      </button>

      {open ? (
        <section className="glass w-[min(92vw,22rem)] rounded-[var(--radius-panel)] p-2 shadow-2xl shadow-black/40">
          <ul className="panel-scroll max-h-[min(46vh,20rem)] space-y-0.5 overflow-y-auto">
            {items.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/news/${item.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex gap-2.5 rounded-xl p-2 transition hover:bg-white/10"
                >
                  {item.hero ? (
                    <span
                      className="h-11 w-14 shrink-0 rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${item.hero})` }}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide ${SCOPE_STYLE[item.scopeKind]}`}
                      >
                        {item.scope}
                      </span>
                      {formatDate(item.published) ? (
                        <span className="text-[10px] text-white/45">
                          {formatDate(item.published)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-snug text-white/90">
                      {item.title}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3s5.5 4.2 5.5 9a5.5 5.5 0 1 1-11 0c0-1.9 1-3.4 1.8-4.3.2 1.3.9 2.2 1.8 2.2 1.3 0 1.6-1.6 1.4-3.1A6.6 6.6 0 0 1 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
