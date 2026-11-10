import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import pg from "pg";
import type { AuthUser } from "../auth/auth.js";
import { DB } from "../db/db.module.js";
import { inTransaction } from "../db/transaction.js";
import { authorize } from "../permissions/authorize.js";

@Injectable()
export class SeatsService {
  constructor(@Inject(DB) private readonly db: pg.Pool) {}

  async assign(user: AuthUser, licenceId: string, userId: string): Promise<{ seatId: string }> {
    const orgId = await this.licenceOrgId(licenceId);
    authorize(user, "seat:assign", orgId);

    try {
      const { rows } = await inTransaction(this.db, user.id, (client) =>
        client.query<{ seat_id: string }>("SELECT assign_seat($1, $2, $3) AS seat_id", [
          licenceId,
          userId,
          user.id,
        ]),
      );
      return { seatId: rows[0]!.seat_id };
    } catch (err) {
      // RAISE EXCEPTION in assign_seat → P0001, message is the rule that failed
      if (err instanceof pg.DatabaseError && err.code === "P0001") {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  async revoke(user: AuthUser, licenceId: string, userId: string): Promise<void> {
    const orgId = await this.licenceOrgId(licenceId);
    authorize(user, "seat:revoke", orgId);

    const { rows } = await inTransaction(this.db, user.id, (client) =>
      client.query<{ revoked: boolean }>("SELECT revoke_seat($1, $2) AS revoked", [
        licenceId,
        userId,
      ]),
    );
    if (!rows[0]!.revoked) {
      throw new NotFoundException("No seat to revoke");
    }
  }

  // Unknown licence → 404. Licences in other orgs also end up as 404, via authorize().
  private async licenceOrgId(licenceId: string): Promise<string> {
    const { rows } = await this.db.query<{ org_id: string }>(
      "SELECT org_id FROM licences WHERE id = $1",
      [licenceId],
    );
    if (!rows[0]) {
      throw new NotFoundException();
    }
    return rows[0].org_id;
  }
}
