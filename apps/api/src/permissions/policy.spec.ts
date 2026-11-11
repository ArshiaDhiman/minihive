import { type Action, type Actor, can } from "./policy.js";

const GARAGE_A = "org-a";
const GARAGE_B = "org-b";

const alice: Actor = { groups: ["platform_admin"], memberships: [] };
const bob: Actor = { groups: [], memberships: [{ orgId: GARAGE_A, role: "org_admin" }] };
const carol: Actor = { groups: [], memberships: [{ orgId: GARAGE_A, role: "member" }] };
const erin: Actor = { groups: [], memberships: [{ orgId: GARAGE_B, role: "org_admin" }] };

const ORG_ADMIN_ACTIONS: Action[] = [
  "org:users:read",
  "org:invite",
  "org:licences:read",
  "seat:assign",
  "seat:revoke",
  "org:audit:read",
];

describe("platform-only actions", () => {
  test.each([
    ["alice (platform_admin)", alice, true],
    ["bob (org_admin)", bob, false],
    ["carol (member)", carol, false],
  ])("org:list / org:create / licence:create: %s → %s", (_name, actor, expected) => {
    expect(can(actor, "org:list")).toBe(expected);
    expect(can(actor, "org:create")).toBe(expected);
    expect(can(actor, "licence:create", GARAGE_A)).toBe(expected);
  });
});

describe.each(ORG_ADMIN_ACTIONS)("%s on Garage A", (action) => {
  test.each([
    ["alice (platform_admin)", alice, true],
    ["bob (org_admin, same org)", bob, true],
    ["carol (member, same org)", carol, false],
    ["erin (org_admin, other org)", erin, false],
  ])("%s → %s", (_name, actor, expected) => {
    expect(can(actor, action, GARAGE_A)).toBe(expected);
  });
});

test("org-scoped actions without an org are denied", () => {
  expect(can(bob, "org:users:read")).toBe(false);
});
