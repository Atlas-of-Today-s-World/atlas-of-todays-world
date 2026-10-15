import { kickerVariants } from "@/components/atlas/kicker";
import { Rail } from "@/components/atlas/Rail";
import { SourceLink } from "@/components/atlas/ui";
import type { VisualItem } from "@/lib/content-types";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/request";
import { MapVisual, type MapSpec } from "@/features/visuals/map-slot";
import { EmbedFrame } from "./EmbedFrame";

/**
 * "Maps & charts" — the carousel of visuals of a region, a global issue, a
 * topic or a subtopic, the same everywhere: one visual at a time with
 * previous / next arrows and dots (Rail `pages`: swipe on touch, ←/→ on the
 * keyboard), its title, caption and source under it. Embedded charts load
 * only when they come near the viewport (EmbedFrame); so do custom maps,
 * drawn by the map slot's MapVisual.
 *
 * `variant="section"`: a page section (portrait, topic page) — a "Maps &
 * charts" pill, a centred heading and lead, like the timeline. `"inline"`: a
 * block inside a subtopic panel, with a small heading.
 */
export async function VisualsCarousel({
  items,
  title,
  lead,
  variant = "section",
  id = "maps-and-charts",
  className,
}: {
  items: readonly VisualItem[];
  /** Heading; default the UI text's. */
  title?: string;
  lead?: string;
  variant?: "section" | "inline";
  /** Anchor of the block (unique on the page: subtopics need their own). */
  id?: string;
  className?: string;
}) {
  const t = await getT();
  if (!items.length) return null;
  const heading = title ?? (variant === "section" ? t.portrait.mapsTitle : t.portrait.mapsKicker);
  const headingId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        variant === "section" ? "border-t border-[var(--color-line)] px-6 py-10 sm:px-10" : "mt-8",
        className,
      )}
    >
      {variant === "section" ? (
        <div className="text-center">
          <p className={kickerVariants({ tone: "pill" })}>{t.portrait.mapsKicker}</p>
          <h2
            id={headingId}
            className="font-display mx-auto mt-4 max-w-2xl text-[26px] leading-tight font-bold text-balance text-[var(--color-ink)] sm:text-[32px]"
          >
            {heading}
          </h2>
          {lead ? (
            <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
              {lead}
            </p>
          ) : null}
        </div>
      ) : (
        <h3 id={headingId} className={kickerVariants()}>
          {heading}
        </h3>
      )}

      <Rail label={heading} layout="pages" className={variant === "section" ? "mt-8" : "mt-3"}>
        {items.map((item, index) => (
          <figure
            key={item.id}
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${items.length}: ${item.title}`}
            className="w-full shrink-0 snap-start"
          >
            <Visual item={item} openLabel={t.portrait.mapsOpen} />
            <figcaption className="mx-auto mt-3 max-w-2xl text-center">
              <span className="font-display block text-[16px] leading-snug font-bold text-[var(--color-ink)]">
                {item.title}
              </span>
              {item.caption ? (
                <span className="mt-1 block text-[13px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
                  {item.caption}
                </span>
              ) : null}
              {item.source ? (
                <span className="mt-1 block text-[11.5px] text-[var(--color-ink-muted)]">
                  {t.ui.source}{" "}
                  <SourceLink href={item.source.url}>
                    {item.source.label || item.source.url}
                  </SourceLink>
                </span>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </Rail>
    </section>
  );
}

function Visual({ item, openLabel }: { item: VisualItem; openLabel: string }) {
  switch (item.kind) {
    case "embed":
      return (
        <EmbedFrame
          provider={item.provider}
          url={item.url}
          title={item.title}
          height={item.height}
          openLabel={openLabel}
          className="border border-[var(--color-line)]"
        />
      );
    case "image":
      return (
        // A picture from any https host (img-src); its size is the editors' hint or its own.
        // eslint-disable-next-line @next/next/no-img-element -- see above
        <img
          src={item.url}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="mx-auto block max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
          style={item.height ? { height: item.height } : undefined}
        />
      );
    case "map":
      // The spec passed parseMapSpec when it was read (features/visuals/rows.ts).
      return <MapVisual spec={item.spec as MapSpec} title={item.title} height={item.height} />;
  }
}
