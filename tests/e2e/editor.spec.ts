import { test, expect } from "@playwright/test";
test("Projekt erstellen, bearbeiten, rückgängig und nach Reload wiederherstellen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Deine Projekte", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Neues Projekt", exact: true })
    .click();
  await page.getByLabel("Projektname", { exact: true }).fill("E2E Probentanz");
  await page.getByLabel("Anzahl Personen (1–100)").fill("8");
  await page
    .getByRole("button", { name: "Projekt erstellen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByTestId("stage-2d")).toBeVisible();
  await expect(
    page.getByText("Lokal gespeichert", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Person 1", exact: true }).click();
  const originalX = await page
    .getByLabel("Position X (m)", { exact: true })
    .inputValue();
  await page.getByLabel("Position X (m)", { exact: true }).fill("-2.5");
  await page.getByLabel("Position X (m)", { exact: true }).press("Tab");
  await expect(
    page.getByText("Lokal gespeichert", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.getByLabel("Position X (m)", { exact: true })).toHaveValue(
    originalX,
  );
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(page.getByLabel("Position X (m)", { exact: true })).toHaveValue(
    "-2.5",
  );
  await page
    .getByRole("button", { name: "Formation hinzufügen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Formation auswählen: Formation 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Anordnen", exact: true }).click();
  await page.getByRole("button", { name: "Kreis", exact: true }).click();
  await expect(
    page.getByText("Lokal gespeichert", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Formation auswählen: Formation 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Wiederholen", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await page.getByRole("button", { name: "Abspielen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
});
test("3D rendert echte WebGL-Szene ohne Seitenfehler", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: /Projekt öffnen:/ })
    .first()
    .click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/editor-3d.png" });
  await page.getByRole("button", { name: "Publikum", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(errors).toEqual([]);
});
test("Kleiner Bildschirm und dunkles Design bleiben bedienbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByRole("button", { name: "Dunkel", exact: true }).click();
  await page.getByRole("button", { name: "Projekte", exact: true }).click();
  await page
    .getByRole("button", { name: /Projekt öffnen:/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Abspielen", exact: true }),
  ).toBeVisible();
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
});
