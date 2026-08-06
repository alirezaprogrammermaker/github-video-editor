import { describe, expect, it } from "vitest";
import { parseVtt, stripCueMarkup } from "./parseVtt";

describe("parseVtt", () => {
  it("parses a basic WebVTT document", () => {
    const cues = parseVtt(`WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:04.500 --> 00:00:08.000
Second cue`);

    expect(cues).toEqual([
      { start: 1, end: 4, text: "Hello world" },
      { start: 4.5, end: 8, text: "Second cue" },
    ]);
  });

  it("ignores trailing cue settings", () => {
    const cues = parseVtt(`WEBVTT

00:00:01.000 --> 00:00:05.000 align:start position:50%
Settings ignored`);

    expect(cues).toEqual([
      { start: 1, end: 5, text: "Settings ignored" },
    ]);
  });

  it("accepts comma decimal separators", () => {
    const cues = parseVtt(`WEBVTT

00:00:01,250 --> 00:00:02,500
Comma millis`);

    expect(cues).toEqual([{ start: 1.25, end: 2.5, text: "Comma millis" }]);
  });

  it("strips inline cue markup from text", () => {
    const cues = parseVtt(`WEBVTT

00:00:01.000 --> 00:00:02.000
Hello <c.yellow>world</c> <00:00:01.500>now`);

    expect(cues[0].text).toBe("Hello world now");
  });

  it("throws on malformed cue timing", () => {
    expect(() =>
      parseVtt(`WEBVTT

not-a-timestamp --> also-bad
Text`),
    ).toThrow(/Invalid WebVTT cue timing/);
  });

  it("throws when cue ends before it starts", () => {
    expect(() =>
      parseVtt(`WEBVTT

00:00:05.000 --> 00:00:01.000
Backwards`),
    ).toThrow(/ends before it starts/);
  });

  it("skips NOTE blocks and cue identifiers", () => {
    const cues = parseVtt(`WEBVTT

NOTE this is a comment

cue-1
00:00:01.000 --> 00:00:02.000
Identified`);

    expect(cues).toEqual([{ start: 1, end: 2, text: "Identified" }]);
  });
});

describe("stripCueMarkup", () => {
  it("decodes common entities", () => {
    expect(stripCueMarkup("A &amp; B &lt;C&gt;")).toBe("A & B <C>");
  });
});
