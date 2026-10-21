import Link from "@/components/i18n/Link";
import type { PlaceTopics } from "@/features/entries/types";
import type { RegionDossier } from "@/lib/content-types";
import { Photo } from "@/components/atlas/Photo";
import { PHOTO_SIZES } from "@/config/layout";
import { PHOTO_WIDTH } from "@/lib/images";
import { format } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/request";
import { IndicatorCards, PatronsCallout } from "./sections";
import { ProfileSections, profileComplete } from "./Portrait";
import { routes } from "@/config/routes";

/**
 * The region's profile shown right under a country (decision of 2026-10-07):
 * the editors write per region, so a reader of Turkey sees the Middle East's
 * story, maps and sources without a click to the region. Set apart by a
 * dark header with the region's photo and a paper-grey background, so it's
 * clear where the country ends and the region begins. No computed regional
 * figures — the country's own data are above; the region's key facts (the
 * editors' sourced cards) are part of its story. The country's topics
 * (`topics`) take the topics' place in the region's run, so they read right
 * under the region's timeline (owner, 2026-10-21).
 */
export async function RegionalProfile({
  country,
  region,
  dossier,
  topics,
}: {
  country: string;
  region: { slug: string; name: string; summary: string; hero?: string | null };
  dossier: RegionDossier;
  /** The country's topics (its own and its region's); left out = no topic rows. */
  topics?: PlaceTopics;
}) {
  const t = await getT();
  const titleId = "regional-profile-title";
  return (
    <section aria-labelledby={titleId} className="mt-8 bg-[var(--color-paper)]">
      <header className="relative isolate overflow-hidden bg-[var(--color-band)] px-6 pt-24 pb-7 text-white sm:px-10">
        {/* Below the country's own profile: loaded lazily, as it nears the screen. */}
        <Photo
          src={region.hero}
          alt=""
          widths={[PHOTO_WIDTH.tile, PHOTO_WIDTH.card]}
          sizes={PHOTO_SIZES.rail}
          width={PHOTO_WIDTH.card}
          height={460}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--color-band)] via-[var(--color-band)]/65 to-[var(--color-band)]/15"
        />
        <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
          {t.portrait.regionalProfile}
        </p>
        <h2 id={titleId} className="font-display mt-2 text-[26px] leading-tight font-bold">
          {region.name}
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/80">
          {format(t.portrait.regionalProfileLead, { country, region: region.name })}
        </p>
        <Link
          href={routes.region(region.slug)}
          className="mt-4 inline-flex min-h-(--touch-min) items-center rounded-full bg-white/15 px-4 text-[12.5px] font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          {t.portrait.regionalProfileOpen} →
        </Link>
      </header>

      {/* The editors' intro wins; without it the Atlas summary of the region. */}
      <p className="px-6 py-6 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)] sm:px-10">
        {dossier.intro?.trim() || region.summary}
      </p>

      <IndicatorCards metrics={dossier.metrics} />

      <ProfileSections dossier={dossier} topics={topics} place={country} />
      <PatronsCallout complete={profileComplete(dossier)} />
    </section>
  );
}
