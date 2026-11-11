// Who can do what. Pure functions so it can be tested

export type OrgRole = "org_admin" | "member";

export type Actor = {
  groups: string[]; // cognito:groups
  memberships: { orgId: string; role: OrgRole }[];
};

export type Action =
  | "org:list"
  | "org:create"
  | "licence:create"
  | "org:users:read"
  | "org:invite"
  | "org:licences:read"
  | "seat:assign"
  | "seat:revoke"
  | "org:audit:read";

type Policy = (actor: Actor, orgId: string | undefined) => boolean;

const isPlatformAdmin: Policy = (actor) =>
  actor.groups.includes("platform_admin");

const isOrgAdmin: Policy = (actor, orgId) =>
  isPlatformAdmin(actor, orgId) ||
  actor.memberships.some((m) => m.orgId === orgId && m.role === "org_admin");

const POLICIES: Record<Action, Policy> = {
  "org:list": isPlatformAdmin,
  "org:create": isPlatformAdmin,
  "licence:create": isPlatformAdmin,
  "org:users:read": isOrgAdmin,
  "org:invite": isOrgAdmin,
  "org:licences:read": isOrgAdmin,
  "seat:assign": isOrgAdmin,
  "seat:revoke": isOrgAdmin,
  "org:audit:read": isOrgAdmin,
};

export function can(actor: Actor, action: Action, orgId?: string): boolean {
  return POLICIES[action](actor, orgId);
}

export function isMemberOf(actor: Actor, orgId: string): boolean {
  return actor.memberships.some((m) => m.orgId === orgId);
}
