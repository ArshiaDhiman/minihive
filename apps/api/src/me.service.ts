import { Inject, Injectable } from "@nestjs/common";
import pg from "pg";
import type { AuthUser } from "./auth.js";
import { DB } from "./db.module.js";

type Membership = { orgId: string; orgName: string; role: "org_admin" | "member" };

type Seat = {
  licenceId: string;
  productCode: string;
  orgName: string;
  validTo: Date;
  active: boolean;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  groups: string[];
  memberships: Membership[];
  seats: Seat[];
};

@Injectable()
export class MeService {
  constructor(@Inject(DB) private readonly db: pg.Pool) {}

  async getMe(user: AuthUser): Promise<Me> {
    const memberships = await this.db.query<Membership>(
      `SELECT o.id AS "orgId", o.name AS "orgName", m.role
       FROM memberships m
       JOIN organisations o ON o.id = m.org_id
       WHERE m.user_id = $1
       ORDER BY o.name`,
      [user.id],
    );

    const seats = await this.db.query<Seat>(
      `SELECT l.id AS "licenceId", p.code AS "productCode", o.name AS "orgName",
              l.valid_to AS "validTo",
              (l.valid_from <= now() AND now() < l.valid_to) AS active
       FROM seat_assignments s
       JOIN licences l      ON l.id = s.licence_id
       JOIN products p      ON p.id = l.product_id
       JOIN organisations o ON o.id = l.org_id
       WHERE s.user_id = $1
       ORDER BY p.code`,
      [user.id],
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      groups: user.groups,
      memberships: memberships.rows,
      seats: seats.rows,
    };
  }
}
