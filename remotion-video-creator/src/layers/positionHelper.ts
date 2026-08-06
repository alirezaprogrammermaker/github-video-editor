import type { CSSProperties } from "react";
import type { PositionAnchor } from "./types";

/**
 * Convert a PositionAnchor + offsets into absolute CSS position properties.
 */
export function resolvePosition(
  anchor: PositionAnchor = "bottom-center",
  offsetX: number = 0,
  offsetY: number = 0,
): CSSProperties {
  const base: CSSProperties = { position: "absolute" };

  // Vertical
  if (anchor.startsWith("top")) {
    base.top = offsetY;
  } else if (anchor.startsWith("bottom")) {
    base.bottom = offsetY;
  } else {
    // center vertically
    base.top = "50%";
    base.transform = `translateY(calc(-50% + ${offsetY}px))`;
  }

  // Horizontal
  if (anchor.endsWith("left")) {
    base.left = offsetX;
  } else if (anchor.endsWith("right")) {
    base.right = offsetX;
  } else {
    // center horizontally
    if (base.transform) {
      base.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
      base.left = `calc(50% + ${offsetX}px)`;
    } else {
      base.left = 0;
      base.right = 0;
      base.display = "flex";
      base.justifyContent = "center";
      if (offsetX !== 0) {
        base.paddingLeft = offsetX;
        base.paddingRight = offsetX;
      }
    }
  }

  return base;
}

/**
 * Replace {{variable}} placeholders in a string with actual values.
 * Keys may include letters, digits, underscore, dot, and hyphen.
 */
export function resolveVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{([\w.-]+)\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      console.warn(`Unknown template variable: {{${key}}}`);
      return "";
    }
    return vars[key];
  });
}
