import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import { App } from "./App";

const userPoolId = import.meta.env.COGNITO_USER_POOL_ID;
const region = userPoolId.split("_")[0]; // eu-west-1_AbC123 -> eu-west-1

const oidcConfig = {
  authority: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  client_id: import.meta.env.COGNITO_CLIENT_ID,
  redirect_uri: "http://localhost:5173/",
  scope: "openid email profile",
  // strip ?code=... from the URL
  onSigninCallback: () => window.history.replaceState({}, document.title, "/"),
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
