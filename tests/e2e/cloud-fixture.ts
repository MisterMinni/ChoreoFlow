import { expect, type Page } from "@playwright/test";
import { createDemoProject } from "../../packages/core/src/index";

export function generatedCloudWav(): Buffer {
  const rate = 22050,
    samples = rate * 2,
    b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 2000),
      44 + i * 2,
    );
  return b;
}
export async function installCloudFixture(
  page: Page,
  options: {
    role?: "owner" | "reader" | "editor";
    audio?: boolean;
    truncated?: boolean;
    conflict?: boolean;
  } = {},
) {
  const userId = "11111111-1111-4111-8111-111111111111",
    ownerId =
      options.role && options.role !== "owner"
        ? "22222222-2222-4222-8222-222222222222"
        : userId;
  const cloudId = "33333333-3333-4333-8333-333333333333",
    token = "a".repeat(64),
    bytes = generatedCloudWav();
  const snapshot = createDemoProject("line");
  snapshot.id = "cloud-original";
  snapshot.name = "Synthetisches Teamprojekt";
  if (options.audio) {
    snapshot.audio = {
      assets: [
        {
          id: "audio-test",
          name: "cloud-test.wav",
          mimeType: "audio/wav",
          sizeBytes: bytes.length,
          durationSeconds: 2,
        },
      ],
      clips: [
        {
          id: "clip-test",
          assetId: "audio-test",
          startSeconds: 0,
          trimStartSeconds: 0,
          trimEndSeconds: 2,
          fadeInSeconds: 0,
          fadeOutSeconds: 0,
          volume: 1,
        },
      ],
    };
  }
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "trainer@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  };
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated" })).toString("base64url")}.test`;
  const calls: {
    path: string;
    body: Record<string, unknown>;
    authorization?: string;
  }[] = [];
  let invitations: {
    id: string;
    email: string;
    role: string;
    expires_at: string;
    accepted_at: null;
    revoked_at: string | null;
  }[] = [];
  await page.route("https://**.supabase.co/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const body =
      request.headers()["content-type"]?.includes("application/json") &&
      request.postData()
        ? (request.postDataJSON() as Record<string, unknown>)
        : {};
    calls.push({ path, body, authorization: request.headers().authorization });
    const send = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/auth/v1/token")
      return send({
        access_token: jwt,
        refresh_token: "synthetic-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    if (path === "/auth/v1/user") return send(user);
    if (path === "/auth/v1/logout") return send({});
    const row = {
      id: cloudId,
      owner_id: ownerId,
      title: snapshot.name,
      snapshot,
      revision: 5,
      archived_at: null,
    };
    if (path === "/rest/v1/projects")
      return send(
        request.headers().accept?.includes("vnd.pgrst.object") ? row : [row],
      );
    if (path.endsWith("/get_project_access"))
      return send({
        role: options.role ?? "owner",
        can_edit: options.role !== "reader",
        owner_id: ownerId,
        owner_has_pro: options.role === "editor",
      });
    if (path.endsWith("/get_project_team"))
      return send({
        members: [
          { user_id: ownerId, email: "trainer@example.test", role: "owner" },
        ],
        invitations,
      });
    if (path.endsWith("/create_project_invitation")) {
      invitations = [
        {
          id: "44444444-4444-4444-8444-444444444444",
          email: String(body.p_email),
          role: String(body.p_role),
          expires_at: new Date(Date.now() + 604800000).toISOString(),
          accepted_at: null,
          revoked_at: null,
        },
      ];
      return send({
        id: invitations[0]!.id,
        token,
        expires_at: invitations[0]!.expires_at,
      });
    }
    if (path.endsWith("/revoke_project_invitation")) {
      invitations = invitations.map((i) => ({
        ...i,
        revoked_at: new Date().toISOString(),
      }));
      return send(null);
    }
    if (path.endsWith("/accept_project_invitation"))
      return send({ project_id: cloudId });
    if (path.endsWith("/save_project"))
      return options.conflict
        ? send({ code: "40001", message: "REVISION_CONFLICT" }, 409)
        : send({ project_id: cloudId, revision: 6 });
    if (path.startsWith("/storage/v1/object/project-media/"))
      return request.method() === "GET"
        ? route.fulfill({
            status: 200,
            contentType: "audio/wav",
            body: options.truncated ? bytes.subarray(0, 20) : bytes,
          })
        : send({ Key: "synthetic" });
    return send({ message: `Unexpected synthetic endpoint: ${path}` }, 400);
  });
  return { calls, snapshot, userId, ownerId, cloudId, token, bytes };
}
export async function loginCloudFixture(page: Page): Promise<boolean> {
  await page.goto("/");
  await page.getByRole("button", { name: "Cloud & Team", exact: true }).click();
  if (
    await page
      .getByText("Cloud noch nicht eingerichtet", { exact: true })
      .isVisible()
  )
    return false;
  await page
    .getByLabel("Cloud E-Mail", { exact: true })
    .fill("trainer@example.test");
  await page
    .getByLabel("Cloud Passwort", { exact: true })
    .fill("synthetic-test-password");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cloud-Projekte laden", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cloud-Projekte laden", exact: true })
    .click();
  await expect(
    page.getByText("Synthetisches Teamprojekt", { exact: true }),
  ).toBeVisible();
  return true;
}
