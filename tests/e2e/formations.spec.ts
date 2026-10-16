import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { importProject, type Project } from "@choreoflow/core";

const card = (page: Page, name: string) =>
  page.getByRole("button", {
    name: `Formation auswählen: ${name}`,
    exact: true,
  });
const formationCards = (page: Page) =>
  page.getByRole("button", { name: /^Formation auswählen:/ });
const saved = (page: Page) =>
  expect(page.getByText("Lokal gespeichert", { exact: true })).toBeVisible();
const openPanel = (page: Page) =>
  page.getByRole("button", { name: "Formationen", exact: true }).click();
async function apply(page: Page) {
  await expect(page.getByTestId("formation-preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Änderung anwenden", exact: true })
    .click();
  await expect(page.getByTestId("formation-preview")).toHaveCount(0);
  await saved(page);
}
async function createProject(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Neues Projekt", exact: true })
    .click();
  await page.getByLabel("Projektname", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Projekt erstellen", exact: true })
    .click();
  await expect(page.getByTestId("stage-2d")).toBeVisible();
  await saved(page);
}
async function exportSnapshot(page: Page): Promise<Project> {
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Projektdatei exportieren", exact: true })
    .click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  if (!path) throw new Error("Der Projektdatei-Download fehlt.");
  const snapshot = importProject(await readFile(path, "utf8"));
  await openPanel(page);
  return snapshot;
}

test("Duplizieren fokussiert neue Endformation, Undo/Redo und Reload erhalten die Daten", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createProject(page, "Formationen kopieren");
  await openPanel(page);
  await expect(
    page.getByRole("button", {
      name: "Ausgewählte Formation löschen",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Formation eine Position früher",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Formation eine Position später",
      exact: true,
    }),
  ).toBeDisabled();

  await page
    .getByRole("button", { name: "Formation hinzufügen", exact: true })
    .click();
  await expect(card(page, "Formation 2")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("playback-time")).toContainText("00:08.00");
  await saved(page);
  await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await expect(page.getByTestId("formation-preview")).toContainText(
    "12,00 s → 20,00 s",
  );
  await expect(formationCards(page)).toHaveCount(2);
  await apply(page);
  await expect(card(page, "Formation 2 (Kopie)")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // This exceeds the OLD 12-second duration and catches premature clamping.
  await expect(page.getByTestId("playback-time")).toContainText("00:16.00");
  await expect(page.getByTestId("formation-position")).toHaveText(
    "Position 3 von 3",
  );
  const copied = await exportSnapshot(page);
  expect(copied.formations[2].id).not.toBe(copied.formations[1].id);
  expect(copied.formations[2].positions).toEqual(
    copied.formations[1].positions,
  );
  expect(copied.transitions).toHaveLength(2);

  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(formationCards(page)).toHaveCount(2);
  await expect(card(page, "Formation 2")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await saved(page);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(card(page, "Formation 2 (Kopie)")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("playback-time")).toContainText("00:16.00");
  await saved(page);
  await page.reload();
  await expect(formationCards(page)).toHaveCount(3);
  await card(page, "Formation 2 (Kopie)").click();
  await page.getByRole("button", { name: "Position", exact: true }).click();
  await page.getByLabel("Haltedauer (Sekunden)", { exact: true }).fill("6");
  await page.getByLabel("Haltedauer (Sekunden)", { exact: true }).press("Tab");
  await saved(page);
  const changed = await exportSnapshot(page);
  expect(changed.formations[1].holdSeconds).toBe(4);
  expect(changed.formations[2].holdSeconds).toBe(6);
  expect(changed.formations[2].id).toBe(copied.formations[2].id);
  expect(errors).toEqual([]);
});

test("Umordnen und Löschen bleiben auf kleinem Bildschirm mit stabiler Auswahl bedienbar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Projekt öffnen: Lichtspiel · Showformation",
      exact: true,
    })
    .click();
  await card(page, "Kreis").click();
  await openPanel(page);
  await page
    .getByRole("button", {
      name: "Formation eine Position früher",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("formation-preview")).toContainText(
    "Hebefigur bleibt bei 00:00.00",
  );
  await apply(page);
  await expect(card(page, "Kreis")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("formation-position")).toHaveText(
    "Position 1 von 4",
  );
  await expect(
    page.getByRole("button", {
      name: "Formation eine Position früher",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.getByTestId("playback-time")).toContainText("00:00.00");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.getByTestId("formation-position")).toHaveText(
    "Position 2 von 4",
  );
  await expect(card(page, "Kreis")).toHaveAttribute("aria-pressed", "true");
  await saved(page);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(page.getByTestId("formation-position")).toHaveText(
    "Position 1 von 4",
  );
  await saved(page);
  await page
    .getByRole("button", { name: "Ausgewählte Formation löschen", exact: true })
    .click();
  await apply(page);
  await expect(formationCards(page)).toHaveCount(3);
  await expect(card(page, "Auftakt")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(formationCards(page)).toHaveCount(3);
  await expect(card(page, "Kreis")).toHaveCount(0);
  await openPanel(page);
  const bounds = await page.getByTestId("formations-panel").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  for (const name of [
    "Duplizieren",
    "Formation eine Position früher",
    "Formation eine Position später",
    "Ausgewählte Formation löschen",
  ]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(formationCards(page)).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: /^Formation auswählen:/, pressed: true }),
  ).toHaveCount(1);
  await saved(page);
  const restored = await exportSnapshot(page);
  expect(restored.formations.map((formation) => formation.name)).toEqual([
    "Kreis",
    "Auftakt",
    "Fächer",
    "Finale",
  ]);
});

test("Volle Drehung bleibt im Duplikat erhalten und wird nur nach Vorschau entfernt", async ({
  page,
}) => {
  await createProject(page, "Volle Drehung erhalten");
  await page
    .getByRole("button", { name: "Formation hinzufügen", exact: true })
    .click();
  await saved(page);
  await card(page, "Auftakt").click();
  await page.getByRole("button", { name: "Weg", exact: true }).click();
  await page.getByRole("button", { name: "360° drehen", exact: true }).click();
  await saved(page);
  const original = await exportSnapshot(page);
  const motion = original.transitions[0].motions[0];
  expect(motion.type).toBe("group");

  await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await expect(page.getByTestId("formation-preview")).toContainText(
    "einschließlich voller Drehungen",
  );
  await apply(page);
  const copied = await exportSnapshot(page);
  expect(copied.transitions[1].id).toBe(original.transitions[0].id);
  expect(copied.transitions[1].motions[0]).toEqual(motion);
  await expect(card(page, "Auftakt (Kopie)")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page
    .getByRole("button", { name: "Ausgewählte Formation löschen", exact: true })
    .click();
  await expect(page.getByTestId("formation-preview")).toContainText(
    "1 Gruppenbewegung entfällt.",
  );
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(formationCards(page)).toHaveCount(3);
  expect((await exportSnapshot(page)).transitions[1].motions[0]).toEqual(
    motion,
  );
  await page
    .getByRole("button", { name: "Ausgewählte Formation löschen", exact: true })
    .click();
  await apply(page);
  const removed = await exportSnapshot(page);
  expect(removed.formations).toHaveLength(2);
  expect(removed.transitions[0].motions).toEqual([]);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(card(page, "Auftakt (Kopie)")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await saved(page);
  const undone = await exportSnapshot(page);
  expect(undone.formations).toEqual(copied.formations);
  expect(undone.transitions).toEqual(copied.transitions);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(formationCards(page)).toHaveCount(2);
  await saved(page);
});
