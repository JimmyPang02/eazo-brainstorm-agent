import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

type AgentRunResponseJson = {
  ok?: boolean;
  response?: {
    operations?: Array<{ type?: string }>;
  };
};

test.describe("real OpenAI UI smoke", () => {
  test.skip(
    process.env.BRAINSTORM_REAL_OPENAI_E2E !== "1" || !process.env.OPENAI_API_KEY,
    "Set BRAINSTORM_REAL_OPENAI_E2E=1 and OPENAI_API_KEY to run the real UI Agent smoke.",
  );

  test.setTimeout(90_000);

  test("updates and persists the tree through the real /api/agent/run route", async ({ page }) => {
    await page.goto("/");

    const initialActiveCount = await getActiveIdeaCount(page);
    const agentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/agent/run") && response.request().method() === "POST",
      { timeout: 75_000 },
    );

    await page.getByRole("button", { name: "继续长" }).first().click();

    const agentResponse = await agentResponsePromise;
    expect(agentResponse.ok()).toBe(true);

    const responseBody = (await agentResponse.json()) as AgentRunResponseJson;
    expect(responseBody.ok).toBe(true);
    expect(responseBody.response?.operations?.some((operation) => operation.type === "create_nodes")).toBe(
      true,
    );

    await expect.poll(() => getActiveIdeaCount(page), { timeout: 15_000 }).toBeGreaterThan(initialActiveCount);

    const updatedActiveCount = await getActiveIdeaCount(page);
    await page.waitForTimeout(800);
    await page.reload();

    await expect.poll(() => getActiveIdeaCount(page), { timeout: 15_000 }).toBe(updatedActiveCount);
  });
});

async function getActiveIdeaCount(page: Page) {
  const stats = await page.getByText(/树上做判断/).innerText();
  const match = stats.match(/(\d+)\s*个活跃想法/);

  if (!match) {
    throw new Error(`Could not read active idea count from: ${stats}`);
  }

  return Number(match[1]);
}
