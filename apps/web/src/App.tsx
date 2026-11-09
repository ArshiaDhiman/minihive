import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { api } from "./api";

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

  useEffect(() => {
    api<Me>("/me", accessToken).then(setMe, (err: Error) => setError(err.message));
  }, [accessToken]);

  if (error) return <p>Could not load /me: {error}</p>;
  if (!me) return <p>Loading profile…</p>;

  return (
    <>
      <h2>{me.name}</h2>
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
              {s.productCode} at {s.orgName}, {s.active ? "active" : "expired"} until{" "}
              {new Date(s.validTo).toLocaleDateString()}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
