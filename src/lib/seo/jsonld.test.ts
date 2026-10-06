import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "./index";
import {
  articleNode,
  breadcrumbNode,
  countryNode,
  countrySameAs,
  datasetNode,
  faqNode,
  graph,
  groupPlaceNode,
  ids,
  itemListNode,
  organizationNode,
  pageUrl,
  personNode,
  webPageNode,
  websiteNode,
} from "./jsonld";
import { jsonLdNodes, validateJsonLd } from "./jsonld-rules";

/** Round-trip through the rendered script text, as a robot reads it. */
const parsed = (data: unknown) => JSON.parse(jsonLdHtml(data).replace(/\\u003c/g, "<"));

const czechia = { slug: "czechia", name: "Czechia", iso3: "CZE" };

describe("JSON-LD builders", () => {
  it("publisher and website: an NGO with logo, profiles, registration and search", () => {
    const data = parsed(graph(organizationNode(), websiteNode("en")));
    expect(validateJsonLd(data)).toEqual([]);
    const [org, site] = jsonLdNodes(data);
    expect(org).toMatchObject({
      "@type": "NGO",
      "@id": ids.organization,
      legalName: "Atlas of Today's World, z. s.",
      foundingDate: "2016-09-07",
      email: "info@atlasoftodaysworld.org",
    });
    expect(org?.sameAs).toEqual(
      expect.arrayContaining([
        "https://www.facebook.com/atlasoftodaysworld/",
        "https://www.instagram.com/atlasoftodaysworld_official/",
        "https://www.linkedin.com/company/atlas-of-todays-world/",
        "https://bsky.app/profile/atlas-otw.bsky.social",
      ]),
    );
    expect(JSON.stringify(site)).toContain("/search?q={search_term_string}");
  });

  it("news article: NewsArticle with author profile, publisher, places and dates", () => {
    const url = pageUrl("/news/sahel-coup-belt");
    const data = parsed(
      graph(
        webPageNode({ url, name: "Sahel", locale: "en", about: `${url}#article` }),
        articleNode({
          kind: "news",
          url,
          headline: "The Sahel's Coup Belt",
          description: "A band of states…",
          images: ["https://example.org/a.jpg", null],
          published: "2026-09-02",
          modified: "2026-09-30",
          locale: "en",
          author: { name: "Jana Dvořáková", slug: "jana-dvorakova" },
          about: [czechia],
          location: { slug: "sub-saharan-africa", name: "Sub-Saharan Africa", center: [15, 8] },
        }),
        breadcrumbNode([
          { name: "Atlas", path: "/" },
          { name: "Sahel", path: "/news/sahel-coup-belt" },
        ]),
      ),
    );
    expect(validateJsonLd(data)).toEqual([]);
    const article = jsonLdNodes(data).find((node) => node["@type"] === "NewsArticle");
    expect(article).toMatchObject({
      isAccessibleForFree: true,
      inLanguage: "en",
      publisher: { "@id": ids.organization },
      author: { "@type": "Person", url: expect.stringContaining("/authors/jana-dvorakova") },
      image: ["https://example.org/a.jpg"],
    });
    expect(JSON.stringify(article?.about)).toContain("wikidata.org/wiki/Q213");
  });

  it("the editorial team is the organization, not a fake person", () => {
    const node = articleNode({
      kind: "news",
      url: pageUrl("/news/x"),
      headline: "X",
      description: "X",
      images: ["/og-image.png"],
      published: "2026-09-02",
      locale: "en",
      author: { name: "Atlas editorial team" },
    });
    expect(node.author).toEqual({ "@id": ids.organization });
  });

  it("encyclopedia entry: Article with abstract, citations, parts, FAQ and speakable page", () => {
    const url = pageUrl("/topics/smuggling", "en");
    const data = parsed(
      graph(
        webPageNode({
          url,
          name: "Smuggling",
          locale: "en",
          speakable: ["#in-short"],
          about: `${url}#article`,
        }),
        articleNode({
          kind: "entry",
          url,
          headline: "Smuggling explained",
          description: "How smuggling works.",
          abstract: "Migrant smuggling is the paid facilitation of irregular border crossing.",
          images: ["/og-image.png"],
          published: "2026-10-01",
          locale: "en",
          author: null,
          citations: [{ title: "UNODC report", url: "https://www.unodc.org/x", source: "UNODC" }],
          parts: [{ name: "Routes", url: `${url}#topic-1`, audio: "https://example.org/a.mp3" }],
        }),
        faqNode(url, [{ question: "What is it?", answer: "A crime." }]),
        faqNode(url, []),
      ),
    );
    expect(validateJsonLd(data)).toEqual([]);
    const nodes = jsonLdNodes(data);
    expect(nodes.map((node) => node["@type"])).toEqual(["WebPage", "Article", "FAQPage"]);
    expect(nodes[0]?.speakable).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: ["#in-short"],
    });
    expect(nodes[1]?.citation).toEqual([
      expect.objectContaining({ name: "UNODC report", url: "https://www.unodc.org/x" }),
    ]);
  });

  it("country with codes, Wikidata, region and sourced indicators", () => {
    const data = parsed(
      graph(
        countryNode({
          ...czechia,
          iso2: "CZ",
          nameFormal: "Czech Republic",
          description: "A country in Central Europe.",
          lat: 49.8,
          lon: 15.5,
          locale: "en",
          region: { slug: "western-central-europe", name: "Western & Central Europe" },
          population: 10_700_000,
          stats: [
            {
              label: "Human Development Index",
              raw: 0.915,
              value: "0.915",
              year: 2023,
              source: "UNDP",
              sourceUrl: "https://hdr.undp.org/",
            },
          ],
        }),
      ),
    );
    expect(validateJsonLd(data)).toEqual([]);
    const [country] = jsonLdNodes(data);
    expect(country).toMatchObject({
      "@type": "Country",
      sameAs: [
        "https://www.wikidata.org/wiki/Q213",
        "https://en.wikipedia.org/wiki/Czech_Republic",
      ],
      containedInPlace: { "@id": ids.region("western-central-europe") },
      geo: { latitude: 49.8, longitude: 15.5 },
    });
  });

  it("region / global issue: Place containing its countries", () => {
    const data = parsed(
      graph(
        groupPlaceNode({
          kind: "issue",
          slug: "food-insecurity",
          name: "Food Insecurity",
          alternateName: "Where hunger is political",
          description: "Countries where…",
          locale: "en",
          center: [20, 10],
          countries: [czechia],
        }),
      ),
    );
    expect(validateJsonLd(data)).toEqual([]);
    expect(jsonLdNodes(data)[0]?.["@id"]).toBe(ids.issue("food-insecurity"));
  });

  it("data layer: Dataset with a 50+ character description, licence and coverage", () => {
    const data = parsed(
      graph(
        datasetNode({
          id: "hdi",
          name: "Human Development Index",
          description: "HDI.",
          locale: "en",
          latestYear: 2023,
          earliestYear: 2021,
          source: "UNDP",
          sourceUrl: "https://hdr.undp.org/",
        }),
      ),
    );
    expect(validateJsonLd(data)).toEqual([]);
    expect(jsonLdNodes(data)[0]).toMatchObject({ temporalCoverage: "2021/2023" });
  });

  it("author profile and lists", () => {
    const data = parsed(
      graph(
        webPageNode({
          url: pageUrl("/authors/ana"),
          name: "Ana",
          locale: "en",
          type: "ProfilePage",
          about: ids.author("ana"),
        }),
        personNode({ slug: "ana", name: "Ana", description: "Geographer." }),
        itemListNode("Articles", [{ name: "One", url: pageUrl("/news/one") }]),
      ),
    );
    expect(validateJsonLd(data)).toEqual([]);
  });

  it("drops empty values and escapes </script>", () => {
    const html = jsonLdHtml(
      graph(personNode({ slug: "x", name: "</script><b>", description: "" })),
    );
    expect(html).not.toContain("</script>");
    expect(html).not.toContain('"description"');
  });

  it("a page's breadcrumbs become a top-level node referenced by @id", () => {
    const url = pageUrl("/region/east-asia");
    const crumbs = breadcrumbNode([
      { name: "Atlas", path: "/" },
      { name: "East Asia", path: "/region/east-asia" },
    ]);
    const nodes = jsonLdNodes(
      parsed(graph(webPageNode({ url, name: "East Asia", locale: "en", breadcrumb: crumbs }))),
    );
    expect(nodes.map((node) => node["@type"])).toEqual(["WebPage", "BreadcrumbList"]);
    expect(nodes[0]?.breadcrumb).toEqual({ "@id": `${url}#breadcrumb` });
    expect(nodes[1]?.["@id"]).toBe(`${url}#breadcrumb`);
  });

  it("countries without a Wikidata match get no sameAs", () => {
    expect(countrySameAs("XXX")).toEqual([]);
  });
});

describe("validateJsonLd", () => {
  it("reports what Google requires or recommends", () => {
    const problems = validateJsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "NewsArticle", headline: "x".repeat(120), image: "not-a-url" },
        { "@type": "Dataset", name: "D", description: "short" },
        { "@type": "BreadcrumbList", itemListElement: [{ position: 2, name: "" }, {}] },
        { "@type": "FAQPage", mainEntity: [{ name: "Q" }] },
        { "@type": "Organization", name: "O" },
        { name: "untyped" },
      ],
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        "NewsArticle: headline over 110 characters",
        "NewsArticle: image not a URL",
        "NewsArticle: missing or invalid datePublished",
        "NewsArticle: missing author",
        "Dataset: description must have 50–5000 characters",
        "BreadcrumbList[0]: wrong position",
        "FAQPage: question without name or answer text",
        "Organization: missing logo",
        "node without @type",
      ]),
    );
  });
});
