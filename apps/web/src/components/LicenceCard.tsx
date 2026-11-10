import { useState } from "react";
import type { Licence, OrgUser } from "../types";

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
        <strong>{licence.productCode}</strong>: {licence.used}/{licence.seats} seats,{" "}
        {licence.active ? "active" : "expired"} until {new Date(licence.validTo).toLocaleDateString()}
      </p>
      <ul>
        {licence.holders.map((holder) => (
          <li key={holder.userId}>
            {holder.name} <button onClick={() => onRevoke(holder.userId)}>Revoke</button>
          </li>
        ))}
      </ul>
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
    </div>
  );
};
