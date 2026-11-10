import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { type Action, type Actor, can, isMemberOf } from "./policy.js";

// Throws if the actor isn't allowed. Outsiders get 404, not 403,
// so the API doesn't reveal that another org exists.
export function authorize(actor: Actor, action: Action, orgId?: string): void {
  if (can(actor, action, orgId)) return;

  if (orgId && !isMemberOf(actor, orgId)) {
    throw new NotFoundException();
  }
  throw new ForbiddenException();
}
