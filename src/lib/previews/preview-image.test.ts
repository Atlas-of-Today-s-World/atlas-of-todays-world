import type { LookupAddress } from "node:dns";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  extractPreviewImage,
  findPreviewImage,
  findPreviewImages,
  isAllowedTarget,
  isPublicAddress,
  pinnedLookup,
  videoThumbnail,
  type PreviewLookup,
  type PreviewRequest,
  type PreviewResponse,
} from "./preview-image";

const PUBLIC: LookupAddress = { address: "93.184.216.34", family: 4 };
const OG = (image: string) => `<html><head><meta property="og:image" content="${image}"></head>`;

async function* chunks(parts: (string | Uint8Array)[], seen?: { count: number }) {
  for (const part of parts) {
    if (seen) seen.count += 1;
    yield typeof part === "string" ? Buffer.from(part) : part;
  }
}

function page(html: string | (string | Uint8Array)[], init: Partial<PreviewResponse> = {}) {
  return {
    status: 200,
    contentType: "text/html; charset=utf-8",
    contentEncoding: "",
    body: chunks(Array.isArray(html) ? html : [html]),
    close: vi.fn(),
    ...init,
  } satisfies PreviewResponse;
}

const redirect = (location?: string, status = 302) => page("", { status, location });

/** A fake network: DNS answers per host (default: one public address), responses in order. */
function network(responses: PreviewResponse[], dns: Record<string, string[]> = {}) {
  const lookup = vi.fn<PreviewLookup>(async (host) =>
    (dns[host] ?? [PUBLIC.address]).map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    })),
  );
  const queue = [...responses];
  const request = vi.fn<PreviewRequest>(async () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected request");
    return next;
  });
  return { lookup, request };
}

describe("isPublicAddress", () => {
  it.each([
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd00:ec2::254",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a9fe:a9fe",
    "2001::1",
    "2001:db8::1",
    "2002:7f00:1::1",
    "example.com",
    "",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "93.184.216.34",
    "11.0.0.1",
    "172.32.0.1",
    "2606:4700::1111",
    "2a00:1450::1",
  ])("accepts %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe("isAllowedTarget", () => {
  it.each([
    "http://example.com/",
    "ftp://example.com/",
    "https://user:pass@example.com/",
    "https://user@example.com/",
    "https://example.com:8443/",
    "https://example.com:80/",
    "https://localhost/",
    "https://app.localhost/",
    "https://metadata.google.internal/",
    "https://printer.local/",
    "https://intranet/",
    "https://127.0.0.1/",
    "https://2130706433/",
    "https://0x7f.1/",
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://169.254.169.254/latest/meta-data/",
    "https://[fd00:ec2::254]/",
  ])("refuses %s", (url) => {
    expect(isAllowedTarget(new URL(url))).toBe(false);
  });

  it.each([
    "https://example.com/a?b=c",
    "https://example.com:443/",
    "https://93.184.216.34/",
    "https://[2606:4700::1111]/",
  ])("accepts %s", (url) => {
    expect(isAllowedTarget(new URL(url))).toBe(true);
  });
});

describe("videoThumbnail", () => {
  const thumb = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
  it.each([
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=42",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ?start=3",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
  ])("derives the thumbnail of %s", (url) => {
    expect(videoThumbnail(new URL(url))).toBe(thumb);
  });

  it.each([
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22",
    "https://www.youtube.com/channel/UC123",
    "https://www.youtube.com/",
    "https://youtu.be/",
    "https://youtube.com.example.org/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/76979871",
  ])("has none for %s", (url) => {
    expect(videoThumbnail(new URL(url))).toBeNull();
  });
});

describe("extractPreviewImage", () => {
  const PAGE = "https://example.org/reports/2024/index.html";
  const extract = (head: string) => extractPreviewImage(`<html><head>${head}</head>`, PAGE);

  it("reads og:image in any attribute order and quoting", () => {
    expect(extract('<meta property="og:image" content="https://cdn.example.org/a.jpg">')).toBe(
      "https://cdn.example.org/a.jpg",
    );
    expect(extract("<meta content='https://cdn.example.org/b.jpg' property='og:image' />")).toBe(
      "https://cdn.example.org/b.jpg",
    );
    expect(extract("<META PROPERTY=og:image CONTENT=https://cdn.example.org/c.jpg>")).toBe(
      "https://cdn.example.org/c.jpg",
    );
  });

  it("resolves relative and protocol-relative addresses against the page", () => {
    expect(extract('<meta property="og:image" content="cover.png">')).toBe(
      "https://example.org/reports/2024/cover.png",
    );
    expect(extract('<meta property="og:image" content="/img/cover.png">')).toBe(
      "https://example.org/img/cover.png",
    );
    expect(extract('<meta property="og:image" content="//cdn.example.org/x.png">')).toBe(
      "https://cdn.example.org/x.png",
    );
  });

  it("resolves against <base href> when the page has one, and ignores a broken one", () => {
    expect(
      extract(
        '<base href="https://static.example.net/site/"><meta property="og:image" content="x.png">',
      ),
    ).toBe("https://static.example.net/site/x.png");
    expect(extract('<base href="https://["><meta property="og:image" content="x.png">')).toBe(
      "https://example.org/reports/2024/x.png",
    );
  });

  it("decodes HTML entities once", () => {
    expect(
      extract(
        '<meta property="og:image" content="https://cdn.example.org/a.jpg?w=1&amp;h=2&#x26;q=3&#38;f=&quot;x&quot;">',
      ),
    ).toBe("https://cdn.example.org/a.jpg?w=1&h=2&q=3&f=%22x%22");
    expect(
      extract('<meta property="og:image" content="https:&#x2F;&#47;cdn.example.org&sol;b.jpg">'),
    ).toBe("https://cdn.example.org/b.jpg");
    // Double-encoded stays encoded once; unknown or out-of-range entities stay as they are.
    expect(
      extract(
        '<meta property="og:image" content="https://cdn.example.org/c.jpg?a=1&amp;amp;b=2&bogus;&#0;&#x110000;">',
      ),
    ).toBe("https://cdn.example.org/c.jpg?a=1&amp;b=2&bogus;&#0;&#x110000;");
  });

  it("prefers secure_url, then og:image, then twitter:image, skipping what isn't https", () => {
    expect(
      extract(
        '<meta name="twitter:image" content="https://t.example.org/t.jpg">' +
          '<meta property="og:image" content="https://o.example.org/o.jpg">' +
          '<meta property="og:image:secure_url" content="https://s.example.org/s.jpg">',
      ),
    ).toBe("https://s.example.org/s.jpg");
    expect(
      extract(
        '<meta property="og:image" content="http://o.example.org/o.jpg">' +
          '<meta name="twitter:image" content="https://t.example.org/t.jpg">',
      ),
    ).toBe("https://t.example.org/t.jpg");
    expect(
      extract(
        '<meta property="og:image" content="http://o.example.org/1.jpg">' +
          '<meta property="og:image" content="https://o.example.org/2.jpg">',
      ),
    ).toBe("https://o.example.org/2.jpg");
    expect(extract('<meta name="twitter:image:src" content="https://t.example.org/src.jpg">')).toBe(
      "https://t.example.org/src.jpg",
    );
  });

  it("refuses images that aren't public https addresses or don't fit the column", () => {
    for (const content of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "http://cdn.example.org/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://localhost/a.jpg",
      "https://user:pw@cdn.example.org/a.jpg",
      "https://cdn.example.org:8443/a.jpg",
      "https://[",
      `https://cdn.example.org/${"a".repeat(1000)}.jpg`,
      "   ",
    ]) {
      expect(extract(`<meta property="og:image" content="${content}">`), content).toBeNull();
    }
  });

  it("ignores tags in comments and scripts, and unrelated meta tags", () => {
    expect(
      extract(
        '<!-- <meta property="og:image" content="https://x.example.org/old.jpg"> -->' +
          '<script>document.write(\'<meta property="og:image" content="https://x.example.org/js.jpg">\')</script>' +
          '<meta property="og:image:alt" content="https://x.example.org/alt.jpg">' +
          '<meta name="description" content="Hi"><meta charset="utf-8">',
      ),
    ).toBeNull();
    expect(extractPreviewImage("<html><head><title>No image</title>", PAGE)).toBeNull();
  });
});

describe("pinnedLookup", () => {
  it("answers with the checked address in both callback forms", () => {
    const lookup = pinnedLookup(PUBLIC);
    const single = vi.fn();
    lookup("example.org", {}, single);
    expect(single).toHaveBeenCalledWith(null, PUBLIC.address, 4);
    const all = vi.fn();
    lookup("example.org", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [PUBLIC]);
  });
});

describe("findPreviewImage", () => {
  it("fetches the page through the checked, pinned address", async () => {
    const net = network([page(OG("/cover.jpg"))]);
    expect(await findPreviewImage("https://example.org/report", net)).toBe(
      "https://example.org/cover.jpg",
    );
    expect(net.lookup).toHaveBeenCalledWith("example.org");
    const [url, address] = net.request.mock.calls[0]!;
    expect(url.href).toBe("https://example.org/report");
    expect(address).toEqual(PUBLIC);
  });

  it("derives YouTube thumbnails without any request", async () => {
    const net = network([]);
    expect(await findPreviewImage("https://youtu.be/dQw4w9WgXcQ", net)).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(net.lookup).not.toHaveBeenCalled();
  });

  it("reads a Vimeo player link from the video's page", async () => {
    const net = network([page(OG("https://i.vimeocdn.com/video/1-d"))]);
    expect(await findPreviewImage("https://player.vimeo.com/video/76979871?h=abc", net)).toBe(
      "https://i.vimeocdn.com/video/1-d",
    );
    expect(net.request.mock.calls[0]![0].href).toBe("https://vimeo.com/76979871");
  });

  it.each([
    "not a url",
    "http://example.org/",
    "https://user:pw@example.org/",
    "https://example.org:8080/",
    "https://localhost/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.5/",
  ])("refuses %s before any DNS or request", async (url) => {
    const net = network([page(OG("https://x.example.org/a.jpg"))]);
    expect(await findPreviewImage(url, net)).toBeNull();
    expect(net.lookup).not.toHaveBeenCalled();
    expect(net.request).not.toHaveBeenCalled();
  });

  it.each([
    [["127.0.0.1"]],
    [["169.254.169.254"]],
    [["10.1.2.3"]],
    [["172.20.0.1"]],
    [["192.168.0.10"]],
    [["0.0.0.0"]],
    [["::1"]],
    [["fd12:3456::1"]],
    [["fe80::1"]],
    [["::ffff:10.0.0.1"]],
    // One bad address is enough: the pinned one must not be a lucky pick.
    [["93.184.216.34", "10.0.0.1"]],
    [[]],
  ])("refuses a host resolving to %j", async (addresses) => {
    const net = network([page(OG("https://x.example.org/a.jpg"))], {
      "rebind.example.com": addresses,
    });
    expect(await findPreviewImage("https://rebind.example.com/", net)).toBeNull();
    expect(net.request).not.toHaveBeenCalled();
  });

  it("connects to a public IP literal without DNS", async () => {
    const net = network([page(OG("https://x.example.org/a.jpg"))]);
    expect(await findPreviewImage("https://[2606:4700::1111]/", net)).toBe(
      "https://x.example.org/a.jpg",
    );
    expect(net.lookup).not.toHaveBeenCalled();
    expect(net.request.mock.calls[0]![1]).toEqual({ address: "2606:4700::1111", family: 6 });
  });

  it("follows up to 3 redirects, resolving relative locations", async () => {
    const net = network([
      redirect("/step-2", 301),
      redirect("https://www.example.net/step-3", 307),
      redirect("step-4", 308),
      page(OG("https://x.example.org/final.jpg")),
    ]);
    expect(await findPreviewImage("https://example.org/start", net)).toBe(
      "https://x.example.org/final.jpg",
    );
    expect(net.request.mock.calls.map(([url]) => url.href)).toEqual([
      "https://example.org/start",
      "https://example.org/step-2",
      "https://www.example.net/step-3",
      "https://www.example.net/step-4",
    ]);
    expect(net.lookup).toHaveBeenCalledWith("www.example.net");
  });

  it("stops after the 3rd redirect", async () => {
    const net = network([redirect("/a"), redirect("/b"), redirect("/c"), redirect("/d")]);
    expect(await findPreviewImage("https://example.org/", net)).toBeNull();
    expect(net.request).toHaveBeenCalledTimes(4);
  });

  it.each([
    "http://example.org/plain",
    "https://127.0.0.1/admin",
    "https://169.254.169.254/latest/meta-data/",
    "https://example.org:8443/",
    "https://u:p@example.org/",
  ])("re-checks a redirect to %s and refuses it", async (location) => {
    const net = network([redirect(location), page(OG("https://x.example.org/a.jpg"))]);
    expect(await findPreviewImage("https://example.org/", net)).toBeNull();
    expect(net.request).toHaveBeenCalledTimes(1);
  });

  it("re-resolves a redirect's host and refuses a private answer", async () => {
    const net = network(
      [redirect("https://internal.example.com/"), page(OG("https://x.example.org/a.jpg"))],
      { "internal.example.com": ["10.0.0.7"] },
    );
    expect(await findPreviewImage("https://example.org/", net)).toBeNull();
    expect(net.request).toHaveBeenCalledTimes(1);
  });

  it("takes the thumbnail when a short link redirects to YouTube", async () => {
    const net = network([redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ")]);
    expect(await findPreviewImage("https://bit.ly/x", net)).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("gives up on a redirect without a location, an error status or non-HTML", async () => {
    for (const response of [
      redirect(undefined),
      page(OG("https://x.example.org/a.jpg"), { status: 404 }),
      page(OG("https://x.example.org/a.jpg"), { status: 103 }),
      page("%PDF-1.7", { contentType: "application/pdf" }),
      page(OG("https://x.example.org/a.jpg"), { contentType: "application/xhtml+xml" }),
      page(OG("https://x.example.org/a.jpg"), { contentType: "" }),
    ]) {
      const net = network([response]);
      expect(await findPreviewImage("https://example.org/", net)).toBeNull();
      expect(response.close).toHaveBeenCalled();
    }
  });

  it("decompresses gzip, deflate and brotli bodies, refusing unknown encodings", async () => {
    const html = OG("https://x.example.org/zipped.jpg");
    const cases: [string, Uint8Array, string | null][] = [
      ["gzip", gzipSync(html), "https://x.example.org/zipped.jpg"],
      ["x-gzip", gzipSync(html), "https://x.example.org/zipped.jpg"],
      ["deflate", deflateSync(html), "https://x.example.org/zipped.jpg"],
      ["br", brotliCompressSync(html), "https://x.example.org/zipped.jpg"],
      ["identity", Buffer.from(html), "https://x.example.org/zipped.jpg"],
      ["compress", Buffer.from(html), null],
      ["constructor", Buffer.from(html), null],
    ];
    for (const [encoding, body, expected] of cases) {
      const net = network([page([body], { contentEncoding: encoding })]);
      expect(await findPreviewImage("https://example.org/", net), encoding).toBe(expected);
    }
  });

  it("gives up on a corrupt compressed body", async () => {
    const net = network([page(["not gzip at all"], { contentEncoding: "gzip" })]);
    expect(await findPreviewImage("https://example.org/", net)).toBeNull();
  });

  it("reads at most ~512 kB", async () => {
    const filler = "<!-- " + "x".repeat(600 * 1024) + " -->";
    const late = network([page(`<html><head>${filler}${OG("https://x.example.org/late.jpg")}`)]);
    expect(await findPreviewImage("https://example.org/", late)).toBeNull();
  });

  it("stops reading once the head is over", async () => {
    const seen = { count: 0 };
    const response = page("", {
      body: chunks(
        [OG("https://x.example.org/early.jpg"), "<body>", "x".repeat(1024), "y".repeat(1024)],
        seen,
      ),
    });
    expect(await findPreviewImage("https://example.org/", network([response]))).toBe(
      "https://x.example.org/early.jpg",
    );
    // The stream may buffer one chunk ahead, never the whole body.
    expect(seen.count).toBeLessThan(4);
    expect(response.close).toHaveBeenCalled();
  });

  it("decodes the declared charset, falling back to UTF-8 for an unknown one", async () => {
    const latin = Buffer.from(
      '<meta property="og:image" content="https://x.example.org/caf\xe9.jpg">',
      "latin1",
    );
    const net = network([page([latin], { contentType: "text/html; charset=windows-1252" })]);
    expect(await findPreviewImage("https://example.org/", net)).toBe(
      "https://x.example.org/caf%C3%A9.jpg",
    );
    const unknown = network([
      page(OG("https://x.example.org/u.jpg"), { contentType: 'text/html; charset="no-such"' }),
    ]);
    expect(await findPreviewImage("https://example.org/", unknown)).toBe(
      "https://x.example.org/u.jpg",
    );
  });

  it("gives up when DNS or the request fails", async () => {
    const failingDns = network([]);
    failingDns.lookup.mockRejectedValueOnce(new Error("ENOTFOUND"));
    expect(await findPreviewImage("https://nowhere.example/", failingDns)).toBeNull();
    const failingRequest = network([]);
    expect(await findPreviewImage("https://example.org/", failingRequest)).toBeNull();
  });

  it("gives up after the timeout, whatever hangs", async () => {
    const hungDns = network([]);
    hungDns.lookup.mockReturnValueOnce(new Promise(() => undefined));
    expect(
      await findPreviewImage("https://example.org/", { ...hungDns, timeoutMs: 20 }),
    ).toBeNull();

    const hungBody = page("", {
      body: (async function* () {
        yield Buffer.from("<html><head>");
        await new Promise(() => undefined);
      })(),
    });
    const net = network([hungBody]);
    expect(await findPreviewImage("https://example.org/", { ...net, timeoutMs: 20 })).toBeNull();
    // The request saw the abort signal fire.
    expect(net.request.mock.calls[0]![2].aborted).toBe(true);
  });

  it("gives up when the caller aborts, even before starting", async () => {
    const net = network([page(OG("https://x.example.org/a.jpg"))]);
    expect(
      await findPreviewImage("https://example.org/", { ...net, signal: AbortSignal.abort() }),
    ).toBeNull();
  });
});

describe("findPreviewImages", () => {
  it("looks up distinct links in parallel, capped, keeping only the found ones", async () => {
    const find = vi.fn(async (url: string) => (url.endsWith("none") ? null : `${url}.jpg`));
    const found = await findPreviewImages(
      [
        "https://a.example/1",
        "https://a.example/1",
        "https://a.example/none",
        "https://a.example/2",
        "https://a.example/3",
      ],
      { max: 3, find },
    );
    expect(find).toHaveBeenCalledTimes(3);
    expect(Object.fromEntries(found)).toEqual({
      "https://a.example/1": "https://a.example/1.jpg",
      "https://a.example/2": "https://a.example/2.jpg",
    });
  });

  it("drops what isn't done within the budget and survives a throwing finder", async () => {
    const find = vi.fn(async (url: string, options?: { signal?: AbortSignal }) => {
      if (url.endsWith("boom")) throw new Error("boom");
      if (url.endsWith("slow")) {
        await new Promise((done) => options?.signal?.addEventListener("abort", done));
        return `${url}.jpg`;
      }
      return `${url}.jpg`;
    });
    const found = await findPreviewImages(
      ["https://a.example/fast", "https://a.example/slow", "https://a.example/boom"],
      { budgetMs: 20, find },
    );
    expect([...found.keys()]).toEqual(["https://a.example/fast"]);
  });

  it("does nothing for an empty list", async () => {
    const find = vi.fn();
    expect((await findPreviewImages([], { find })).size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });
});
