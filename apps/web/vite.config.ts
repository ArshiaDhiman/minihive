import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  envDir: "../..",
  envPrefix: ["COGNITO_", "REPAIRINFO_"],
  // Cognito callback URL is pinned to :5173
  server: { port: 5173, strictPort: true },
});
