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
import { DB } from "./db.module.js";

// Set on the request by AuthGuard, read with @CurrentUser()
export type AuthUser = {
  id: string; // users.id
  sub: string; // Cognito sub
  email: string;
  name: string;
  groups: string[]; // cognito:groups claim
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

    // Valid token, but no account on our side
    const { rows } = await this.db.query<{ id: string; email: string; name: string }>(
      "SELECT id, email, name FROM users WHERE idp_sub = $1",
      [payload.sub],
    );
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException("Unknown user");
    }

    request.user = { ...user, sub: payload.sub, groups: payload["cognito:groups"] ?? [] };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
