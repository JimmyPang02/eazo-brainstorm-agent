import { expect, test } from "@playwright/test";

test("runs the Idea Tree brainstorm path with mocked agent operations", async ({ page }) => {
  let agentCall = 0;

  await page.route("**/api/agent/run", async (route) => {
    const request = route.request().postDataJSON() as {
      focusedNodeId?: string;
      state: {
        rootNodeId: string;
        nodes: Record<string, { title: string; favorited?: boolean; status?: string }>;
      };
      userMessage: string;
    };
    agentCall += 1;

    if (request.userMessage.includes("清晰版本")) {
      const favoritedTitles = Object.values(request.state.nodes)
        .filter((node) => node.favorited)
        .map((node) => node.title);
      const parkedTitles = Object.values(request.state.nodes)
        .filter((node) => node.status === "parked")
        .map((node) => node.title);

      await route.fulfill({
        json: {
          ok: true,
          response: {
            message: "我先把这一轮取舍收成一版清晰版本。",
            operations: [
              {
                type: "create_clear_version",
                summary: "这轮更清楚的是：先把 brainstorm 做成树上的判断过程。",
                favoritedTitles: favoritedTitles.length > 0 ? favoritedTitles : ["当前方向"],
                parked: parkedTitles,
                uncertain: "还不确定右侧对话需要多主动。",
                nextThought: "继续沿收藏的方向长出更小的交互细节。",
                html: "<section><h2>这一轮更清楚了</h2><p>先把 brainstorm 做成树上的判断过程。</p></section>",
              },
            ],
          },
        },
      });
      return;
    }

    const parentNodeId = request.focusedNodeId ?? request.state.rootNodeId;
    await route.fulfill({
      json: {
        ok: true,
        response: {
          message: "我先沿当前节点长出三个可比较方向。",
          operations: [
            {
              type: "create_nodes",
              parentNodeId,
              ideas: [
                { title: "更小的试用场景", description: "缩到一天内能验证的 brainstorm 体验。" },
                { title: "找一个反例", description: "看它什么时候会退化成普通聊天。" },
                { title: "换成内容选题", description: "验证它不只服务产品 idea。" },
              ],
            },
          ],
        },
      },
    });
  });

  await page.goto("/");

  // Empty canvas: seed the root by submitting the first thought.
  const chatInput = page.getByRole("textbox", { name: "问 AI" });
  await expect(chatInput).toBeVisible();
  await chatInput.fill("想做一个让人把模糊想法想清楚的 brainstorm 工具");
  await page.getByRole("button", { name: "发送" }).click();

  // Wait for AI-grown children.
  await expect(page.getByRole("button", { name: "更小的试用场景" })).toBeVisible();

  // Click a child to focus → favorite it.
  await page.getByRole("button", { name: "更小的试用场景" }).click();
  await page.getByRole("button", { name: "收藏" }).first().click();

  // Focus a different child → park it.
  await page.getByRole("button", { name: "找一个反例" }).click();
  await page.getByRole("button", { name: "放一边" }).first().click();

  // After favorite + grow, the synthesis trigger should appear.
  await page.getByRole("button", { name: "生成清晰版本" }).click();

  const clearVersionDialog = page.getByRole("dialog", { name: "清晰版本" });
  await expect(clearVersionDialog).toBeVisible();
  await expect(
    clearVersionDialog.getByText("这轮更清楚的是：先把 brainstorm 做成树上的判断过程。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续想" }).click();

  await page.reload();

  await expect(page.getByRole("button", { name: "更小的试用场景" })).toBeVisible();
  expect(agentCall).toBeGreaterThanOrEqual(2);
});
