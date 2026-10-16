import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TeamService,
  teamErrorMessage,
  type AuthenticatedRpc,
} from "../src/team";

const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const expiry = "2026-10-23T12:00:00.000Z";
const token = "a".repeat(64);
function harness(responses: Record<string, unknown>) {
  const calls: {
    name: string;
    args: Record<string, unknown>;
    expectedUserId: string;
  }[] = [];
  const client: AuthenticatedRpc = {
    async authenticatedRpc(name, args, expectedUserId) {
      calls.push({ name, args, expectedUserId });
      const response = responses[name];
      if (response instanceof Error) throw response;
      return response;
    },
  };
  return { team: new TeamService(client), calls };
}

test("team calls all pin the expected account and invite does not use any mail API", async () => {
  const { team, calls } = harness({
    get_project_access: {
      role: "owner",
      can_edit: true,
      owner_id: userId,
      owner_has_pro: false,
    },
    get_project_team: {
      members: [
        { user_id: userId, email: "owner@example.test", role: "owner" },
      ],
      invitations: [],
    },
    create_project_invitation: { id: "invitation", token, expires_at: expiry },
    accept_project_invitation: { project_id: projectId },
  });
  assert.equal((await team.getAccess(projectId, userId)).can_edit, true);
  assert.equal(
    (await team.getTeam(projectId, userId)).members[0]!.role,
    "owner",
  );
  assert.equal(
    (await team.invite(projectId, "  Dancer@Example.test  ", "reader", userId))
      .token,
    token,
  );
  assert.deepEqual(await team.acceptInvitation(` ${token} `, userId), {
    project_id: projectId,
  });
  await team.setMemberRole(projectId, "member", "reader", userId);
  await team.setMemberRole(projectId, "member", null, userId);
  await team.revokeInvitation("invitation", userId);
  assert.ok(calls.every((call) => call.expectedUserId === userId));
  assert.deepEqual(calls[2]!.args, {
    p_project_id: projectId,
    p_email: "dancer@example.test",
    p_role: "reader",
  });
  assert.deepEqual(calls[3]!.args, { p_token: token });
  assert.deepEqual(calls[5]!.args, {
    p_project_id: projectId,
    p_user_id: "member",
    p_role: null,
  });
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "get_project_access",
      "get_project_team",
      "create_project_invitation",
      "accept_project_invitation",
      "set_project_member",
      "set_project_member",
      "revoke_project_invitation",
    ],
  );
});

test("invalid invitation input or missing account causes no network request", async () => {
  const { team, calls } = harness({});
  await assert.rejects(
    team.invite(projectId, "not an email", "reader", userId),
    /E-Mail/,
  );
  await assert.rejects(
    team.invite(projectId, "a@example.test", "owner" as "reader", userId),
    /Lesen/,
  );
  await assert.rejects(
    team.acceptInvitation("short-token", userId),
    /Einladungscode/,
  );
  await assert.rejects(team.getAccess(projectId, ""), /Konto/);
  assert.equal(calls.length, 0);
});

test("malformed role and invitation responses are never accepted as authorization", async () => {
  const { team } = harness({
    get_project_access: {
      role: "admin",
      can_edit: "true",
      owner_id: userId,
      owner_has_pro: true,
    },
    get_project_team: {
      members: [],
      invitations: [
        {
          id: "bad",
          email: "a@example.test",
          role: "owner",
          expires_at: expiry,
          accepted_at: null,
          revoked_at: null,
        },
      ],
    },
    create_project_invitation: {
      id: "bad",
      token: "unexpected",
      expires_at: expiry,
    },
  });
  await assert.rejects(team.getAccess(projectId, userId), /unvollständig/);
  await assert.rejects(team.getTeam(projectId, userId), /unvollständig/);
  await assert.rejects(
    team.invite(projectId, "a@example.test", "reader", userId),
    /unvollständig/,
  );
});

test("server quota and invitation failures have meaningful messages without losing account errors", async () => {
  const { team } = harness({
    create_project_invitation: new Error("OWNER_NOT_PRO"),
  });
  await assert.rejects(
    team.invite(projectId, "a@example.test", "editor", userId),
    /aktiven Pro-Tarif/,
  );
  assert.match(teamErrorMessage(new Error("EDITOR_LIMIT")), /vier/);
  assert.match(
    teamErrorMessage(new Error("INVITATION_UNAVAILABLE")),
    /bereits angenommen/,
  );
  assert.match(
    teamErrorMessage(new Error("INVITATION_PENDING")),
    /offene Einladung/,
  );
  assert.match(
    teamErrorMessage(new Error("Das Konto wurde gewechselt.")),
    /Konto wurde gewechselt/,
  );
});
