import speedtestPlugin, {
  command as baseCommand,
  routes as baseRoutes,
  slot as baseSlot,
} from "./index.mjs";

const debugModeSetting = {
  key: "debugMode",
  label: "Debug mode",
  type: "toggle",
  default: false,
  description:
    "Show Speedtest debug details for troubleshooting server behavior and measurement output.",
};

const sharedSettingsSchema = [debugModeSetting];

export const slot = {
  ...baseSlot,
  settingsSchema: sharedSettingsSchema,
};

export const command = {
  ...baseCommand,
  settingsSchema: sharedSettingsSchema,
};

export const routes = baseRoutes;

export default {
  ...speedtestPlugin,
  slot,
  command,
  routes,
};
