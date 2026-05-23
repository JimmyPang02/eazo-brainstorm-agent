import { expect, test, type Locator } from "@playwright/test";

// Node focus relies on pointerdown + pointerup (see idea-node-card.tsx). The
// canvas sits inside a pan/zoom transform, so deeper-layer nodes can extend
// outside Playwright's viewport rectangle even though they're rendered. Dispatch
// the pointer event pair via DOM APIs so the viewport bounds check is skipped.
async function focusNode(locator: Locator) {
  await locator.evaluate((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const options: PointerEventInit = {
      pointerId: 1,
      pointerType: "mouse",
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      button: 0,
      bubbles: true,
      cancelable: true,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", options));
    el.dispatchEvent(new PointerEvent("pointerup", options));
  });
}

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
    const callIndex = agentCall;
    await route.fulfill({
      json: {
        ok: true,
        response: {
          message: `我先沿当前节点长出三个可比较方向（第 ${callIndex} 次）。`,
          operations: [
            {
              type: "create_nodes",
              parentNodeId,
              ideas: [
                { title: `分支-${callIndex}-A`, description: "第一个候选方向。" },
                { title: `分支-${callIndex}-B`, description: "第二个候选方向。" },
                { title: `分支-${callIndex}-C`, description: "第三个候选方向。" },
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

  // Layer 1 children arrive from the seed-and-grow agent call.
  await expect(page.getByRole("button", { name: "分支-1-A" })).toBeVisible();

  // Grow a layer-1 node → layer 2.
  await focusNode(page.getByRole("button", { name: "分支-1-A" }));
  await page.getByRole("button", { name: "继续长" }).dispatchEvent("click");
  await chatInput.fill("再多想几个角度");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "分支-2-A" })).toBeVisible();

  // Grow a layer-2 node → layer 3 (canConverge threshold).
  await focusNode(page.getByRole("button", { name: "分支-2-A" }));
  await page.getByRole("button", { name: "继续长" }).dispatchEvent("click");
  await chatInput.fill("再深入一层");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "分支-3-A" })).toBeVisible();

  // Favorite one node and park another so the synthesis has material.
  await focusNode(page.getByRole("button", { name: "分支-3-A" }));
  await page.getByRole("button", { name: "收藏" }).dispatchEvent("click");

  await focusNode(page.getByRole("button", { name: "分支-1-B" }));
  await page.getByRole("button", { name: "放一边" }).dispatchEvent("click");

  // Converge → clear version dialog with the agent's HTML report. The button's
  // aria-label overrides its text; match by accessible name.
  await page.getByRole("button", { name: "收敛当前想法" }).click();

  const clearVersionDialog = page.getByRole("dialog", { name: "清晰版本" });
  await expect(clearVersionDialog).toBeVisible();
  await expect(clearVersionDialog.getByText("这一轮想法现在更清楚了")).toBeVisible();
  await page.getByRole("button", { name: "继续想" }).click();
  await expect(clearVersionDialog).toBeHidden();

  // Persistence smoke check: the seeded tree survives a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "分支-1-A" })).toBeVisible();
  expect(agentCall).toBeGreaterThanOrEqual(4);
});
