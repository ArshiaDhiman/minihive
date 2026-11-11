import { useEffect, useState } from "react";
import { api } from "../api";
import type { Org } from "../types";
import { OrgAdmin } from "./OrgAdmin";

// The seeded products. There's no products endpoint yet.
const PRODUCTS = ["REPAIR_INFO", "SERVICE_BOOK"];

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD for <input type="date">
const inOneYear = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

// Platform admins only. The API checks org:list and licence:create anyway.
export const CreateLicence = ({ accessToken }: { accessToken: string }) => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [licence, setLicence] = useState({
    productCode: PRODUCTS[0],
    seats: 1,
    validFrom: today(),
    validTo: inOneYear(),
  });
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  // Bumped after creating a licence so the org view below reloads
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api<Org[]>("/orgs", accessToken).then(setOrgs, (err: Error) => setError(err.message));
  }, [accessToken]);

  const selectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    // Messages are about the previous org
    setMessage(undefined);
    setError(undefined);
  };

  const create = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      await api(`/orgs/${selectedOrgId}/licences`, accessToken, { method: "POST", body: licence });
      setReloadKey((key) => key + 1);
      setMessage(`Created a ${licence.productCode} licence with ${licence.seats} seat(s)`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const selectedOrg = orgs.find((org) => org.id === selectedOrgId);

  return (
    <>
      <p className="hint">Sell an organisation a licence: a product with a number of seats.</p>

      <select value={selectedOrgId} onChange={(e) => selectOrg(e.target.value)}>
        <option value="">Choose an organisation…</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>

      {error && <p>Error: {error}</p>}
      {message && <p>{message}</p>}

      {selectedOrg && (
        <>
          <h3>New licence for {selectedOrg.name}</h3>
          <p>
            <label>
              Product{" "}
              <select
                value={licence.productCode}
                onChange={(e) => setLicence({ ...licence, productCode: e.target.value })}
              >
                {PRODUCTS.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>{" "}
            <label>
              Seats{" "}
              <input
                type="number"
                min={1}
                value={licence.seats}
                onChange={(e) => setLicence({ ...licence, seats: Number(e.target.value) })}
              />
            </label>
          </p>
          <p>
            <label>
              Valid from{" "}
              <input
                type="date"
                value={licence.validFrom}
                onChange={(e) => setLicence({ ...licence, validFrom: e.target.value })}
              />
            </label>{" "}
            <label>
              Valid to{" "}
              <input
                type="date"
                value={licence.validTo}
                onChange={(e) => setLicence({ ...licence, validTo: e.target.value })}
              />
            </label>
          </p>
          <button onClick={create}>Create licence</button>

          {/* Platform admins can manage any org, so reuse the org admin view */}
          <OrgAdmin
            key={`${selectedOrg.id}-${reloadKey}`}
            orgId={selectedOrg.id}
            orgName={selectedOrg.name}
            accessToken={accessToken}
          />
        </>
      )}
    </>
  );
};
