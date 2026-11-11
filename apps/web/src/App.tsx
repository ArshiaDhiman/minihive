import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { api } from "./api";
import { CreateLicence } from "./components/CreateLicence";
import { CreateOrganisation } from "./components/CreateOrganisation";
import { OrgAdmin } from "./components/OrgAdmin";
import { formatDate } from "./format";
import { RepairInfo } from "./components/RepairInfo";

type Me = {
  name: string;
  email: string;
  groups: string[];
  memberships: { orgId: string; orgName: string; role: string }[];
  seats: { licenceId: string; productCode: string; orgName: string; validTo: string; active: boolean }[];
};

export function App() {
  const auth = useAuth();

  if (auth.isLoading) return <p>Loading…</p>;
  if (auth.error) return <p>Login error: {auth.error.message}</p>;

  if (!auth.isAuthenticated) {
    return <button onClick={() => auth.signinRedirect()}>Log in</button>;
  }

  // Cognito has no end_session_endpoint, so use its /logout instead
  const logout = async () => {
    await auth.removeUser();
    const params = new URLSearchParams({
      client_id: import.meta.env.COGNITO_CLIENT_ID,
      logout_uri: "http://localhost:5173/",
    });
    window.location.href = `${import.meta.env.COGNITO_DOMAIN}/logout?${params}`;
  };

  return (
    <>
      <p>
        Logged in as {auth.user?.profile.email} <button onClick={logout}>Log out</button>
      </p>
      <MePanel accessToken={auth.user!.access_token} />
    </>
  );
}

function MePanel({ accessToken }: { accessToken: string }) {
  const [me, setMe] = useState<Me>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState("account"); // "account", "orgs", "licences" or an admin org's id

  useEffect(() => {
    api<Me>("/me", accessToken).then(setMe, (err: Error) => setError(err.message));
  }, [accessToken]);

  if (error) return <p>Could not load /me: {error}</p>;
  if (!me) return <p>Loading profile…</p>;

  // Only org admins get a manage tab. It just hides UI: the API still checks every request.
  const adminOrgs = me.memberships.filter((m) => m.role === "org_admin");
  const isPlatformAdmin = me.groups.includes("platform_admin");
  const tabs = [
    { id: "account", label: "My account" },
    ...(isPlatformAdmin
      ? [
          { id: "orgs", label: "Create organisation" },
          { id: "licences", label: "Create licence" },
        ]
      : []),
    ...adminOrgs.map((m) => ({ id: m.orgId, label: `Manage ${m.orgName}` })),
  ];

  return (
    <div className="products">
      <section className="product minihive">
        <header>
          <h2>MiniHive</h2>
          <p className="hint">Licence and seat management</p>
        </header>
        <nav>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={t.id === tab ? "active" : ""}>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "account" && (
          <>
            <h3>{me.name}</h3>
            <p className="hint">Your profile, organisations and seats.</p>
            {me.groups.length > 0 && <p>Platform roles: {me.groups.join(", ")}</p>}

            <h3>Organisations</h3>
            {me.memberships.length === 0 ? (
              <p>None</p>
            ) : (
              <ul>
                {me.memberships.map((m) => (
                  <li key={m.orgId}>
                    {m.orgName} ({m.role})
                  </li>
                ))}
              </ul>
            )}

            <h3>Seats</h3>
            {me.seats.length === 0 ? (
              <p>None</p>
            ) : (
              <ul>
                {me.seats.map((s) => (
                  <li key={s.licenceId}>
                    {s.productCode} at {s.orgName}, {s.active ? "active until" : "expired"}{" "}
                    {formatDate(s.validTo)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "orgs" && <CreateOrganisation accessToken={accessToken} />}
        {tab === "licences" && <CreateLicence accessToken={accessToken} />}

        {adminOrgs
          .filter((m) => m.orgId === tab)
          .map((m) => (
            <div key={m.orgId}>
              <p className="hint">
                Assigning or revoking a seat here tells RepairInfo automatically, through events.
              </p>
              <OrgAdmin orgId={m.orgId} orgName={m.orgName} accessToken={accessToken} />
            </div>
          ))}
      </section>

      <section className="product repairinfo">
        <header>
          <h2>RepairInfo</h2>
          <p className="hint">
            A separate product. It never calls MiniHive: it checks its own access list, which
            MiniHive's events keep up to date. Changes arrive a second or two after a seat change.
          </p>
        </header>
        <RepairInfo accessToken={accessToken} />
      </section>
    </div>
  );
}
