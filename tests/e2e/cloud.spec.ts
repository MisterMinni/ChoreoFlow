import { test, expect } from "@playwright/test";
import { createDemoProject } from "../../packages/core/src/index";

test("Freigaben zeigen optionale Anmeldung ohne das lokale Projekt zu wechseln", async ({
  page,
}) => {
  const authRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/auth\/v1\/(signup|token|otp|recover)/.test(request.url()))
      authRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /Projekt öffnen:/ })
    .first()
    .click();
  const editorUrl = page.url();
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name: "Freigaben", exact: true }).click();
  await expect(
    page
      .getByText("Cloud-Testkonto", { exact: true })
      .or(page.getByText("Cloud nicht eingerichtet", { exact: true })),
  ).toBeVisible();
  const configured = await page
    .getByText("Cloud-Testkonto", { exact: true })
    .isVisible();
  if (configured) {
    await expect(page.getByLabel("E-Mail", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Anmelden", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Neues Testkonto erstellen", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Testkonto erstellen", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Ich habe bereits ein Konto", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Lokale Projektdatei exportieren",
        exact: true,
      }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByText("Cloud nicht eingerichtet", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Projektdatei sichern", exact: true }),
    ).toBeVisible();
  }
  expect(page.url()).toBe(editorUrl);
  await expect(page.getByTestId("stage-2d")).toBeVisible();
  expect(authRequests).toEqual([]);
});

test("Ungültiger Freigabelink bleibt readonly und sendet kein Token im URL-Request", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/share#token=invalid-fragment");
  await expect(
    page.getByText("Probenstand nicht verfügbar", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Freigabelink ist unvollständig/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Im Testkonto sichern", exact: true }),
  ).toHaveCount(0);
  expect(requests.some((url) => url.includes("invalid-fragment"))).toBe(false);
  expect(requests.some((url) => /\/rest\/v1\/rpc\/read_share/.test(url))).toBe(
    false,
  );
});

test("Zuschaueransicht spielt einen simulierten Probenstand ab und erlaubt nur Hervorhebung", async ({
  page,
}) => {
  // Synthetic RPC response: this checks the UI, not live Auth or delivery.
  const snapshot = createDemoProject("show");
  snapshot.notes = [];
  snapshot.lifts.forEach((lift) => {
    lift.note = "";
  });
  const token = "1".repeat(64);
  const rpcRequests: { url: string; body: unknown }[] = [];
  await page.route("**/rest/v1/rpc/read_share", async (route) => {
    rpcRequests.push({
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "synthetic-publication",
        source_revision: 7,
        created_at: "2026-10-16T00:00:00Z",
        includes_media: false,
        snapshot,
      }),
    });
  });
  await page.goto(`/share#token=${token}`);
  await expect(
    page
      .getByTestId("stage-2d")
      .or(
        page.getByText(
          "Diese Vorschau ist noch nicht mit der Cloud-Testumgebung verbunden.",
          { exact: true },
        ),
      ),
  ).toBeVisible();
  test.skip(
    await page
      .getByText(
        "Diese Vorschau ist noch nicht mit der Cloud-Testumgebung verbunden.",
        { exact: true },
      )
      .isVisible(),
    "Build ohne optionale Cloud-Konfiguration",
  );
  await expect(page.getByText(snapshot.name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abspielen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Person 4", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hervorhebung aufheben", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Projektmenü", exact: true }),
  ).toHaveCount(0);
  expect(rpcRequests).toHaveLength(1);
  expect(rpcRequests[0]!.url).not.toContain(token);
  expect(rpcRequests[0]!.body).toEqual({ p_token: token });
});
