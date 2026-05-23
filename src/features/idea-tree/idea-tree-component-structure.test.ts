import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const componentModules = [
  ["IdeaTreeCanvas", "idea-tree-canvas.tsx"],
  ["IdeaNodeCard", "idea-node-card.tsx"],
  ["NodeActions", "node-actions.tsx"],
  ["IdeaBasket", "idea-basket.tsx"],
  ["ClearVersionModal", "clear-version-modal.tsx"],
] as const;

describe("Idea Tree component structure", () => {
  test("keeps the required workspace components in separate modules", () => {
    for (const [exportName, fileName] of componentModules) {
      const path = join(import.meta.dir, fileName);
      expect(existsSync(path), `${fileName} should exist`).toBe(true);
      expect(readFileSync(path, "utf8")).toContain(`export function ${exportName}`);
    }
  });
});
