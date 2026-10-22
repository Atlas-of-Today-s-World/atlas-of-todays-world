import { describe, expect, it } from "vitest";
import { CV_ACCEPT, cleanFileName, cvExtension } from "./cv";
import { ApplicationInput, PositionInput } from "./schema";

const bytes = (...values: number[]) => new Uint8Array(values);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00);
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);

describe("CV files", () => {
  it("recognises an accepted format by its extension and first bytes", () => {
    expect(cvExtension("Ana Novak CV.PDF", PDF)).toBe("pdf");
    expect(cvExtension("cv.docx", ZIP)).toBe("docx");
    expect(cvExtension("cv.odt", ZIP)).toBe("odt");
    expect(cvExtension("cv.doc", OLE)).toBe("doc");
  });

  it("refuses other formats and files that only pretend", () => {
    expect(cvExtension("cv.html", PDF)).toBeNull();
    expect(cvExtension("cv", PDF)).toBeNull();
    expect(cvExtension("cv.pdf", ZIP)).toBeNull();
    expect(cvExtension("cv.docx", PDF)).toBeNull();
    expect(cvExtension("cv.pdf", bytes(0x25, 0x50))).toBeNull();
    expect(cvExtension("cv.constructor", PDF)).toBeNull();
  });

  it("offers every accepted extension to the file picker", () => {
    for (const ext of [".pdf", ".doc", ".docx", ".odt"]) expect(CV_ACCEPT).toContain(ext);
  });

  it("keeps a plain, short file name", () => {
    expect(cleanFileName("C:\\Users\\ana\\My  CV.pdf", "pdf")).toBe("My CV.pdf");
    expect(cleanFileName('a"b\u0007.pdf', "pdf")).toBe("ab.pdf");
    expect(cleanFileName("/", "docx")).toBe("cv.docx");
    expect(cleanFileName(`${"x".repeat(300)}.pdf`, "pdf")).toHaveLength(200);
    expect(cleanFileName(`${"x".repeat(300)}.pdf`, "pdf").endsWith(".pdf")).toBe(true);
  });
});

const application = {
  position_id: "6f1c1c1e-6a51-4c5a-9a3c-1d1b1f1e1a1b",
  name: " Ana ",
  email: " Ana@Example.org ",
  message: "First paragraph.\n\nSecond paragraph.",
  consent: "on",
};

describe("job applications", () => {
  it("accepts a filled form and normalises name and e-mail", () => {
    expect(ApplicationInput.parse(application)).toMatchObject({
      name: "Ana",
      email: "ana@example.org",
      message: "First paragraph.\n\nSecond paragraph.",
    });
  });

  it("stores line breaks as the textarea counts them", () => {
    const message = "One.\r\n\r\nTwo.\r\n";
    expect(ApplicationInput.parse({ ...application, message }).message).toBe("One.\n\nTwo.");
  });

  it("answers with the code the form shows", () => {
    const issue = (input: object) =>
      ApplicationInput.safeParse({ ...application, ...input }).error?.issues[0]?.message;
    expect(issue({ name: "  " })).toBe("name");
    expect(issue({ email: "ana@" })).toBe("invalidEmail");
    expect(issue({ message: "   " })).toBe("message");
    expect(issue({ message: "x".repeat(8001) })).toBe("tooLong");
    expect(issue({ consent: null })).toBe("consent");
  });
});

describe("positions", () => {
  const position = {
    title: "Editor",
    slug: "Editor",
    location: "Remote",
    job_type: "Volunteer",
    summary: "",
    body_html: '<h2>About the role</h2><p onclick="x()">Text</p><script>bad()</script>',
    status: "open",
  };

  it("sanitizes the profile and lowercases the address", () => {
    const parsed = PositionInput.parse(position);
    expect(parsed.slug).toBe("editor");
    expect(parsed.id).toBeUndefined();
    expect(parsed.body_html).toBe("<h2>About the role</h2><p>Text</p>");
  });

  it("refuses an unknown status or a bad address", () => {
    expect(PositionInput.safeParse({ ...position, status: "published" }).success).toBe(false);
    expect(PositionInput.safeParse({ ...position, slug: "edi tor" }).success).toBe(false);
  });
});
