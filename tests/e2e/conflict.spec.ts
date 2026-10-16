import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { createDemoProject, importProject } from "@choreoflow/core";

async function openPanel(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}

test("Zwei Tabs bewahren gespeicherten Stand und exportierbaren Konfliktentwurf", async ({
  page,
  context,
}, testInfo) => {
  const demo = createDemoProject("show");
  await page.goto("/");
  await page
    .getByRole("button", { name: `Projekt öffnen: ${demo.name}`, exact: true })
    .click();
  await expect(page.getByTestId("stage-2d")).toBeVisible();
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.getByTestId("stage-2d")).toBeVisible();

  await openPanel(page, "Projekteinstellungen");
  await page
    .getByLabel("Projektname", { exact: true })
    .fill("Gespeicherte Änderung aus Tab A");
  await page
    .getByRole("button", { name: "Namen speichern", exact: true })
    .click();
  await expect(
    page.getByText("Lokal gespeichert", { exact: true }),
  ).toBeVisible();

  await openPanel(second, "Bühne");
  await second.getByLabel("Breite (m)", { exact: true }).fill("13");
  await second.getByLabel("Breite (m)", { exact: true }).press("Tab");
  await expect(
    second.getByText("Nicht gespeichert", { exact: true }),
  ).toBeVisible();
  await expect(
    second.getByText(
      /Weitere Änderungen sind nach einem Speicherfehler gesperrt/,
    ),
  ).toBeVisible();

  // This independent cast write refreshes listCasts. It must never advance the
  // stale project's observed revision or unlock its editor.
  await openPanel(second, "Besetzung");
  await second
    .getByRole("button", { name: "Hinweis schließen", exact: true })
    .click();
  await second
    .getByRole("button", { name: "Als Besetzung speichern", exact: true })
    .click();
  await expect(
    second.getByText(/Besetzung gespeichert\. Du findest sie unter/),
  ).toBeVisible();
  await openPanel(second, "Bühne");
  await second.getByLabel("Breite (m)", { exact: true }).fill("14");
  await second.getByLabel("Breite (m)", { exact: true }).press("Tab");
  await expect(
    second.getByText("Nicht gespeichert", { exact: true }),
  ).toBeVisible();
  await expect(
    second.getByText(
      /Weitere Änderungen sind nach einem Speicherfehler gesperrt/,
    ),
  ).toBeVisible();

  await openPanel(second, "Export");
  const pendingDownload = second.waitForEvent("download");
  await second
    .getByRole("button", { name: "Projektdatei exportieren", exact: true })
    .click();
  const download = await pendingDownload;
  expect(await download.failure()).toBeNull();
  const path = testInfo.outputPath("unsaved-conflict.choreoflow.json");
  await download.saveAs(path);
  const draft = importProject(await readFile(path, "utf8"));
  expect(draft.name).toBe(demo.name);
  expect(draft.stage.width).toBe(13);
  expect(draft.revision).toBe(demo.revision + 1);

  // Reload only after exporting the unsaved draft. The other tab's committed
  // project is intact, and an explicit reload makes editing possible again.
  await second.reload();
  await expect(
    second.getByText("Lokal gespeichert", { exact: true }),
  ).toBeVisible();
  await expect(
    second.getByText("Gespeicherte Änderung aus Tab A", { exact: true }),
  ).toBeVisible();
  await openPanel(second, "Bühne");
  await expect(second.getByLabel("Breite (m)", { exact: true })).toHaveValue(
    String(demo.stage.width),
  );
  await second.getByLabel("Breite (m)", { exact: true }).fill("15");
  await second.getByLabel("Breite (m)", { exact: true }).press("Tab");
  await expect(
    second.getByText("Lokal gespeichert", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await openPanel(page, "Bühne");
  await expect(page.getByLabel("Breite (m)", { exact: true })).toHaveValue(
    "15",
  );
  await expect(
    page.getByText("Gespeicherte Änderung aus Tab A", { exact: true }),
  ).toBeVisible();
  await second.close();
});
