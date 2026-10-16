import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads quoted fields: delimiters, line breaks and doubled quotes inside", () => {
    const text = 'Name,Note\r\n"Korea, Rep.","say ""hi""\nthere"\r\nChad,\r\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Note"],
      ["Korea, Rep.", 'say "hi"\nthere'],
      ["Chad", ""],
    ]);
  });

  it("drops a BOM and blank lines, reads LF and CRLF alike, keeps a last line without newline", () => {
    expect(parseCsv("\ufeffa,b\n\n1,2\r\n\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("splits on the delimiter it is given", () => {
    expect(parseCsv("a;b\n1,5;2", ";")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
    expect(parseCsv("a\tb\n1\t2", "\t")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("a quote opens a quoted field only at the field's start", () => {
    expect(parseCsv('a,b\n5" screen,"x"', ",")).toEqual([
      ["a", "b"],
      ['5" screen', "x"],
    ]);
  });
});

describe("detectDelimiter", () => {
  it("finds comma, semicolon and tab files", () => {
    expect(detectDelimiter("Country,Value\nCzechia,1.5\nPoland,2.5")).toBe(",");
    expect(detectDelimiter("Country;Value;Year\nCzechia;1,5;2024\nPoland;2,5;2024")).toBe(";");
    expect(detectDelimiter("Country\tValue\nCzechia\t1,5\nPoland\t2,5")).toBe("\t");
  });

  it("prefers ';' over ',' on a tie — a semicolon file writes decimal commas", () => {
    expect(detectDelimiter("Country;Value\nCzechia;1,5\nPoland;2,5")).toBe(";");
  });

  it("ignores delimiters inside quotes and title lines above the header", () => {
    expect(detectDelimiter('"Korea, Rep.";"1,5"\n"Chad";"2"')).toBe(";");
    const worldBank = [
      '"Data Source","World Development Indicators",',
      "",
      '"Last Updated Date","2026-07-01",',
      "",
      '"Country Name","Country Code","Indicator Name","Indicator Code","2022","2023",',
      '"Czechia","CZE","GDP","NY.GDP","1","2",',
      '"Poland","POL","GDP","NY.GDP","3","4",',
    ].join("\n");
    expect(detectDelimiter(worldBank)).toBe(",");
  });
});
