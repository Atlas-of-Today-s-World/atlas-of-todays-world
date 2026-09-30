import MiniSearch from "minisearch";
import { REGIONS } from "@/data/regions";
import { allNews } from "@/lib/content";
import { indexableCountries } from "@/lib/countries";

export type SearchKind = "region" | "country" | "news";

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  body: string;
  url: string;
  /** Kam otočit globus, když uživatel výsledek otevře. */
  center?: [number, number];
  zoom?: number;
}

export interface SearchHit extends SearchDoc {
  score: number;
}

let indexPromise: Promise<{ index: MiniSearch<SearchDoc>; docs: SearchDoc[] }> | null =
  null;

async function buildDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];

  for (const region of REGIONS) {
    docs.push({
      id: `region:${region.slug}`,
      kind: "region",
      title: region.name,
      subtitle: "World region",
      body: region.summary,
      url: `/region/${region.slug}`,
      center: region.center,
      zoom: region.zoom,
    });
  }

  for (const country of indexableCountries()) {
    const stats = country.stats
      .map((stat) => `${stat.label} ${stat.value}`)
      .join(". ");
    docs.push({
      id: `country:${country.iso3}`,
      kind: "country",
      title: country.name,
      subtitle: country.region?.name ?? "Country",
      body: `${country.nameFormal ?? country.name}. ${country.unSubregion ?? ""}. ${stats}`,
      url: `/country/${country.slug}`,
      center:
        country.labelLon !== null && country.labelLat !== null
          ? [country.labelLon, country.labelLat]
          : undefined,
      zoom: 3.4,
    });
  }

  for (const item of await allNews()) {
    docs.push({
      id: `news:${item.slug}`,
      kind: "news",
      title: item.title,
      subtitle: `${item.category} · ${item.regionRef?.name ?? ""}`.trim(),
      body: `${item.summary} ${item.plain}`,
      url: `/news/${item.slug}`,
      center: item.regionRef?.center,
      zoom: item.regionRef?.zoom,
    });
  }

  return docs;
}

async function getIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const docs = await buildDocs();
      const index = new MiniSearch<SearchDoc>({
        fields: ["title", "subtitle", "body"],
        storeFields: ["kind", "title", "subtitle", "url", "center", "zoom", "body"],
        searchOptions: {
          boost: { title: 4, subtitle: 2 },
          prefix: true,
          fuzzy: 0.2,
        },
      });
      index.addAll(docs);
      return { index, docs };
    })();
  }
  return indexPromise;
}

export async function search(query: string, limit = 12): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { index } = await getIndex();
  return index
    .search(trimmed)
    .slice(0, limit)
    .map((result) => ({
      id: String(result.id),
      kind: result.kind as SearchKind,
      title: result.title as string,
      subtitle: result.subtitle as string,
      body: (result.body as string).slice(0, 400),
      url: result.url as string,
      center: result.center as [number, number] | undefined,
      zoom: result.zoom as number | undefined,
      score: result.score,
    }));
}
