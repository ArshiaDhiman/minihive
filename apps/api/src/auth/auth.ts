import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import pg from "pg";
import { DB } from "../db/db.module.js";
import type { Actor, OrgRole } from "../permissions/policy.js";

// Set on the request by AuthGuard, read with @CurrentUser()
export type AuthUser = Actor & {
  id: string; // users.id
  sub: string; // Cognito sub
  email: string;
  name: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  memberships: { orgId: string; role: OrgRole }[];
};

type AuthRequest = {
  headers: { authorization?: string };
  user?: AuthUser;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (is it in .env?)`);
  }
  return value;
}

// Registered globally in AppModule
@Injectable()
export class AuthGuard implements CanActivate {
  // Checks signature (JWKS, cached), exp, iss, token_use and client_id
  private readonly verifier = CognitoJwtVerifier.create({
    userPoolId: requireEnv("COGNITO_USER_POOL_ID"),
    clientId: requireEnv("COGNITO_CLIENT_ID"),
    tokenUse: "access",
  });

  constructor(@Inject(DB) private readonly db: pg.Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    let payload;
    try {
      payload = await this.verifier.verify(header.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    // Org roles come from the database on every request, so changes apply immediately.
    const { rows } = await this.db.query<UserRow>(
      `SELECT u.id, u.email, u.name,
              COALESCE(
                json_agg(json_build_object('orgId', m.org_id, 'role', m.role))
                  FILTER (WHERE m.org_id IS NOT NULL),
                '[]'
              ) AS memberships
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       WHERE u.idp_sub = $1
       GROUP BY u.id`,
      [payload.sub],
    );
    // Valid token, but no account on our side
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException("Unknown user");
    }

    request.user = {
      ...user,
      sub: payload.sub,
      groups: payload["cognito:groups"] ?? [],
    };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
