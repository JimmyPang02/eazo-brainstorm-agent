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

test("sends similar-case quick actions as web research requests", async ({ page }) => {
  type CapturedQuickActionRequest = {
    allowWebSearch: boolean;
    userMessage: string;
    focusedNodeId?: string;
    state: { rootNodeId: string };
  };
  const capturedRequest: { current: CapturedQuickActionRequest | null } = { current: null };

  await page.route("**/api/agent/run", async (route) => {
    const request = route.request().postDataJSON() as CapturedQuickActionRequest;
    capturedRequest.current = request;

    await route.fulfill({
      json: {
        ok: true,
        response: {
          message: "我会先找可借鉴的相似案例。",
          operations: [
            {
              type: "ask_followup",
              nodeId: request.focusedNodeId ?? request.state.rootNodeId,
              question: "你更想参考产品、内容还是活动案例？",
            },
          ],
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "找相似案例" }).click();

  await expect.poll(() => capturedRequest.current?.allowWebSearch).toBe(true);
  const userMessage = capturedRequest.current?.userMessage ?? "";
  expect(userMessage).toContain("网络调研");
  expect(userMessage).toContain("相似案例");
  expect(userMessage).toContain("不要生成 PRD");
  await expect(page.getByText("你更想参考产品、内容还是活动案例？")).toBeVisible();
});

test("shows merge suggestion cards without deleting nodes", async ({ page }) => {
  await page.route("**/api/agent/run", async (route) => {
    const request = route.request().postDataJSON() as {
      state: {
        rootNodeId: string;
        nodes: Record<string, { title: string; parentId: string | null }>;
      };
      userMessage: string;
    };
    const candidateIds = Object.entries(request.state.nodes)
      .filter(([, node]) => node.parentId === request.state.rootNodeId)
      .slice(0, 2)
      .map(([id]) => id);

    await route.fulfill({
      json: {
        ok: true,
        response: {
          message: "这两个节点可以先合成一个候选方向。",
          operations: [
            {
              type: "propose_node_merge",
              nodeIds: candidateIds,
              title: "树状思考伙伴",
              description: "把树形表达和节点动作合成一个更聚焦的方向。",
              reason: "它们都在描述让想法通过节点操作变清楚。",
            },
          ],
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "合并重复" }).click();

  await expect(page.getByText("合并建议")).toBeVisible();
  await expect(page.getByText("树状思考伙伴")).toBeVisible();
  await expect(page.getByRole("button", { name: "节点只承载短想法片段" })).toBeVisible();
});
