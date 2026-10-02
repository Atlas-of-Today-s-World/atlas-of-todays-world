/**
 * Checks of structured data against what Google's structured-data docs require
 * or recommend for the types the Atlas uses. No imports, so the Playwright
 * tests can run it on real pages too (tests/seo.spec.ts).
 *
 * Returns human-readable problems; an empty list means the graph is fine.
 */

type Node = Record<string, unknown>;

const isText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const isUrl = (value: unknown) => typeof value === "string" && /^https?:\/\/\S+$/.test(value);
/** ISO 8601 date or date-time (what schema.org Date/DateTime accept). */
const isDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const typesOf = (node: Node) => list(node["@type"]).map(String);

/** Flattens a JSON-LD script body (object, array or `@graph`) into nodes. */
export function jsonLdNodes(data: unknown): Node[] {
  return list(data).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const node = item as Node;
    return node["@graph"] ? jsonLdNodes(node["@graph"]) : [node];
  });
}

/** Person or Organization with a name, or a reference to one by `@id`. */
function checkAgent(value: unknown, path: string, out: string[]) {
  for (const item of list(value)) {
    const agent = item as Node;
    if (!agent || typeof agent !== "object") out.push(`${path}: not an object`);
    else if (!agent["@id"] && !isText(agent.name)) out.push(`${path}: missing name`);
    else if (agent["@type"] === "Person" && !agent["@id"] && !isUrl(agent.url))
      out.push(`${path}: a Person author should have a url`);
  }
}

const RULES: Record<string, (node: Node, out: string[]) => void> = {
  Article: checkArticle,
  NewsArticle: checkArticle,
  BreadcrumbList(node, out) {
    const items = list(node.itemListElement) as Node[];
    if (!items.length) out.push("BreadcrumbList: empty itemListElement");
    items.forEach((item, index) => {
      if (item.position !== index + 1) out.push(`BreadcrumbList[${index}]: wrong position`);
      if (!isText(item.name)) out.push(`BreadcrumbList[${index}]: missing name`);
      if (index < items.length - 1 && !isUrl(item.item))
        out.push(`BreadcrumbList[${index}]: missing item URL`);
    });
  },
  ItemList(node, out) {
    const items = list(node.itemListElement) as Node[];
    items.forEach((item, index) => {
      if (item.position !== index + 1) out.push(`ItemList[${index}]: wrong position`);
      if (!isUrl(item.url) && !item.item) out.push(`ItemList[${index}]: missing url`);
    });
  },
  NGO: checkOrganization,
  Organization: checkOrganization,
  WebSite(node, out) {
    if (!isText(node.name)) out.push("WebSite: missing name");
    if (!isUrl(node.url)) out.push("WebSite: missing url");
  },
  Dataset(node, out) {
    if (!isText(node.name)) out.push("Dataset: missing name");
    const description = String(node.description ?? "");
    if (description.length < 50 || description.length > 5000)
      out.push("Dataset: description must have 50–5000 characters");
    if (!node.creator) out.push("Dataset: missing creator (recommended)");
    if (!isUrl(node.license)) out.push("Dataset: missing license (recommended)");
  },
  FAQPage(node, out) {
    const questions = list(node.mainEntity) as Node[];
    if (!questions.length) out.push("FAQPage: no questions");
    for (const question of questions) {
      const answer = question.acceptedAnswer as Node | undefined;
      if (!isText(question.name) || !answer || !isText(answer.text))
        out.push("FAQPage: question without name or answer text");
    }
  },
  Country: checkPlace,
  Place: checkPlace,
  Person(node, out) {
    if (!isText(node.name)) out.push("Person: missing name");
  },
  ProfilePage(node, out) {
    if (!node.mainEntity) out.push("ProfilePage: missing mainEntity");
  },
};

function checkArticle(node: Node, out: string[]) {
  const type = typesOf(node)[0];
  if (!isText(node.headline)) out.push(`${type}: missing headline`);
  else if (String(node.headline).length > 110) out.push(`${type}: headline over 110 characters`);
  if (!list(node.image).length) out.push(`${type}: missing image (recommended)`);
  for (const image of list(node.image)) if (!isUrl(image)) out.push(`${type}: image not a URL`);
  if (!isDate(node.datePublished)) out.push(`${type}: missing or invalid datePublished`);
  if (node.dateModified !== undefined && !isDate(node.dateModified))
    out.push(`${type}: invalid dateModified`);
  if (!node.author) out.push(`${type}: missing author`);
  checkAgent(node.author, `${type}.author`, out);
  if (!node.publisher) out.push(`${type}: missing publisher`);
}

function checkOrganization(node: Node, out: string[]) {
  const type = typesOf(node)[0];
  if (!isText(node.name)) out.push(`${type}: missing name`);
  if (!isUrl(node.url)) out.push(`${type}: missing url`);
  const logo = node.logo as Node | string | undefined;
  const logoUrl = typeof logo === "string" ? logo : logo?.url;
  if (!isUrl(logoUrl)) out.push(`${type}: missing logo`);
  for (const link of list(node.sameAs)) if (!isUrl(link)) out.push(`${type}: sameAs not a URL`);
}

function checkPlace(node: Node, out: string[]) {
  const type = typesOf(node)[0];
  if (!isText(node.name)) out.push(`${type}: missing name`);
  for (const link of list(node.sameAs)) if (!isUrl(link)) out.push(`${type}: sameAs not a URL`);
}

/**
 * Problems of all nodes (top level of the graph; nested references are
 * checked through their parent rules). Unknown types pass.
 */
export function validateJsonLd(data: unknown): string[] {
  const out: string[] = [];
  for (const node of jsonLdNodes(data)) {
    const types = typesOf(node);
    if (!types.length) out.push("node without @type");
    for (const type of types) RULES[type]?.(node, out);
  }
  return out;
}
