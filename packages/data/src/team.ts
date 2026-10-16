export type ProjectRole = "owner" | "editor" | "reader";
export type MemberRole = Exclude<ProjectRole, "owner">;
export interface ProjectAccess {
  role: ProjectRole;
  can_edit: boolean;
  owner_id: string;
  owner_has_pro: boolean;
}
export interface TeamMember {
  user_id: string;
  email: string | null;
  role: ProjectRole;
}
export interface TeamInvitation {
  id: string;
  email: string;
  role: MemberRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}
export interface ProjectTeam {
  members: TeamMember[];
  invitations: TeamInvitation[];
}
export interface CreatedInvitation {
  id: string;
  token: string;
  expires_at: string;
}
export interface AuthenticatedRpc {
  authenticatedRpc(
    name: string,
    args: Record<string, unknown>,
    expectedUserId: string,
  ): Promise<unknown>;
}
const roles: ProjectRole[] = ["owner", "editor", "reader"];
const invalidResponse = () =>
  new Error("Die Team-Antwort ist unvollständig. Bitte erneut laden.");
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableDate = (value: unknown) => value === null || date(value);
function requiredId(value: string) {
  if (!value.trim())
    throw new Error(
      "Konto oder Projektkennung fehlt. Bitte erneut anmelden und das Projekt auswählen.",
    );
}
function memberRole(value: MemberRole) {
  if (value !== "reader" && value !== "editor")
    throw new Error("Bitte Lesen oder Bearbeiten auswählen.");
}
export function teamErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const known: [RegExp, string][] = [
    [
      /INVITATION_PENDING/,
      "Für diese E-Mail besteht bereits eine offene Einladung. Widerrufe sie, bevor du eine neue erstellst.",
    ],
    [
      /MEMBER_ALREADY_EXISTS/,
      "Dieses Konto ist bereits Mitglied des Projekts. Ändere seine Rolle in der Mitgliederliste.",
    ],
    [
      /INVITATION_UNAVAILABLE/,
      "Diese Einladung ist abgelaufen, widerrufen oder bereits angenommen. Bitte einen neuen Link anfordern.",
    ],
    [
      /EMAIL_MISMATCH|INVITATION_EMAIL|EMAIL_NOT_CONFIRMED|EMAIL_CONFIRMATION_REQUIRED/,
      "Melde dich mit dem bestätigten Konto der eingeladenen E-Mail-Adresse an.",
    ],
    [
      /PRO_REQUIRED|OWNER_NOT_PRO|OWNER_REQUIRES_PRO/,
      "Bearbeitungsrechte benötigen einen aktiven Pro-Tarif des Projekteigentümers. Lesen bleibt möglich.",
    ],
    [
      /EDITOR_LIMIT|MEMBER_LIMIT|TEAM_LIMIT/,
      "Die vier Bearbeitungsplätze sind bereits vergeben oder durch offene Einladungen reserviert.",
    ],
    [
      /PROJECT_FORBIDDEN|OWNER_REQUIRED|FORBIDDEN|NOT_OWNER/,
      "Nur der Projekteigentümer darf die Teamzugänge verwalten.",
    ],
    [/INVALID_EMAIL/, "Bitte eine gültige E-Mail-Adresse eingeben."],
    [
      /MEMBER_NOT_FOUND/,
      "Dieses Mitglied ist nicht mehr im Projekt. Bitte die Teamliste aktualisieren.",
    ],
    [
      /PROJECT_ARCHIVED/,
      "Dieses Cloud-Projekt ist archiviert. Teamänderungen sind derzeit nicht möglich.",
    ],
    [
      /SELF_INVITATION|INVITE_SELF/,
      "Du bist bereits Eigentümer dieses Projekts und benötigst keine Einladung.",
    ],
  ];
  return known.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

/** No admin Auth client and no email delivery: every RPC stays bound to its caller's account. */
export class TeamService {
  constructor(private readonly service: AuthenticatedRpc) {}
  private async call(
    name: string,
    args: Record<string, unknown>,
    userId: string,
  ) {
    requiredId(userId);
    try {
      return await this.service.authenticatedRpc(name, args, userId);
    } catch (error) {
      throw new Error(teamErrorMessage(error), { cause: error });
    }
  }
  async getAccess(projectId: string, userId: string): Promise<ProjectAccess> {
    requiredId(projectId);
    const value = await this.call(
      "get_project_access",
      { p_project_id: projectId },
      userId,
    );
    if (
      !record(value) ||
      !roles.includes(value.role as ProjectRole) ||
      typeof value.can_edit !== "boolean" ||
      typeof value.owner_id !== "string" ||
      typeof value.owner_has_pro !== "boolean"
    )
      throw invalidResponse();
    return {
      role: value.role as ProjectRole,
      can_edit: value.can_edit,
      owner_id: value.owner_id,
      owner_has_pro: value.owner_has_pro,
    };
  }
  async getTeam(projectId: string, userId: string): Promise<ProjectTeam> {
    requiredId(projectId);
    const value = await this.call(
      "get_project_team",
      { p_project_id: projectId },
      userId,
    );
    if (
      !record(value) ||
      !Array.isArray(value.members) ||
      !Array.isArray(value.invitations)
    )
      throw invalidResponse();
    const members = value.members.map((item: unknown): TeamMember => {
      if (
        !record(item) ||
        typeof item.user_id !== "string" ||
        !(item.email === null || typeof item.email === "string") ||
        !roles.includes(item.role as ProjectRole)
      )
        throw invalidResponse();
      return {
        user_id: item.user_id,
        email: item.email,
        role: item.role as ProjectRole,
      };
    });
    const invitations = value.invitations.map(
      (item: unknown): TeamInvitation => {
        if (
          !record(item) ||
          typeof item.id !== "string" ||
          typeof item.email !== "string" ||
          !["reader", "editor"].includes(String(item.role)) ||
          !date(item.expires_at) ||
          !nullableDate(item.accepted_at) ||
          !nullableDate(item.revoked_at)
        )
          throw invalidResponse();
        return {
          id: item.id,
          email: item.email,
          role: item.role as MemberRole,
          expires_at: item.expires_at,
          accepted_at: item.accepted_at as string | null,
          revoked_at: item.revoked_at as string | null,
        };
      },
    );
    return { members, invitations };
  }
  async invite(
    projectId: string,
    email: string,
    role: MemberRole,
    userId: string,
  ): Promise<CreatedInvitation> {
    requiredId(projectId);
    memberRole(role);
    const normalized = email.trim().toLowerCase();
    if (
      normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    )
      throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.");
    const value = await this.call(
      "create_project_invitation",
      { p_project_id: projectId, p_email: normalized, p_role: role },
      userId,
    );
    if (
      !record(value) ||
      typeof value.id !== "string" ||
      typeof value.token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(value.token) ||
      !date(value.expires_at)
    )
      throw invalidResponse();
    return { id: value.id, token: value.token, expires_at: value.expires_at };
  }
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ project_id: string }> {
    const trimmed = token.trim();
    if (!/^[a-f0-9]{64}$/i.test(trimmed))
      throw new Error("Der Einladungscode ist unvollständig oder ungültig.");
    const value = await this.call(
      "accept_project_invitation",
      { p_token: trimmed },
      userId,
    );
    if (
      !record(value) ||
      typeof value.project_id !== "string" ||
      !value.project_id
    )
      throw invalidResponse();
    return { project_id: value.project_id };
  }
  async revokeInvitation(invitationId: string, userId: string): Promise<void> {
    requiredId(invitationId);
    await this.call(
      "revoke_project_invitation",
      { p_invitation_id: invitationId },
      userId,
    );
  }
  async setMemberRole(
    projectId: string,
    memberId: string,
    role: MemberRole | null,
    userId: string,
  ): Promise<void> {
    requiredId(projectId);
    requiredId(memberId);
    if (role !== null) memberRole(role);
    await this.call(
      "set_project_member",
      { p_project_id: projectId, p_user_id: memberId, p_role: role },
      userId,
    );
  }
}
