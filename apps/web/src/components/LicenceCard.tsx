import { useState } from "react";
import { formatDate } from "../format";
import type { Licence, OrgUser } from "../types";

// Not active means either it hasn't started yet or it has ended
const status = (licence: Licence) => {
  if (licence.active) return `active until ${formatDate(licence.validTo)}`;
  if (new Date(licence.validFrom) > new Date()) return `starts ${formatDate(licence.validFrom)}`;
  return `expired ${formatDate(licence.validTo)}`;
};

type Props = {
  licence: Licence;
  users: OrgUser[];
  onAssign: (userId: string) => void;
  onRevoke: (userId: string) => void;
};

export const LicenceCard = ({ licence, users, onAssign, onRevoke }: Props) => {
  const holderIds = new Set(licence.holders.map((h) => h.userId));
  const candidates = users.filter((u) => !holderIds.has(u.id));
  const [selected, setSelected] = useState("");

  return (
    <div>
      <p>
        <strong>{licence.productCode}</strong>: {licence.used}/{licence.seats} seats, {status(licence)}
      </p>
      <ul>
        {licence.holders.map((holder) => (
          <li key={holder.userId}>
            {holder.name} <button onClick={() => onRevoke(holder.userId)}>Revoke</button>
          </li>
        ))}
      </ul>
      {/* The database enforces both rules too; this just avoids offering a button that can't work */}
      {!licence.active ? (
        <p className="hint">Not active, so no new seats. A platform admin can create a new licence.</p>
      ) : licence.used >= licence.seats ? (
        <p className="hint">No free seats. Revoke one first.</p>
      ) : (
        <>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose a user…</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>{" "}
          <button disabled={!selected} onClick={() => onAssign(selected)}>
            Assign seat
          </button>
        </>
      )}
    </div>
  );
};
