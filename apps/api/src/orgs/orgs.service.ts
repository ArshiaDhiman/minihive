import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import pg from "pg";
import type { AuthUser } from "../auth/auth.js";
import { DB } from "../db/db.module.js";
import { inTransaction } from "../db/transaction.js";
import { authorize } from "../permissions/authorize.js";
import type { OrgRole } from "../permissions/policy.js";

export type Org = { id: string; name: string };

export type OrgUser = { id: string; name: string; email: string; role: OrgRole };

export type Licence = {
  id: string;
  productCode: string;
  seats: number;
  used: number;
  validFrom: Date;
  validTo: Date;
  active: boolean;
  holders: { userId: string; name: string }[];
};

export type AuditEntry = {
  id: string;
  tableName: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedAt: Date;
  changedBy: string | null; // user name; null for scripts/seeds
};

export type NewLicence = { productCode: string; seats: number; validFrom: Date; validTo: Date };

@Injectable()
export class OrgsService {
  constructor(@Inject(DB) private readonly db: pg.Pool) {}

  async listOrgs(user: AuthUser): Promise<Org[]> {
    authorize(user, "org:list");

    const { rows } = await this.db.query<Org>("SELECT id, name FROM organisations ORDER BY name");
    return rows;
  }

  async createOrg(user: AuthUser, name: string): Promise<Org> {
    authorize(user, "org:create");

    const { rows } = await this.db.query<Org>(
      "INSERT INTO organisations (name) VALUES ($1) RETURNING id, name",
      [name],
    );
    return rows[0]!;
  }

  async createLicence(user: AuthUser, orgId: string, input: NewLicence): Promise<{ id: string }> {
    authorize(user, "licence:create", orgId);
    await this.assertOrgExists(orgId);

    if (input.validTo <= input.validFrom) {
      throw new BadRequestException("validTo must be after validFrom");
    }

    const { rows } = await inTransaction(this.db, user.id, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO licences (org_id, product_id, seats, valid_from, valid_to)
         SELECT $1, p.id, $3, $4, $5 FROM products p WHERE p.code = $2
         RETURNING id`,
        [orgId, input.productCode, input.seats, input.validFrom, input.validTo],
      ),
    );
    if (!rows[0]) {
      throw new BadRequestException(`Unknown product ${input.productCode}`);
    }
    return rows[0];
  }

  async listUsers(user: AuthUser, orgId: string): Promise<OrgUser[]> {
    authorize(user, "org:users:read", orgId);
    await this.assertOrgExists(orgId);

    const { rows } = await this.db.query<OrgUser>(
      `SELECT u.id, u.name, u.email, m.role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1
       ORDER BY u.name`,
      [orgId],
    );
    return rows;
  }

  async listLicences(user: AuthUser, orgId: string): Promise<Licence[]> {
    authorize(user, "org:licences:read", orgId);
    await this.assertOrgExists(orgId);

    const { rows } = await this.db.query<Licence>(
      `SELECT l.id, p.code AS "productCode", l.seats,
              count(s.id)::int AS used,
              l.valid_from AS "validFrom", l.valid_to AS "validTo",
              (l.valid_from <= now() AND now() < l.valid_to) AS active,
              COALESCE(
                json_agg(json_build_object('userId', u.id, 'name', u.name))
                  FILTER (WHERE u.id IS NOT NULL),
                '[]'
              ) AS holders
       FROM licences l
       JOIN products p ON p.id = l.product_id
       LEFT JOIN seat_assignments s ON s.licence_id = l.id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE l.org_id = $1
       GROUP BY l.id, p.code
       ORDER BY p.code, l.valid_to DESC`,
      [orgId],
    );
    return rows;
  }

  async listAudit(user: AuthUser, orgId: string): Promise<AuditEntry[]> {
    authorize(user, "org:audit:read", orgId);
    await this.assertOrgExists(orgId);

    // audit_log has no org_id column, so find the org through the logged row data.
    // TODO: add an indexed org_id to audit_log; this JSON lookup scans every row.
    // TODO: paginate (e.g. ?before=<changedAt>) instead of a fixed LIMIT.
    const { rows } = await this.db.query<AuditEntry>(
      `SELECT a.id, a.table_name AS "tableName", a.action,
              a.old_data AS "oldData", a.new_data AS "newData", a.changed_at AS "changedAt",
              u.name AS "changedBy"
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.changed_by
       WHERE (a.table_name = 'licences'
              AND (COALESCE(a.new_data, a.old_data)->>'org_id')::uuid = $1)
          OR (a.table_name = 'seat_assignments'
              AND (COALESCE(a.new_data, a.old_data)->>'licence_id')::uuid IN
                  (SELECT id FROM licences WHERE org_id = $1))
       ORDER BY a.changed_at DESC, a.id DESC
       LIMIT 50`,
      [orgId],
    );
    return rows;
  }

  private async assertOrgExists(orgId: string): Promise<void> {
    const { rowCount } = await this.db.query("SELECT 1 FROM organisations WHERE id = $1", [orgId]);
    if (!rowCount) {
      throw new NotFoundException();
    }
  }
}
