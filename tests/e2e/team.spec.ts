import { test, expect } from "@playwright/test";
import { installCloudFixture, loginCloudFixture } from "./cloud-fixture";

test("Eigentümer erstellt und widerruft eine Leser-Einladung ohne Mailversand", async ({
  page,
}) => {
  const fixture = await installCloudFixture(page);
  test.skip(
    !(await loginCloudFixture(page)),
    "Build ohne optionale Cloud-Konfiguration",
  );
  await page
    .getByRole("button", { name: "Als Arbeitskopie öffnen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\/project-/);
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name: "Freigaben", exact: true }).click();
  await expect(
    page.getByText("Deine Rolle: Eigentümer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Einladungsrolle Bearbeiten",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByLabel("E-Mail für Einladung", { exact: true })
    .fill("team@example.test");
  await page
    .getByRole("button", { name: "Einladungslink erstellen", exact: true })
    .click();
  await expect(
    page.getByLabel("Neuer Einladungslink", { exact: true }),
  ).toHaveValue(new RegExp(`#invite=${fixture.token}$`));
  await expect(
    page
      .getByText("Einladung erstellt. Es wurde keine E-Mail versendet.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Einladung widerrufen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Änderung bestätigen", exact: true })
    .click();
  await expect(
    page.getByLabel("Neuer Einladungslink", { exact: true }),
  ).toHaveCount(0);
  expect(
    fixture.calls.some((call) => /signup|otp|invite$/.test(call.path)),
  ).toBe(false);
  expect(
    fixture.calls.find((call) =>
      call.path.endsWith("/create_project_invitation"),
    )?.body,
  ).toEqual({
    p_project_id: fixture.cloudId,
    p_email: "team@example.test",
    p_role: "reader",
  });
});

test("Leser-Arbeitskopie bleibt lokal; ein neuerer Teamstand wird nicht überschrieben", async ({
  page,
}) => {
  const fixture = await installCloudFixture(page, { role: "reader" });
  test.skip(
    !(await loginCloudFixture(page)),
    "Build ohne optionale Cloud-Konfiguration",
  );
  await page
    .getByRole("button", { name: "Als Arbeitskopie öffnen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\/project-/);
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name: "Freigaben", exact: true }).click();
  await expect(
    page.getByText("Deine Rolle: Nur lesen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Arbeitskopie im Teamprojekt sichern",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Einladungslink erstellen", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Lokale Projektdatei exportieren",
      exact: true,
    }),
  ).toBeEnabled();
  expect(
    fixture.calls.some(
      (call) =>
        call.path.endsWith("/save_project") ||
        call.path.endsWith("/get_project_team"),
    ),
  ).toBe(false);
});

test("Teamkonflikt erhält Arbeitskopie und wiederholt dieselbe ausstehende Änderung", async ({
  page,
}) => {
  const fixture = await installCloudFixture(page, {
    role: "editor",
    conflict: true,
  });
  test.skip(
    !(await loginCloudFixture(page)),
    "Build ohne optionale Cloud-Konfiguration",
  );
  await page
    .getByRole("button", { name: "Als Arbeitskopie öffnen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\/project-/);
  const localUrl = page.url();
  await page.getByRole("button", { name: "Projektmenü", exact: true }).click();
  await page.getByRole("button", { name: "Freigaben", exact: true }).click();
  const save = page.getByRole("button", {
    name: "Arbeitskopie im Teamprojekt sichern",
    exact: true,
  });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByText(/^Der Cloud-Stand wurde inzwischen geändert/),
  ).toBeVisible();
  await expect(save).toBeEnabled();
  await save.click();
  await expect
    .poll(
      () =>
        fixture.calls.filter((call) => call.path.endsWith("/save_project"))
          .length,
    )
    .toBe(2);
  const saves = fixture.calls.filter((call) =>
    call.path.endsWith("/save_project"),
  );
  expect(saves[0]!.body).toEqual(saves[1]!.body);
  expect(saves[0]!.body.p_base_revision).toBe(5);
  expect((saves[0]!.body.p_snapshot as { id: string }).id).toBe(
    "cloud-original",
  );
  expect(page.url()).toBe(localUrl);
  await expect(
    page.getByRole("button", {
      name: "Lokale Projektdatei exportieren",
      exact: true,
    }),
  ).toBeEnabled();
});

test("Einladungsfragment öffnet Cloud und Team ohne automatischen Beitritt oder URL-Tokenversand", async ({
  page,
}) => {
  const fixture = await installCloudFixture(page),
    urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto(`/#invite=${fixture.token}`);
  await expect(
    page
      .getByText("Im Testkonto anmelden", { exact: true })
      .or(page.getByText("Cloud noch nicht eingerichtet", { exact: true })),
  ).toBeVisible();
  expect(urls.some((url) => url.includes(fixture.token))).toBe(false);
  expect(
    fixture.calls.some((call) =>
      call.path.endsWith("/accept_project_invitation"),
    ),
  ).toBe(false);
});
