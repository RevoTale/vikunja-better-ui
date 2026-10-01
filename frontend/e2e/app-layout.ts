import { expect, type Locator, type Page, test } from "@playwright/test";
import { invalidTitle, vikunjaTimezone } from "./app-fixture";

export function elementPadding(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { top: style.paddingTop, bottom: style.paddingBottom, left: style.paddingLeft };
  });
}

export async function expectTaskRowLayout(page: Page, title: string, label: string) {
  const isPhone = test.info().project.name.startsWith("phone-");
  const card = page.locator('[data-slot="card"]').filter({ hasText: title });
  await expect(card).toHaveCSS("padding-top", "0px");
  await expect(card).toHaveCSS("padding-bottom", "0px");
  const scheduleBox = await card.locator('[data-slot="task-schedule"]').boundingBox();
  const titleBox = await card.getByRole("link", { name: title }).boundingBox();
  const kindBox = await card.getByText("One-time", { exact: true }).boundingBox();
  const labelBox = await card.getByText(label, { exact: true }).boundingBox();
  const completeBox = await card.getByRole("button", { name: `Complete ${title}` }).boundingBox();
  const metadata = card.locator('[data-slot="task-metadata"]');
  const metadataBox = await metadata.boundingBox();
  const project = metadata.locator('[data-slot="task-project"]');
  const projectBadge = project.locator('[data-slot="badge"]');
  const projectBox = await project.boundingBox();
  if (
    !scheduleBox ||
    !titleBox ||
    !kindBox ||
    !labelBox ||
    !completeBox ||
    !metadataBox ||
    !projectBox
  ) {
    throw new Error("task row layout is not measurable");
  }
  expect(scheduleBox.x).toBeLessThan(titleBox.x);
  expect(labelBox.y).toBeGreaterThan(titleBox.y);
  expect(labelBox.y).toBeLessThanOrEqual(projectBox.y + 2);
  expect(projectBox.y).toBeLessThanOrEqual(kindBox.y + 2);
  expect(Math.abs(kindBox.height - labelBox.height)).toBeLessThanOrEqual(1);
  expect(completeBox.x).toBeGreaterThan(titleBox.x);
  expect(completeBox.y).toBeLessThan(projectBox.y);
  expect(projectBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
  await expect(projectBadge).toHaveText("Project: E2E Daily Tasks");
  await expect(projectBadge).toHaveClass(/bg-secondary/);
  await expect(metadata).toHaveCSS("flex-wrap", "wrap");
  await expect(metadata).toHaveCSS("justify-content", "flex-end");
  await expect(metadata.locator("li").first()).toHaveText(label);
  await expect(
    card.locator('[data-slot="task-schedule"]').getByText("High", { exact: true }),
  ).toBeVisible();
  expect(Math.abs(kindBox.x + kindBox.width - (metadataBox.x + metadataBox.width))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  if (isPhone) {
    const headerBox = await page.locator("header").boundingBox();
    const headingBox = await page.getByRole("heading", { name: "Today" }).boundingBox();
    const filterBox = await page.getByLabel("Filter by label", { exact: true }).boundingBox();
    const firstCardBox = await page.locator('[data-slot="card"]').first().boundingBox();
    const invalidKind = page.getByText("Invalid: history snapshot still repeats", {
      exact: true,
    });
    const invalidCardBox = await page
      .locator('[data-slot="card"]')
      .filter({ hasText: invalidTitle })
      .boundingBox();
    const invalidKindBox = await invalidKind.boundingBox();
    if (
      !headerBox ||
      !headingBox ||
      !filterBox ||
      !firstCardBox ||
      !invalidCardBox ||
      !invalidKindBox
    ) {
      throw new Error("mobile task list spacing is not measurable");
    }
    expect(headingBox.y - (headerBox.y + headerBox.height)).toBeLessThanOrEqual(20);
    expect(firstCardBox.y - (filterBox.y + filterBox.height)).toBeLessThanOrEqual(20);
    expect(await renderedLineCount(invalidKind)).toBeLessThanOrEqual(2);
    await expectUnclippedLines(invalidKind, 1);
    expect(invalidKindBox.x + invalidKindBox.width).toBeLessThanOrEqual(
      invalidCardBox.x + invalidCardBox.width,
    );
  } else {
    expect(labelBox.x + labelBox.width).toBeLessThan(projectBox.x);
    expect(projectBox.x + projectBox.width).toBeLessThan(kindBox.x);
  }
}

export async function expectTaskPriorityLayout(page: Page, title: string, priority: string) {
  const card = page.locator('[data-slot="card"]').filter({ hasText: title });
  const metadata = card.locator('[data-slot="task-metadata"]');
  const priorityBox = await metadata.getByText(priority, { exact: true }).boundingBox();
  const projectBox = await metadata.locator('[data-slot="task-project"]').boundingBox();
  const kindBox = await metadata.getByText("One-time", { exact: true }).boundingBox();
  if (!priorityBox || !projectBox || !kindBox) {
    throw new Error("task priority metadata layout is not measurable");
  }
  expect(Math.abs(priorityBox.y - projectBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(priorityBox.y - kindBox.y)).toBeLessThanOrEqual(2);
  expect(priorityBox.x + priorityBox.width).toBeLessThan(projectBox.x);
  expect(projectBox.x + projectBox.width).toBeLessThan(kindBox.x);
}

export async function chooseSelectOption(page: Page, label: string, option: string) {
  const trigger = page.getByLabel(label, { exact: true });
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(trigger).toContainText(option);
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

export async function renderedLineCount(locator: Locator) {
  return locator.evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return Math.round(element.getBoundingClientRect().height / lineHeight);
  });
}

export async function expectUnclippedLines(locator: Locator, minimumLines: number) {
  const metrics = await locator.evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      contentLines: Math.round(element.scrollHeight / lineHeight),
    };
  });
  expect(metrics.contentLines).toBeGreaterThanOrEqual(minimumLines);
  expect(metrics.clientHeight).toBeGreaterThanOrEqual(metrics.scrollHeight);
}

export async function expectBrandTimezone(page: Page) {
  const brand = page.getByRole("link", { name: /Better Vikunja/ }).filter({ visible: true });
  const timezone = page
    .getByText(`Timezone ${vikunjaTimezone}`, { exact: true })
    .filter({ visible: true });
  await expect(brand).toHaveAttribute("href", "/today?project=all&page=1");
  await expect(timezone).toBeVisible();
  const brandBox = await brand.boundingBox();
  const timezoneBox = await timezone.boundingBox();
  if (!brandBox || !timezoneBox) throw new Error("brand timezone layout is not measurable");
  expect(timezoneBox.y).toBeGreaterThan(brandBox.y);
}

export async function expectBaseUICSP(page: Page) {
  const nonce = await page.locator('meta[name="csp-nonce"]').getAttribute("content");
  expect(nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  const styleNonces = await page
    .locator("style")
    .evaluateAll((styles) => styles.map((style) => style.getAttribute("nonce")));
  expect(styleNonces.every((styleNonce) => styleNonce === nonce)).toBe(true);
}
