import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Org } from "../types";

// Platform admins only. The API checks org:list and org:create anyway.
export const CreateOrganisation = ({ accessToken }: { accessToken: string }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const loadOrgs = useCallback(
    () => api<Org[]>("/orgs", accessToken).then(setOrgs),
    [accessToken],
  );

  useEffect(() => {
    loadOrgs().catch((err: Error) => setError(err.message));
  }, [loadOrgs]);

  const create = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      const org = await api<Org>("/orgs", accessToken, { method: "POST", body: { name } });
      setName("");
      await loadOrgs();
      setMessage(`Created ${org.name}. Give it a licence in the Create licence tab.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <p className="hint">Organisations are the customers, e.g. a garage.</p>
      {error && <p>Error: {error}</p>}
      {message && <p>{message}</p>}

      <h3>New organisation</h3>
      <input placeholder="e.g. Garage C" value={name} onChange={(e) => setName(e.target.value)} />{" "}
      <button disabled={!name.trim()} onClick={create}>
        Create organisation
      </button>

      <h3>All organisations</h3>
      <ul>
        {orgs.map((org) => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </>
  );
};
