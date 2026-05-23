import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");

describe("Eazo delivery surface", () => {
  test("does not require template Postgres or notification cron setup", () => {
    const envExample = readText(".env.example");
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const vercelConfig = JSON.parse(readText("vercel.json")) as { crons?: unknown[] };

    expect(envExample).not.toContain("DATABASE_URL");
    expect(envExample).not.toContain("CRON_SECRET");
    expect(packageJson.scripts ?? {}).not.toHaveProperty("cleanup:demo");
    expect(packageJson.scripts ?? {}).not.toHaveProperty("db:migrate");
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("postgres");
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("drizzle-orm");
    expect(packageJson.devDependencies ?? {}).not.toHaveProperty("drizzle-kit");
    expect(vercelConfig.crons ?? []).toHaveLength(0);
    expect(existsSync(join(ROOT, "src/lib/db"))).toBe(false);
    expect(existsSync(join(ROOT, "src/app/api/notifications"))).toBe(false);
    expect(existsSync(join(ROOT, "scripts/cleanup-demo.ts"))).toBe(false);
  });

  test("keeps the agent guide focused on this Brainstorm app instead of template todos", () => {
    const agentGuide = readText("AGENTS.md");

    expect(agentGuide).toContain("Brainstorm");
    expect(agentGuide).toContain("Idea Tree");
    expect(agentGuide).not.toContain("todo-list");
    expect(agentGuide).not.toContain("todos/");
  });
});

function readText(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}
