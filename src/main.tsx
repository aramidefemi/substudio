import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { applyKeyBindings } from "@/app/commands/bindings";
import { registerCommands } from "@/app/commands/definitions";
import { initRuleProfile } from "@/app/ruleProfiles";
import { startAppearanceSync } from "@/features/settings/appearance";
import { loadSettings, useSettings } from "@/features/settings/store";
import "./index.css";

registerCommands();

// Apply saved theme and density before the first paint to avoid a flash.
void loadSettings().then(() => {
  applyKeyBindings(useSettings.getState().shortcutOverrides);
  startAppearanceSync();
  initRuleProfile();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
