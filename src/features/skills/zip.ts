import { crc32, deflateRawSync } from "node:zlib";

/**
 * A minimal ZIP writer (PKWARE APPNOTE 6.3): local file headers, the central
 * directory and its end record — no ZIP64, no encryption, no extra fields.
 * Enough for the skill downloads (a few small text files), without a
 * dependency. Each file is deflated when that makes it smaller, else stored;
 * names are UTF-8 (general purpose flag bit 11) with "/" separators.
 */

export interface ZipEntry {
  /** Path inside the archive, e.g. `atlas-web/SKILL.md`. */
  path: string;
  data: Uint8Array;
  /** Modification time (default 1 January 1980, the earliest a ZIP can hold). */
  modified?: Date;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const VERSION = 20; // 2.0: deflate
const UTF8_NAMES = 0x0800;
const STORED = 0;
const DEFLATED = 8;
/** "Made by" Unix, so the external attributes below carry the file mode. */
const MADE_BY_UNIX = (3 << 8) | VERSION;
/** A regular file, rw-r--r--. */
const FILE_ATTRIBUTES = (0o100644 << 16) >>> 0;

/** MS-DOS time and date fields (2-second precision, years 1980–2107), in UTC. */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

export function zip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path.replace(/\\/g, "/").replace(/^\/+/, ""), "utf8");
    const deflated = deflateRawSync(entry.data);
    const method = deflated.length < entry.data.length ? DEFLATED : STORED;
    const body = method === DEFLATED ? deflated : Buffer.from(entry.data);
    const checksum = crc32(entry.data);
    const stamp = dosDateTime(entry.modified ?? new Date(Date.UTC(1980, 0, 1)));

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_HEADER, 0);
    header.writeUInt16LE(MADE_BY_UNIX, 4);
    header.writeUInt16LE(VERSION, 6);
    header.writeUInt16LE(UTF8_NAMES, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    // 30 extra field length, 32 comment length, 34 disk number, 36 internal attributes: all 0.
    header.writeUInt32LE(FILE_ATTRIBUTES, 38);
    header.writeUInt32LE(offset, 42);

    parts.push(local, name, body);
    central.push(header, name);
    offset += local.length + name.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  // 4 this disk, 6 the directory's disk: both 0.
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return new Uint8Array(Buffer.concat([...parts, directory, end]));
}
