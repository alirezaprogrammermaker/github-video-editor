import type { CSSProperties } from "react";

export type TextDirection = "rtl" | "ltr" | "auto";

/**
 * Bidi styling for the Persian content this project renders.
 *
 * "auto" resolves the paragraph direction from its first strong character, which
 * keeps punctuation, digits and Latin words on the correct side for both the
 * Persian tracks and the English `_en.vtt` ones. An explicit "rtl"/"ltr" forces
 * the direction while still isolating the block from its surroundings.
 */
export function textDirectionStyle(
  direction: TextDirection = "auto",
): Pick<CSSProperties, "direction" | "unicodeBidi"> {
  if (direction === "auto") {
    return { direction: "rtl", unicodeBidi: "plaintext" };
  }
  return { direction, unicodeBidi: "isolate" };
}
