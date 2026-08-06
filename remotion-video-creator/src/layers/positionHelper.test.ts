import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePosition, resolveVariables } from "./positionHelper";

describe("resolveVariables", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces simple keys", () => {
    expect(
      resolveVariables("Hello {{name}}", { name: "World" }),
    ).toBe("Hello World");
  });

  it("supports dotted and hyphenated keys", () => {
    expect(
      resolveVariables("{{user.name}} / {{brand-color}}", {
        "user.name": "Ali",
        "brand-color": "red",
      }),
    ).toBe("Ali / red");
  });

  it("warns and blanks unknown keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveVariables("{{missing}}", {})).toBe("");
    expect(warn).toHaveBeenCalledWith("Unknown template variable: {{missing}}");
  });
});

describe("resolvePosition", () => {
  const anchors = [
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ] as const;

  it.each(anchors)("snapshots %s", (anchor) => {
    expect(resolvePosition(anchor, 12, 24)).toMatchSnapshot();
  });
});
