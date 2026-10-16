import { crc32, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { zip } from "./zip";

interface Read {
  path: string;
  data: Buffer;
  method: number;
  flags: number;
  time: number;
  date: number;
}

/**
 * Reads an archive back the way an unzip tool does: from the end record to the
 * central directory, then each local header it points to, checking that both
 * headers agree and that the data matches its CRC-32.
 */
function unzip(archive: Uint8Array): Read[] {
  const buffer = Buffer.from(archive);
  const end = buffer.length - 22;
  expect(buffer.readUInt32LE(end)).toBe(0x06054b50);
  const count = buffer.readUInt16LE(end + 10);
  expect(buffer.readUInt16LE(end + 8)).toBe(count);
  const size = buffer.readUInt32LE(end + 12);
  let at = buffer.readUInt32LE(end + 16);
  expect(at + size).toBe(end);

  const files: Read[] = [];
  for (let n = 0; n < count; n++) {
    expect(buffer.readUInt32LE(at)).toBe(0x02014b50);
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const time = buffer.readUInt16LE(at + 12);
    const date = buffer.readUInt16LE(at + 14);
    const crc = buffer.readUInt32LE(at + 16);
    const compressed = buffer.readUInt32LE(at + 20);
    const length = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extra = buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
    const offset = buffer.readUInt32LE(at + 42);
    const path = buffer.toString("utf8", at + 46, at + 46 + nameLength);

    // The local header says the same.
    expect(buffer.readUInt32LE(offset)).toBe(0x04034b50);
    expect(buffer.readUInt16LE(offset + 6)).toBe(flags);
    expect(buffer.readUInt16LE(offset + 8)).toBe(method);
    expect(buffer.readUInt32LE(offset + 14)).toBe(crc);
    expect(buffer.readUInt32LE(offset + 18)).toBe(compressed);
    expect(buffer.readUInt32LE(offset + 22)).toBe(length);
    const localName = buffer.readUInt16LE(offset + 26);
    expect(buffer.toString("utf8", offset + 30, offset + 30 + localName)).toBe(path);
    const start = offset + 30 + localName + buffer.readUInt16LE(offset + 28);
    const body = buffer.subarray(start, start + compressed);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    expect(data.length).toBe(length);
    expect(crc32(data)).toBe(crc);

    files.push({ path, data, method, flags, time, date });
    at += 46 + nameLength + extra;
  }
  return files;
}

describe("zip", () => {
  it("writes an archive an unzip tool can read back", () => {
    const text = "# Skill\n\n" + "Repeated text compresses well. ".repeat(50);
    const files = unzip(
      zip([
        { path: "atlas-web/SKILL.md", data: Buffer.from(text) },
        { path: "atlas-web/reference/čeština.md", data: Buffer.from("ž") },
        { path: "atlas-web/empty.txt", data: new Uint8Array() },
      ]),
    );
    expect(files.map((file) => file.path)).toEqual([
      "atlas-web/SKILL.md",
      "atlas-web/reference/čeština.md",
      "atlas-web/empty.txt",
    ]);
    expect(files[0]!.data.toString()).toBe(text);
    expect(files[0]!.method).toBe(8); // deflated: smaller
    expect(files[1]!.data.toString()).toBe("ž");
    expect(files[1]!.method).toBe(0); // stored: deflate would be bigger
    expect(files[2]!.data.length).toBe(0);
    for (const file of files) expect(file.flags & 0x0800).toBe(0x0800); // UTF-8 names
  });

  it("stores the modification time as MS-DOS date and time", () => {
    const [file] = unzip(
      zip([{ path: "a", data: Buffer.from("x"), modified: new Date("2026-10-16T13:45:30Z") }]),
    );
    expect(file!.date).toBe(((2026 - 1980) << 9) | (10 << 5) | 16);
    expect(file!.time).toBe((13 << 11) | (45 << 5) | 15);
    const [first] = unzip(zip([{ path: "b", data: Buffer.from("y") }]));
    expect(first!.date).toBe((0 << 9) | (1 << 5) | 1); // 1980-01-01
  });

  it("uses / separators without a leading slash", () => {
    const [file] = unzip(zip([{ path: "\\skill\\SKILL.md", data: Buffer.from("x") }]));
    expect(file!.path).toBe("skill/SKILL.md");
  });

  it("writes an empty archive as just the end record", () => {
    expect(unzip(zip([]))).toEqual([]);
  });
});
