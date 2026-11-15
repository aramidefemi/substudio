import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { registerCommands } from "@/app/commands/definitions";
import { initRuleProfile } from "@/app/ruleProfiles";
import { startAppearanceSync } from "@/features/settings/appearance";
import { loadSettings } from "@/features/settings/store";
import "./index.css";

registerCommands();

// Apply saved theme and density before the first paint to avoid a flash.
void loadSettings().then(() => {
  startAppearanceSync();
  initRuleProfile();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
