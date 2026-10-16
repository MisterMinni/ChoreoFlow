import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  type Download,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  createDemoProject,
  evaluateScene,
  importProject,
  projectDuration,
} from "@choreoflow/core";

const demo = createDemoProject("show");
// Browser and Node Math.sin/cos can differ by one ULP. Compare world values to
// a nanometre while keeping every identifier, field and collection exact.
const comparable = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "number" ? Math.round(item * 1e9) / 1e9 : item,
    ),
  ) as unknown;

async function openExports(page: Page): Promise<void> {
  await page.goto("/");
  await page
    .getByRole("button", { name: `Projekt öffnen: ${demo.name}`, exact: true })
    .click();
  await expect(page.getByTestId("stage-2d")).toBeVisible();
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
}

async function downloadBytes(
  page: Page,
  label: string,
  testInfo: TestInfo,
): Promise<{ download: Download; bytes: Buffer }> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  return { download, bytes: await readFile(file) };
}

test("JSON-Download erhält das vollständige Demo-Projekt und reproduzierbare Bewegungen", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openExports(page);
  const { download, bytes } = await downloadBytes(
    page,
    "Projektdatei exportieren",
    testInfo,
  );
  expect(download.suggestedFilename()).toBe(`${demo.name}.choreoflow.json`);
  expect(bytes.length).toBeGreaterThan(10000);
  expect(bytes.length).toBeLessThan(10 * 1024 * 1024);
  expect(bytes.toString("utf8").trimStart().startsWith("{")).toBe(true);
  const restored = importProject(bytes.toString("utf8"));
  expect(comparable(restored)).toEqual(comparable(demo));
  expect(restored.people).toHaveLength(24);
  expect(restored.formations).toHaveLength(4);
  expect(restored.lifts[0]?.phases).toHaveLength(4);
  expect(projectDuration(restored)).toBe(28);
  for (const time of [0, 1.5, 6, 14, 28])
    expect(comparable(evaluateScene(restored, time))).toEqual(
      comparable(evaluateScene(demo, time)),
    );
  expect(errors).toEqual([]);
});

test("PNG-Download ist ein dekodierbares Bühnenbild mit echten Personenfarben", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openExports(page);
  const { download, bytes } = await downloadBytes(
    page,
    "Formation als PNG",
    testInfo,
  );
  expect(download.suggestedFilename()).toBe(`${demo.name}.png`);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  expect(bytes.readUInt32BE(16)).toBe(1600);
  expect(bytes.readUInt32BE(20)).toBe(1200);
  expect(bytes.subarray(-8, -4).toString("ascii")).toBe("IEND");
  expect(bytes.length).toBeGreaterThan(15000);
  expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
  const pixels = await page.evaluate(
    async ({ source, colors }) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("PNG inspection requires a real Canvas context.");
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const expected = colors.map((color) =>
        [1, 3, 5].map((offset) =>
          parseInt(color.slice(offset, offset + 2), 16),
        ),
      );
      let personPixels = 0,
        opaquePixels = 0;
      for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 255) opaquePixels++;
        if (
          expected.some(
            (color) =>
              color[0] === data[offset] &&
              color[1] === data[offset + 1] &&
              color[2] === data[offset + 2],
          )
        )
          personPixels++;
      }
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        personPixels,
        opaquePixels,
      };
    },
    {
      source: `data:image/png;base64,${bytes.toString("base64")}`,
      colors: [...new Set(demo.people.map((person) => person.color))],
    },
  );
  expect(pixels.width).toBe(1600);
  expect(pixels.height).toBe(1200);
  expect(pixels.opaquePixels).toBe(1600 * 1200);
  expect(pixels.personPixels).toBeGreaterThan(15000);
  expect(errors).toEqual([]);
});

test("PDF-Download enthält fünf echte Seiten mit eingebetteter Schrift", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openExports(page);
  const { download, bytes } = await downloadBytes(
    page,
    "Formationsübersicht als PDF",
    testInfo,
  );
  expect(download.suggestedFilename()).toBe(`${demo.name}.pdf`);
  expect(bytes.length).toBeGreaterThan(20000);
  expect(bytes.length).toBeLessThan(1024 * 1024);
  const document = bytes.toString("latin1");
  expect(document.startsWith("%PDF-")).toBe(true);
  expect(document.trimEnd().endsWith("%%EOF")).toBe(true);
  expect((document.match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(5);
  expect(document).toContain("/FontFile2");
  expect(document).toContain("/Creator (ChoreoFlow)");
  expect(document).not.toContain("/JavaScript");
  expect(errors).toEqual([]);
});
