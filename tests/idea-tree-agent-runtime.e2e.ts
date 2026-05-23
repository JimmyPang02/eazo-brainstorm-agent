import { expect, test } from "@playwright/test";

test("lets the user retry a failed agent run", async ({ page }) => {
  let calls = 0;

  await page.route("**/api/agent/run", async (route) => {
    calls += 1;

    if (calls === 1) {
      await route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: "missing_openai_api_key",
          message: "OPENAI_API_KEY is not configured on the server.",
        },
      });
      return;
    }

    const request = route.request().postDataJSON() as {
      focusedNodeId?: string;
      state: { rootNodeId: string };
    };

    await route.fulfill({
      json: {
        ok: true,
        response: {
          message: "我重新试了一次，并长出一个方向。",
          operations: [
            {
              type: "create_nodes",
              parentNodeId: request.focusedNodeId ?? request.state.rootNodeId,
              ideas: [{ title: "失败后重试的新方向", description: "重试后仍然通过树更新。" }],
            },
          ],
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "继续长" }).first().click();

  await expect(page.getByText("OPENAI_API_KEY is not configured on the server.")).toBeVisible();
  await page.getByRole("button", { name: "重试" }).click();

  await expect(page.getByRole("button", { name: "失败后重试的新方向" })).toBeVisible();
  expect(calls).toBe(2);
});

test("lets the user cancel an in-flight agent run", async ({ page }) => {
  await page.route("**/api/agent/run", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      json: {
        ok: true,
        response: {
          message: "这个响应应该被取消。",
          operations: [
            {
              type: "create_nodes",
              parentNodeId: "unused",
              ideas: [{ title: "取消后不应出现" }],
            },
          ],
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "继续长" }).first().click();

  await expect(page.getByRole("button", { name: "取消" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await expect(page.getByText("已取消这次 AI 操作。")).toBeVisible();
  await expect(page.getByRole("button", { name: "取消后不应出现" })).toHaveCount(0);
});
