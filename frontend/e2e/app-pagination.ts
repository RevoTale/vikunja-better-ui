import { expect, type Page } from "@playwright/test";
import { graphQLOperation } from "./app-api";

export async function findTaskInPaginatedList(page: Page, title: string) {
  const taskLink = page.getByRole("link", { name: title, exact: true });
  const taskList = page.locator("main > section > div[aria-busy]");

  while (true) {
    await expect(taskList).toHaveAttribute("aria-busy", "false");
    if (await taskLink.isVisible()) return;

    const nextPage = page.getByRole("button", { name: "Go to next page" });
    if (!(await nextPage.isVisible()) || !(await nextPage.isEnabled())) {
      throw new Error(`${title} was not found in the list pages`);
    }
    const nextResponse = page.waitForResponse(
      (response) => graphQLOperation(response.request().postData()) === "TaskList",
    );
    await nextPage.click();
    await nextResponse;
  }
}
