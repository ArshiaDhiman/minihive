import { useEffect, useState } from "react";

type Access = { licenceId: string; grantedAt: string; content: string };

// RepairInfo is a separate product, so this calls its API, not MiniHive's.
// Access changes arrive through events, so it can lag a second or two behind a seat change.
export const RepairInfo = ({ accessToken }: { accessToken: string }) => {
  const [access, setAccess] = useState<Access>();
  const [error, setError] = useState<string>();

  const load = async () => {
    setAccess(undefined);
    setError(undefined);
    try {
      const response = await fetch(import.meta.env.REPAIRINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await response.json();
      if (response.ok) setAccess(body);
      else setError(body.message);
    } catch {
      setError("Could not reach RepairInfo");
    }
  };

  useEffect(() => {
    load();
  }, [accessToken]);

  return (
    <>
      <button onClick={load}>Check my access</button>
      {error && <p>No access: {error}</p>}
      {access && (
        <>
          <p>Access granted {new Date(access.grantedAt).toLocaleString()}</p>
          <p>{access.content}</p>
        </>
      )}
    </>
  );
};
