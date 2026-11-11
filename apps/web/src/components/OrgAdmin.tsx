import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { formatDateTime } from "../format";
import type { AuditEntry, Licence, OrgUser } from "../types";
import { LicenceCard } from "./LicenceCard";

type Props = { orgId: string; orgName: string; accessToken: string };

// Admin view for one org. Only rendered for org admins; the API enforces it too.
export const OrgAdmin = ({ orgId, orgName, accessToken }: Props) => {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [licences, setLicences] = useState<Licence[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const [u, l, a] = await Promise.all([
      api<OrgUser[]>(`/orgs/${orgId}/users`, accessToken),
      api<Licence[]>(`/orgs/${orgId}/licences`, accessToken),
      api<AuditEntry[]>(`/orgs/${orgId}/audit`, accessToken),
    ]);
    setUsers(u);
    setLicences(l);
    setAudit(a);
  }, [orgId, accessToken]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  // Run a change, then reload so seat counts and the audit log stay current
  const run = async (change: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await change();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const assign = (licenceId: string, userId: string) =>
    run(() => api(`/licences/${licenceId}/seats`, accessToken, { method: "POST", body: { userId } }));

  const revoke = (licenceId: string, userId: string) =>
    run(() => api(`/licences/${licenceId}/seats/${userId}`, accessToken, { method: "DELETE" }));

  const userName = (id: string | undefined) => users.find((u) => u.id === id)?.name ?? "unknown user";

  return (
    <section>
      <h2>{orgName}: admin</h2>
      {error && <p>Error: {error}</p>}

      <h3>Users</h3>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.name} ({u.email}), {u.role}
          </li>
        ))}
      </ul>

      <h3>Licences</h3>
      {licences.map((licence) => (
        <LicenceCard
          key={licence.id}
          licence={licence}
          users={users}
          onAssign={(userId) => assign(licence.id, userId)}
          onRevoke={(userId) => revoke(licence.id, userId)}
        />
      ))}

      <h3>Audit log</h3>
      <ul>
        {audit.map((entry) => (
          <li key={entry.id}>
            {formatDateTime(entry.changedAt)}: {describe(entry, userName)}, by{" "}
            {entry.changedBy ?? "system"}
          </li>
        ))}
      </ul>
    </section>
  );
};

const describe = (entry: AuditEntry, userName: (id: string | undefined) => string): string => {
  const data = entry.newData ?? entry.oldData;
  if (entry.tableName === "seat_assignments") {
    const verb = { INSERT: "assigned to", UPDATE: "updated for", DELETE: "revoked from" }[entry.action];
    return `Seat ${verb} ${userName(data?.user_id)}`;
  }
  const verb = { INSERT: "created", UPDATE: "updated", DELETE: "deleted" }[entry.action];
  return `Licence ${verb}`;
};
