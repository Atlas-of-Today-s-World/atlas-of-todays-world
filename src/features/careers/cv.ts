/**
 * The CV attached to an application: which files are accepted and how they
 * are recognised (pure, unit-tested). The limits match the bucket
 * `job-applications` in 20261022001000_careers.sql, which enforces them again.
 */

/** The private bucket the CVs are kept in (signed URLs only). */
export const CV_BUCKET = "job-applications";

/** 4 MB: under Vercel's 4.5 MB request limit together with the rest of the form. */
export const CV_MAX_BYTES = 4 * 1024 * 1024;

/** Accepted formats by extension, with the type the file is stored under. */
export const CV_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
} as const;
export type CvExtension = keyof typeof CV_TYPES;

/** The file input's `accept`: extensions and types, so every picker offers them. */
export const CV_ACCEPT = [
  ...Object.keys(CV_TYPES).map((ext) => `.${ext}`),
  ...Object.values(CV_TYPES),
].join(",");

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .doc (OLE2)
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // .docx, .odt

const MAGIC: Record<CvExtension, number[]> = { pdf: PDF, doc: OLE, docx: ZIP, odt: ZIP };

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);

/**
 * The file's format when its extension is accepted and its first bytes match
 * it; null otherwise. The browser's own type is never trusted: the file is
 * stored under the type of its recognised format.
 */
export function cvExtension(fileName: string, head: Uint8Array): CvExtension | null {
  const ext = /\.([a-z]+)$/i.exec(fileName)?.[1]?.toLowerCase();
  if (!ext || !Object.hasOwn(CV_TYPES, ext)) return null;
  const known = ext as CvExtension;
  return startsWith(head, MAGIC[known]) ? known : null;
}

/**
 * The original file name as the team sees it: no folders, no control
 * characters, at most 200 characters (the column's CHECK). It only ever goes
 * into the download's file name and the admin table's text.
 */
export function cleanFileName(name: string, ext: CvExtension): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (base || `cv.${ext}`).slice(-200);
}
